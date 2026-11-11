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
  loadUserWorkspace,
  acknowledgeReminderRecord,
  updateCourseRecord,
  updateCourseRecords,
} from '../repositories/firebaseRepository';
import { getFirebaseServices } from '../firebase';
import {
  parseGradeValue,
  isGradeValueInvalid,
  getGradeLetter,
  calcCourseTotal,
  getRankByGPA,
  calcSemesterStats,
  hasFinalSemesterGpa,
} from '../services/gradeService';
import {
  EMAIL_ALREADY_EXISTS_MESSAGE,
  getFirebaseErrorMessage,
  getSemesterOptionLabel,
} from '../constants/config';

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
  const [selectedWhatIfIndex, setSelectedWhatIfIndex] = useState(0);
  const [selectedTargetGrade, setSelectedTargetGrade] = useState('A'); // A (8.5) | B+ (8.0) | B (7.0)
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
    advance: '1d',
  });
  const [reminderFormError, setReminderFormError] = useState('');
  const [profileNotice, setProfileNotice] = useState('');

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
    try {
      await acknowledgeReminderRecord(selectedReminderId);
      setCurrentScreen(10);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
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

  const formatSemesterGpa = (stats) => hasFinalSemesterGpa(stats) ? stats.gpa.toFixed(2) : '--';
  const formatSemesterAverage = (stats) => hasFinalSemesterGpa(stats) ? stats.avg10.toFixed(2) : '--';

  const semesterStats = semesters.map((sem) => ({
    ...sem,
    stats: calcSemesterStats(subjects.filter((item) => item.sem === sem.id)),
  }));

  const overallStats = calcSemesterStats(subjects);
  const remainingCredits = Math.max(0, TOTAL_PROGRAM_CREDITS - overallStats.earnedCredits);
  const overallRank = getRankByGPA(overallStats.gpa);
  const hasOverallGpa = overallStats.gradedCredits > 0;
  const overallGpaText = hasOverallGpa ? overallStats.gpa.toFixed(2) : '--';
  const overallAverageText = hasOverallGpa ? overallStats.avg10.toFixed(2) : '--';
  const emptySemesterStats = calcSemesterStats([]);
  const currentSemesterStats = semesterStats.find((sem) => sem.status === 'Đang học') || semesterStats[0] || {
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
  }, []);

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
      status: 'Đang học',
    };
    const previousSemesterIds = semesters
      .filter((semester) => semester.status === 'Đang học')
      .map((semester) => semester.id);
    let semesterId;
    try {
      semesterId = await createSemesterRecord(firebaseUser.uid, newSemester, previousSemesterIds);
    } catch (error) {
      setOperationError(getFirebaseErrorMessage(error));
      return;
    }
    newSemester.id = semesterId;
    setSemesters((current) => [
      ...current.map((semester) =>
        semester.status === 'Đang học' ? { ...semester, status: 'Hoàn thành' } : semester
      ),
      newSemester,
    ]);
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
      newCourse.id = await createCourseRecord(newCourse);
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
  const whatIfCourses = reminderCourses.map((item) => ({
    id: item.id,
    name: `${item.name} (${item.credits} TC)`,
    credits: item.credits,
    cc: parseGradeValue(item.cc),
    gk: parseGradeValue(item.gk),
    weights: item.weights,
    detail: `Đã có: CC ${item.cc} (${item.weights.cc}%) • GK ${item.gk} (${item.weights.gk}%)`,
  }));

  // ----- Helper cho luồng nhắc thi & hồ sơ (Màn 10, 11, 13, 14) -----
  const openReminderDetail = (reminder) => {
    setSelectedReminderId(reminder.id);
    setCurrentScreen(13);
  };

  const saveNewReminder = async () => {
    const course = currentSemesterCourses.find((item) => item.id === newReminder.courseId);
    if (!course) {
      setReminderFormError('Vui lòng chọn học phần cần nhắc thi.');
      return;
    }
    if (!newReminder.date.trim() || !newReminder.time.trim() || !newReminder.room.trim()) {
      setReminderFormError('Vui lòng nhập đầy đủ ngày thi, giờ thi và phòng thi.');
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
      advance: newReminder.advance,
    };

    try {
      reminder.id = await createReminderRecord(reminder);
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
      advance: '1d',
    });
    setCurrentScreen(10);
  };

  const exportGradeData = () => {
    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = subjects.map((item) =>
      [
        item.name,
        item.credits,
        item.semester,
        `${item.weights.cc}%`,
        `${item.weights.gk}%`,
        `${item.weights.ck}%`,
        item.cc,
        item.gk,
        item.ck,
        item.total,
        item.badge,
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [
      'Môn học,Tín chỉ,Học kỳ,Trọng số CC,Trọng số GK,Trọng số CK,Điểm CC,Điểm GK,Điểm CK,Tổng kết,Xếp loại',
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
      setProfileNotice('Đã xuất file CSV. (Xuất PDF cần thêm thư viện in ấn.)');
    } else {
      setProfileNotice('Đã tạo dữ liệu CSV (bản demo). Xuất PDF cần thêm thư viện.');
    }
  };

  const importGradesFromFile = async () => {
    setGradeImportMessage('');
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
        setGradeImportMessage('Vui lòng chọn file Excel có định dạng .xls hoặc .xlsx.');
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
        setGradeImportMessage('File Excel không có trang tính để nhập.');
        return;
      }

      const rows = Excel.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
        header: 1,
        defval: '',
        raw: false,
      });
      const normalizeHeader = (value) =>
        String(value)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
      const headerAliases = {
        name: ['tenmonhoc', 'monhoc', 'tenhocphan', 'hocphan', 'subject', 'course'],
        cc: ['cc', 'diemcc', 'chuyencan', 'diemchuyencan'],
        gk: ['gk', 'diemgk', 'giuaky', 'diemgiuaky'],
        ck: ['ck', 'diemck', 'cuoiky', 'diemcuoiky'],
      };

      let headerRowIndex = -1;
      let columns = {};
      for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
        const headers = rows[rowIndex].map(normalizeHeader);
        const foundColumns = {};
        Object.entries(headerAliases).forEach(([key, aliases]) => {
          foundColumns[key] = headers.findIndex((header) => aliases.includes(header));
        });
        if (foundColumns.name !== -1 && ['cc', 'gk', 'ck'].some((key) => foundColumns[key] !== -1)) {
          headerRowIndex = rowIndex;
          columns = foundColumns;
          break;
        }
      }
      if (headerRowIndex === -1) {
        setGradeImportMessage('Không nhận diện được tiêu đề cột. Cần có Tên môn học và ít nhất một cột CC, GK hoặc CK.');
        return;
      }

      const subjectByName = new Map(
        subjects.map((subject) => [
          normalizeHeader(subject.name),
          subject,
        ])
      );
      const importedGrades = new Map();
      let skippedRows = 0;
      for (const row of rows.slice(headerRowIndex + 1)) {
        const name = String(row[columns.name] || '').trim();
        if (!name) continue;

        const subject = subjectByName.get(normalizeHeader(name));
        if (!subject) {
          skippedRows += 1;
          continue;
        }

        const nextGrades = importedGrades.get(subject.id) || {};
        let hasGrade = false;
        let invalidGrade = false;
        ['cc', 'gk', 'ck'].forEach((key) => {
          const columnIndex = columns[key];
          if (columnIndex === -1 || String(row[columnIndex] ?? '').trim() === '') return;
          const grade = parseGradeValue(row[columnIndex]);
          if (grade === null || grade < 0 || grade > 10) {
            invalidGrade = true;
            return;
          }
          nextGrades[key] = grade.toFixed(1);
          hasGrade = true;
        });
        if (!hasGrade || invalidGrade) {
          skippedRows += 1;
          continue;
        }
        importedGrades.set(subject.id, nextGrades);
      }

      if (importedGrades.size === 0) {
        setGradeImportMessage('Không có điểm hợp lệ để nhập. Kiểm tra tên môn và điểm trong file.');
        return;
      }

      const updatedSubjects = subjects.map((subject) => {
        const imported = importedGrades.get(subject.id);
        if (!imported) return subject;

        const grades = {
          cc: parseGradeValue(subject.cc) === null ? '' : String(subject.cc),
          gk: parseGradeValue(subject.gk) === null ? '' : String(subject.gk),
          ck: parseGradeValue(subject.ck) === null ? '' : String(subject.ck),
          ...imported,
        };
        const total = calcCourseTotal(grades, subject.weights);
        const missingParts = ['cc', 'gk', 'ck'].filter(
          (key) => Number(subject.weights[key]) > 0 && parseGradeValue(grades[key]) === null
        );
        const grade = total === null ? null : getGradeLetter(total);

        return {
          ...subject,
          cc: grades.cc || 'Chưa nhập',
          gk: grades.gk || 'Chưa nhập',
          ck: grades.ck || 'Chưa nhập',
          total: total === null ? '--' : total.toFixed(2),
          status: grade ? grade.status : 'pending',
          badge: grade ? grade.text : missingParts.length ? `Chờ nhập ${missingParts.join('/')}` : 'Chờ điểm',
        };
      });
      await updateCourseRecords(updatedSubjects.filter((subject) => importedGrades.has(subject.id)));
      setSubjects(updatedSubjects);
      setGradeImportMessage(
        `Đã nhập điểm cho ${importedGrades.size} môn.${skippedRows ? ` Bỏ qua ${skippedRows} dòng không khớp hoặc không hợp lệ.` : ''}`
      );
    } catch (error) {
      setGradeImportMessage(
        `Không thể nhập file Excel: ${error instanceof Error ? error.message : 'Lỗi không xác định.'}`
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
    whatIfCourses,
    openReminderDetail,
    saveNewReminder,
    exportGradeData,
    importGradesFromFile,
  };
}
