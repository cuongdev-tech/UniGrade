// ViewModel: toàn bộ state, hiệu ứng và xử lý nghiệp vụ của UniGrade.
// Được tách nguyên văn từ App.js (bước 4 MVVM) — không đổi logic hay giao diện.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PanResponder, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  createCourseRecord,
  createReminderRecord,
  createSemesterRecord,
  createUserProfile,
  deleteCourseAndReminders,
  ensureSemesterRecord,
  loadUserWorkspace,
  acknowledgeReminderRecord,
  updateReminderAlarmRecord,
  confirmSemesterRecord,
  updateCourseRecords,
  updateUserProfileRecord,
  upsertForecastRecord,
} from '../repositories/firebaseRepository';
import { getFirebaseServices } from '../firebase';
import {
  parseGradeValue,
  parseDecimalValue,
  parseCourseCredits,
  parseTargetGpa,
  roundGradeTotal,
  getCourseWeightTotal,
  isGradeValueInvalid,
  getGradeLetter,
  calcCourseTotal,
  clearZeroWeightGrades,
  getRankByGPA,
  calcSemesterStats,
  hasFinalSemesterGpa,
} from '../services/gradeService';
import {
  readGradeImportRows,
  parseGradeSheet,
  applyImportedGrades,
  getImportedSubjectIds,
  buildGradeFormula,
  buildCourseFromImportRow,
  buildSemesterId,
  parseSemesterLabel,
  IMPORT_REQUIRED_COLUMNS_MESSAGE,
} from '../services/gradeImportService';
import {
  getReminderAvailability,
  getRemindersToDelete,
  getNewReminderError,
  getReminderAlarmError,
  getReminderAlarmStatus,
  parseDateTimeInput,
  getSnoozeAlarm,
  findAlarmToAutoShow,
  isReminderBeforeToday,
} from '../services/reminderService';
import {
  getAddCoursePreview,
  getCourseImportBlocker,
  getCpaCourses,
} from '../services/retakeService';
import { getRemainingFinalWeight, getWhatIfForecast } from '../services/forecastService';
import {
  EMAIL_ALREADY_EXISTS_MESSAGE,
  MIN_PASSWORD_LENGTH,
  getFirebaseErrorMessage,
  getSemesterOptionLabel,
  getTargetGradeOption,
  isValidEmail,
} from '../constants/config';
import {
  compareSemesters,
  getSemesterDisplayStatus,
  canConfirmSemester,
} from '../models/semesterModel';

const REMEMBERED_LOGIN_EMAIL_KEY = 'unigrade.remembered-login-email';

export function useUniGradeViewModel() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [operationError, setOperationError] = useState('');
  const pendingAuthSetup = useRef(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberPassword, setRememberPassword] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmRegisterPassword, setConfirmRegisterPassword] = useState('');
  const [registerCredits, setRegisterCredits] = useState('');
  const [registerSemesters, setRegisterSemesters] = useState('');
  const [registerTargetGpa, setRegisterTargetGpa] = useState('3.2');
  const registerProgramCredits = parseDecimalValue(registerCredits);
  const registerProgramSemesters = parseDecimalValue(registerSemesters);
  const registerGpa = parseTargetGpa(registerTargetGpa);
  const isRegisterProgramValid =
    Number.isSafeInteger(registerProgramCredits) && registerProgramCredits >= 1 &&
    Number.isSafeInteger(registerProgramSemesters) && registerProgramSemesters >= 1 &&
    registerGpa !== null;
  const [isRegisterConfirmationVisible, setIsRegisterConfirmationVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const persistRememberedEmail = async (email, shouldRemember) => {
    try {
      if (shouldRemember && email.trim()) {
        await AsyncStorage.setItem(REMEMBERED_LOGIN_EMAIL_KEY, email.trim());
      } else if (!shouldRemember) {
        await AsyncStorage.removeItem(REMEMBERED_LOGIN_EMAIL_KEY);
      }
    } catch {
      setAuthNotice('Không thể lưu email ghi nhớ trên thiết bị.');
    }
  };

  const updateRememberPassword = (nextValue) => {
    const shouldRemember = typeof nextValue === 'function'
      ? nextValue(rememberPassword)
      : Boolean(nextValue);
    setRememberPassword(shouldRemember);
    void persistRememberedEmail(loginEmail, shouldRemember);
  };

  useEffect(() => {
    if (authError !== EMAIL_ALREADY_EXISTS_MESSAGE) return undefined;
    const timeoutId = setTimeout(() => setAuthError(''), 5000);
    return () => clearTimeout(timeoutId);
  }, [authError]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(REMEMBERED_LOGIN_EMAIL_KEY)
      .then((email) => {
        if (!active || !email) return;
        setLoginEmail(email);
        setRememberPassword(true);
      })
      .catch(() => {
        if (active) setAuthNotice('Không thể đọc email đã ghi nhớ trên thiết bị.');
      });
    return () => {
      active = false;
    };
  }, []);

  // Khay chỉ mở khi đã chọn được một báo thức đến giờ.
  const [shadeReminderId, setShadeReminderId] = useState('');
  const [hasDueAlarm, setHasDueAlarm] = useState(false);
  const [shadeReminderError, setShadeReminderError] = useState('');
  const shadeReminderIdRef = useRef('');
  const autoShownAlarmKeys = useRef(new Set());
  const isShadeOpen = Boolean(shadeReminderId);
  const closeShade = useCallback(() => {
    shadeReminderIdRef.current = '';
    setShadeReminderId('');
    setShadeReminderError('');
  }, []);
  const showAlarm = useCallback((reminder) => {
    autoShownAlarmKeys.current.add(`${reminder.id}|${reminder.alarmDate}|${reminder.alarmTime}`);
    shadeReminderIdRef.current = reminder.id;
    setShadeReminderId(reminder.id);
    setShadeReminderError('');
  }, []);

  // State bộ lọc tĩnh trên Màn 3 & Màn 6
  const [semesterYearQuery, setSemesterYearQuery] = useState('');
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('all'); // all | hk1 | hk2
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');     // all | passed | pending
  const [gradeImportMessage, setGradeImportMessage] = useState('');
  const [gradeImportMessageType, setGradeImportMessageType] = useState('success');
  const gradeImportMessageTimer = useRef(null);
  const [courseActionNotice, setCourseActionNotice] = useState(null);
  const courseActionNoticeTimer = useRef(null);
  const [semesters, setSemesters] = useState([]);
  const [newSemesterName, setNewSemesterName] = useState('');
  const [newSemesterYear, setNewSemesterYear] = useState('');
  const [semesterFormError, setSemesterFormError] = useState('');
  const [isSemesterFilterExpanded, setIsSemesterFilterExpanded] = useState(false);
  const [semesterFilterButtonWidth, setSemesterFilterButtonWidth] = useState(0);
  const [selectedSemesterId, setSelectedSemesterId] = useState('hk1'); // Học kỳ đang xem ở Màn 5
  const orderedSemesters = [...semesters].sort(compareSemesters);

  // State cho Dropdown chọn môn ở Màn hình 9 (Dự báo Điểm What-if)
  const [isWhatIfDropdownOpen, setIsWhatIfDropdownOpen] = useState(false);
  const [isTargetGradeDropdownOpen, setIsTargetGradeDropdownOpen] = useState(false);
  const [selectedWhatIfIndex, setSelectedWhatIfIndex] = useState(0);
  const [selectedTargetGrade, setSelectedTargetGrade] = useState('A+'); // A+ (9.0) | A (8.5) | B+ (8.0) | B (7.0)
  const [isAddCourseSemesterOpen, setIsAddCourseSemesterOpen] = useState(false);
  const [selectedAddCourseSemester, setSelectedAddCourseSemester] = useState('');
  const [addCourseName, setAddCourseName] = useState('');
  const [addCourseCredits, setAddCourseCredits] = useState('');
  const [addCourseError, setAddCourseError] = useState('');
  const courseSemesterOptions = orderedSemesters.map(getSemesterOptionLabel);

  // State trọng số thành phần (%) cho Màn 7 (Thêm) và Màn 8 (Sửa)
  const [addCourseWeights, setAddCourseWeights] = useState({ cc: '10', gk: '30', ck: '60' });
  const [editCourseWeights, setEditCourseWeights] = useState({ cc: '10', gk: '30', ck: '60' });
  const addWeightTotal = getCourseWeightTotal(addCourseWeights);
  const editWeightTotal = getCourseWeightTotal(editCourseWeights);

  // State danh sách môn + môn đang sửa ở Màn 8 (UI state, chưa có backend)
  const [subjects, setSubjects] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('s2');
  const [editCourseName, setEditCourseName] = useState('Lập trình Di động');
  const [editCourseCredits, setEditCourseCredits] = useState('3');
  const [editCourseGrades, setEditCourseGrades] = useState({ cc: '9.0', gk: '8.5', ck: '9.0' });
  const [isDeleteCourseDialogVisible, setIsDeleteCourseDialogVisible] = useState(false);
  const [isConfirmSemesterDialogVisible, setIsConfirmSemesterDialogVisible] = useState(false);
  const [isConfirmingSemester, setIsConfirmingSemester] = useState(false);

  // Nhận biết học lại ngay khi gõ tên ở Màn 7: môn đã trượt thì cho thêm lại,
  // môn đã đạt hoặc đang học thì chặn (đồng bộ với COURSES.is_passed của ERD).
  const selectedAddCourseSemesterRecord = semesters.find(
    (item) => getSemesterOptionLabel(item) === selectedAddCourseSemester
  );
  const addCoursePreview = getAddCoursePreview({
    courses: subjects,
    name: addCourseName,
    semesterId: selectedAddCourseSemesterRecord?.id || '',
  });

  // State nhắc thi & hồ sơ (Màn 10, 11, 13, 14)
  const [reminders, setReminders] = useState([]);
  const [selectedReminderId, setSelectedReminderId] = useState('');
  const [isReminderCourseOpen, setIsReminderCourseOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    courseId: '',
    type: '',
    date: '',
    time: '',
    room: '',
    note: '',
    alarmDate: '',
    alarmTime: '',
  });
  const [reminderFormError, setReminderFormError] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);
  const reminderWritePending = useRef(false);
  const [profileNotice, setProfileNotice] = useState('');
  const profileNoticeTimer = useRef(null);

  const gradeRelevantReminders = useMemo(() => {
    const coursesById = new Map(subjects.map((course) => [course.id, course]));
    return reminders.filter((reminder) => {
      const course = coursesById.get(reminder.courseId);
      return !course || getReminderAvailability(course).pendingTypes.includes(reminder.type);
    });
  }, [subjects, reminders]);
  const activeReminders = gradeRelevantReminders.filter(
    (reminder) => !reminder.isAcknowledged && !isReminderBeforeToday(reminder)
  );

  const canShowReminderShade = Boolean(firebaseUser && currentScreen > 2 && currentScreen !== 12);
  const openReminderShade = useCallback(() => {
    if (!canShowReminderShade || shadeReminderIdRef.current) return;
    const due = findAlarmToAutoShow(gradeRelevantReminders);
    if (due) showAlarm(due);
  }, [canShowReminderShade, gradeRelevantReminders, showAlarm]);

  const shadePanResponder = useMemo(() => {
    const canHandleSwipe = (_, gesture) =>
      canShowReminderShade && !shadeReminderIdRef.current
      && gesture.y0 <= 60 && gesture.dy > 20 && Math.abs(gesture.dy) > Math.abs(gesture.dx)
      && Boolean(findAlarmToAutoShow(gradeRelevantReminders));
    return PanResponder.create({
      onMoveShouldSetPanResponder: canHandleSwipe,
      onMoveShouldSetPanResponderCapture: canHandleSwipe,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 36) openReminderShade();
      },
    });
  }, [canShowReminderShade, gradeRelevantReminders, openReminderShade]);

  // Mỗi mốc báo thức chỉ tự bật một lần trong khoảng thời gian còn hiệu lực.
  useEffect(() => {
    if (!canShowReminderShade) {
      setHasDueAlarm(false);
      closeShade();
      return undefined;
    }

    const tick = () => {
      const now = Date.now();
      setHasDueAlarm(Boolean(findAlarmToAutoShow(gradeRelevantReminders, now)));
      if (shadeReminderIdRef.current) {
        const opened = gradeRelevantReminders.find((item) => item.id === shadeReminderIdRef.current && !item.isAcknowledged);
        if (opened && getReminderAlarmStatus(opened, now) === 'due') return;
        closeShade();
      }
      const due = findAlarmToAutoShow(gradeRelevantReminders, now, autoShownAlarmKeys.current);
      if (due) showAlarm(due);
    };

    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, [canShowReminderShade, closeShade, gradeRelevantReminders, showAlarm]);

  // State riêng cho màn "Sửa hồ sơ" trong modal avatar (chỉ GPA mục tiêu + tổng tín chỉ).
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [profileTargetGpa, setProfileTargetGpa] = useState('');
  const [profileTotalCredits, setProfileTotalCredits] = useState('');
  const [profileEditError, setProfileEditError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    let unsubscribe;
    try {
      const { auth } = getFirebaseServices();
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        setFirebaseUser(user);
        setAuthError('');
        setAuthNotice('');
        if (!user) {
          setProfile(null);
          setSemesters([]);
          setSubjects([]);
          setReminders([]);
          setShadeReminderError('');
          setCurrentScreen(1);
          setIsWorkspaceLoading(false);
          return;
        }
        if (pendingAuthSetup.current) return;

        setIsWorkspaceLoading(true);
        setOperationError('');
        try {
          const workspace = await loadUserWorkspace(user.uid, user);
          setProfile(workspace.profile);
          setSemesters(workspace.semesters);
          setSubjects(workspace.courses);
          setReminders(workspace.reminders);
          setSelectedReminderId(workspace.reminders[0]?.id || '');
          setNewReminder((current) => ({
            ...current,
            courseId: workspace.courses[0]?.id || '',
          }));
          setSelectedSemesterId(
            [...workspace.semesters].sort(compareSemesters).slice(-1)[0]?.id || ''
          );
          setCurrentScreen(3);
        } catch (error) {
          setOperationError(getFirebaseErrorMessage(error));
          setCurrentScreen(1);
        } finally {
          setIsWorkspaceLoading(false);
        }
      });
    } catch (error) {
      setAuthError(getFirebaseErrorMessage(error));
      setIsWorkspaceLoading(false);
    }

    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (courseSemesterOptions.length === 0) {
      setSelectedAddCourseSemester('');
    } else if (!courseSemesterOptions.includes(selectedAddCourseSemester)) {
      const latestOpenSemester = [...orderedSemesters].reverse().find(
        (semester) => semester.status !== 'Hoàn thành'
      );
      const latestSemester = orderedSemesters[orderedSemesters.length - 1];
      setSelectedAddCourseSemester(
        getSemesterOptionLabel(latestOpenSemester || latestSemester)
      );
    }
  }, [semesters]);

  const handleLogin = async () => {
    setAuthError('');
    setAuthNotice('');
    setOperationError('');
    const email = loginEmail.trim();
    if (!email || !loginPassword) {
      setAuthError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    if (!isValidEmail(email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    if (loginPassword.length < MIN_PASSWORD_LENGTH) {
      setAuthError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    setIsAuthBusy(true);
    try {
      const { auth } = getFirebaseServices();
      await signInWithEmailAndPassword(auth, email, loginPassword);
      await persistRememberedEmail(email, rememberPassword);
    } catch (error) {
      setAuthError(getFirebaseErrorMessage(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleRegister = async () => {
    setAuthError('');
    setAuthNotice('');
    const fullName = registerName.trim();
    const email = registerEmail.trim();

    if (!fullName || !email || !registerPassword || !confirmRegisterPassword) {
      setAuthError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    if (!isValidEmail(email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    if (registerPassword.length < MIN_PASSWORD_LENGTH) {
      setAuthError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`);
      return;
    }
    if (registerPassword !== confirmRegisterPassword) {
      setAuthError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (!isRegisterProgramValid) {
      setAuthError('Tổng tín chỉ, số học kỳ hoặc GPA mục tiêu không hợp lệ.');
      return;
    }

    setIsRegisterConfirmationVisible(true);
  };

  const confirmRegister = async () => {
    setAuthError('');
    const fullName = registerName.trim();
    const email = registerEmail.trim();
    if (!isRegisterProgramValid) {
      setAuthError('Tổng tín chỉ, số học kỳ hoặc GPA mục tiêu không hợp lệ.');
      return;
    }
    setIsAuthBusy(true);
    pendingAuthSetup.current = true;
    try {
      const { auth } = getFirebaseServices();
      const credential = await createUserWithEmailAndPassword(auth, email, registerPassword);
      await updateProfile(credential.user, { displayName: fullName });
      await createUserProfile(credential.user.uid, {
        fullName,
        email,
        totalProgramCredits: registerProgramCredits,
        totalProgramSemesters: registerProgramSemesters,
        targetGpa: registerGpa,
      });
      const workspace = await loadUserWorkspace(credential.user.uid, credential.user);
      setFirebaseUser(credential.user);
      setProfile(workspace.profile);
      setSemesters(workspace.semesters);
      setSubjects(workspace.courses);
      setReminders(workspace.reminders);
      setSelectedSemesterId(
        [...workspace.semesters].sort(compareSemesters).slice(-1)[0]?.id || ''
      );
      setIsRegisterConfirmationVisible(false);
      setCurrentScreen(3);
    } catch (error) {
      if (error?.code === 'auth/email-already-in-use') {
        setIsRegisterConfirmationVisible(false);
      }
      setAuthError(getFirebaseErrorMessage(error));
    } finally {
      pendingAuthSetup.current = false;
      setIsWorkspaceLoading(false);
      setIsAuthBusy(false);
    }
  };

  const handlePasswordReset = async () => {
    setAuthError('');
    setAuthNotice('');
    const email = resetEmail.trim();
    if (!email) {
      setAuthError('Vui lòng nhập email đã đăng ký.');
      return;
    }
    if (!isValidEmail(email)) {
      setAuthError('Email không đúng định dạng.');
      return;
    }
    setIsAuthBusy(true);
    try {
      const { auth } = getFirebaseServices();
      await sendPasswordResetEmail(auth, email);
      setAuthNotice('Đã gửi email đặt lại mật khẩu. Hãy kiểm tra hộp thư của bạn.');
    } catch (error) {
      setAuthError(getFirebaseErrorMessage(error));
    } finally {
      setIsAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    setOperationError('');
    try {
      const { auth } = getFirebaseServices();
      await signOut(auth);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
    }
  };

  const acknowledgeReminder = async () => {
    if (!selectedReminderId || reminderWritePending.current) return;
    const acknowledgedId = selectedReminderId;
    reminderWritePending.current = true;
    setIsSavingReminder(true);
    setOperationError('');
    try {
      await acknowledgeReminderRecord(acknowledgedId);
      setReminders((current) => current.map((reminder) =>
        reminder.id === acknowledgedId ? { ...reminder, isAcknowledged: true } : reminder
      ));
      const next = activeReminders.find((reminder) => reminder.id !== acknowledgedId);
      setSelectedReminderId((current) => current === acknowledgedId ? next?.id || '' : current);
      setCurrentScreen((screen) => screen === 13 ? 10 : screen);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
    } finally {
      reminderWritePending.current = false;
      setIsSavingReminder(false);
    }
  };

  const snoozeReminder10m = async (reminderId) => {
    const reminder = activeReminders.find((item) => item.id === reminderId);
    if (!reminder || reminderWritePending.current) return false;
    const now = Date.now();
    if (getReminderAlarmStatus(reminder, now) !== 'due') {
      setShadeReminderError('Chỉ có thể báo lại khi báo thức đang đến giờ.');
      return false;
    }
    const snooze = getSnoozeAlarm(now);
    const exam = parseDateTimeInput(reminder.date, reminder.time);
    const alarm = parseDateTimeInput(snooze.alarmDate, snooze.alarmTime);
    const validationError = exam && alarm
      ? getReminderAlarmError(alarm, exam, now)
      : 'Ngày hoặc giờ thi của lịch nhắc không hợp lệ.';
    if (validationError) {
      setShadeReminderError(validationError);
      return false;
    }
    reminderWritePending.current = true;
    setIsSavingReminder(true);
    setShadeReminderError('');
    try {
      await updateReminderAlarmRecord(reminder.id, snooze.isoDate, snooze.alarmTime);
      setReminders((current) => current.map((item) =>
        item.id === reminder.id
          ? { ...item, alarmDate: snooze.alarmDate, alarmTime: snooze.alarmTime }
          : item
      ));
      return true;
    } catch (error) {
      setShadeReminderError(getFirebaseErrorMessage(error));
      return false;
    } finally {
      reminderWritePending.current = false;
      setIsSavingReminder(false);
    }
  };

  // ----- Sửa hồ sơ: chỉ GPA mục tiêu và tổng tín chỉ chương trình -----
  const openProfileEdit = () => {
    setProfileTargetGpa(String(profile?.targetGpa ?? 3.2));
    setProfileTotalCredits(String(profile?.totalProgramCredits ?? 130));
    setProfileEditError('');
    setIsProfileEditOpen(true);
  };

  const closeProfileEdit = () => {
    setProfileEditError('');
    setIsProfileEditOpen(false);
  };

  const saveProfileSettings = async () => {
    const targetGpa = parseTargetGpa(profileTargetGpa);
    const totalProgramCredits = parseDecimalValue(profileTotalCredits);

    if (targetGpa === null) {
      setProfileEditError('Nhập GPA mục tiêu lớn hơn 0 và tối đa 4.00.');
      return false;
    }
    if (!Number.isInteger(totalProgramCredits) || totalProgramCredits < 1 || totalProgramCredits > 300) {
      setProfileEditError('Tổng tín chỉ phải là số nguyên từ 1 đến 300.');
      return false;
    }
    if (!firebaseUser?.uid) {
      setProfileEditError('Không xác định được tài khoản đang đăng nhập.');
      return false;
    }

    setIsSavingProfile(true);
    try {
      await updateUserProfileRecord(firebaseUser.uid, { targetGpa, totalProgramCredits });
      setProfile((current) => ({
        ...(current || {}),
        targetGpa,
        totalProgramCredits,
      }));
      showProfileNotice('Đã lưu hồ sơ: GPA mục tiêu và tổng tín chỉ đã được cập nhật.');
      setIsProfileEditOpen(false);
      setProfileEditError('');
      return true;
    } catch (error) {
      setProfileEditError(getFirebaseErrorMessage(error));
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ----- Helper: xử lý điểm & cập nhật danh sách môn (UI only, chưa có backend) -----
  const formatCourseMeta = (sub) => {
    const base = `${sub.credits} Tín chỉ • ${sub.semester} • ${sub.weights.cc}%-${sub.weights.gk}%-${sub.weights.ck}%`;
    const retake = Number(sub.attemptNo) > 1 ? ` • Học lại lần ${sub.attemptNo}` : '';
    return sub.status === 'failed'
      ? `${base} • Không tính vào TC tích lũy${retake}`
      : `${base}${retake}`;
  };

  // ----- Tính GPA / TBC tự động từ danh sách môn (UI only) -----
  const TOTAL_PROGRAM_CREDITS = profile?.totalProgramCredits || 130;
  const TOTAL_PROGRAM_SEMESTERS = profile?.totalProgramSemesters || 8;

  // Học kỳ đã có điểm nhưng chưa đủ 100% môn -> GPA tạm tính.
  const isSemesterGpaProvisional = (stats) =>
    stats.count > 0 && stats.gradedCount > 0 && !hasFinalSemesterGpa(stats);

  const formatSemesterGpa = (stats) =>
    hasFinalSemesterGpa(stats) ? stats.gpa.toFixed(2) : isSemesterGpaProvisional(stats) ? `${stats.gpa.toFixed(2)}*` : '--';
  const formatSemesterAverage = (stats) =>
    hasFinalSemesterGpa(stats) ? stats.avg10.toFixed(2) : isSemesterGpaProvisional(stats) ? `${stats.avg10.toFixed(2)}*` : '--';

  const semesterStats = semesters.map((sem) => {
    const semesterCourses = subjects.filter((item) => item.sem === sem.id);
    const isConfirmed = sem.status === 'Hoàn thành';
    return {
      ...sem,
      // Trạng thái hiển thị: Đang học / Chưa xác nhận / Hoàn thành.
      status: getSemesterDisplayStatus(sem.status, sem.year, semesters, sem.rawName),
      isConfirmed,
      // Nút "✓ Xác nhận điểm" chỉ hiện khi kỳ chưa chốt và 100% môn đã có điểm tổng kết.
      canConfirm: canConfirmSemester(sem.status, semesterCourses),
      stats: calcSemesterStats(semesterCourses),
    };
  }).sort(compareSemesters);

  // GPA tích lũy (CPA) chỉ tính lần học mới nhất: điểm F đã được học lại thì bị thay thế.
  // GPA từng học kỳ vẫn dùng đủ danh sách môn ở trên nên điểm F cũ vẫn hiển thị.
  const overallStats = calcSemesterStats(getCpaCourses(subjects));
  const remainingCredits = Math.max(0, TOTAL_PROGRAM_CREDITS - overallStats.earnedCredits);
  const overallRank = getRankByGPA(overallStats.gpa);
  const hasOverallGpa = overallStats.gradedCredits > 0;
  const overallGpaText = hasOverallGpa ? overallStats.gpa.toFixed(2) : '--';
  const overallAverageText = hasOverallGpa ? overallStats.avg10.toFixed(2) : '--';
  const emptySemesterStats = calcSemesterStats([]);
  // Kỳ hiện tại: chọn kỳ mới nhất theo năm học rồi tới số thứ tự kỳ.
  const currentSemesterStats = semesterStats
    .filter((sem) => sem.status === 'Đang học')
    .sort((a, b) => compareSemesters(b, a))[0] || semesterStats[semesterStats.length - 1] || {
    id: '',
    name: 'Chưa có học kỳ',
    rawName: 'Chưa có học kỳ',
    year: '',
    status: '',
    stats: emptySemesterStats,
  };
  const previousSemesterStats = semesterStats
    .filter((sem) =>
      sem.id !== currentSemesterStats.id &&
      compareSemesters(sem, currentSemesterStats) < 0
    )
    .sort((a, b) => compareSemesters(b, a))[0]
    || semesterStats.filter((sem) => sem.id !== currentSemesterStats.id)
      .sort((a, b) => compareSemesters(b, a))[0];
  const gpaDelta = currentSemesterStats && previousSemesterStats
    ? Number(currentSemesterStats.stats.gpa.toFixed(2)) - Number(previousSemesterStats.stats.gpa.toFixed(2))
    : 0;

  const editingCourse = subjects.find((item) => item.id === selectedCourseId) || subjects[0];
  const editedGrades = clearZeroWeightGrades(editCourseGrades, editCourseWeights);
  const unchangedGradeInputs = editingCourse && ['cc', 'gk', 'ck'].every((key) =>
    parseGradeValue(editedGrades[key]) === parseGradeValue(editingCourse[key]) &&
    (parseDecimalValue(editCourseWeights[key]) ?? 0) === (parseDecimalValue(editingCourse.weights[key]) ?? 0)
  );
  const editedCourseTotal = calcCourseTotal(editedGrades, editCourseWeights)
    ?? (editWeightTotal === 100 && unchangedGradeInputs && !Object.values(editedGrades).some(isGradeValueInvalid)
      ? roundGradeTotal(editingCourse.total)
      : null);

  useEffect(() => () => {
    if (courseActionNoticeTimer.current) clearTimeout(courseActionNoticeTimer.current);
    if (profileNoticeTimer.current) clearTimeout(profileNoticeTimer.current);
    if (gradeImportMessageTimer.current) clearTimeout(gradeImportMessageTimer.current);
  }, []);

  // Thông báo nhập điểm: đỏ khi lỗi, xanh khi thành công, tự ẩn sau 5 giây.
  const showGradeImportMessage = (message, type = 'error') => {
    if (gradeImportMessageTimer.current) clearTimeout(gradeImportMessageTimer.current);
    setGradeImportMessage(message);
    setGradeImportMessageType(type);
    gradeImportMessageTimer.current = setTimeout(() => {
      setGradeImportMessage('');
      gradeImportMessageTimer.current = null;
    }, 5000);
  };

  const clearGradeImportMessage = () => {
    if (gradeImportMessageTimer.current) clearTimeout(gradeImportMessageTimer.current);
    gradeImportMessageTimer.current = null;
    setGradeImportMessage('');
  };

  // Thông báo ngắn (5 giây) rồi tự ẩn.
  const showProfileNotice = (message) => {
    if (profileNoticeTimer.current) clearTimeout(profileNoticeTimer.current);
    setProfileNotice(message);
    profileNoticeTimer.current = setTimeout(() => {
      setProfileNotice('');
      profileNoticeTimer.current = null;
    }, 5000);
  };

  const showCourseActionNotice = (notice) => {
    if (courseActionNoticeTimer.current) clearTimeout(courseActionNoticeTimer.current);
    setCourseActionNotice(notice);
    courseActionNoticeTimer.current = setTimeout(() => {
      setCourseActionNotice(null);
      courseActionNoticeTimer.current = null;
    }, 4000);
  };

  const dismissCourseActionNotice = () => {
    if (courseActionNoticeTimer.current) clearTimeout(courseActionNoticeTimer.current);
    courseActionNoticeTimer.current = null;
    setCourseActionNotice(null);
  };

  const openEditCourse = (sub) => {
    dismissCourseActionNotice();
    if (!sub || sub.canEdit === false) {
      setOperationError('Học kỳ đã xác nhận điểm nên không thể sửa học phần này.');
      return;
    }
    setSelectedCourseId(sub.id);
    setEditCourseName(sub.name);
    setEditCourseCredits(String(sub.credits));
    const weights = { ...sub.weights };
    setEditCourseWeights(weights);
    setEditCourseGrades(clearZeroWeightGrades({
      cc: parseGradeValue(sub.cc) === null ? '' : sub.cc,
      gk: parseGradeValue(sub.gk) === null ? '' : sub.gk,
      ck: parseGradeValue(sub.ck) === null ? '' : sub.ck,
    }, weights));
    setCurrentScreen(8);
  };

  const saveEditCourse = async () => {
    if (!editingCourse || editingCourse.canEdit === false) {
      setOperationError('Học kỳ đã xác nhận điểm nên không thể sửa điểm.');
      return;
    }
    if (editWeightTotal !== 100) return;

    const savedCourseName = editCourseName.trim() || editingCourse.name;
    const credits = parseCourseCredits(editCourseCredits);
    const weights = { ...editCourseWeights };
    const grades = editedGrades;
    if (credits === null || Object.values(grades).some(isGradeValueInvalid)) return;
    const total = editedCourseTotal;
    const missingParts = [
      parseDecimalValue(weights.cc) > 0 && parseGradeValue(grades.cc) === null ? 'CC' : null,
      parseDecimalValue(weights.gk) > 0 && parseGradeValue(grades.gk) === null ? 'GK' : null,
      parseDecimalValue(weights.ck) > 0 && parseGradeValue(grades.ck) === null ? 'CK' : null,
    ].filter(Boolean);

    let status = 'pending';
    let badge = missingParts.length > 0 ? `Chờ nhập ${missingParts.join('/')}` : 'Chờ điểm';
    let totalText = '--';

    if (total !== null) {
      const letter = getGradeLetter(total);
      status = letter.status;
      badge = letter.text;
      totalText = total.toFixed(2);
    }

    const updatedCourse = {
      ...editingCourse,
      name: savedCourseName,
      credits,
      weights,
      cc: grades.cc.trim() || 'Chưa nhập',
      gk: grades.gk.trim() || 'Chưa nhập',
      ck: grades.ck.trim() || 'Chưa nhập',
      total: totalText,
      status,
      badge,
    };
    // Nhập điểm ở Màn 8 -> gỡ luôn lịch nhắc đã hết tác dụng của môn này.
    const remindersToDelete = getRemindersToDelete(reminders, updatedCourse);
    const reminderNotice = remindersToDelete.length > 0
      ? ` Đã tự động gỡ ${remindersToDelete.length} lịch nhắc thi của môn này.`
      : '';
    try {
      const enrollmentIds = await updateCourseRecords([updatedCourse], remindersToDelete);
      updatedCourse.enrollmentDocumentId = enrollmentIds.get(updatedCourse.id);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      return;
    }
    setSubjects((current) => current.map((item) => item.id === selectedCourseId ? updatedCourse : item));
    if (remindersToDelete.length > 0) {
      const deletedReminderIds = new Set(remindersToDelete.map((reminder) => reminder.id));
      const remainingReminders = reminders.filter(
        (reminder) => !deletedReminderIds.has(reminder.id)
      );
      setReminders(remainingReminders);
      if (deletedReminderIds.has(selectedReminderId)) {
        setSelectedReminderId(remainingReminders[0]?.id || '');
      }
    }

    showCourseActionNotice({
      type: 'success',
      message: (total !== null
        ? `Đã cập nhật điểm “${savedCourseName}”: Tổng ${totalText} • Điểm ${badge}.`
        : `Đã cập nhật thông tin học phần “${savedCourseName}”.`) + reminderNotice,
    });
    setCurrentScreen(6);
  };

  const createSemester = async () => {
    const rawName = newSemesterName.trim();
    const normalizedYear = newSemesterYear.trim().replace(/\s*[-–]\s*/, ' - ');
    const yearMatch = normalizedYear.match(/^(\d{4}) - (\d{4})$/);

    if (!rawName) {
      setSemesterFormError('Vui lòng nhập tên học kỳ.');
      return;
    }
    if (!yearMatch || Number(yearMatch[2]) !== Number(yearMatch[1]) + 1) {
      setSemesterFormError('Năm học cần đúng định dạng YYYY - YYYY, ví dụ 2026 - 2027.');
      return;
    }
    if (semesters.length >= TOTAL_PROGRAM_SEMESTERS) {
      setSemesterFormError(`Chương trình đã đủ ${TOTAL_PROGRAM_SEMESTERS} học kỳ.`);
      return;
    }
    const duplicate = semesters.some(
      (semester) =>
        semester.rawName.trim().toLocaleLowerCase() === rawName.toLocaleLowerCase() &&
        semester.year.replace(/\s*-\s*/, ' - ') === normalizedYear
    );
    if (duplicate) {
      setSemesterFormError('Học kỳ này đã tồn tại trong danh sách.');
      return;
    }

    const newSemester = {
      name: `${rawName} (${normalizedYear})`,
      rawName,
      year: normalizedYear,
      // Học kỳ mới luôn ở learning cho tới khi người dùng bấm "✓ Xác nhận điểm".
      // Kỳ năm cũ sẽ hiển thị là "Chưa xác nhận" nhờ getSemesterDisplayStatus.
      status: 'Đang học',
    };
    // Không tự chuyển các kỳ trước sang completed: chỉ chốt khi có xác nhận thủ công.
    let semesterId;
    try {
      semesterId = await createSemesterRecord(
        firebaseUser.uid,
        newSemester,
        [],
        semesters.map((semester) => semester.id)
      );
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      return;
    }
    newSemester.id = semesterId;
    setSemesters((current) => [...current, newSemester]);
    setNewSemesterName('');
    setNewSemesterYear('');
    setSemesterYearQuery('');
    setSelectedSemesterId(newSemester.id);
    setSelectedAddCourseSemester(getSemesterOptionLabel(newSemester));
    setSemesterFormError('');
    showCourseActionNotice({
      type: 'info',
      message: `Đã tạo học kỳ “${rawName}” • ${normalizedYear}.`,
    });
    setCurrentScreen(3);
  };

  const deleteEditingCourse = async () => {
    if (!editingCourse || editingCourse.canEdit === false) {
      setIsDeleteCourseDialogVisible(false);
      setOperationError('Học kỳ đã xác nhận điểm nên không thể xóa học phần.');
      return;
    }
    const courseId = selectedCourseId;
    const deletedCourseName = editingCourse.name;
    const remainingCourses = subjects.filter((item) => item.id !== courseId);
    const remainingReminders = reminders.filter((reminder) => reminder.courseId !== courseId);

    try {
      await deleteCourseAndReminders(editingCourse, reminders);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      return;
    }
    setSubjects(remainingCourses);
    setReminders(remainingReminders);
    if (selectedReminderId && !remainingReminders.some((reminder) => reminder.id === selectedReminderId)) {
      setSelectedReminderId(remainingReminders[0]?.id || '');
    }
    if (newReminder.courseId === courseId) {
      const replacementCourse = remainingCourses.find(
        (course) => course.sem === editingCourse.sem && course.status !== 'failed'
      );
      setNewReminder((current) => ({ ...current, courseId: replacementCourse?.id || '' }));
    }

    setIsDeleteCourseDialogVisible(false);
    showCourseActionNotice({
      type: 'error',
      message: `Đã xóa học phần “${deletedCourseName}” khỏi bảng điểm.`,
    });
    setCurrentScreen(6);
  };

  // ----- Chốt điểm học kỳ: learning -> completed -----
  const openConfirmSemesterDialog = (semesterId = selectedSemesterId) => {
    const sem = semesterStats.find((item) => item.id === semesterId);
    if (!sem || sem.isConfirmed || !sem.canConfirm) return;
    setIsConfirmSemesterDialogVisible(true);
  };

  const closeConfirmSemesterDialog = () => {
    if (isConfirmingSemester) return;
    setIsConfirmSemesterDialogVisible(false);
  };

  const confirmSemesterGrades = async (semesterId = selectedSemesterId) => {
    const sem = semesterStats.find((item) => item.id === semesterId);
    if (!sem || sem.isConfirmed || !sem.canConfirm) {
      setIsConfirmSemesterDialogVisible(false);
      return;
    }
    setIsConfirmingSemester(true);
    try {
      await confirmSemesterRecord(sem.id, sem.stats);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      setIsConfirmingSemester(false);
      return;
    }
    // Khóa toàn bộ môn của kỳ ngay trên state, không cần tải lại app.
    setSemesters((current) =>
      current.map((item) =>
        item.id === sem.id ? { ...item, status: 'Hoàn thành' } : item
      )
    );
    setSubjects((current) =>
      current.map((item) =>
        item.sem === sem.id ? { ...item, canEdit: false } : item
      )
    );
    setIsConfirmingSemester(false);
    setIsConfirmSemesterDialogVisible(false);
    showCourseActionNotice({
      type: 'success',
      message: `Đã xác nhận điểm ${sem.rawName} • ${sem.year}. Điểm của học kỳ này đã bị khóa.`,
    });
  };

  const createCourse = async () => {
    const name = addCourseName.trim();
    const credits = parseCourseCredits(addCourseCredits);
    const semester = semesters.find(
      (item) => getSemesterOptionLabel(item) === selectedAddCourseSemester
    );

    if (!name) {
      setAddCourseError('Vui lòng nhập tên học phần.');
      return;
    }
    if (credits === null) {
      setAddCourseError('Số tín chỉ phải là số nguyên từ 1 đến 20.');
      return;
    }
    if (!semester) {
      setAddCourseError('Vui lòng chọn học kỳ hợp lệ.');
      return;
    }
    if (semester.status === 'Hoàn thành') {
      setAddCourseError('Học kỳ đã xác nhận điểm nên không thể thêm học phần.');
      return;
    }
    if (addWeightTotal !== 100) {
      setAddCourseError('Mỗi trọng số phải từ 0 đến 100% và tổng phải bằng 100%.');
      return;
    }

    // Chặn trùng tên: môn đã đạt / đang học / đã có trong kỳ này thì không cho thêm.
    // Môn đã trượt thì cho thêm và tự đánh dấu là học lại lần kế tiếp.
    const preview = getAddCoursePreview({
      courses: subjects,
      name,
      semesterId: semester.id,
    });
    if (preview.kind === 'blocked') {
      setAddCourseError(preview.message);
      return;
    }

    const newCourse = {
      name,
      credits,
      semester: `${semester.rawName} (${semester.year.replace(' - ', '-')})`,
      sem: semester.id,
      weights: { ...addCourseWeights },
      status: 'pending',
      badge: 'Chờ nhập điểm',
      cc: 'Chưa nhập',
      gk: 'Chưa nhập',
      ck: 'Chưa nhập',
      total: '--',
      canEdit: true,
      attemptNo: preview.kind === 'retake' ? preview.attemptNo : 1,
      retakeOf: preview.kind === 'retake' ? preview.latest.id : null,
      // Dùng lại đúng dòng danh mục courses của lần học trước (học lại).
      courseId: preview.kind === 'retake' ? preview.latest.courseId || null : null,
    };

    try {
      const created = await createCourseRecord(newCourse, subjects.map((item) => item.id));
      newCourse.id = created.id;
      newCourse.courseId = created.catalogId;
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      return;
    }
    setSubjects((current) => [...current, newCourse]);
    setSubjectSearchQuery('');
    setSelectedSemesterFilter(semester.id);
    setSelectedStatusFilter('all');
    setAddCourseName('');
    setAddCourseCredits('');
    setAddCourseError('');
    setIsAddCourseSemesterOpen(false);
    showCourseActionNotice({
      type: 'success',
      message: preview.kind === 'retake'
        ? `Đã thêm môn “${name}” dạng học lại lần ${preview.attemptNo} • ${semester.rawName} (${semester.year}). Điểm mới sẽ thay điểm F khi tính GPA tích lũy.`
        : `Đã tạo học phần “${name}” • ${semester.rawName} (${semester.year}).`,
    });
    setCurrentScreen(6);
  };

  // ----- Môn của HỌC KỲ HIỆN TẠI (dùng cho Dự báo What-if & Nhắc thi) -----
  // Chỉ lấy môn thuộc kỳ đang học, không lấy môn của kỳ đã qua
  const currentSemesterCourses = subjects.filter((item) => item.sem === currentSemesterStats.id);
  const pendingCurrentCourses = currentSemesterCourses.filter((item) =>
    item.status === 'pending' && parseGradeValue(item.total) === null &&
    parseGradeValue(item.ck) === null && getRemainingFinalWeight(item.weights) > 0
  );
  const whatIfCourses = pendingCurrentCourses.map((item) => {
    const ccWeight = parseDecimalValue(item.weights.cc) ?? 0;
    const gkWeight = parseDecimalValue(item.weights.gk) ?? 0;
    const ckWeight = getRemainingFinalWeight(item.weights);
    const ccValue = parseGradeValue(item.cc);
    const gkValue = parseGradeValue(item.gk);
    const detailParts = [];
    if (ccWeight > 0) {
      detailParts.push(`CC ${ccValue === null ? 'chưa nhập' : item.cc} (${ccWeight}%)`);
    }
    if (gkWeight > 0) {
      detailParts.push(`GK ${gkValue === null ? 'chưa nhập' : item.gk} (${gkWeight}%)`);
    }
    if (ckWeight > 0) detailParts.push(`CK ${ckWeight}%`);
    return {
      id: item.id,
      name: `${item.name} (${item.credits} TC)`,
      cc: ccValue,
      gk: gkValue,
      weights: item.weights,
      detail: detailParts.length > 0 ? detailParts.join(' • ') : 'Chưa có trọng số thành phần',
    };
  });

  // Lưu kết quả What-if vào bảng grade_forecasts khi người dùng mở Màn 9
  // và đổi môn / mức điểm mục tiêu. Mỗi lần học chỉ có 1 bản ghi (upsert).
  const activeWhatIfCourse = whatIfCourses[selectedWhatIfIndex] || whatIfCourses[0];
  const activeWhatIfCourseId = activeWhatIfCourse?.id;
  const targetGrade = getTargetGradeOption(selectedTargetGrade);
  const forecast = activeWhatIfCourse ? getWhatIfForecast({
    cc: activeWhatIfCourse.cc,
    gk: activeWhatIfCourse.gk,
    weights: activeWhatIfCourse.weights,
    targetTen: targetGrade.ten,
  }) : null;
  const projectedGpa = activeWhatIfCourseId
    ? calcSemesterStats(getCpaCourses(subjects.map((course) =>
      course.id === activeWhatIfCourseId ? { ...course, total: targetGrade.ten, status: 'passed' } : course
    ))).gpa
    : overallStats.gpa;
  const requiredFinalScore = forecast?.requiredScore ?? null;
  useEffect(() => {
    if (currentScreen !== 9 || !firebaseUser?.uid || !activeWhatIfCourseId) return;
    upsertForecastRecord(activeWhatIfCourseId, {
      targetGrade: targetGrade.key,
      targetScore10: targetGrade.ten,
      requiredFinalScore,
      projectedGpa4: projectedGpa,
    }).catch(() => {
      // Rules chưa cập nhật hoặc mất mạng: không chặn thao tác xem dự báo.
    });
  }, [activeWhatIfCourseId, currentScreen, firebaseUser?.uid, targetGrade, requiredFinalScore, projectedGpa]);

  // ----- Lựa chọn học phần cho form nhắc thi (Màn 11) -----
  // Giữ chỗ cho từng loại lịch đã đặt, kể cả khi đã xác nhận thông báo.
  const reminderTypesByCourse = new Map();
  for (const reminder of gradeRelevantReminders) {
    if (isReminderBeforeToday(reminder)) continue;
    const types = reminderTypesByCourse.get(reminder.courseId) || [];
    types.push(reminder.type);
    reminderTypesByCourse.set(reminder.courseId, types);
  }

  const reminderCourseOptions = currentSemesterCourses
    .map((course) => ({
      course,
      ...getReminderAvailability(course, reminderTypesByCourse.get(course.id)),
    }))
    .filter((option) => option.allowedTypes.length > 0);

  // Đồng bộ lựa chọn đang mở nếu điểm hoặc lịch nhắc thay đổi.
  const reminderCourseOptionKey = reminderCourseOptions
    .map((option) => `${option.course.id}:${option.allowedTypes.join('|')}`)
    .join(',');

  useEffect(() => {
    if (reminderCourseOptions.length === 0) return;
    const currentOption =
      reminderCourseOptions.find((option) => option.course.id === newReminder.courseId) ||
      reminderCourseOptions[0];
    const nextType = currentOption.course.id === newReminder.courseId
      && currentOption.allowedTypes.includes(newReminder.type)
      ? newReminder.type
      : currentOption.allowedTypes[0];
    if (newReminder.courseId !== currentOption.course.id || newReminder.type !== nextType) {
      setNewReminder((current) => ({
        ...current,
        courseId: currentOption.course.id,
        type: nextType,
      }));
    }
  }, [reminderCourseOptionKey, newReminder.courseId, newReminder.type]);

  // ----- Helper cho luồng nhắc thi & hồ sơ (Màn 10, 11, 13, 14) -----
  const openReminderDetail = (reminder) => {
    setSelectedReminderId(reminder.id);
    setCurrentScreen(13);
  };

  const saveNewReminder = async () => {
    if (reminderWritePending.current) return;
    const selectedOption = reminderCourseOptions.find(
      (option) => option.course.id === newReminder.courseId
    );
    if (!selectedOption) {
      setReminderFormError('Học phần này không còn loại lịch nhắc có thể đặt. Vui lòng chọn học phần khác.');
      return;
    }
    if (!selectedOption.allowedTypes.includes(newReminder.type)) {
      setReminderFormError('Vui lòng chọn loại lịch nhắc còn khả dụng cho học phần này.');
      return;
    }
    const course = selectedOption.course;
    if (!newReminder.date.trim() || !newReminder.time.trim() || !newReminder.room.trim()) {
      setReminderFormError('Vui lòng nhập đầy đủ ngày thi, giờ thi và phòng thi.');
      return;
    }
    const examDateTime = parseDateTimeInput(newReminder.date, newReminder.time);
    if (!examDateTime) {
      setReminderFormError('Ngày thi cần đúng dạng DD/MM/YYYY và giờ thi dạng HH:MM.');
      return;
    }
    // Chặn ngày giờ trong quá khứ, trùng loại lịch của cùng môn và trùng giờ thi.
    const validationError = getNewReminderError({
      courseId: course.id,
      type: newReminder.type,
      examDateTime,
      reminders: gradeRelevantReminders,
    });
    if (validationError) {
      setReminderFormError(validationError);
      return;
    }
    if (!newReminder.alarmDate.trim() || !newReminder.alarmTime.trim()) {
      setReminderFormError('Vui lòng nhập ngày và giờ báo thức trước giờ thi.');
      return;
    }
    const alarmDateTime = parseDateTimeInput(newReminder.alarmDate, newReminder.alarmTime);
    if (!alarmDateTime) {
      setReminderFormError('Ngày báo thức cần đúng dạng DD/MM/YYYY và giờ báo thức dạng HH:MM.');
      return;
    }
    const alarmError = getReminderAlarmError(alarmDateTime, examDateTime);
    if (alarmError) {
      setReminderFormError(alarmError);
      return;
    }

    const semester = semesters.find((sem) => sem.id === course.sem);
    const reminder = {
      courseId: course.id,
      courseName: course.name,
      credits: course.credits,
      semesterLabel: semester ? semester.name : course.semester,
      type: newReminder.type,
      date: newReminder.date.trim(),
      time: newReminder.time.trim(),
      room: newReminder.room.trim(),
      note: newReminder.note.trim(),
      alarmDate: newReminder.alarmDate.trim(),
      alarmTime: newReminder.alarmTime.trim(),
      isAcknowledged: false,
    };

    reminderWritePending.current = true;
    setIsSavingReminder(true);
    setReminderFormError('');
    try {
      reminder.id = await createReminderRecord(reminder, reminders.map((item) => item.id));
    } catch (error) {
      setReminderFormError(getFirebaseErrorMessage(error));
      return;
    } finally {
      reminderWritePending.current = false;
      setIsSavingReminder(false);
    }
    setReminders((current) => [reminder, ...current]);
    setSelectedReminderId(reminder.id);
    setReminderFormError('');
    setIsReminderCourseOpen(false);
    setNewReminder({
      courseId: course.id,
      type: '',
      date: '',
      time: '',
      room: '',
      note: '',
      alarmDate: '',
      alarmTime: '',
    });
    setCurrentScreen(10);
  };

  const exportGradeData = () => {
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const scoreCell = (value) => (parseGradeValue(value) === null ? '' : String(value));
    const rows = subjects.map((item) => {
      const total = roundGradeTotal(item.total);
      const letterInfo = getGradeLetter(total);
      return [
        item.semester,
        item.name,
        item.credits,
        buildGradeFormula(item.weights),
        scoreCell(item.cc),
        scoreCell(item.gk),
        scoreCell(item.ck),
        total === null ? '' : total.toFixed(2),
        letterInfo ? letterInfo.point.toFixed(1) : '',
        letterInfo ? letterInfo.letter : '',
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csv = [
      'Kỳ/Năm học,Tên môn học,Số TC,Công thức điểm,CC,GK,CK,Thang 10,Thang 4,Chữ',
      ...rows,
    ].join('\n');

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'unigrade-diem.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showProfileNotice('Đã xuất file CSV.');
    } else {
      showProfileNotice('Đã xuất file CSV.');
    }
  };

  const importGradesFromFile = async () => {
    clearGradeImportMessage();
    const createdSemesters = [];
    const createdSubjects = [];
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/comma-separated-values',
          'application/csv',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });
      if (selection.canceled || !selection.assets || selection.assets.length === 0) return;

      const file = selection.assets[0];
      const fileExtension = (file.name || file.uri).toLowerCase().match(/\.(csv|xls|xlsx)$/)?.[1];
      if (!fileExtension) {
        showGradeImportMessage('Vui lòng chọn file .csv, .xls hoặc .xlsx.', 'error');
        return;
      }

      const isCsv = fileExtension === 'csv';
      const isWeb = Platform.OS === 'web';
      const workbookData =
        isWeb
          ? await fetch(file.uri).then((response) => {
              if (!response.ok) throw new Error('Không thể đọc file đã chọn.');
              return isCsv ? response.text() : response.arrayBuffer();
            })
          : await FileSystem.readAsStringAsync(file.uri, {
              encoding: isCsv ? FileSystem.EncodingType.UTF8 : FileSystem.EncodingType.Base64,
            });
      const binaryType = isWeb ? 'array' : 'base64';
      const rows = readGradeImportRows(workbookData, isCsv ? 'string' : binaryType);
      if (!rows) {
        showGradeImportMessage('File không có bảng điểm để nhập.', 'error');
        return;
      }

      const importResult = parseGradeSheet(rows, subjects);
      if (importResult.headerRowIndex === -1) {
        const missingColumns = importResult.missingColumns || [];
        const missingText = missingColumns.length > 0
          ? `File thiếu cột: ${missingColumns.join(', ')}. `
          : '';
        showGradeImportMessage(
          `${missingText}${IMPORT_REQUIRED_COLUMNS_MESSAGE}`,
          'error'
        );
        return;
      }

      const importedSubjectIds = getImportedSubjectIds(importResult);
      const newCourseRows = importResult.newCourses || [];
      const invalidRows = importResult.invalidRows;
      const invalidDetails = invalidRows.slice(0, 3).map(({ rowNumber, fields }) =>
        `Dòng ${rowNumber} (${fields.join(', ')})`
      ).join('; ');
      const invalidMessage = invalidDetails
        ? ` Dữ liệu không hợp lệ: ${invalidDetails}${invalidRows.length > 3 ? ` và ${invalidRows.length - 3} dòng khác` : ''}.`
        : '';
      if (importedSubjectIds.size === 0 && newCourseRows.length === 0) {
        showGradeImportMessage(
          invalidMessage.trim() || 'Không có dữ liệu hợp lệ để nhập. Kiểm tra học kỳ, tên môn, số tín chỉ và điểm trong file.',
          'error'
        );
        return;
      }

      // Học kỳ đã xác nhận thì khóa hoàn toàn: không sửa điểm, không thêm môn mới.
      const lockedSemesterIds = new Set(
        semesters.filter((semester) => semester.status === 'Hoàn thành').map((semester) => semester.id)
      );

      // Tìm học kỳ đã có theo khóa "hocky<term><start><end>"; chưa có thì tạo mới ở trạng thái learning.
      // Nhờ vậy đang học 2026-2027 vẫn nhập được điểm năm 1 (2024-2025) / năm 2 (2025-2026),
      // và các kỳ đó vẫn chờ người dùng bấm "✓ Xác nhận điểm" mới chuyển completed.
      const semesterByCanonical = new Map();
      semesters.forEach((semester) => {
        const label = parseSemesterLabel(`${semester.rawName} ${semester.year}`);
        if (label) semesterByCanonical.set(label.canonical, semester);
      });

      const importedCoursesToValidate = newCourseRows.flatMap((row) => {
        const info = row.semesterInfo;
        const semesterId = buildSemesterId(info);
        const semester = semesterByCanonical.get(info.canonical)
          || semesters.find((item) => item.id === semesterId);
        if (semester && lockedSemesterIds.has(semester.id)) return [];
        return [buildCourseFromImportRow(row, semester || {
          id: semesterId,
          rawName: `Học kỳ ${info.term}`,
          year: `${info.startYear} - ${info.endYear}`,
          status: 'Đang học',
        })];
      });
      const importBlocker = getCourseImportBlocker(subjects, importedCoursesToValidate);
      if (importBlocker) {
        showGradeImportMessage(
          `Không thể nhập file bảng điểm: ${importBlocker.preview.message} Toàn bộ file đã bị hủy, chưa có thay đổi nào được lưu.`,
          'error'
        );
        return;
      }

      let lockedSkippedCount = 0;
      for (const row of newCourseRows) {
        const info = row.semesterInfo;
        const semesterId = buildSemesterId(info);
        // Ưu tiên học kỳ đã có trong app (theo tên/năm hoặc theo mã cố định).
        let semester = semesterByCanonical.get(info.canonical)
          || semesters.find((item) => item.id === semesterId);
        if (semester && lockedSemesterIds.has(semester.id)) {
          lockedSkippedCount += 1;
          continue;
        }
        if (!semester) {
          const newSemester = {
            name: `Học kỳ ${info.term} (${info.startYear} - ${info.endYear})`,
            rawName: `Học kỳ ${info.term}`,
            year: `${info.startYear} - ${info.endYear}`,
            status: 'Đang học',
          };
          newSemester.id = await ensureSemesterRecord(firebaseUser.uid, semesterId, newSemester);
          semester = newSemester;
          semesterByCanonical.set(info.canonical, semester);
          createdSemesters.push(semester);
        }

        const newCourse = buildCourseFromImportRow(row, semester);
        // Nhập Excel gặp môn đã trượt trước đó -> tự nối thành học lại để GPA tích lũy thay điểm F.
        const importPreview = getAddCoursePreview({
          courses: [...subjects, ...createdSubjects],
          name: newCourse.name,
          semesterId: semester.id,
        });
        if (importPreview.kind === 'retake') {
          newCourse.retakeOf = importPreview.latest.id;
          newCourse.attemptNo = importPreview.attemptNo;
          newCourse.courseId = importPreview.latest.courseId || null;
        }
        const created = await createCourseRecord(newCourse, [
          ...subjects.map((item) => item.id),
          ...createdSubjects.map((item) => item.id),
        ]);
        newCourse.id = created.id;
        newCourse.courseId = created.catalogId;
        createdSubjects.push(newCourse);
      }

      // Tách môn có điểm với môn chỉ cập nhật Số TC để báo đúng việc đã làm.
      const importedGradeIds = new Set(importResult.gradesBySubject.keys());
      [importResult.total10BySubject, importResult.total4BySubject, importResult.letterBySubject].forEach((map) => {
        if (map) map.forEach((_value, key) => importedGradeIds.add(key));
      });
      const originalById = new Map(subjects.map((subject) => [subject.id, subject]));
      const editableImportedIds = new Set(
        [...importedSubjectIds].filter((id) => {
          const subject = originalById.get(id);
          return subject && !lockedSemesterIds.has(subject.sem);
        })
      );
      const lockedImportedCount = importedSubjectIds.size - editableImportedIds.size;
      const creditsOnlyCount = [...editableImportedIds].filter((id) => !importedGradeIds.has(id)).length;

      const updatedSubjects = applyImportedGrades(subjects, importResult);
      // Giữ nguyên môn thuộc kỳ đã xác nhận (không ghi đè điểm đã khóa).
      const nextSubjects = updatedSubjects.map((subject) =>
        lockedSemesterIds.has(subject.sem) ? originalById.get(subject.id) || subject : subject
      );
      const editableUpdates = nextSubjects.filter(
        (subject) => importedSubjectIds.has(subject.id) && !lockedSemesterIds.has(subject.sem)
      );
      // Xét kết quả cuối cùng sau khi ghép điểm và trọng số nhập từ Excel.
      const remindersToDelete = editableUpdates.flatMap((course) => getRemindersToDelete(reminders, course));
      const enrollmentIds = editableUpdates.length > 0 || remindersToDelete.length > 0
        ? await updateCourseRecords(editableUpdates, remindersToDelete)
        : new Map();
      setSubjects([
        ...nextSubjects.map((subject) => enrollmentIds.has(subject.id)
          ? { ...subject, enrollmentDocumentId: enrollmentIds.get(subject.id) }
          : subject),
        ...createdSubjects,
      ]);
      if (remindersToDelete.length > 0) {
        const deletedReminderIds = new Set(remindersToDelete.map((reminder) => reminder.id));
        const remainingReminders = reminders.filter(
          (reminder) => !deletedReminderIds.has(reminder.id)
        );
        setReminders(remainingReminders);
        if (deletedReminderIds.has(selectedReminderId)) {
          setSelectedReminderId(remainingReminders[0]?.id || '');
        }
      }
      if (createdSemesters.length > 0) {
        setSemesters((current) => [...current, ...createdSemesters]);
      }

      const summaryParts = [];
      if (importedGradeIds.size > 0) {
        const editableGradeCount = [...importedGradeIds].filter((id) => editableImportedIds.has(id)).length;
        if (editableGradeCount > 0) summaryParts.push(`Đã nhập điểm cho ${editableGradeCount} môn`);
      }
      if (creditsOnlyCount > 0) {
        summaryParts.push(`Đã cập nhật tín chỉ cho ${creditsOnlyCount} môn`);
      }
      if (remindersToDelete.length > 0) {
        summaryParts.push(`Đã gỡ ${remindersToDelete.length} lịch nhắc thi đã hết tác dụng`);
      }
      if (createdSubjects.length > 0) {
        summaryParts.push(
          createdSemesters.length > 0
            ? `Đã tạo ${createdSubjects.length} học phần và ${createdSemesters.length} học kỳ mới`
            : `Đã tạo ${createdSubjects.length} học phần mới`
        );
      }
      if (lockedImportedCount > 0) {
        summaryParts.push(`Bỏ qua ${lockedImportedCount} môn thuộc học kỳ đã xác nhận`);
      }
      if (lockedSkippedCount > 0) {
        summaryParts.push(`Bỏ qua ${lockedSkippedCount} môn mới thuộc học kỳ đã xác nhận`);
      }
      const importSummary = summaryParts.length > 0
        ? `${summaryParts.join(', ')}.`
        : 'Không có thay đổi nào được ghi.';
      showGradeImportMessage(
        `${importSummary}${importResult.skippedRows ? ` Bỏ qua ${importResult.skippedRows} dòng không khớp hoặc không hợp lệ.` : ''}${invalidMessage}`,
        'success'
      );
    } catch (error) {
      // Giữ lại các học kỳ/học phần đã tạo thành công trước khi lỗi để không lệch với Firestore.
      if (createdSemesters.length > 0) {
        setSemesters((current) => [...current, ...createdSemesters]);
      }
      if (createdSubjects.length > 0) {
        setSubjects((current) => [...current, ...createdSubjects]);
      }
      showGradeImportMessage(
        `Không thể nhập file bảng điểm: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`,
        'error'
      );
    }
  };


  return {
    currentScreen,
    setCurrentScreen,
    firebaseUser,
    setFirebaseUser,
    profile,
    setProfile,
    isWorkspaceLoading,
    setIsWorkspaceLoading,
    isAuthBusy,
    setIsAuthBusy,
    authError,
    setAuthError,
    authNotice,
    setAuthNotice,
    operationError,
    setOperationError,
    pendingAuthSetup,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    rememberPassword,
    setRememberPassword: updateRememberPassword,
    registerName,
    setRegisterName,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    confirmRegisterPassword,
    setConfirmRegisterPassword,
    registerCredits,
    setRegisterCredits,
    registerSemesters,
    setRegisterSemesters,
    registerTargetGpa,
    setRegisterTargetGpa,
    isRegisterConfirmationVisible,
    setIsRegisterConfirmationVisible,
    resetEmail,
    setResetEmail,
    isShadeOpen,
    hasDueAlarm: canShowReminderShade && hasDueAlarm,
    openReminderShade,
    shadeReminderId,
    shadeReminderError,
    closeShade,
    snoozeReminder10m,
    shadePanResponder,
    semesterYearQuery,
    setSemesterYearQuery,
    subjectSearchQuery,
    setSubjectSearchQuery,
    selectedSemesterFilter,
    setSelectedSemesterFilter,
    selectedStatusFilter,
    setSelectedStatusFilter,
    gradeImportMessage,
    gradeImportMessageType,
    setGradeImportMessage,
    courseActionNotice,
    setCourseActionNotice,
    courseActionNoticeTimer,
    semesters,
    setSemesters,
    newSemesterName,
    setNewSemesterName,
    newSemesterYear,
    setNewSemesterYear,
    semesterFormError,
    setSemesterFormError,
    isSemesterFilterExpanded,
    setIsSemesterFilterExpanded,
    semesterFilterButtonWidth,
    setSemesterFilterButtonWidth,
    selectedSemesterId,
    setSelectedSemesterId,
    isWhatIfDropdownOpen,
    setIsWhatIfDropdownOpen,
    isTargetGradeDropdownOpen,
    setIsTargetGradeDropdownOpen,
    selectedWhatIfIndex,
    setSelectedWhatIfIndex,
    selectedTargetGrade,
    setSelectedTargetGrade,
    isAddCourseSemesterOpen,
    setIsAddCourseSemesterOpen,
    selectedAddCourseSemester,
    setSelectedAddCourseSemester,
    addCourseName,
    setAddCourseName,
    addCourseCredits,
    setAddCourseCredits,
    addCourseError,
    setAddCourseError,
    addCoursePreview,
    courseSemesterOptions,
    addCourseWeights,
    setAddCourseWeights,
    editCourseWeights,
    setEditCourseWeights,
    addWeightTotal,
    editWeightTotal,
    subjects,
    setSubjects,
    selectedCourseId,
    setSelectedCourseId,
    editCourseName,
    setEditCourseName,
    editCourseCredits,
    setEditCourseCredits,
    editCourseGrades,
    setEditCourseGrades,
    isDeleteCourseDialogVisible,
    setIsDeleteCourseDialogVisible,
    isConfirmSemesterDialogVisible,
    isConfirmingSemester,
    openConfirmSemesterDialog,
    closeConfirmSemesterDialog,
    confirmSemesterGrades,
    reminders,
    setReminders,
    activeReminders,
    selectedReminderId,
    setSelectedReminderId,
    isReminderCourseOpen,
    setIsReminderCourseOpen,
    newReminder,
    setNewReminder,
    reminderFormError,
    setReminderFormError,
    isSavingReminder,
    profileNotice,
    setProfileNotice,
    isProfileEditOpen,
    setIsProfileEditOpen,
    profileTargetGpa,
    setProfileTargetGpa,
    profileTotalCredits,
    setProfileTotalCredits,
    profileEditError,
    setProfileEditError,
    isSavingProfile,
    openProfileEdit,
    closeProfileEdit,
    saveProfileSettings,
    handleLogin,
    handleRegister,
    confirmRegister,
    handlePasswordReset,
    handleLogout,
    acknowledgeReminder,
    formatCourseMeta,
    TOTAL_PROGRAM_CREDITS,
    TOTAL_PROGRAM_SEMESTERS,
    formatSemesterGpa,
    formatSemesterAverage,
    isSemesterGpaProvisional,
    semesterStats,
    overallStats,
    remainingCredits,
    overallRank,
    hasOverallGpa,
    overallGpaText,
    overallAverageText,
    emptySemesterStats,
    currentSemesterStats,
    previousSemesterStats,
    gpaDelta,
    editingCourse,
    editedCourseTotal,
    showCourseActionNotice,
    dismissCourseActionNotice,
    openEditCourse,
    saveEditCourse,
    createSemester,
    deleteEditingCourse,
    createCourse,
    reminderCourseOptions,
    whatIfCourses,
    forecast,
    projectedGpa,
    openReminderDetail,
    saveNewReminder,
    exportGradeData,
    importGradesFromFile,
  };
}
