

import React, { useState, useEffect, useRef } from 'react';
import * as Excel from 'xlsx';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Ionicons from '@expo/vector-icons/Ionicons';
import NotificationShade from './src/components/NotificationShade';
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
} from './src/firebaseRepository';
import { getFirebaseServices } from './src/firebase';

// Tự động nhúng font Inter chuẩn như trên Figma khi chạy trên trình duyệt Web (VS Code)
const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
if (typeof document !== 'undefined') {
  const linkId = 'unigrade-inter-font';
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
  const styleId = 'unigrade-font-Wait';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `body, input, textarea, select, button { font-family: ${FONT_FAMILY}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }`;
    document.head.appendChild(style);
  }
}
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  PanResponder,
  Modal,
} from 'react-native';

// 1. BẢNG MÀU CHUẨN DESIGN SYSTEM (TUẦN 2)
const COLORS = {
  bg: '#F8FAFC',
  white: '#FFFFFF',
  blue: '#2563EB',        // Thành viên 1: Dashboard & Học kỳ (Màn 3, 4, 5)
  blueLight: '#EFF6FF',
  purple: '#7C3AED',      // Thành viên 2: Môn học, Sửa điểm & Dự báo (Màn 6, 7, 8, 9)
  purpleLight: '#F5F3FF',
  green: '#10B981',       // Thành viên 3: Đăng nhập, Đăng ký & Nhắc thi (Màn 1, 2, 10, 11, 12)
  greenLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  textDark: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

// 2. DỮ LIỆU MẪU TĨNH (STATIC MOCK DATA CHO TUẦN 2)
const SEMESTERS_DATA = [
  { id: 'hk1', name: 'Học kỳ 1 (2026 - 2027)', rawName: 'Học kỳ 1', year: '2026 - 2027', status: 'Đang học' },
  { id: 'hk2', name: 'Học kỳ 2 (2025 - 2026)', rawName: 'Học kỳ 2', year: '2025 - 2026', status: 'Hoàn thành' },
];

const SUBJECTS_LIST_DATA = [
  // ----- HỌC KỲ 1 (2026 - 2027) - 5 học phần / 15 TC -----
  {
    id: 's1',
    name: 'Kiểm thử Phần mềm',
    credits: 3,
    semester: 'HK1 (2026-2027)',
    sem: 'hk1',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'pending',
    badge: 'Chờ nhập CK',
    cc: '9.0',
    gk: '8.0',
    ck: 'Chưa nhập',
    total: '--',
    canEdit: true,
  },
  {
    id: 's2',
    name: 'Lập trình Di động',
    credits: 3,
    semester: 'HK1 (2026-2027)',
    sem: 'hk1',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'passed',
    badge: 'A (3.7)',
    cc: '9.0',
    gk: '8.5',
    ck: '9.0',
    total: '8.85',
    canEdit: true,
  },
  {
    id: 's3',
    name: 'Cơ sở Dữ liệu',
    credits: 4,
    semester: 'HK1 (2026-2027)',
    sem: 'hk1',
    weights: { cc: '20', gk: '30', ck: '50' },
    status: 'passed',
    badge: 'B+ (3.5)',
    cc: '8.5',
    gk: '8.0',
    ck: '8.0',
    total: '8.10',
    canEdit: true,
  },
  {
    id: 's4',
    name: 'Công nghệ Phần mềm',
    credits: 3,
    semester: 'HK1 (2026-2027)',
    sem: 'hk1',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'pending',
    badge: 'Chờ nhập CK',
    cc: '9.0',
    gk: '8.5',
    ck: 'Chưa nhập',
    total: '--',
    canEdit: true,
  },
  {
    id: 's5',
    name: 'Mạng Máy tính',
    credits: 2,
    semester: 'HK1 (2026-2027)',
    sem: 'hk1',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'pending',
    badge: 'Chờ nhập CK',
    cc: '8.0',
    gk: '7.5',
    ck: 'Chưa nhập',
    total: '--',
    canEdit: true,
  },

  // ----- HỌC KỲ 2 (2025 - 2026) - 6 học phần / 18 TC (đã kết thúc, không sửa) -----
  {
    id: 's6',
    name: 'Giải tích 1 (Trượt - Học lại)',
    credits: 3,
    semester: 'HK2 (2025-2026)',
    sem: 'hk2',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'failed',
    badge: 'F (0.0)',
    cc: '5.0',
    gk: '3.5',
    ck: '3.0',
    total: '3.35',
    canEdit: false,
  },
  {
    id: 's7',
    name: 'Vật lý Đại cương',
    credits: 3,
    semester: 'HK2 (2025-2026)',
    sem: 'hk2',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'passed',
    badge: 'B (3.0)',
    cc: '8.0',
    gk: '7.5',
    ck: '7.5',
    total: '7.55',
    canEdit: false,
  },
  {
    id: 's8',
    name: 'Tiếng Anh B1',
    credits: 3,
    semester: 'HK2 (2025-2026)',
    sem: 'hk2',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'passed',
    badge: 'A (3.7)',
    cc: '9.0',
    gk: '8.5',
    ck: '8.5',
    total: '8.55',
    canEdit: false,
  },
  {
    id: 's9',
    name: 'Kỹ năng mềm',
    credits: 2,
    semester: 'HK2 (2025-2026)',
    sem: 'hk2',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'passed',
    badge: 'A+ (4.0)',
    cc: '9.0',
    gk: '9.0',
    ck: '9.0',
    total: '9.00',
    canEdit: false,
  },
  {
    id: 's10',
    name: 'Toán Rời rạc',
    credits: 4,
    semester: 'HK2 (2025-2026)',
    sem: 'hk2',
    weights: { cc: '20', gk: '30', ck: '50' },
    status: 'passed',
    badge: 'B+ (3.5)',
    cc: '8.5',
    gk: '8.0',
    ck: '8.0',
    total: '8.10',
    canEdit: false,
  },
  {
    id: 's11',
    name: 'Lập trình Hướng đối tượng',
    credits: 3,
    semester: 'HK2 (2025-2026)',
    sem: 'hk2',
    weights: { cc: '10', gk: '30', ck: '60' },
    status: 'passed',
    badge: 'B+ (3.5)',
    cc: '8.0',
    gk: '8.0',
    ck: '8.0',
    total: '8.00',
    canEdit: false,
  },
];

// 3. CẤU HÌNH NHẮC THI (MÀN 10, 11, 13, 14)
const REMINDER_TYPES = [
  { key: 'final', label: 'Thi Cuối kỳ' },
  { key: 'mid', label: 'Thi Giữa kỳ' },
];

const REMINDER_ADVANCES = [
  { key: '1d', label: 'Trước 1 ngày' },
  { key: '2h', label: 'Trước 2 giờ' },
  { key: '30m', label: 'Trước 30 phút' },
];

const getReminderTypeLabel = (key) => (REMINDER_TYPES.find((item) => item.key === key) || REMINDER_TYPES[0]).label;
const getReminderAdvanceLabel = (key) => (REMINDER_ADVANCES.find((item) => item.key === key) || REMINDER_ADVANCES[0]).label;
const getSemesterOptionLabel = (semester) =>
  `${semester.rawName.replace(/^Học kỳ\s*/, 'HK')} ${semester.year.replace(/\s*-\s*/, '-')}`.trim();

const EMAIL_ALREADY_EXISTS_MESSAGE = 'Email này đã tồn tại. Vui lòng dùng email khác.';

const getFirebaseErrorMessage = (error) => {
  const messages = {
    'auth/invalid-email': 'Email không đúng định dạng.',
    'auth/user-not-found': 'Không tìm thấy tài khoản với email này.',
    'auth/wrong-password': 'Mật khẩu không chính xác.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
    'auth/email-already-in-use': EMAIL_ALREADY_EXISTS_MESSAGE,
    'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.',
    'auth/network-request-failed': 'Không thể kết nối mạng. Hãy kiểm tra Internet rồi thử lại.',
    'permission-denied': 'Firestore từ chối thao tác. Hãy kiểm tra Rules và UID của tài khoản.',
  };
  return messages[error?.code] || error?.message || 'Đã xảy ra lỗi không xác định.';
};

export default function App() {
  // Quản lý luồng di chuyển giữa 12 màn hình chính + 2 màn phụ (Screen State)
  // 1: Đăng nhập | 2: Đăng ký | 3: Dashboard | 4: Quản lý Học kỳ | 5: Bảng điểm HK1
  // 6: Danh sách Môn | 7: Thêm Học phần mới | 8: Sửa Học phần & Sửa điểm
  // 9: Dự báo Điểm What-if | 10: Nhắc thi & Hồ sơ | 11: Thêm Lịch Nhắc Thi Mới | 12: Quên Mật Khẩu
  // 13 (phụ): Chi tiết thông báo nhắc thi (mở từ thông báo, quay lại Màn 10 - Nhắc thi)
  // Lưu ý: màn khóa + banner thông báo là UI của hệ điều hành, không phải màn hình trong app.
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
  const parseGradeValue = (value) => {
    const num = parseFloat(String(value ?? '').replace(',', '.'));
    return Number.isNaN(num) ? null : num;
  };

  const isGradeValueInvalid = (value) => {
    const normalized = String(value ?? '').trim().replace(',', '.');
    if (!normalized) return false;
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return true;
    const grade = Number(normalized);
    return !Number.isFinite(grade) || grade < 0 || grade > 10;
  };

  const getGradeLetter = (total) => {
    if (total >= 9.0) return { text: 'A+ (4.0)', point: 4.0, status: 'passed', rank: 'Xuất sắc' };
    if (total >= 8.5) return { text: 'A (3.7)', point: 3.7, status: 'passed', rank: 'Giỏi' };
    if (total >= 8.0) return { text: 'B+ (3.5)', point: 3.5, status: 'passed', rank: 'Khá giỏi' };
    if (total >= 7.0) return { text: 'B (3.0)', point: 3.0, status: 'passed', rank: 'Khá' };
    if (total >= 6.5) return { text: 'C+ (2.5)', point: 2.5, status: 'passed', rank: 'Trung bình khá' };
    if (total >= 5.5) return { text: 'C (2.0)', point: 2.0, status: 'passed', rank: 'Trung bình' };
    if (total >= 5.0) return { text: 'D+ (1.5)', point: 1.5, status: 'passed', rank: 'Trung bình yếu' };
    if (total >= 4.0) return { text: 'D (1.0)', point: 1.0, status: 'passed', rank: 'Yếu' };
    return { text: 'F (0.0)', point: 0, status: 'failed', rank: 'Kém' };
  };

  const calcCourseTotal = (grades, weights) => {
    if (Object.values(grades).some(isGradeValueInvalid)) return null;
    const cc = parseGradeValue(grades.cc);
    const gk = parseGradeValue(grades.gk);
    const ck = parseGradeValue(grades.ck);
    const wc = Number(weights.cc) || 0;
    const wg = Number(weights.gk) || 0;
    const wk = Number(weights.ck) || 0;
    if (wc + wg + wk !== 100) return null;
    // Đầu điểm có trọng số 0% thì không bắt buộc phải nhập.
    if ((wc > 0 && cc === null) || (wg > 0 && gk === null) || (wk > 0 && ck === null)) return null;
    return ((cc ?? 0) * wc + (gk ?? 0) * wg + (ck ?? 0) * wk) / 100;
  };

  const formatCourseMeta = (sub) => {
    const base = `${sub.credits} Tín chỉ • ${sub.semester} • ${sub.weights.cc}%-${sub.weights.gk}%-${sub.weights.ck}%`;
    return sub.status === 'failed' ? `${base} • Không tính vào TC tích lũy` : base;
  };

  // ----- Tính GPA / TBC tự động từ danh sách môn (UI only) -----
  const TOTAL_PROGRAM_CREDITS = profile?.totalProgramCredits || 130;
  const TOTAL_PROGRAM_SEMESTERS = profile?.totalProgramSemesters || 8;

  const getRankByGPA = (gpa) => {
    if (gpa >= 3.6) return { text: 'Xuất sắc', tone: 'green' };
    if (gpa >= 3.2) return { text: 'Giỏi', tone: 'green' };
    if (gpa >= 2.5) return { text: 'Khá', tone: 'blue' };
    if (gpa >= 2.0) return { text: 'Trung bình', tone: 'amber' };
    if (gpa >= 1.0) return { text: 'Yếu', tone: 'amber' };
    return { text: 'Kém', tone: 'red' };
  };

  const calcSemesterStats = (list) => {
    const graded = list.filter((item) => parseGradeValue(item.total) !== null);
    const gradedCredits = graded.reduce((sum, item) => sum + item.credits, 0);
    const totalCredits = list.reduce((sum, item) => sum + item.credits, 0);
    const earnedCredits = list
      .filter((item) => item.status === 'passed')
      .reduce((sum, item) => sum + item.credits, 0);
    const failedCredits = list
      .filter((item) => item.status === 'failed')
      .reduce((sum, item) => sum + item.credits, 0);
    const gpa = gradedCredits
      ? graded.reduce((sum, item) => sum + getGradeLetter(parseGradeValue(item.total)).point * item.credits, 0) / gradedCredits
      : 0;
    const avg10 = gradedCredits
      ? graded.reduce((sum, item) => sum + parseGradeValue(item.total) * item.credits, 0) / gradedCredits
      : 0;

    return {
      gpa,
      avg10,
      gradedCredits,
      totalCredits,
      earnedCredits,
      failedCredits,
      count: list.length,
      gradedCount: graded.length,
    };
  };

  const hasFinalSemesterGpa = (stats) => stats.count > 0 && stats.gradedCount === stats.count;
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

  // ==========================================================================
  // MÀN HÌNH 1: ĐĂNG NHẬP (THÀNH VIÊN 3 - MÀU XANH LÁ)
  // ==========================================================================
  const renderScreen1Login = () => (
    <ScrollView contentContainerStyle={styles.authScroll}>
      <View style={styles.logoBox}>
        <Text style={styles.logoText}>U</Text>
      </View>
      <Text style={styles.authTitle}>Đăng Nhập UniGrade</Text>
      <Text style={styles.authSub}>Quản lý điểm số, tín chỉ & dự báo GPA đại học</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Email sinh viên</Text>
        <TextInput
          style={styles.input}
          value={loginEmail}
          onChangeText={setLoginEmail}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={styles.label}>Mật khẩu</Text>
        <TextInput
          style={styles.input}
          value={loginPassword}
          onChangeText={setLoginPassword}
          placeholder="Nhập mật khẩu"
          secureTextEntry
          autoComplete="password"
        />

        <View style={styles.rowBetween}>
          <TouchableOpacity
            style={styles.rememberPasswordOption}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberPassword }}
            onPress={() => setRememberPassword((checked) => !checked)}
          >
            <View style={[styles.rememberPasswordCheckbox, rememberPassword && styles.rememberPasswordCheckboxChecked]}>
              {rememberPassword && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
            </View>
            <Text style={styles.rememberPasswordText}>Nhớ mật khẩu</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentScreen(12)}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.blue, textDecorationLine: 'underline' }}>Quên mật khẩu?</Text>
          </TouchableOpacity>
        </View>

        {!!authError && (
          <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600', marginTop: 10 }}>
            {authError}
          </Text>
        )}
        {isWorkspaceLoading && (
          <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 10 }}>Đang kết nối Firebase...</Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.green, marginTop: 14, opacity: isAuthBusy || isWorkspaceLoading ? 0.6 : 1 }]}
          onPress={handleLogin}
          disabled={isAuthBusy || isWorkspaceLoading}
        >
          <Text style={styles.primaryBtnText}>{isAuthBusy ? 'Đang đăng nhập...' : 'Đăng nhập vào bảng điểm'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cardCenter} onPress={() => setCurrentScreen(2)}>
        <Text style={{ fontSize: 13, color: COLORS.textMuted }}>
          Chưa có tài khoản? <Text style={{ color: COLORS.green, fontWeight: '600', textDecorationLine: 'underline' }}>Đăng ký ngay <Ionicons name="arrow-forward" size={12} color={COLORS.green} /></Text>
        </Text>
      </TouchableOpacity>

      <View style={styles.offlineBanner}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.green }}>
          <Ionicons name="shield-checkmark-outline" size={13} color={COLORS.green} /> Phiên đăng nhập an toàn
        </Text>
        <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
          Ứng dụng ghi nhớ phiên đăng nhập trên thiết bị. Cần có mạng để đồng bộ dữ liệu.
        </Text>
      </View>
    </ScrollView>
  );

  // ==========================================================================
  // MÀN HÌNH 2: ĐĂNG KÝ TÀI KHOẢN (THÀNH VIÊN 3 - MÀU XANH LÁ)
  // ==========================================================================
  const renderScreen2Register = () => (
    <ScrollView contentContainerStyle={styles.authScroll}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={[styles.screenTitle, { fontSize: 22 }]}>Đăng Ký Tài Khoản</Text>
          <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: -10, marginBottom: 12 }}>
            Tạo tài khoản sinh viên mới trên UniGrade
          </Text>
        </View>
        <View style={[styles.logoBoxSmall, { backgroundColor: COLORS.green }]}>
          <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 16 }}>U</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Họ và tên sinh viên *</Text>
        <TextInput
          style={styles.input}
          value={registerName}
          onChangeText={setRegisterName}
          placeholder="Nguyễn Văn A"
          autoComplete="name"
        />

        <Text style={styles.label}>Email sinh viên *</Text>
        <TextInput
          style={styles.input}
          value={registerEmail}
          onChangeText={setRegisterEmail}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Mật khẩu *</Text>
            <TextInput
              style={styles.input}
              value={registerPassword}
              onChangeText={setRegisterPassword}
              placeholder="Ít nhất 6 ký tự"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Nhập lại MK *</Text>
            <TextInput
              style={styles.input}
              value={confirmRegisterPassword}
              onChangeText={setConfirmRegisterPassword}
              placeholder="Nhập lại mật khẩu"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>
        </View>

        {/* Yêu cầu bổ sung: Nhập tổng số tín chỉ chương trình đào tạo & số học kỳ */}
        <View style={[styles.rowGap, { backgroundColor: COLORS.greenLight, padding: 10, borderRadius: 12, marginBottom: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: COLORS.green }]}>Tổng TC chương trình *</Text>
            <TextInput
              style={[styles.input, { marginBottom: 0, backgroundColor: COLORS.white }]}
              value={registerCredits}
              onChangeText={(value) => setRegisterCredits(value.replace(/[^0-9]/g, ''))}
              placeholder="Ví dụ: 130"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: COLORS.green }]}>Tổng số học kỳ *</Text>
            <TextInput
              style={[styles.input, { marginBottom: 0, backgroundColor: COLORS.white }]}
              value={registerSemesters}
              onChangeText={(value) => setRegisterSemesters(value.replace(/[^0-9]/g, ''))}
              placeholder="Ví dụ: 8"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.label}>Mục tiêu GPA Toàn khóa (Hệ 4.0)</Text>
        <View style={styles.rowGap}>
          {[
            { value: '2.5', label: 'Khá (2.5)' },
            { value: '3.2', label: 'Giỏi (3.2)' },
            { value: '3.6', label: 'Xuất sắc (3.6)' },
          ].map((target) => (
            <TouchableOpacity
              key={target.value}
              style={registerTargetGpa === target.value ? [styles.chipActive, { backgroundColor: COLORS.green }] : styles.chipGray}
              onPress={() => setRegisterTargetGpa(target.value)}
            >
              <Text style={registerTargetGpa === target.value ? styles.chipActiveText : styles.chipGrayText}>
                {target.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.green, marginTop: 14, opacity: isAuthBusy ? 0.6 : 1 }]}
          onPress={handleRegister}
          disabled={isAuthBusy}
        >
          <Text style={styles.primaryBtnText}>{isAuthBusy ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}</Text>
        </TouchableOpacity>
        {!!authError && (
          <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '500', textAlign: 'center', marginTop: 8 }}>
            {authError}
          </Text>
        )}
      </View>

      <TouchableOpacity style={styles.cardCenter} onPress={() => setCurrentScreen(1)}>
        <Text style={{ fontSize: 13, color: COLORS.textMuted }}>
          Đã có tài khoản? <Text style={{ color: COLORS.green, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' }}><Ionicons name="arrow-back" size={14} color={COLORS.green} /> Quay lại Đăng nhập</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ==========================================================================
  // MÀN HÌNH 3: TRANG CHỦ DASHBOARD (THÀNH VIÊN 1 - MÀU XANH DƯƠNG)
  // ==========================================================================
  const renderScreen3Dashboard = () => {
    const earnedPercent = Math.round((overallStats.earnedCredits / TOTAL_PROGRAM_CREDITS) * 100);
    const chartSemesters = [...semesterStats].reverse();
    const rankBadge = overallRank.tone === 'green' ? styles.badgeGreen : overallRank.tone === 'blue' ? styles.badgeBlue : overallRank.tone === 'amber' ? styles.badgeAmber : styles.badgeRed;
    const rankBadgeText = overallRank.tone === 'green' ? styles.badgeGreenText : overallRank.tone === 'blue' ? styles.badgeBlueText : overallRank.tone === 'amber' ? styles.badgeAmberText : styles.badgeRedText;

    return (
    <ScrollView contentContainerStyle={styles.bodyPadding}>
      {!!courseActionNotice && courseActionNotice.type === 'info' && (
        <View style={[styles.courseActionNotice, styles.courseActionNoticeInfo]}>
          <Text style={[styles.courseActionNoticeText, styles.courseActionNoticeInfoText]}>
            {courseActionNotice.message}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Đóng thông báo"
            onPress={dismissCourseActionNotice}
          >
            <Ionicons name="close" size={16} color={COLORS.blue} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.rowBetween}>
        <View>
          <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
                Xin chào, {profile?.fullName || firebaseUser?.displayName || 'Sinh viên'} <Ionicons name="hand-left-outline" size={13} color={COLORS.textMuted} />
          </Text>
          <Text style={styles.screenTitle}>Tổng quan Kết quả học tập</Text>
        </View>
        <View style={hasOverallGpa ? rankBadge : styles.badgeGray}>
          <Text style={hasOverallGpa ? rankBadgeText : styles.badgeGrayText}>
            {hasOverallGpa ? overallRank.text : '--'}
          </Text>
        </View>
      </View>

      {/* Thẻ GPA Tích lũy */}
      <View style={styles.heroBlueCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.heroSub}>GPA Tích lũy (Hệ 4)</Text>
            <Text style={styles.heroBig}>{overallGpaText} <Text style={{ fontSize: 16, fontWeight: '400' }}>/ 4.0</Text></Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroSub}>Điểm Hệ 10</Text>
            <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: '600' }}>{overallAverageText}</Text>
          </View>
        </View>
        <View style={[styles.rowBetween, { marginTop: 8 }]}>
          <Text style={styles.heroSub}>TC tích lũy: {overallStats.earnedCredits} / {TOTAL_PROGRAM_CREDITS} TC (Còn lại: {remainingCredits} TC)</Text>
          <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 12 }}>{earnedPercent}%</Text>
        </View>
        <Text style={{ color: '#FDE68A', fontSize: 11, marginTop: 4 }}>
          * Không tính học phần trượt (Điểm F &lt; 4.0) vào TC tích lũy
        </Text>
      </View>

      {/* Biểu đồ xu hướng GPA các kỳ */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardHeader}>Biểu đồ xu hướng GPA các kỳ</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: hasFinalSemesterGpa(currentSemesterStats.stats) ? (gpaDelta >= 0 ? COLORS.green : COLORS.danger) : COLORS.textMuted }}>
            {hasFinalSemesterGpa(currentSemesterStats.stats) ? `${gpaDelta >= 0 ? '+' : ''}${gpaDelta.toFixed(2)} kỳ này` : '-- kỳ này'}
          </Text>
        </View>
        <View style={styles.chartBox}>
          {chartSemesters.map((sem, index) => {
            const isActive = index === chartSemesters.length - 1;
            const hasFinalGpa = hasFinalSemesterGpa(sem.stats);
            const h = hasFinalGpa ? Math.max(16, Math.round((sem.stats.gpa / 4) * 90)) : 16;
            return (
              <View key={sem.id} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isActive ? COLORS.blue : COLORS.textMuted }}>
                  {formatSemesterGpa(sem.stats)}
                </Text>
                <View style={{ width: 34, height: h, backgroundColor: hasFinalGpa ? (isActive ? COLORS.blue : '#93C5FD') : COLORS.border, borderRadius: 6, marginVertical: 4 }} />
                <Text style={{ fontSize: 11, color: isActive ? COLORS.blue : COLORS.textMuted, fontWeight: isActive ? '700' : '400' }}>
                  {sem.rawName.replace('Học kỳ ', 'HK')}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Danh sách Học kỳ + Tìm kiếm Học kỳ theo Năm học */}
      <View style={[styles.rowBetween, { marginBottom: 8 }]}>
        <Text style={styles.sectionTitle}>Danh sách Học kỳ ({semesterStats.length}/{TOTAL_PROGRAM_SEMESTERS} kỳ)</Text>
        <TouchableOpacity onPress={() => setCurrentScreen(4)}>
          <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 13 }}>+ Thêm kỳ mới</Text>
        </TouchableOpacity>
      </View>

      <View style={{ position: 'relative', justifyContent: 'center' }}>
        <TextInput
          style={[styles.searchBar, { paddingLeft: 34 }]}
          placeholder="Tìm học kỳ theo năm học (VD: 2026)..."
          value={semesterYearQuery}
          onChangeText={setSemesterYearQuery}
        />
        <Ionicons name="search" size={15} color={COLORS.textMuted} style={{ position: 'absolute', left: 12 }} />
      </View>

      {semesterStats.filter((item) =>
        item.name.toLowerCase().includes(semesterYearQuery.toLowerCase())
      ).map((sem) => (
        <TouchableOpacity
          key={sem.id}
          style={[styles.card, styles.rowBetween]}
          onPress={() => {
            setSelectedSemesterId(sem.id);
            setCurrentScreen(5);
          }}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.itemTitle}>{sem.name}</Text>
            <Text style={styles.itemSub}>
              {sem.stats.count} học phần • Đạt {sem.stats.earnedCredits}/{sem.stats.totalCredits} TC
              {sem.stats.failedCredits > 0 ? ` (Trượt ${sem.stats.failedCredits} TC)` : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={[styles.badgeBlue, { width: 84, alignItems: 'center' }]}>
              <Text style={styles.badgeBlueText}>GPA: {formatSemesterGpa(sem.stats)}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
      {semesterStats.length === 0 && (
        <View style={styles.card}>
          <Text style={[styles.itemSub, { textAlign: 'center', marginBottom: 10 }]}>
            Tài khoản chưa có học kỳ. Hãy tạo học kỳ đầu tiên để bắt đầu nhập môn học.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.blue }]}
            onPress={() => setCurrentScreen(4)}
          >
            <Text style={styles.primaryBtnText}>Tạo học kỳ đầu tiên</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    );
  };

  // ==========================================================================
  // MÀN HÌNH 4: QUẢN LÝ HỌC KỲ (THÀNH VIÊN 1 - MÀU XANH DƯƠNG)
  // ==========================================================================
  const renderScreen4SemesterManage = () => (
    <ScrollView contentContainerStyle={styles.bodyPadding}>
      <TouchableOpacity style={styles.backLinkRow} onPress={() => setCurrentScreen(3)}>
        <Ionicons name="arrow-back" size={16} color={COLORS.blue} />
        <Text style={styles.backLinkBlue}>Quay lại</Text>
      </TouchableOpacity>

      <View style={styles.rowBetween}>
        <Text style={styles.screenTitle}>Quản lý Học kỳ (CRUD)</Text>
      </View>

      {/* Dòng Số tín chỉ còn lại phải học */}
      <View style={[styles.card, { backgroundColor: COLORS.blueLight, borderColor: COLORS.blue }]}>
        <View style={styles.rowBetween}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.blue }}>
            <Ionicons name="pin" size={13} color={COLORS.blue} /> Số tín chỉ còn lại phải học:
          </Text>
          <Text style={styles.badgeBlueText}>{remainingCredits} / {TOTAL_PROGRAM_CREDITS} TC</Text>
        </View>
        <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
          Đã tích lũy: {overallStats.earnedCredits} TC (Không tính {overallStats.failedCredits} TC môn trượt) • Học kỳ: {semesterStats.length} / {TOTAL_PROGRAM_SEMESTERS} kỳ
        </Text>
      </View>

      {/* Form Thêm Học kỳ mới */}
      <View style={[styles.card, { borderColor: COLORS.blue, borderWidth: 1.5 }]}>
        <Text style={[styles.cardHeader, { color: COLORS.blue }]}>
          <Ionicons name="add-circle" size={14} color={COLORS.blue} /> Thêm Học kỳ mới
        </Text>
        <Text style={styles.label}>Tên học kỳ</Text>
        <TextInput
          style={styles.input}
          value={newSemesterName}
          onChangeText={(value) => {
            setNewSemesterName(value);
            setSemesterFormError('');
          }}
          placeholder="Ví dụ: Học kỳ 1"
        />
        <Text style={styles.label}>Năm học</Text>
        <TextInput
          style={styles.input}
          value={newSemesterYear}
          onChangeText={(value) => {
            setNewSemesterYear(value);
            setSemesterFormError('');
          }}
          placeholder="YYYY - YYYY"
        />
        {!!semesterFormError && (
          <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600', marginBottom: 10 }}>
            {semesterFormError}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.blue }]}
          onPress={createSemester}
        >
          <Text style={styles.primaryBtnText}>Lưu Học kỳ</Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách các học kỳ hiện có (Không cho sửa/xóa theo yêu cầu) */}
      <Text style={styles.sectionTitle}>Các học kỳ hiện có ({semesterStats.length})</Text>
      {semesterStats.map((sem) => (
        <View key={sem.id} style={[styles.card, styles.rowBetween]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.itemTitle}>{sem.rawName} • {sem.year}</Text>
            <Text style={styles.itemSub}>
              {sem.stats.totalCredits} Tín chỉ • GPA: {formatSemesterGpa(sem.stats)}
              {hasFinalSemesterGpa(sem.stats) ? ` (${getRankByGPA(sem.stats.gpa).text})` : ''}
            </Text>
          </View>
          <View style={sem.status === 'Đang học' ? styles.badgeGreen : styles.badgeGray}>
            <Text style={sem.status === 'Đang học' ? styles.badgeGreenText : styles.badgeGrayText}>{sem.status}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  // ==========================================================================
  // MÀN HÌNH 5: BẢNG ĐIỂM HỌC KỲ 1 (CHỈ XEM - THÀNH VIÊN 1 - XANH DƯƠNG)
  // ==========================================================================
  const renderScreen5SemesterDetail = () => {
    const sem = semesterStats.find((item) => item.id === selectedSemesterId) || currentSemesterStats;
    const detailCourses = subjects.filter((item) => item.sem === sem.id);
    const hasFinalGpa = hasFinalSemesterGpa(sem.stats);
    const rank = getRankByGPA(sem.stats.gpa);
    const rankBadge = rank.tone === 'green' ? styles.badgeGreen : rank.tone === 'blue' ? styles.badgeBlue : rank.tone === 'amber' ? styles.badgeAmber : styles.badgeRed;
    const rankBadgeText = rank.tone === 'green' ? styles.badgeGreenText : rank.tone === 'blue' ? styles.badgeBlueText : rank.tone === 'amber' ? styles.badgeAmberText : styles.badgeRedText;

    return (
    <ScrollView contentContainerStyle={styles.bodyPadding}>
      <TouchableOpacity style={styles.backLinkRow} onPress={() => setCurrentScreen(3)}>
        <Ionicons name="arrow-back" size={16} color={COLORS.blue} />
        <Text style={styles.backLinkBlue}>Quay lại Trang chủ</Text>
      </TouchableOpacity>

      <View style={styles.rowBetween}>
        <Text style={styles.screenTitle}>{sem.name}</Text>
        {hasFinalGpa && <View style={rankBadge}><Text style={rankBadgeText}>{rank.text}</Text></View>}
      </View>

      <View style={styles.heroBlueCard}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.heroSub}>GPA Học kỳ (Hệ 4)</Text>
            <Text style={styles.heroBig}>{formatSemesterGpa(sem.stats)} <Text style={{ fontSize: 14 }}>/ 4.0</Text></Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.heroSub}>TBC Hệ 10</Text>
            <Text style={{ color: COLORS.white, fontSize: 20, fontWeight: '600' }}>{formatSemesterAverage(sem.stats)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.heroSub}>Tín chỉ đạt</Text>
            <Text style={{ color: COLORS.white, fontSize: 20, fontWeight: '600' }}>{sem.stats.earnedCredits} / {sem.stats.totalCredits} TC</Text>
          </View>
        </View>
        <Text style={[styles.heroSub, { marginTop: 8 }]}>
          Tổng {sem.stats.count} học phần trong kỳ • TC còn lại toàn khóa: {remainingCredits}/{TOTAL_PROGRAM_CREDITS} TC
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Điểm các môn trong Học kỳ ({detailCourses.length})</Text>
      {detailCourses.map((course, index) => {
        const isFailed = course.status === 'failed';
        const isPending = course.status === 'pending';
        const badgeStyle = isFailed ? styles.badgeRed : isPending ? styles.badgeAmber : styles.badgeGreen;
        const badgeTextStyle = isFailed ? styles.badgeRedText : isPending ? styles.badgeAmberText : styles.badgeGreenText;
        const badgeLabel = parseGradeValue(course.total) === null ? course.badge : `Tổng: ${course.total} • ${course.badge}`;

        return (
          <View key={course.id} style={[styles.card, isFailed && { borderColor: COLORS.danger }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.itemTitle, { flex: 1, paddingRight: 8 }]}>
                {index + 1}. {course.name} ({course.credits} TC)
              </Text>
              <View style={badgeStyle}>
                <Text style={badgeTextStyle}>{badgeLabel}</Text>
              </View>
            </View>
            <Text style={styles.itemSub}>
              CC: {course.cc} ({course.weights.cc}%) • GK: {course.gk} ({course.weights.gk}%) • CK: {course.ck} ({course.weights.ck}%)
            </Text>
          </View>
        );
      })}
    </ScrollView>
    );
  };

  // ==========================================================================
  // MÀN HÌNH 6: DANH SÁCH MÔN & TÌM KIẾM (THÀNH VIÊN 2 - MÀU TÍM)
  // ==========================================================================
  const renderScreen6SubjectList = () => {
    const query = subjectSearchQuery.trim().toLocaleLowerCase();
    const semesterSubjects = subjects.filter((subject) => {
      const matchesQuery =
        !query ||
        subject.name.toLocaleLowerCase().includes(query) ||
        subject.semester.toLocaleLowerCase().includes(query);
      const matchesSemester =
        selectedSemesterFilter === 'all' || subject.sem === selectedSemesterFilter;

      return matchesQuery && matchesSemester;
    });
    const visibleSubjects = semesterSubjects
      .filter((subject) => selectedStatusFilter === 'all' || subject.status === selectedStatusFilter)
      .map((subject, index) => ({ subject, index }))
      .sort((a, b) => {
        const aHasNoFinalGrade = parseGradeValue(a.subject.total) === null;
        const bHasNoFinalGrade = parseGradeValue(b.subject.total) === null;
        return Number(bHasNoFinalGrade) - Number(aHasNoFinalGrade) || a.index - b.index;
      })
      .map(({ subject }) => subject);
    const selectedSemesterLabel =
      selectedSemesterFilter === 'all'
        ? 'Tất cả học kỳ'
        : semesters.find((semester) => semester.id === selectedSemesterFilter)?.name || 'Tất cả học kỳ';

    return (
      <ScrollView contentContainerStyle={styles.subjectScreen}>
        <View style={styles.subjectStatusBar}>
          <Text style={styles.subjectStatusTime}>09:41</Text>
          <Text style={styles.subjectStatusNetwork}>5G • 100%</Text>
        </View>

        <View style={styles.subjectHeader}>
          <Text style={styles.subjectTitle}>Môn học &amp; Bảng điểm</Text>
          <TouchableOpacity
            style={styles.addSubjectButton}
            accessibilityRole="button"
            onPress={() => setCurrentScreen(7)}
          >
            <Text style={styles.addSubjectButtonText}>+ Thêm môn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.importGradesButton}
            accessibilityRole="button"
            onPress={importGradesFromFile}
          >
            <Text style={styles.importGradesButtonText}>⇧ Nhập điểm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.subjectSearch}>
          <Ionicons name="search-outline" size={14} color={COLORS.textMuted} />
          <TextInput
            accessibilityLabel="Tìm kiếm môn học"
            style={styles.subjectSearchInput}
            placeholder="Tìm tên môn học (VD: Lập trình)..."
            value={subjectSearchQuery}
            onChangeText={setSubjectSearchQuery}
          />
        </View>

        <View style={[styles.semesterFilterContainer, isSemesterFilterExpanded && styles.semesterFilterContainerExpanded]}>
          <View style={styles.semesterFilterRow}>
            <Text style={styles.semesterFilterTitle}>🗓 Lọc theo Học kỳ:</Text>
            <View style={styles.semesterDropdownWrap}>
              <TouchableOpacity
                style={styles.semesterDropdownButton}
                onPress={() => setIsSemesterFilterExpanded((expanded) => !expanded)}
              >
                <Text style={styles.semesterDropdownText} numberOfLines={1}>
                  {selectedSemesterLabel}
                </Text>
                <Ionicons
                  name={isSemesterFilterExpanded ? 'chevron-up' : 'chevron-down'}
                  size={15}
                  color={COLORS.purple}
                />
              </TouchableOpacity>

              {isSemesterFilterExpanded && (
                <View style={styles.semesterDropdownMenu}>
                  {[{ id: 'all', name: 'Tất cả học kỳ' }, ...semesters].map((semester) => (
                    <TouchableOpacity
                      key={semester.id}
                      style={[
                        styles.semesterDropdownOption,
                        selectedSemesterFilter === semester.id && styles.semesterDropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedSemesterFilter(semester.id);
                        setIsSemesterFilterExpanded(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.semesterDropdownOptionText,
                          selectedSemesterFilter === semester.id && styles.semesterDropdownOptionTextSelected,
                        ]}
                      >
                        {semester.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.subjectStatusFilters}>
          {[
            { key: 'all', label: 'Tất cả', count: semesterSubjects.length },
            { key: 'passed', label: 'Đã đạt', count: semesterSubjects.filter((item) => item.status === 'passed').length },
            { key: 'pending', label: 'Chờ điểm', count: semesterSubjects.filter((item) => item.status === 'pending').length },
          ].map((filter) => {
            const active = selectedStatusFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.subjectStatusChip,
                  active && styles.subjectStatusChipActive,
                ]}
                onPress={() => setSelectedStatusFilter(filter.key)}
              >
                <Text style={[styles.subjectStatusChipText, active && styles.subjectStatusChipTextActive]}>
                  {filter.label} ({filter.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!courseActionNotice && (
          <View
            accessibilityRole="alert"
            style={[
              styles.courseActionNotice,
              courseActionNotice.type === 'error'
                ? styles.courseActionNoticeError
                : styles.courseActionNoticeSuccess,
            ]}
          >
            <Text
              style={[
                styles.courseActionNoticeText,
                courseActionNotice.type === 'error'
                  ? styles.courseActionNoticeErrorText
                  : styles.courseActionNoticeSuccessText,
              ]}
            >
              {courseActionNotice.type === 'error' ? '🗑 ' : '✓ '}
              {courseActionNotice.message}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Đóng thông báo"
              onPress={dismissCourseActionNotice}
            >
              <Ionicons
                name="close"
                size={16}
                color={courseActionNotice.type === 'error' ? COLORS.danger : COLORS.green}
              />
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.importGradesHint}>
          File Excel cần có cột Tên môn học và các cột điểm CC, GK, CK.
        </Text>
        {!!gradeImportMessage && (
          <Text style={styles.importGradesMessage}>{gradeImportMessage}</Text>
        )}

        {visibleSubjects.map((subject, index) => {
          const isFailed = subject.status === 'failed';
          const isPending = subject.status === 'pending';
          const badgeStyle = isFailed
            ? styles.badgeRed
            : isPending
              ? styles.badgeAmber
              : styles.badgeGreen;
          const badgeTextStyle = isFailed
            ? styles.badgeRedText
            : isPending
              ? styles.badgeAmberText
              : styles.badgeGreenText;

          const gradeValues = [
            { label: 'CC', value: subject.cc },
            { label: 'GK', value: subject.gk },
            { label: 'CK', value: subject.ck },
            { label: 'Tổng', value: subject.total },
          ];

          return (
            <View key={subject.id} style={[styles.subjectCard, isFailed && styles.failedSubjectCard]}>
              <View style={styles.subjectCardHeading}>
                <View style={styles.subjectCardCopy}>
                  <Text style={styles.subjectCardTitle}>
                    {subject.name}{isFailed ? ' (Trượt - Học lại)' : subject.status === 'passed' ? ' (Đã đạt)' : ''}
                  </Text>
                  <Text style={[styles.subjectCardMeta, isFailed && styles.failedSubjectMeta]}>
                    {subject.credits} Tín chỉ • {subject.semester} • {subject.weights.cc}%-{subject.weights.gk}%-{subject.weights.ck}%
                    {isFailed ? ' • Không tính vào TC tích lũy' : ''}
                  </Text>
                </View>
                <View style={[styles.subjectGradeBadge, isFailed ? styles.failedGradeBadge : isPending ? styles.pendingGradeBadge : styles.passedGradeBadge]}>
                  <Text style={badgeTextStyle}>{subject.badge}</Text>
                </View>
              </View>

              <View style={[styles.gradeGrid, isFailed && styles.failedGradeGrid]}>
                {gradeValues.map((grade) => (
                  <View key={grade.label} style={styles.gradeCell}>
                    <Text style={styles.gradeCellLabel}>{grade.label}</Text>
                    <Text style={[styles.gradeCellValue, isFailed && styles.failedGradeValue, grade.value === 'Chưa nhập' && styles.pendingGradeValue]}>
                      {grade.value}
                    </Text>
                  </View>
                ))}
              </View>

              {subject.canEdit && (
                <TouchableOpacity
                  style={styles.editSubjectButton}
                  onPress={() => openEditCourse(subject)}
                >
                  <Text style={styles.editSubjectButtonText}>✏️ Sửa học phần &amp; Sửa điểm</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {visibleSubjects.length === 0 && (
          <View style={styles.subjectCard}>
            <Text style={[styles.subjectCardMeta, { textAlign: 'center' }]}>
              Không tìm thấy môn học phù hợp.
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ==========================================================================
  // MÀN HÌNH 7: THÊM HỌC PHẦN MỚI (THÀNH VIÊN 2 - MÀU TÍM)
  // ==========================================================================
  const renderScreen7AddCourse = () => (
    <ScrollView contentContainerStyle={styles.bodyPadding}>
      <TouchableOpacity style={styles.backLinkRow} onPress={() => setCurrentScreen(6)}>
        <Ionicons name="arrow-back" size={16} color={COLORS.purple} />
        <Text style={styles.backLinkPurple}>Quay lại</Text>
      </TouchableOpacity>

      <View style={styles.rowBetween}>
        <Text style={styles.screenTitle}>Thêm Học Phần Mới</Text>
      </View>

      <View style={[
        styles.card,
        { borderColor: COLORS.purple, borderWidth: 1.5, minHeight: 430 },
        isAddCourseSemesterOpen && styles.openDropdownCard,
      ]}>
        <Text style={styles.label}>1. Tên học phần mới *</Text>
        <TextInput
          style={styles.input}
          value={addCourseName}
          placeholder="Nhập tên học phần"
          onChangeText={(value) => {
            setAddCourseName(value);
            setAddCourseError('');
          }}
        />

        <View style={[styles.rowGap, isAddCourseSemesterOpen && styles.openDropdownRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>2. Số tín chỉ (1–10) *</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              maxLength={2}
              value={addCourseCredits}
              placeholder="Nhập số tín chỉ"
              onChangeText={(value) => {
                setAddCourseCredits(value.replace(/[^0-9]/g, ''));
                setAddCourseError('');
              }}
            />
          </View>
          <View style={[styles.semesterSelectWrap, { flex: 1 }, isAddCourseSemesterOpen && styles.openDropdownCard]}>
            <Text style={styles.label}>3. Chọn Học kỳ *</Text>
            <TouchableOpacity
              style={styles.semesterSelectButton}
              onPress={() => setIsAddCourseSemesterOpen(!isAddCourseSemesterOpen)}
            >
              <Text style={styles.semesterSelectText}>{selectedAddCourseSemester}</Text>
              <Text style={styles.semesterSelectArrow}>
                {isAddCourseSemesterOpen ? <Ionicons name="chevron-up" size={12} color={COLORS.purple} /> : <Ionicons name="chevron-down" size={12} color={COLORS.purple} />}
              </Text>
            </TouchableOpacity>
            {isAddCourseSemesterOpen && (
              <View style={[styles.semesterSelectMenu, { borderColor: COLORS.purple }]}>
                {courseSemesterOptions.map((semester, index) => (
                  <TouchableOpacity
                    key={semester}
                    style={[
                      styles.semesterSelectOption,
                      selectedAddCourseSemester === semester && { backgroundColor: COLORS.purpleLight },
                      index < courseSemesterOptions.length - 1 && styles.semesterSelectOptionBorder,
                    ]}
                    onPress={() => {
                      setSelectedAddCourseSemester(semester);
                      setIsAddCourseSemesterOpen(false);
                      setAddCourseError('');
                    }}
                  >
                    <Text style={[
                      styles.semesterSelectText,
                      selectedAddCourseSemester === semester && { color: COLORS.purple, fontWeight: '600' },
                    ]}>
                      {semester}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>4. Thiết lập tỷ lệ trọng số (%) *</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: addWeightTotal === 100 ? COLORS.green : COLORS.danger }}>
            Tổng = {addWeightTotal}% {addWeightTotal === 100 ? <Ionicons name="checkmark-circle" size={12} color={COLORS.green} /> : <Ionicons name="close-circle" size={12} color={COLORS.danger} />}
          </Text>
        </View>
        <View style={styles.rowGap}>
          {[
            { key: 'cc', label: 'Chuyên cần' },
            { key: 'gk', label: 'Giữa kỳ' },
            { key: 'ck', label: 'Cuối kỳ' },
          ].map((item) => (
            <View key={item.key} style={styles.weightBox}>
              <Text style={[styles.gradeLabel, { fontSize: 11 }]}>{item.label}</Text>
              <View style={styles.weightValueRow}>
                <TextInput
                  style={styles.weightInput}
                  keyboardType="numeric"
                  maxLength={3}
                  value={addCourseWeights[item.key]}
                  onChangeText={(value) =>
                    setAddCourseWeights((current) => ({ ...current, [item.key]: value.replace(/[^0-9]/g, '') }))
                  }
                />
                <Text style={styles.weightVal}>%</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: COLORS.bg, padding: 12, borderRadius: 12, marginTop: 12 }}>
          <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
            <Ionicons name="bulb-outline" size={12} color={COLORS.textMuted} /> Lưu ý: Học phần mới tạo sẽ ở trạng thái Chờ nhập điểm. Khi có điểm, bấm nút "Sửa học phần & Sửa điểm" ngoài danh sách.
          </Text>
        </View>

        {!!addCourseError && (
          <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600', marginTop: 10 }}>
            {addCourseError}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.purple, marginTop: 14 }]}
          onPress={createCourse}
        >
          <Text style={styles.primaryBtnText}>
            <Ionicons name="add-circle" size={13} color={COLORS.white} /> Tạo học phần mới
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // ==========================================================================
  // MÀN HÌNH 8: SỬA HỌC PHẦN & SỬA ĐIỂM (THÀNH VIÊN 2 - MÀU TÍM)
  // ==========================================================================
  const renderScreen8EditCourseAndGrade = () => {
    const liveTotal = calcCourseTotal(editCourseGrades, editCourseWeights);
    const liveLetter = liveTotal === null ? null : getGradeLetter(liveTotal);
    const isFailed = liveLetter ? liveLetter.status === 'failed' : false;
    const resultBg = liveLetter === null ? COLORS.bg : isFailed ? COLORS.dangerLight : COLORS.greenLight;
    const resultColor = liveLetter === null ? COLORS.textMuted : isFailed ? COLORS.danger : COLORS.green;
    const hasInvalidGrade = Object.values(editCourseGrades).some(isGradeValueInvalid);
    const canSaveCourse = editWeightTotal === 100 && !hasInvalidGrade;

    return (
    <ScrollView contentContainerStyle={styles.bodyPadding}>
      <TouchableOpacity style={styles.backLinkRow} onPress={() => setCurrentScreen(6)}>
        <Ionicons name="arrow-back" size={16} color={COLORS.purple} />
        <Text style={styles.backLinkPurple}>Quay lại</Text>
      </TouchableOpacity>

      <View style={styles.rowBetween}>
        <Text style={styles.screenTitle}>Sửa Học phần & Sửa điểm</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tên môn học *</Text>
        <TextInput style={styles.input} value={editCourseName} onChangeText={setEditCourseName} />

        <View style={styles.rowGap}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Số tín chỉ (1–10)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              maxLength={2}
              value={editCourseCredits}
              onChangeText={(value) => setEditCourseCredits(value.replace(/[^0-9]/g, ''))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Học kỳ</Text>
            <View style={styles.semesterSelectButton}>
              <Text style={[styles.semesterSelectText, { color: COLORS.textMuted }]}>{editingCourse.semester}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Tỷ lệ trọng số (%)</Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: editWeightTotal === 100 ? COLORS.green : COLORS.danger }}>
            Tổng = {editWeightTotal}% {editWeightTotal === 100 ? <Ionicons name="checkmark-circle" size={12} color={COLORS.green} /> : <Ionicons name="close-circle" size={12} color={COLORS.danger} />}
          </Text>
        </View>
        <View style={styles.rowGap}>
          {[
            { key: 'cc', label: 'Chuyên cần' },
            { key: 'gk', label: 'Giữa kỳ' },
            { key: 'ck', label: 'Cuối kỳ' },
          ].map((item) => (
            <View key={item.key} style={styles.weightBox}>
              <Text style={[styles.gradeLabel, { fontSize: 11 }]}>{item.label}</Text>
              <View style={styles.weightValueRow}>
                <TextInput
                  style={styles.weightInput}
                  keyboardType="numeric"
                  maxLength={3}
                  value={editCourseWeights[item.key]}
                  onChangeText={(value) =>
                    setEditCourseWeights((current) => ({ ...current, [item.key]: value.replace(/[^0-9]/g, '') }))
                  }
                />
                <Text style={styles.weightVal}>%</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 12 }]}>Nhập điểm thành phần (Thang 0.0 – 10.0)</Text>
        <View style={styles.rowGap}>
          {[
            { key: 'cc', label: 'Chuyên cần' },
            { key: 'gk', label: 'Giữa kỳ' },
            { key: 'ck', label: 'Cuối kỳ' },
          ].map((item) => {
            const hasInvalidValue = isGradeValueInvalid(editCourseGrades[item.key]);
            return (
              <View key={item.key} style={{ flex: 1 }}>
                <Text style={styles.gradeLabel}>{item.label}</Text>
                <TextInput
                  style={[
                    styles.input,
                    hasInvalidValue && { borderColor: COLORS.danger, borderWidth: 1.5, color: COLORS.danger },
                  ]}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  placeholder="Chưa nhập"
                  value={editCourseGrades[item.key]}
                  onChangeText={(value) =>
                    setEditCourseGrades((current) => ({
                      ...current,
                      [item.key]: value
                        .replace(',', '.')
                        .replace(/[^0-9.]/g, '')
                        .replace(/(\..*)\./g, '$1'),
                    }))
                  }
                />
                {hasInvalidValue && (
                  <Text style={{ color: COLORS.danger, fontSize: 10, marginTop: -7, marginBottom: 8 }}>
                    Điểm phải từ 0 đến 10
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        <View style={[styles.rowBetween, { backgroundColor: resultBg, padding: 12, borderRadius: 12, marginVertical: 10 }]}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: resultColor }}>
            {liveLetter === null
              ? 'Chưa đủ điểm để tính tổng'
              : isFailed
              ? 'Trượt (<4.0) • Không tính TC:'
              : `Đạt (>=4.0) • +${editingCourse.credits} TC:`}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: resultColor }}>
            {liveLetter === null ? '--' : (
              <>
                {liveTotal.toFixed(2)} <Ionicons name="arrow-forward" size={12} color={resultColor} /> Điểm {liveLetter.text}
              </>
            )}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.purple }, !canSaveCourse && { opacity: 0.45 }]}
          disabled={!canSaveCourse}
          onPress={saveEditCourse}
        >
          <Text style={styles.primaryBtnText}>Lưu thông tin & Cập nhật Điểm</Text>
        </TouchableOpacity>
        {editWeightTotal !== 100 && (
          <Text style={{ fontSize: 11, color: COLORS.danger, textAlign: 'center', marginTop: 6 }}>
            Tổng trọng số phải bằng 100% mới lưu được
          </Text>
        )}
        {hasInvalidGrade && (
          <Text style={{ fontSize: 11, color: COLORS.danger, textAlign: 'center', marginTop: 6 }}>
            Vui lòng sửa điểm không hợp lệ trước khi lưu
          </Text>
        )}
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.deleteCourseButton}
          onPress={() => setIsDeleteCourseDialogVisible(true)}
        >
          <Ionicons name="trash" size={14} color={COLORS.danger} />
          <Text style={styles.deleteCourseButtonText}>Xóa học phần này</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isDeleteCourseDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteCourseDialogVisible(false)}
      >
        <View style={styles.deleteDialogBackdrop}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteDialogTitle}>Xóa học phần?</Text>
            <Text style={styles.deleteDialogMessage}>
              Bạn có chắc muốn xóa “{editingCourse.name}”? Các nhắc thi của học phần này cũng sẽ bị xóa.
            </Text>
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setIsDeleteCourseDialogVisible(false)}
              >
                <Text style={styles.deleteCancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmButton}
                onPress={deleteEditingCourse}
              >
                <Text style={styles.deleteConfirmButtonText}>Xóa học phần</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    );
  };

  // ==========================================================================
  // MÀN HÌNH 9: DỰ BÁO ĐIỂM MỤC TIÊU WHAT-IF (THÀNH VIÊN 2 - MÀU TÍM)
  // ==========================================================================
  const renderScreen9Calculator = () => {
    const activeCourse = whatIfCourses[selectedWhatIfIndex] || whatIfCourses[0];
    if (!activeCourse) {
      return (
        <ScrollView contentContainerStyle={styles.bodyPadding}>
          <Text style={styles.screenTitle}>Dự báo Điểm (What-if)</Text>
          <View style={styles.card}>
            <Text style={styles.itemSub}>
              Chưa có học phần trong học kỳ hiện tại để dự báo điểm.
            </Text>
          </View>
        </ScrollView>
      );
    }

    const targetTenMap = { 'A+': 9.0, A: 8.5, 'B+': 8.0, B: 7.0 };
    const targetTen = targetTenMap[selectedTargetGrade] || 9.0;
    const ccWeight = Number(activeCourse.weights.cc) || 0;
    const gkWeight = Number(activeCourse.weights.gk) || 0;
    const ckWeight = Number(activeCourse.weights.ck) || 0;
    const requiredScoreNumber =
      ckWeight > 0 && activeCourse.cc !== null && activeCourse.gk !== null
        ? (targetTen * 100 - activeCourse.cc * ccWeight - activeCourse.gk * gkWeight) / ckWeight
        : NaN;
    const requiredScore = Number.isNaN(requiredScoreNumber) ? '--' : `${requiredScoreNumber.toFixed(2)} điểm`;
    const isFeasible = !Number.isNaN(requiredScoreNumber) && requiredScoreNumber <= 10;
    const targetPointMap = { 'A+': 4.0, A: 3.7, 'B+': 3.5, B: 3.0 };
    const targetPoint = targetPointMap[selectedTargetGrade] || 4.0;
    const projectedGPA =
      overallStats.gradedCredits + activeCourse.credits > 0
        ? (overallStats.gpa * overallStats.gradedCredits + targetPoint * activeCourse.credits) /
          (overallStats.gradedCredits + activeCourse.credits)
        : overallStats.gpa;
    const projectedDelta = Number(projectedGPA.toFixed(2)) - Number(overallStats.gpa.toFixed(2));

    return (
      <ScrollView contentContainerStyle={styles.bodyPadding}>
        <View style={styles.rowBetween}>
          <Text style={styles.screenTitle}>Dự báo Điểm (What-if)</Text>
          <View style={styles.badgePurple}><Text style={styles.badgePurpleText}>Tính ngược CK</Text></View>
        </View>

        <View style={[styles.card, isWhatIfDropdownOpen && styles.openDropdownCard]}>
          <Text style={styles.label}>1. Chọn môn học chưa thi cuối kỳ</Text>

          {/* Ô chọn môn thiết kế gọn 1 hộp duy nhất có nút mũi tên bên phải */}
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: COLORS.purpleLight,
              borderWidth: 1,
              borderColor: COLORS.purple,
              padding: 12,
              borderRadius: 12,
              marginBottom: 12,
            }}
            onPress={() => setIsWhatIfDropdownOpen(!isWhatIfDropdownOpen)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{activeCourse.name}</Text>
              <Text style={{ fontSize: 11, color: COLORS.purple, marginTop: 2 }}>{activeCourse.detail}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.purple, marginLeft: 8 }}>
              {isWhatIfDropdownOpen ? <Ionicons name="chevron-up" size={14} color={COLORS.purple} /> : <Ionicons name="chevron-down" size={14} color={COLORS.purple} />}
            </Text>
          </TouchableOpacity>

          {/* Chỉ khi bấm vào nút mũi tên thì danh sách môn mới xổ xuống để đổi môn */}
          {isWhatIfDropdownOpen && (
            <View
              style={{
                position: 'absolute',
                top: 90,
                left: 14,
                right: 14,
                zIndex: 30,
                elevation: 30,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 10,
                backgroundColor: COLORS.white,
                overflow: 'hidden',
              }}
            >
              {whatIfCourses.map((course, idx) => {
                const isSelected = idx === selectedWhatIfIndex;
                return (
                  <TouchableOpacity
                    key={course.id}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isSelected ? COLORS.purpleLight : COLORS.white,
                      borderBottomWidth: idx < whatIfCourses.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.border,
                    }}
                    onPress={() => {
                      setSelectedWhatIfIndex(idx);
                      setIsWhatIfDropdownOpen(false);
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? COLORS.purple : COLORS.textDark }}>
                      {isSelected ? <Ionicons name="checkmark" size={13} color={COLORS.purple} /> : null} {course.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{course.detail}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>2. Chọn mức điểm tổng kết mong muốn</Text>
          <View style={styles.rowGap}>
            {[
              { key: 'A+', label: 'A+ (9.0)' },
              { key: 'A', label: 'A (8.5)' },
              { key: 'B+', label: 'B+ (8.0)' },
              { key: 'B', label: 'B (7.0)' },
            ].map((grade) => (
              <TouchableOpacity
                key={grade.key}
                style={selectedTargetGrade === grade.key ? [styles.chipActive, { backgroundColor: COLORS.purple }] : styles.chipGray}
                onPress={() => setSelectedTargetGrade(grade.key)}
              >
                <Text style={selectedTargetGrade === grade.key ? styles.chipActiveText : styles.chipGrayText}>{grade.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.resultBox}>
            <Text style={{ fontSize: 12, color: COLORS.purple, fontWeight: '600' }}>Điểm thi Cuối kỳ ({activeCourse.weights.ck}%) tối thiểu cần đạt:</Text>
            <Text style={{ fontSize: 28, fontWeight: '600', color: COLORS.purple, marginVertical: 4 }}>{requiredScore}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isFeasible ? COLORS.green : COLORS.danger }}>
              <Ionicons name={isFeasible ? 'checkmark-circle' : 'close-circle'} size={11} color={isFeasible ? COLORS.green : COLORS.danger} />{' '}
              {isFeasible ? 'Khả thi (Nằm trong khoảng 0.0 – 10.0)' : 'Không khả thi (Cần trên 10.0 điểm)'}
            </Text>
          </View>

          <View style={[styles.rowBetween, { backgroundColor: COLORS.bg, padding: 12, borderRadius: 12, marginTop: 10 }]}>
            <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Dự phóng GPA nếu đạt mục tiêu:</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: projectedDelta >= 0 ? COLORS.green : COLORS.danger }}>
              {hasOverallGpa ? overallGpaText : '--'} <Ionicons name="arrow-forward" size={12} color={projectedDelta >= 0 ? COLORS.green : COLORS.danger} /> {projectedGPA.toFixed(2)}
              {hasOverallGpa ? ` (${projectedDelta >= 0 ? '+' : ''}${projectedDelta.toFixed(2)})` : ''}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  // ==========================================================================
  // MÀN HÌNH 10: THÔNG BÁO NHẮC THI & HỒ SƠ (THÀNH VIÊN 3 - MÀU XANH LÁ)
  // ==========================================================================
  const renderScreen10RemindersProfile = () => (
    <ScrollView contentContainerStyle={styles.notificationScreenPage}>
      <View style={styles.statusBarRow}>
        <Text style={styles.timeText}>09:41</Text>
        <Text style={styles.statusText}>5G • 100%</Text>
      </View>

      <View style={[styles.card, { borderColor: COLORS.green, borderWidth: 1.5, marginTop: 8 }]}> 
        <Text style={[styles.cardHeader, { color: COLORS.green, marginBottom: 12 }]}> 
          <Ionicons name="notifications-outline" size={14} color={COLORS.green} /> Hẹn giờ nhắc lịch thi (Expo Notify)
        </Text>

        {reminders.map((reminder) => (
          <View
            key={reminder.id}
            style={[styles.rowBetween, { backgroundColor: COLORS.bg, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }]}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.textDark }}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textDark} /> {getReminderTypeLabel(reminder.type)}: {reminder.courseName}
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                {reminder.room} • Báo trước: {getReminderAdvanceLabel(reminder.advance)}
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.green }}>{reminder.date} • {reminder.time}</Text>
          </View>
        ))}
        {reminders.length === 0 && (
          <Text style={[styles.itemSub, { textAlign: 'center', marginBottom: 12 }]}>
            Chưa có lịch thi nào được lưu.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.green }]}
          onPress={() => {
            setIsReminderCourseOpen(false);
            setReminderFormError('');
            setCurrentScreen(11);
          }}
        >
          <Text style={styles.primaryBtnText}>+ Thêm lịch nhắc thi mới</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.screenTitle, { marginTop: 20, marginBottom: 10 }]}>Hồ sơ cá nhân</Text>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: COLORS.blue,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: '600' }}>
              {(profile?.fullName || firebaseUser?.displayName || 'SV').split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{profile?.fullName || firebaseUser?.displayName || 'Sinh viên'}</Text>
            <Text style={styles.itemSub}>
              {profile?.email || firebaseUser?.email || ''} • CPA mục tiêu: {Number(profile?.targetGpa ?? 3.2).toFixed(2)}
            </Text>
          </View>
        </View>

        <View
          style={{
            backgroundColor: COLORS.greenLight,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.green }}>
            <Ionicons name="cloud-done-outline" size={12} color={COLORS.green} /> Dữ liệu tài khoản được tải từ Firestore
          </Text>
        </View>

        {!!profileNotice && (
          <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.green, marginBottom: 10 }}>{profileNotice}</Text>
        )}

        <View style={styles.rowGap}>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: COLORS.blue, backgroundColor: COLORS.blueLight }]}
            onPress={exportGradeData}
          >
            <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 12 }}>
              <Ionicons name="document-text-outline" size={12} color={COLORS.blue} /> Xuất CSV / PDF
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: COLORS.danger, backgroundColor: COLORS.dangerLight }]}
            onPress={handleLogout}
          >
            <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 12 }}>
              <Ionicons name="log-out-outline" size={12} color={COLORS.danger} /> Đăng xuất
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderScreen11AddExamReminder = () => {
    const selectedCourse =
      currentSemesterCourses.find((item) => item.id === newReminder.courseId) || currentSemesterCourses[0];

    if (!selectedCourse) {
      return (
        <ScrollView contentContainerStyle={styles.bodyPadding}>
          <Text style={styles.screenTitle}>Thêm Lịch Nhắc Thi Mới</Text>
          <View style={styles.card}>
            <Text style={styles.itemSub}>Chưa có học phần nào trong học kỳ hiện tại.</Text>
          </View>
        </ScrollView>
      );
    }

    const selectedCourseSemester =
      semesters.find((sem) => sem.id === selectedCourse.sem)?.name || selectedCourse.semester;

    return (
      <ScrollView contentContainerStyle={styles.reminderScreenContent}>
        <TouchableOpacity style={styles.backLinkRow} onPress={() => setCurrentScreen(10)}>
          <Ionicons name="arrow-back" size={16} color={COLORS.green} />
          <Text style={styles.backLinkGreen}>Quay lại</Text>
        </TouchableOpacity>

        <View style={styles.rowBetween}>
          <Text style={styles.screenTitle}>Thêm Lịch Nhắc Thi Mới</Text>
        </View>

        <View style={[
          styles.card,
          styles.reminderFormCard,
          { borderColor: COLORS.green, borderWidth: 1.5 },
          isReminderCourseOpen && styles.openDropdownCard,
        ]}>
          <Text style={styles.label}>1. Chọn học phần cần nhắc thi *</Text>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: COLORS.greenLight,
              borderWidth: 1,
              borderColor: COLORS.green,
              padding: 12,
              borderRadius: 10,
              marginBottom: 12,
            }}
            onPress={() => setIsReminderCourseOpen(!isReminderCourseOpen)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{selectedCourse.name} ({selectedCourse.credits} TC)</Text>
              <Text style={{ fontSize: 11, color: COLORS.green, marginTop: 2 }}>{selectedCourseSemester}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.green, marginLeft: 8 }}>
              {isReminderCourseOpen ? <Ionicons name="chevron-up" size={14} color={COLORS.green} /> : <Ionicons name="chevron-down" size={14} color={COLORS.green} />}
            </Text>
          </TouchableOpacity>

          {isReminderCourseOpen && (
            <View
              style={{
                position: 'absolute',
                top: 90,
                left: 14,
                right: 14,
                zIndex: 30,
                elevation: 30,
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 10,
                backgroundColor: COLORS.white,
                overflow: 'hidden',
              }}
            >
              {currentSemesterCourses.map((course, idx) => {
                const isSelected = newReminder.courseId === course.id;
                return (
                  <TouchableOpacity
                    key={course.id}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isSelected ? COLORS.greenLight : COLORS.white,
                      borderBottomWidth: idx < currentSemesterCourses.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.border,
                    }}
                    onPress={() => {
                      setNewReminder((current) => ({ ...current, courseId: course.id }));
                      setIsReminderCourseOpen(false);
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? COLORS.green : COLORS.textDark }}>
                      {isSelected ? <Ionicons name="checkmark" size={13} color={COLORS.green} /> : null} {course.name} ({course.credits} TC)
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>{course.semester}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>2. Loại lịch nhắc</Text>
          <View style={[styles.rowGap, { marginBottom: 12 }]}>
            {REMINDER_TYPES.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={newReminder.type === type.key ? [styles.chipActive, { backgroundColor: COLORS.green }] : styles.chipGray}
                onPress={() => setNewReminder((current) => ({ ...current, type: type.key }))}
              >
                <Text style={newReminder.type === type.key ? styles.chipActiveText : styles.chipGrayText}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rowGap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>3. Ngày thi *</Text>
              <TextInput
                style={styles.input}
                value={newReminder.date}
                onChangeText={(value) => setNewReminder((current) => ({ ...current, date: value }))}
                placeholder="DD/MM/YYYY"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>4. Giờ thi *</Text>
              <TextInput
                style={styles.input}
                value={newReminder.time}
                onChangeText={(value) => setNewReminder((current) => ({ ...current, time: value }))}
                placeholder="HH:MM"
              />
            </View>
          </View>

          <Text style={styles.label}>5. Phòng thi *</Text>
          <TextInput
            style={styles.input}
            value={newReminder.room}
            onChangeText={(value) => setNewReminder((current) => ({ ...current, room: value }))}
            placeholder="Phòng thi"
          />

          <Text style={styles.label}>6. Ghi chú (Không bắt buộc)</Text>
          <TextInput
            style={styles.input}
            placeholder="VD: Mang thẻ sinh viên..."
            value={newReminder.note}
            onChangeText={(value) => setNewReminder((current) => ({ ...current, note: value }))}
          />

          <Text style={styles.label}>7. Báo thức trước giờ thi (Expo Notify)</Text>
          <View style={styles.rowGap}>
            {REMINDER_ADVANCES.map((advance) => (
              <TouchableOpacity
                key={advance.key}
                style={newReminder.advance === advance.key ? [styles.chipActive, { backgroundColor: COLORS.green }] : styles.chipGray}
                onPress={() => setNewReminder((current) => ({ ...current, advance: advance.key }))}
              >
                <Text style={newReminder.advance === advance.key ? styles.chipActiveText : styles.chipGrayText}>{advance.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {!!reminderFormError && (
            <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.danger, textAlign: 'center', marginTop: 10 }}>
              {reminderFormError}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.green, marginTop: 14 }]}
            onPress={saveNewReminder}
          >
            <Text style={styles.primaryBtnText}>
              <Ionicons name="notifications-outline" size={13} color={COLORS.white} /> Lưu &amp; Bật Hẹn Giờ Nhắc Thi
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // ==========================================================================
  // MÀN HÌNH 12: QUÊN MẬT KHẨU / ĐẶT LẠI MẬT KHẨU (THÀNH VIÊN 3 - MÀU XANH LÁ)
  // ==========================================================================
  const renderScreen12ForgotPassword = () => (
    <ScrollView contentContainerStyle={styles.authScroll}>
      <View style={[styles.logoBox, { backgroundColor: COLORS.greenLight, borderWidth: 1.5, borderColor: COLORS.green }]}>
        <Ionicons name="lock-closed" size={28} color={COLORS.green} />
      </View>
      <Text style={styles.authTitle}>Quên Mật Khẩu</Text>
      <Text style={styles.authSub}>Firebase sẽ gửi đường dẫn đặt lại mật khẩu qua email</Text>

      <View style={[styles.card, { borderColor: COLORS.green, borderWidth: 1.5 }]}>
        <Text style={styles.label}>Email sinh viên đã đăng ký *</Text>
        <TextInput
          style={styles.input}
          value={resetEmail}
          onChangeText={setResetEmail}
          placeholder="email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {!!authError && (
          <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            {authError}
          </Text>
        )}
        {!!authNotice && (
          <Text style={{ color: COLORS.green, fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
            {authNotice}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: COLORS.green, marginTop: 10, opacity: isAuthBusy ? 0.6 : 1 }]}
          onPress={handlePasswordReset}
          disabled={isAuthBusy}
        >
          <Text style={styles.primaryBtnText}>{isAuthBusy ? 'Đang gửi...' : 'Gửi email đặt lại mật khẩu'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.cardCenter} onPress={() => setCurrentScreen(1)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Ionicons name="arrow-back" size={15} color={COLORS.green} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: COLORS.green }}>Quay lại Đăng nhập</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  // ==========================================================================
  // MÀN HÌNH 13 (PHỤ): CHI TIẾT THÔNG BÁO NHẮC THI (THÀNH VIÊN 3 - XANH LÁ)
  // Mở từ thông báo đẩy của hệ điều hành; nút Quay lại trở về Màn 10 - Nhắc thi.
  // ==========================================================================
  const renderScreen13NotificationDetail = () => {
    const reminder = reminders.find((item) => item.id === selectedReminderId) || reminders[0];
    if (!reminder) {
      return (
        <ScrollView contentContainerStyle={styles.bodyPadding}>
          <Text style={styles.screenTitle}>Không có lịch thi</Text>
          <TouchableOpacity style={styles.backLinkRow} onPress={() => setCurrentScreen(10)}>
            <Ionicons name="arrow-back" size={16} color={COLORS.green} />
            <Text style={styles.backLinkGreen}>Quay lại</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    const detailCourse = subjects.find((item) => item.id === reminder.courseId);
    const targetTen = 8.5;
    const ccValue = detailCourse ? parseGradeValue(detailCourse.cc) : null;
    const gkValue = detailCourse ? parseGradeValue(detailCourse.gk) : null;
    const ccWeight = detailCourse ? Number(detailCourse.weights.cc) || 0 : 0;
    const gkWeight = detailCourse ? Number(detailCourse.weights.gk) || 0 : 0;
    const ckWeight = detailCourse ? Number(detailCourse.weights.ck) || 0 : 0;
    const requiredCkScore =
      ccValue !== null && gkValue !== null && ckWeight > 0
        ? (targetTen * 100 - ccValue * ccWeight - gkValue * gkWeight) / ckWeight
        : null;
    const requiredCkText =
      requiredCkScore !== null && Number.isFinite(requiredCkScore) ? `${requiredCkScore.toFixed(2)} điểm` : '--';

    return (
      <ScrollView contentContainerStyle={styles.reminderDetailScreen}>
        <View style={styles.statusBarRow}>
          <Text style={styles.timeText}>07:00</Text>
          <Text style={styles.statusText}>5G • 100%</Text>
        </View>

        <Text style={styles.detailTitle}>Thông báo Nhắc Giờ Thi</Text>

        <View style={styles.detailCard}>
          <View style={styles.bellWrap}>
            <Text style={styles.bellEmoji}>🔔</Text>
          </View>

          <View style={styles.countdownPill}>
            <Text style={styles.countdownText}>⏰ SẮP BẮT ĐẦU TRONG 30 PHÚT</Text>
          </View>

          <Text style={styles.examName}>{reminder.courseName} ({reminder.credits} TC)</Text>
          <Text style={styles.examMeta}>
            {reminder.semesterLabel} • Trọng số CK: {detailCourse ? detailCourse.weights.ck : '--'}%
          </Text>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Loại lịch nhắc:</Text>
              <Text style={styles.infoValueGreen}>{getReminderTypeLabel(reminder.type)}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ngày &amp; Giờ thi:</Text>
              <Text style={styles.infoValueStrong}>{reminder.date} • {reminder.time} Sáng</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phòng thi:</Text>
              <Text style={styles.infoValueBlue}>{reminder.room}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ghi chú dặn dò:</Text>
              <Text style={styles.infoValueAmber}>{reminder.note || 'Không có'}</Text>
            </View>
          </View>

          <View style={styles.targetBox}>
            <Text style={styles.targetText}>🎯 Mục tiêu Điểm A (8.5) đã đặt ở Dự báo</Text>
            <Text style={styles.targetTextStrong}>Cần đạt tối thiểu: {requiredCkText} Cuối kỳ</Text>
          </View>

          <TouchableOpacity style={styles.mainActionBtn} onPress={acknowledgeReminder}>
            <Text style={styles.mainActionText}>✓ Đã nhận thông báo &amp; Sẵn sàng thi</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // Render màn hình tương ứng
  return (
    <SafeAreaView style={[styles.viewport, Platform.OS === 'web' && styles.webViewport]}>
      <View
        style={[styles.phoneFrame, Platform.OS === 'web' && styles.webPhoneFrame]}
        {...shadePanResponder.panHandlers}
      >
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        {!!operationError && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: COLORS.dangerLight,
            borderBottomWidth: 1,
            borderBottomColor: '#FECACA',
            paddingHorizontal: 14,
            paddingVertical: 9,
          }}>
            <Text style={{ flex: 1, color: COLORS.danger, fontSize: 12, fontWeight: '600', marginRight: 8 }}>
              {operationError}
            </Text>
            <TouchableOpacity onPress={() => setOperationError('')} accessibilityLabel="Đóng thông báo lỗi">
              <Ionicons name="close" size={16} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        )}

        {!isShadeOpen && [3, 6, 9, 10].includes(currentScreen) && (
          <TouchableOpacity
            style={styles.shadePullTab}
            activeOpacity={0.7}
            onPress={() => setIsShadeOpen(true)}
          >
            <View style={styles.shadePullHandle} />
          </TouchableOpacity>
        )}

      {currentScreen === 1 && renderScreen1Login()}
      {currentScreen === 2 && renderScreen2Register()}
      {currentScreen === 3 && renderScreen3Dashboard()}
      {currentScreen === 4 && renderScreen4SemesterManage()}
      {currentScreen === 5 && renderScreen5SemesterDetail()}
      {currentScreen === 6 && renderScreen6SubjectList()}
      {currentScreen === 7 && renderScreen7AddCourse()}
      {currentScreen === 8 && renderScreen8EditCourseAndGrade()}
      {currentScreen === 9 && renderScreen9Calculator()}
      {currentScreen === 10 && renderScreen10RemindersProfile()}
      {currentScreen === 11 && renderScreen11AddExamReminder()}
      {currentScreen === 12 && renderScreen12ForgotPassword()}
      {currentScreen === 13 && renderScreen13NotificationDetail()}

      {/* THANH BOTTOM TAB BAR CHỈ HIỆN Ở CÁC MÀN GỐC CỦA TAB (3, 6, 9, 10) */}
      {[3, 6, 9, 10].includes(currentScreen) && (
        <View style={styles.bottomTab}>
          <TouchableOpacity onPress={() => setCurrentScreen(3)} style={styles.tabItem}>
            <Ionicons
              name="stats-chart"
              size={18}
              color={currentScreen === 3 || currentScreen === 4 || currentScreen === 5 ? COLORS.blue : COLORS.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.tabText, (currentScreen === 3 || currentScreen === 4 || currentScreen === 5) && { color: COLORS.blue }]}>
              Tổng quan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentScreen(6)} style={styles.tabItem}>
            <Ionicons
              name="book"
              size={18}
              color={currentScreen === 6 || currentScreen === 7 || currentScreen === 8 ? COLORS.purple : COLORS.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.tabText, (currentScreen === 6 || currentScreen === 7 || currentScreen === 8) && { color: COLORS.purple }]}>
              Môn học
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentScreen(9)} style={styles.tabItem}>
            <Ionicons
              name="trending-up"
              size={18}
              color={currentScreen === 9 ? COLORS.purple : COLORS.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.tabText, currentScreen === 9 && { color: COLORS.purple }]}>
              Dự báo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentScreen(10)} style={styles.tabItem}>
            <Ionicons
              name="notifications"
              size={18}
              color={currentScreen === 10 ? COLORS.green : COLORS.textMuted}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.tabText, currentScreen === 10 && { color: COLORS.green }]}>Nhắc thi</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* THANH THÔNG BÁO MÔ PHỎNG OS: bấm thông báo -> Màn 13 chi tiết */}
      <NotificationShade
        visible={isShadeOpen}
        reminder={reminders[0]}
        onClose={() => setIsShadeOpen(false)}
        onOpen={() => {
          setIsShadeOpen(false);
          if (reminders[0]) openReminderDetail(reminders[0]);
        }}
      />
      <Modal
        visible={isRegisterConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isAuthBusy) {
            setAuthError('');
            setIsRegisterConfirmationVisible(false);
          }
        }}
      >
        <View style={styles.deleteDialogBackdrop}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteDialogTitle}>Kiểm tra lại email</Text>
            <Text style={styles.deleteDialogMessage}>
              Hãy kiểm tra email đăng ký có chính xác không. Nếu cần chỉnh sửa, hãy chọn Quay lại.
            </Text>
            <View style={styles.registerEmailPreview}>
              <Text style={styles.registerEmailText}>
                {registerEmail.trim()}
              </Text>
            </View>
            {!!authError && (
              <View style={styles.registerErrorNotice}>
                <Text style={styles.registerErrorText}>{authError}</Text>
              </View>
            )}
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => {
                  if (isAuthBusy) return;
                  setAuthError('');
                  setIsRegisterConfirmationVisible(false);
                }}
                disabled={isAuthBusy}
              >
                <Text style={styles.deleteCancelButtonText}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.registerConfirmButton, isAuthBusy && { opacity: 0.6 }]}
                onPress={confirmRegister}
                disabled={isAuthBusy}
              >
                <Text style={styles.registerConfirmButtonText}>
                  {isAuthBusy ? 'Đang đăng ký...' : 'Đăng ký'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, backgroundColor: COLORS.bg },
  webViewport: { width: '100%', minHeight: '100vh', alignItems: 'center', backgroundColor: '#E2E8F0' },
  phoneFrame: { flex: 1, width: '100%', backgroundColor: COLORS.bg },
  shadePullTab: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -36,
    width: 72,
    zIndex: 60,
    elevation: 60,
    alignItems: 'center',
    paddingTop: 3,
    paddingBottom: 5,
  },
  shadePullHandle: {
    width: 46,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  webPhoneFrame: {
    maxWidth: 430,
    minHeight: '100vh',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  container: { flex: 1, backgroundColor: COLORS.bg },
  authScroll: { padding: 20, justifyContent: 'center', flexGrow: 1 },
  bodyPadding: { padding: 16, paddingBottom: 36 },
  subjectScreen: { paddingHorizontal: 18, paddingBottom: 24, backgroundColor: '#F8FAFC' },
  subjectStatusBar: {
    height: 42, marginHorizontal: -18, marginBottom: 14, paddingHorizontal: 22,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  subjectStatusTime: { color: COLORS.textDark, fontSize: 13, fontWeight: '700' },
  subjectStatusNetwork: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  subjectHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  subjectTitle: { flex: 1, color: COLORS.textDark, fontSize: 18, fontWeight: '700' },
  addSubjectButton: { backgroundColor: COLORS.purple, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10 },
  addSubjectButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  importGradesButton: { backgroundColor: COLORS.white, borderColor: COLORS.purple, borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
  importGradesButtonText: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },
  subjectSearch: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderColor: '#D8E1ED', borderWidth: 1,
    borderRadius: 11, paddingHorizontal: 14, marginBottom: 10,
  },
  subjectSearchInput: { flex: 1, paddingVertical: 10, color: COLORS.textDark, fontSize: 13, outlineStyle: 'none' },
  semesterFilterContainer: { position: 'relative', zIndex: 5, marginBottom: 9 },
  semesterFilterContainerExpanded: { zIndex: 40, elevation: 40 },
  semesterFilterRow: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderColor: COLORS.purple, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12,
    backgroundColor: '#FBF9FF',
  },
  semesterFilterTitle: { color: COLORS.purple, fontSize: 12, fontWeight: '700' },
  semesterDropdownWrap: { position: 'relative', width: '58%', maxWidth: 228, zIndex: 50, elevation: 50 },
  semesterDropdownButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6,
    width: '100%', paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: COLORS.white, borderColor: COLORS.purple, borderWidth: 1, borderRadius: 8,
  },
  semesterDropdownText: { flex: 1, color: COLORS.purple, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  semesterDropdownMenu: {
    position: 'absolute', top: '100%', right: 0, width: '100%', zIndex: 50, elevation: 50,
    backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: 10, marginTop: 5, overflow: 'hidden',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14, shadowRadius: 10,
  },
  semesterDropdownOption: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  semesterDropdownOptionSelected: { backgroundColor: COLORS.purpleLight },
  semesterDropdownOptionText: { color: COLORS.textDark, fontSize: 13 },
  semesterDropdownOptionTextSelected: { color: COLORS.purple, fontWeight: '700' },
  subjectStatusFilters: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  subjectStatusChip: { flex: 1, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 9, borderRadius: 18, backgroundColor: COLORS.white, borderColor: COLORS.border, borderWidth: 1 },
  subjectStatusChipActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  subjectStatusChipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  subjectStatusChipTextActive: { color: COLORS.white },
  courseActionNotice: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderRadius: 10,
    marginBottom: 10,
  },
  courseActionNoticeSuccess: { backgroundColor: COLORS.greenLight, borderColor: COLORS.green },
  courseActionNoticeError: { backgroundColor: COLORS.dangerLight, borderColor: COLORS.danger },
  courseActionNoticeInfo: { backgroundColor: COLORS.blueLight, borderColor: COLORS.blue },
  courseActionNoticeText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  courseActionNoticeSuccessText: { color: COLORS.green },
  courseActionNoticeErrorText: { color: COLORS.danger },
  courseActionNoticeInfoText: { color: COLORS.blue },
  importGradesHint: { color: COLORS.textMuted, fontSize: 11, marginBottom: 9 },
  importGradesMessage: { color: COLORS.green, fontSize: 12, fontWeight: '600', marginBottom: 9 },
  subjectCard: {
    backgroundColor: COLORS.white, borderColor: '#D9E2EF', borderWidth: 1,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  failedSubjectCard: { borderColor: COLORS.danger, borderWidth: 1.2 },
  subjectCardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 10 },
  subjectCardCopy: { flex: 1 },
  subjectCardTitle: { color: COLORS.textDark, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  subjectCardMeta: { color: COLORS.textMuted, fontSize: 11, lineHeight: 16 },
  failedSubjectMeta: { color: COLORS.danger, fontWeight: '600' },
  subjectGradeBadge: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, alignItems: 'center', maxWidth: '42%' },
  pendingGradeBadge: { backgroundColor: COLORS.amberLight },
  passedGradeBadge: { backgroundColor: COLORS.greenLight },
  failedGradeBadge: { backgroundColor: COLORS.dangerLight },
  gradeGrid: {
    flexDirection: 'row', backgroundColor: '#F6F8FB', borderRadius: 10,
    paddingVertical: 10, marginBottom: 10,
  },
  failedGradeGrid: { backgroundColor: '#FFF5F5' },
  gradeCell: { flex: 1, alignItems: 'center' },
  gradeCellLabel: { color: COLORS.textMuted, fontSize: 10, marginBottom: 4 },
  gradeCellValue: { color: COLORS.textDark, fontSize: 13, fontWeight: '700' },
  failedGradeValue: { color: COLORS.danger },
  pendingGradeValue: { color: COLORS.amber },
  editSubjectButton: { alignItems: 'center', backgroundColor: COLORS.purple, borderRadius: 9, paddingVertical: 10 },
  editSubjectButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  deleteCourseButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    marginTop: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerLight, borderRadius: 11,
  },
  deleteCourseButtonText: { color: COLORS.danger, fontSize: 13, fontWeight: '700' },
  deleteDialogBackdrop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: 24, backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  deleteDialog: {
    width: '100%', maxWidth: 360, padding: 20, borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  deleteDialogTitle: { color: COLORS.textDark, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  deleteDialogMessage: { color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  deleteDialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  deleteCancelButton: {
    minWidth: 72, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 9, backgroundColor: '#F1F5F9',
  },
  deleteCancelButtonText: { color: COLORS.textDark, fontSize: 13, fontWeight: '600' },
  deleteConfirmButton: {
    minWidth: 112, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 9, backgroundColor: COLORS.danger,
  },
  deleteConfirmButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  registerEmailPreview: {
    marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: COLORS.greenLight,
  },
  registerEmailText: { color: COLORS.textDark, fontSize: 14, fontWeight: '500' },
  registerErrorNotice: {
    marginTop: 10, padding: 10, borderRadius: 9,
    backgroundColor: COLORS.dangerLight, borderWidth: 1, borderColor: '#FECACA',
  },
  registerErrorText: { color: COLORS.danger, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  registerConfirmButton: {
    minWidth: 112, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 9, backgroundColor: COLORS.green,
  },
  registerConfirmButtonText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  rememberPasswordOption: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 28 },
  rememberPasswordCheckbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  rememberPasswordCheckboxChecked: { borderColor: COLORS.green, backgroundColor: COLORS.green },
  rememberPasswordText: { fontSize: 12, color: COLORS.textMuted },
  notificationScreenPage: { padding: 16, paddingBottom: 36, backgroundColor: '#F4F7F9' },
  statusBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0, marginBottom: 14, paddingHorizontal: 4 },
  timeText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  reminderScreenContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 },
  reminderFormCard: { flexGrow: 1, justifyContent: 'space-between', padding: 16 },
  logoBox: {
    width: 60, height: 60, borderRadius: 16, backgroundColor: COLORS.green,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  logoBoxSmall: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: COLORS.white, fontSize: 26, fontWeight: '600' },
  authTitle: { fontSize: 22, fontWeight: '600', color: COLORS.textDark, textAlign: 'center' },
  authSub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginBottom: 18 },
  screenTitle: { fontSize: 19, fontWeight: '600', color: COLORS.textDark, marginBottom: 12 },
  backLinkRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, minHeight: 28, marginBottom: 8 },
  backLinkBlue: { fontSize: 14, fontWeight: '600', color: COLORS.blue },
  backLinkPurple: { fontSize: 14, fontWeight: '600', color: COLORS.purple },
  backLinkGreen: { fontSize: 14, fontWeight: '600', color: COLORS.green },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textDark, marginVertical: 8 },
  heroBlueCard: { backgroundColor: COLORS.blue, padding: 16, borderRadius: 16, marginBottom: 14 },
  heroSub: { color: '#DBEAFE', fontSize: 11, fontWeight: '500' },
  heroBig: { color: COLORS.white, fontSize: 28, fontWeight: '600', marginVertical: 2 },
  card: {
    backgroundColor: COLORS.white, padding: 14, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  openDropdownCard: { zIndex: 20, elevation: 20 },
  cardCenter: {
    backgroundColor: COLORS.white, padding: 12, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  offlineBanner: {
    backgroundColor: COLORS.greenLight, borderColor: COLORS.green, borderWidth: 1,
    padding: 12, borderRadius: 14,
  },
  cardHeader: { fontSize: 14, fontWeight: '600', color: COLORS.textDark, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '500', color: COLORS.textDark, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, backgroundColor: COLORS.bg, fontSize: 13,
  },
  semesterSelectWrap: { position: 'relative' },
  semesterSelectButton: {
    minHeight: 42, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, marginBottom: 10, backgroundColor: COLORS.bg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  semesterSelectText: { color: COLORS.textDark, fontSize: 13 },
  semesterSelectArrow: { color: COLORS.purple, fontSize: 11, fontWeight: '700', marginLeft: 6 },
  semesterSelectMenu: {
    position: 'absolute', top: 66, left: 0, right: 0, zIndex: 30, elevation: 30,
    backgroundColor: COLORS.white, borderWidth: 1, borderRadius: 10, overflow: 'hidden',
  },
  semesterSelectOption: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  semesterSelectOptionBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  openDropdownRow: { zIndex: 25, elevation: 25 },
  searchBar: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, fontSize: 12,
    outlineStyle: 'none',
  },
  primaryBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  secondaryBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  primaryBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowGap: { flexDirection: 'row', gap: 8 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textDark },
  itemSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  badgeBlue: { backgroundColor: COLORS.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeBlueText: { color: COLORS.blue, fontWeight: '600', fontSize: 11 },
  badgePurple: { backgroundColor: COLORS.purpleLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgePurpleText: { color: COLORS.purple, fontWeight: '600', fontSize: 11 },
  badgeGreen: { backgroundColor: COLORS.greenLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeGreenText: { color: COLORS.green, fontWeight: '600', fontSize: 11 },
  badgeAmber: { backgroundColor: COLORS.amberLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeAmberText: { color: COLORS.amber, fontWeight: '600', fontSize: 10 },
  badgeRed: { backgroundColor: COLORS.dangerLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeRedText: { color: COLORS.danger, fontWeight: '600', fontSize: 11 },
  badgeGray: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeGrayText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 11 },
  chipActive: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  chipActiveText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  chipGray: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  chipGrayText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  semesterFilter: { backgroundColor: COLORS.purpleLight, padding: 10, borderRadius: 12, marginBottom: 10, zIndex: 2, elevation: 2, overflow: 'visible' },
  semesterFilterCollapsed: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  semesterFilterLabel: { fontSize: 12, fontWeight: '700', color: COLORS.purple },
  semesterFilterToggle: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.purple, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  semesterFilterToggleText: { color: COLORS.purple, fontSize: 11, fontWeight: '700' },
  semesterFilterDropdown: { position: 'absolute', top: 44, right: 10, backgroundColor: COLORS.white, borderRadius: 10, padding: 4, zIndex: 10, elevation: 10 },
  semesterFilterOption: { backgroundColor: COLORS.white, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  semesterFilterOptionActive: { backgroundColor: COLORS.purple },
  semesterFilterOptionText: { color: COLORS.purple, fontSize: 11, fontWeight: '700' },
  semesterFilterOptionTextActive: { color: COLORS.white },
  chartBox: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end',
    backgroundColor: COLORS.bg, padding: 12, borderRadius: 12, height: 110, marginTop: 6,
  },
  gradeGrid4: {
    flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 10, paddingVertical: 8, marginTop: 8,
  },
  gradeCol: { flex: 1, alignItems: 'center' },
  gradeLabel: { fontSize: 10, color: COLORS.textMuted, marginBottom: 2 },
  gradeVal: { fontSize: 12, fontWeight: '600', color: COLORS.textDark },
  weightBox: {
    flex: 1, backgroundColor: COLORS.purpleLight, borderColor: COLORS.purple, borderWidth: 1,
    borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  weightValueRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  weightInput: {
    width: 32, flexShrink: 0, padding: 0, textAlign: 'right',
    color: COLORS.purple, fontWeight: '700', fontSize: 14,
  },
  weightVal: { fontSize: 14, fontWeight: '700', color: COLORS.purple, marginLeft: 1 },
  resultBox: {
    backgroundColor: COLORS.purpleLight, borderColor: COLORS.purple, borderWidth: 1.5,
    borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 12,
  },
  reminderDetailScreen: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 26, backgroundColor: '#F8FAFC' },
  detailTitle: { color: '#0F172A', fontSize: 19, fontWeight: '700', marginBottom: 12 },
  detailCard: {
    backgroundColor: '#FFFFFF', borderColor: '#10B981', borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 18,
  },
  bellWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ECFDF5', borderWidth: 1.5, borderColor: '#10B981', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bellEmoji: { fontSize: 28 },
  countdownPill: { alignSelf: 'center', backgroundColor: '#FFFFFF', borderColor: '#2563EB', borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, marginBottom: 10 },
  countdownText: { color: '#2563EB', fontWeight: '700', fontSize: 11 },
  examName: { textAlign: 'center', color: '#0F172A', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  examMeta: { textAlign: 'center', color: '#64748B', fontSize: 12, marginBottom: 18 },
  infoBox: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { color: '#64748B', fontSize: 12 },
  infoValueGreen: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  infoValueStrong: { color: '#0F172A', fontSize: 12, fontWeight: '700' },
  infoValueBlue: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
  infoValueAmber: { color: '#D97706', fontSize: 12, fontWeight: '700' },
  infoDivider: { height: 1, backgroundColor: '#E2E8F0' },
  targetBox: { backgroundColor: '#ECFDF5', borderColor: '#10B981', borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 16, marginBottom: 16 },
  targetText: { color: '#10B981', fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  targetTextStrong: { color: '#0F172A', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  mainActionBtn: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  mainActionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  bottomTab: {
    flexDirection: 'row', height: 58, backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.border, alignItems: 'center',
  },
  importOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 360,
    alignItems: 'center',
  },
  importTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textDark, marginBottom: 12, textAlign: 'center' },
  importBtn: {
    backgroundColor: COLORS.purple,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
});