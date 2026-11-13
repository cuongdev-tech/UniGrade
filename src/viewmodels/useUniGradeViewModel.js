// ViewModel: toàn bộ state, hiệu ứng và xử lý nghiệp vụ của UniGrade.
// Được tách nguyên văn từ App.js (bước 4 MVVM) — không đổi logic hay giao diện.
import { useState, useEffect, useRef } from 'react';
import { PanResponder, Platform } from 'react-native';
import * as Excel from 'xlsx';
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
  confirmSemesterRecord,
  updateCourseRecord,
  updateCourseRecords,
  updateUserProfileRecord,
} from '../repositories/firebaseRepository';
import { getFirebaseServices } from '../firebase';
import {
  parseGradeValue,
  isGradeValueInvalid,
  getGradeLetter,
  parseLetterGrade,
  calcCourseTotal,
  getRankByGPA,
  calcSemesterStats,
  hasFinalSemesterGpa,
} from '../services/gradeService';
import {
  parseGradeSheet,
  applyImportedGrades,
  getImportedSubjectIds,
  buildGradeFormula,
  buildCourseFromImportRow,
  buildSemesterId,
  parseSemesterLabel,
} from '../services/gradeImportService';
import { getReminderAvailability } from '../services/reminderService';
import {
  EMAIL_ALREADY_EXISTS_MESSAGE,
  getFirebaseErrorMessage,
  getSemesterOptionLabel,
} from '../constants/config';
import {
  getAcademicYearStart,
  getSemesterDisplayStatus,
  canConfirmSemester,
} from '../models/semesterModel';

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
  const [isRegisterConfirmationVisible, setIsRegisterConfirmationVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  useEffect(() => {
    if (authError !== EMAIL_ALREADY_EXISTS_MESSAGE) return undefined;
    const timeoutId = setTimeout(() => setAuthError(''), 5000);
    return () => clearTimeout(timeoutId);
  }, [authError]);

  // Thanh thông báo mô phỏng hệ điều hành: vuốt từ mép trên xuống để mở
  const [isShadeOpen, setIsShadeOpen] = useState(false);
  const shadePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.y0 <= 60 && gesture.dy > 20 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.y0 <= 60 && gesture.dy > 20 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 36) setIsShadeOpen(true);
      },
    })
  ).current;

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
  const courseSemesterOptions = semesters.map(getSemesterOptionLabel);

  // State trọng số thành phần (%) cho Màn 7 (Thêm) và Màn 8 (Sửa)
  const [addCourseWeights, setAddCourseWeights] = useState({ cc: '10', gk: '30', ck: '60' });
  const [editCourseWeights, setEditCourseWeights] = useState({ cc: '10', gk: '30', ck: '60' });
  const addWeightTotal = (Number(addCourseWeights.cc) || 0) + (Number(addCourseWeights.gk) || 0) + (Number(addCourseWeights.ck) || 0);
  const editWeightTotal = (Number(editCourseWeights.cc) || 0) + (Number(editCourseWeights.gk) || 0) + (Number(editCourseWeights.ck) || 0);

  // State danh sách môn + môn đang sửa ở Màn 8 (UI state, chưa có backend)
  const [subjects, setSubjects] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('s2');
  const [editCourseName, setEditCourseName] = useState('Lập trình Di động');
  const [editCourseCredits, setEditCourseCredits] = useState('3');
  const [editCourseGrades, setEditCourseGrades] = useState({ cc: '9.0', gk: '8.5', ck: '9.0' });
  const [isDeleteCourseDialogVisible, setIsDeleteCourseDialogVisible] = useState(false);
  const [isConfirmSemesterDialogVisible, setIsConfirmSemesterDialogVisible] = useState(false);
  const [isConfirmingSemester, setIsConfirmingSemester] = useState(false);

  // State nhắc thi & hồ sơ (Màn 10, 11, 13, 14)
  const [reminders, setReminders] = useState([]);
  const [selectedReminderId, setSelectedReminderId] = useState('');
  const [isReminderCourseOpen, setIsReminderCourseOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    courseId: '',
    type: 'final',
    date: '',
    time: '',
    room: '',
    note: '',
    alarmDate: '',
    alarmTime: '',
  });
  const [reminderFormError, setReminderFormError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const profileNoticeTimer = useRef(null);

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
          setCurrentScreen(1);
          setIsWorkspaceLoading(false);
          return;
        }
        if (pendingAuthSetup.current) return;

        setIsWorkspaceLoading(true);
        setOperationError('');
        try {
          const workspace = await loadUserWorkspace(user.uid);
          setProfile(workspace.profile);
          setSemesters(workspace.semesters);
          setSubjects(workspace.courses);
          setReminders(workspace.reminders);
          setSelectedReminderId(workspace.reminders[0]?.id || '');
          setNewReminder((current) => ({
            ...current,
            courseId: workspace.courses[0]?.id || '',
          }));
          setSelectedSemesterId(workspace.semesters[0]?.id || '');
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
      setSelectedAddCourseSemester(courseSemesterOptions[0]);
    }
  }, [semesters]);

  const handleLogin = async () => {
    setAuthError('');
    setAuthNotice('');
    setOperationError('');
    if (!loginEmail.trim() || !loginPassword) {
      setAuthError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setIsAuthBusy(true);
    try {
      const { auth } = getFirebaseServices();
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
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
    const totalProgramCredits = Number(registerCredits);
    const totalProgramSemesters = Number(registerSemesters);
    const targetGpa = Number(registerTargetGpa);

    if (!fullName || !email || !registerPassword || !confirmRegisterPassword) {
      setAuthError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      return;
    }
    if (registerPassword !== confirmRegisterPassword) {
      setAuthError('Mật khẩu nhập lại không khớp.');
      return;
    }
    if (!Number.isInteger(totalProgramCredits) || totalProgramCredits < 1 ||
        !Number.isInteger(totalProgramSemesters) || totalProgramSemesters < 1 ||
        !Number.isFinite(targetGpa) || targetGpa < 0 || targetGpa > 4) {
      setAuthError('Tổng tín chỉ, số học kỳ hoặc GPA mục tiêu không hợp lệ.');
      return;
    }

    setIsRegisterConfirmationVisible(true);
  };

  const confirmRegister = async () => {
    setAuthError('');
    const fullName = registerName.trim();
    const email = registerEmail.trim();
    const totalProgramCredits = Number(registerCredits);
    const totalProgramSemesters = Number(registerSemesters);
    const targetGpa = Number(registerTargetGpa);
    setIsAuthBusy(true);
    pendingAuthSetup.current = true;
    try {
      const { auth } = getFirebaseServices();
      const credential = await createUserWithEmailAndPassword(auth, email, registerPassword);
      await updateProfile(credential.user, { displayName: fullName });
      await createUserProfile(credential.user.uid, {
        fullName,
        email,
        totalProgramCredits,
        totalProgramSemesters,
        targetGpa,
      });
      const workspace = await loadUserWorkspace(credential.user.uid);
      setFirebaseUser(credential.user);
      setProfile(workspace.profile);
      setSemesters(workspace.semesters);
      setSubjects(workspace.courses);
      setReminders(workspace.reminders);
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
    if (!resetEmail.trim()) {
      setAuthError('Vui lòng nhập email đã đăng ký.');
      return;
    }
    setIsAuthBusy(true);
    try {
      const { auth } = getFirebaseServices();
      await sendPasswordResetEmail(auth, resetEmail.trim());
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
    if (!selectedReminderId) return;
    const acknowledgedId = selectedReminderId;
    // Gỡ khỏi trang Nhắc thi ngay khi người dùng bấm xác nhận,
    // không chờ có điểm CK và không phụ thuộc trạng thái học kỳ.
    const remainingReminders = reminders.filter(
      (reminder) => reminder.id !== acknowledgedId && !reminder.isAcknowledged
    );
    setReminders((current) =>
      current.map((reminder) =>
        reminder.id === acknowledgedId ? { ...reminder, isAcknowledged: true } : reminder
      )
    );
    setSelectedReminderId(remainingReminders[0]?.id || '');
    setCurrentScreen(10);
    try {
      await acknowledgeReminderRecord(acknowledgedId);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
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
    const targetGpa = Number(profileTargetGpa);
    const totalProgramCredits = Number(profileTotalCredits);

    if (!Number.isFinite(targetGpa) || targetGpa < 0 || targetGpa > 4) {
      setProfileEditError('GPA mục tiêu phải nằm trong khoảng 0.00 – 4.00.');
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
    return sub.status === 'failed' ? `${base} • Không tính vào TC tích lũy` : base;
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
      status: getSemesterDisplayStatus(sem.status, sem.year, semesters),
      isConfirmed,
      // Nút "✓ Xác nhận điểm" chỉ hiện khi kỳ chưa chốt và 100% môn đã có điểm tổng kết.
      canConfirm: canConfirmSemester(sem.status, semesterCourses),
      stats: calcSemesterStats(semesterCourses),
    };
  });

  const overallStats = calcSemesterStats(subjects);
  const remainingCredits = Math.max(0, TOTAL_PROGRAM_CREDITS - overallStats.earnedCredits);
  const overallRank = getRankByGPA(overallStats.gpa);
  const hasOverallGpa = overallStats.gradedCredits > 0;
  const overallGpaText = hasOverallGpa ? overallStats.gpa.toFixed(2) : '--';
  const overallAverageText = hasOverallGpa ? overallStats.avg10.toFixed(2) : '--';
  const emptySemesterStats = calcSemesterStats([]);
  // Kỳ hiện tại: trong các kỳ còn "Đang học", chọn năm học lớn nhất.
  const currentSemesterStats = semesterStats
    .filter((sem) => sem.status === 'Đang học')
    .sort(
      (a, b) =>
        (getAcademicYearStart(b.year) || 0) - (getAcademicYearStart(a.year) || 0)
    )[0] || semesterStats[0] || {
    id: '',
    name: 'Chưa có học kỳ',
    rawName: 'Chưa có học kỳ',
    year: '',
    status: '',
    stats: emptySemesterStats,
  };
  const previousSemesterStats = semesterStats.find((sem) => sem.id !== currentSemesterStats.id);
  const gpaDelta = currentSemesterStats && previousSemesterStats
    ? Number(currentSemesterStats.stats.gpa.toFixed(2)) - Number(previousSemesterStats.stats.gpa.toFixed(2))
    : 0;

  const editingCourse = subjects.find((item) => item.id === selectedCourseId) || subjects[0];

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
    setEditCourseWeights({ ...sub.weights });
    setEditCourseGrades({
      cc: parseGradeValue(sub.cc) === null ? '' : sub.cc,
      gk: parseGradeValue(sub.gk) === null ? '' : sub.gk,
      ck: parseGradeValue(sub.ck) === null ? '' : sub.ck,
    });
    setCurrentScreen(8);
  };

  const saveEditCourse = async () => {
    if (!editingCourse || editingCourse.canEdit === false) {
      setOperationError('Học kỳ đã xác nhận điểm nên không thể sửa điểm.');
      return;
    }
    if (editWeightTotal !== 100 || Object.values(editCourseGrades).some(isGradeValueInvalid)) return;

    const savedCourseName = editCourseName.trim() || editingCourse.name;
    const weights = { ...editCourseWeights };
    const grades = { ...editCourseGrades };
    const total = calcCourseTotal(grades, weights);
    const missingParts = [
      Number(weights.cc) > 0 && parseGradeValue(grades.cc) === null ? 'CC' : null,
      Number(weights.gk) > 0 && parseGradeValue(grades.gk) === null ? 'GK' : null,
      Number(weights.ck) > 0 && parseGradeValue(grades.ck) === null ? 'CK' : null,
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
      name: editCourseName.trim() || editingCourse.name,
      credits: Math.min(10, Math.max(1, Number(editCourseCredits) || editingCourse.credits)),
      weights,
      cc: grades.cc.trim() || 'Chưa nhập',
      gk: grades.gk.trim() || 'Chưa nhập',
      ck: grades.ck.trim() || 'Chưa nhập',
      total: totalText,
      status,
      badge,
    };
    try {
      await updateCourseRecord(updatedCourse);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      return;
    }
    setSubjects((current) => current.map((item) => item.id === selectedCourseId ? updatedCourse : item));

    showCourseActionNotice({
      type: 'success',
      message: total !== null
        ? `Đã cập nhật điểm “${savedCourseName}”: Tổng ${totalText} • Điểm ${badge}.`
        : `Đã cập nhật thông tin học phần “${savedCourseName}”.`,
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
      await deleteCourseAndReminders(courseId, reminders);
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
      await confirmSemesterRecord(sem.id);
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
    const credits = Number(addCourseCredits);
    const semester = semesters.find(
      (item) => getSemesterOptionLabel(item) === selectedAddCourseSemester
    );

    if (!name) {
      setAddCourseError('Vui lòng nhập tên học phần.');
      return;
    }
    if (!Number.isInteger(credits) || credits < 1 || credits > 10) {
      setAddCourseError('Số tín chỉ phải là số nguyên từ 1 đến 10.');
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
      setAddCourseError('Tổng trọng số phải bằng 100% mới tạo được học phần.');
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
    };

    try {
      newCourse.id = await createCourseRecord(newCourse, subjects.map((item) => item.id));
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
      message: `Đã tạo học phần “${name}” • ${semester.rawName} (${semester.year}).`,
    });
    setCurrentScreen(6);
  };

  // ----- Môn của HỌC KỲ HIỆN TẠI (dùng cho Dự báo What-if & Nhắc thi) -----
  // Chỉ lấy môn thuộc kỳ đang học, không lấy môn của kỳ đã qua
  const currentSemesterCourses = subjects.filter((item) => item.sem === currentSemesterStats.id);
  const pendingCurrentCourses = currentSemesterCourses.filter((item) => parseGradeValue(item.ck) === null);
  const reminderCourses = pendingCurrentCourses.length > 0 ? pendingCurrentCourses : currentSemesterCourses;
  const whatIfCourses = reminderCourses.map((item) => {
    const ccWeight = Number(item.weights.cc) || 0;
    const gkWeight = Number(item.weights.gk) || 0;
    const ckWeight = Number(item.weights.ck) || 0;
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
      credits: item.credits,
      cc: ccValue,
      gk: gkValue,
      weights: item.weights,
      // Trọng số CK để dự báo = phần trăm còn lại sau CC + GK.
      remainingCkWeight: Math.max(0, 100 - ccWeight - gkWeight),
      detail: detailParts.length > 0 ? detailParts.join(' • ') : 'Chưa có trọng số thành phần',
    };
  });

  // ----- Lựa chọn học phần cho form nhắc thi (Màn 11) -----
  // Chỉ gợi ý môn còn thiếu điểm thi:
  // - Chưa có điểm CK -> được chọn (nhắc CK, và nhắc GK nếu chưa có điểm GK).
  // - Đã có điểm GK -> khóa lựa chọn Thi Giữa kỳ, chỉ còn Thi Cuối kỳ.
  // - Đã có điểm CK -> coi như thi xong, không hiện trong danh sách chọn nữa.
  // - Đã tạo lịch nhắc Giữa kỳ (dù đã xác nhận hay chưa) -> khóa lựa chọn Giữa kỳ.
  // - Đã tạo lịch nhắc Cuối kỳ (dù đã xác nhận hay chưa) -> môn biến mất khỏi danh sách.
  // Mỗi môn chỉ có tối đa 1 lịch nhắc cho mỗi loại thi, nên phải gom toàn bộ
  // reminders (kể cả chưa xác nhận) chứ không chỉ reminders đã xác nhận.
  const reminderTypesByCourse = reminders.reduce((acc, reminder) => {
    const types = acc[reminder.courseId] || [];
    if (!types.includes(reminder.type)) types.push(reminder.type);
    acc[reminder.courseId] = types;
    return acc;
  }, {});

  const reminderCourseOptions = currentSemesterCourses
    .map((course) => ({
      course,
      ...getReminderAvailability(course, reminderTypesByCourse[course.id] || []),
    }))
    .filter((option) => option.isEligible);

  // Giữ lựa chọn hợp lệ: môn đã có điểm CK bị loại khỏi danh sách, loại nhắc thi
  // đã có điểm cũng không còn chọn được -> tự chuyển sang lựa chọn còn lại.
  const reminderCourseOptionKey = reminderCourseOptions
    .map((option) => `${option.course.id}:${option.allowedTypes.join('|')}`)
    .join(',');

  useEffect(() => {
    if (reminderCourseOptions.length === 0) return;
    const currentOption =
      reminderCourseOptions.find((option) => option.course.id === newReminder.courseId) ||
      reminderCourseOptions[0];
    const nextType = currentOption.allowedTypes.includes(newReminder.type)
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

  // Đọc ngày DD/MM/YYYY + giờ HH:MM thành Date để so sánh báo thức với giờ thi.
  const parseDateTimeInput = (dateValue, timeValue) => {
    const dateMatch = String(dateValue || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const timeMatch = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!dateMatch || !timeMatch) return null;
    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }
    return parsed;
  };

  const saveNewReminder = async () => {
    const selectedOption = reminderCourseOptions.find(
      (option) => option.course.id === newReminder.courseId
    );
    if (!selectedOption) {
      setReminderFormError(
        'Học phần này đã có lịch nhắc thi cuối kỳ hoặc đã có điểm cuối kỳ. Vui lòng chọn học phần khác.'
      );
      return;
    }
    if (!selectedOption.allowedTypes.includes(newReminder.type)) {
      setReminderFormError(
        newReminder.type === 'mid'
          ? 'Học phần này đã có điểm giữa kỳ hoặc đã có lịch nhắc thi giữa kỳ. Vui lòng chọn loại Thi Cuối kỳ.'
          : 'Học phần này đã có lịch nhắc thi cuối kỳ hoặc đã có điểm cuối kỳ. Vui lòng chọn học phần khác.'
      );
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
    if (!newReminder.alarmDate.trim() || !newReminder.alarmTime.trim()) {
      setReminderFormError('Vui lòng nhập ngày và giờ báo thức trước giờ thi.');
      return;
    }
    const alarmDateTime = parseDateTimeInput(newReminder.alarmDate, newReminder.alarmTime);
    if (!alarmDateTime) {
      setReminderFormError('Ngày báo thức cần đúng dạng DD/MM/YYYY và giờ báo thức dạng HH:MM.');
      return;
    }
    if (alarmDateTime.getTime() >= examDateTime.getTime()) {
      setReminderFormError('Thời điểm báo thức phải trước giờ thi.');
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

    try {
      reminder.id = await createReminderRecord(reminder, reminders.map((item) => item.id));
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      return;
    }
    setReminders((current) => [reminder, ...current]);
    setSelectedReminderId(reminder.id);
    setReminderFormError('');
    setIsReminderCourseOpen(false);
    setNewReminder({
      courseId: course.id,
      type: 'final',
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
      const letterInfo = parseLetterGrade(item.badge);
      const total = parseGradeValue(item.total);
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
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });
      if (selection.canceled || !selection.assets || selection.assets.length === 0) return;

      const file = selection.assets[0];
      const isExcelFile = /\.(xls|xlsx)$/i.test(file.name || file.uri);
      if (!isExcelFile) {
        showGradeImportMessage('Vui lòng chọn file Excel có định dạng .xls hoặc .xlsx.', 'error');
        return;
      }

      const workbookData =
        Platform.OS === 'web'
          ? await fetch(file.uri).then((response) => {
              if (!response.ok) throw new Error('Không thể đọc file đã chọn.');
              return response.arrayBuffer();
            })
          : await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
      const workbook = Excel.read(workbookData, {
        type: Platform.OS === 'web' ? 'array' : 'base64',
      });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        showGradeImportMessage('File Excel không có trang tính để nhập.', 'error');
        return;
      }

      const rows = Excel.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
        header: 1,
        defval: '',
        raw: false,
      });
      const importResult = parseGradeSheet(rows, subjects);
      if (importResult.headerRowIndex === -1) {
        showGradeImportMessage(
          'Không nhận diện được tiêu đề cột. Cần có Tên môn học và ít nhất một cột điểm (CC/QT/BT, GK, CK, Thang 10, Thang 4 hoặc Chữ).',
          'error'
        );
        return;
      }

      const importedSubjectIds = getImportedSubjectIds(importResult);
      const newCourseRows = importResult.newCourses || [];
      if (importedSubjectIds.size === 0 && newCourseRows.length === 0) {
        showGradeImportMessage(
          'Không có điểm hợp lệ để nhập. Kiểm tra lại Tên môn học, Kỳ/Năm học và điểm trong file có khớp với app không (môn mới cần thêm Số TC).',
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
        newCourse.id = await createCourseRecord(newCourse, [
          ...subjects.map((item) => item.id),
          ...createdSubjects.map((item) => item.id),
        ]);
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
      if (editableUpdates.length > 0) {
        await updateCourseRecords(editableUpdates);
      }
      setSubjects([...nextSubjects, ...createdSubjects]);
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
        `${importSummary}${importResult.skippedRows ? ` Bỏ qua ${importResult.skippedRows} dòng không khớp hoặc không hợp lệ.` : ''}`,
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
        `Không thể nhập file Excel: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`,
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
    setRememberPassword,
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
    setIsShadeOpen,
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
    selectedReminderId,
    setSelectedReminderId,
    isReminderCourseOpen,
    setIsReminderCourseOpen,
    newReminder,
    setNewReminder,
    reminderFormError,
    setReminderFormError,
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
    showCourseActionNotice,
    dismissCourseActionNotice,
    openEditCourse,
    saveEditCourse,
    createSemester,
    deleteEditingCourse,
    createCourse,
    currentSemesterCourses,
    pendingCurrentCourses,
    reminderCourses,
    reminderCourseOptions,
    whatIfCourses,
    openReminderDetail,
    saveNewReminder,
    exportGradeData,
    importGradesFromFile,
  };
}
