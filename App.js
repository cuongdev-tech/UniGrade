

import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import NotificationShade from './src/components/NotificationShade';
import { COLORS } from './src/constants/theme';
import { styles } from './src/constants/styles';
import { useUniGradeViewModel } from './src/viewmodels/useUniGradeViewModel';
import {
  REMINDER_TYPES,
  getReminderTypeLabel,
  getReminderAdvanceLabel,
} from './src/constants/config';
import {
  parseGradeValue,
  isGradeValueInvalid,
  getGradeLetter,
  calcCourseTotal,
  getRankByGPA,
  calcSemesterStats,
  hasFinalSemesterGpa,
  formatComponentScore,
} from './src/services/gradeService';
import { getWhatIfForecast } from './src/services/forecastService';
import { getReminderTypeSummary } from './src/services/reminderService';

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
  StatusBar,
  Platform,
  Modal,
} from 'react-native';

// Các mức điểm tổng kết dùng cho ô chọn ở màn Dự báo What-if.
const TARGET_GRADE_OPTIONS = [
  { key: 'A+', label: 'A+ (9.0)', ten: 9.0, point: 4.0 },
  { key: 'A', label: 'A (8.5)', ten: 8.5, point: 3.7 },
  { key: 'B+', label: 'B+ (8.0)', ten: 8.0, point: 3.5 },
  { key: 'B', label: 'B (7.0)', ten: 7.0, point: 3.0 },
];

// 1. BẢNG MÀU CHUẨN DESIGN SYSTEM
// Đã chuyển sang src/constants/theme.js (dùng chung với styles.js).


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

// 3. CẤU HÌNH NHẮC THI & THÔNG BÁO LỖI
// Đã chuyển sang src/constants/config.js (dùng chung với ViewModel).

export default function App() {
  // Quản lý luồng di chuyển giữa 12 màn hình chính + 2 màn phụ (Screen State)
  // 1: Đăng nhập | 2: Đăng ký | 3: Dashboard | 4: Quản lý Học kỳ | 5: Bảng điểm HK1
  // 6: Danh sách Môn | 7: Thêm Học phần mới | 8: Sửa Học phần & Sửa điểm
  // 9: Dự báo Điểm What-if | 10: Nhắc thi | 11: Thêm Lịch Nhắc Thi Mới | 12: Quên Mật Khẩu
  // 13 (phụ): Chi tiết thông báo nhắc thi (mở từ thông báo, quay lại Màn 10 - Nhắc thi)
  // Lưu ý: màn khóa + banner thông báo là UI của hệ điều hành, không phải màn hình trong app.
  const {
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
  } = useUniGradeViewModel();

  // Trạng thái UI cục bộ: modal Hồ sơ cá nhân mở từ avatar ở trang Tổng quan.
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);

  // Nhắc thi đã bấm "Đã nhận thông báo" sẽ được gỡ khỏi danh sách hiển thị.
  const activeReminders = reminders.filter((reminder) => !reminder.isAcknowledged);
  const targetGpa = Number(profile?.targetGpa ?? 3.2);
  const isGpaBelowTarget = hasOverallGpa && overallStats.gpa < targetGpa;

  const closeProfileModal = () => {
    setIsProfileModalOpen(false);
    closeProfileEdit();
  };

  const handleSaveProfile = async () => {
    const saved = await saveProfileSettings();
    if (saved) setIsProfileModalOpen(false);
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
      {!!profileNotice && (
        <View style={[styles.courseActionNotice, styles.courseActionNoticeSuccess]}>
          <Text style={[styles.courseActionNoticeText, styles.courseActionNoticeSuccessText]}>
            {profileNotice}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Đóng thông báo hồ sơ"
            onPress={() => setProfileNotice('')}
          >
            <Ionicons name="close" size={16} color={COLORS.green} />
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={hasOverallGpa ? rankBadge : styles.badgeGray}>
            <Text style={hasOverallGpa ? rankBadgeText : styles.badgeGrayText}>
              {hasOverallGpa ? overallRank.text : '--'}
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Mở hồ sơ cá nhân"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: COLORS.blue,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 10,
            }}
            onPress={() => setIsProfileModalOpen(true)}
          >
            <Text style={{ color: COLORS.white, fontSize: 13, fontWeight: '700' }}>
              {(profile?.fullName || firebaseUser?.displayName || 'SV').split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()}
            </Text>
          </TouchableOpacity>
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

      {/* Cảnh báo khi GPA tích lũy thấp hơn GPA mục tiêu trong hồ sơ */}
      {isGpaBelowTarget && (
        <View style={styles.gpaWarningCard}>
          <Ionicons name="warning-outline" size={20} color={COLORS.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.gpaWarningTitle}>GPA đang dưới mục tiêu</Text>
            <Text style={styles.gpaWarningText}>
              GPA tích lũy hiện tại {overallGpaText} thấp hơn mục tiêu {targetGpa.toFixed(2)} ({(
                targetGpa - overallStats.gpa
              ).toFixed(2)} điểm). Hãy cải thiện điểm ở các học kỳ tiếp theo nhé!
            </Text>
          </View>
        </View>
      )}

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
            const isProvisionalGpa = isSemesterGpaProvisional(sem.stats);
            const h = (hasFinalGpa || isProvisionalGpa) ? Math.max(16, Math.round((sem.stats.gpa / 4) * 90)) : 16;
            return (
              <View key={sem.id} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: isActive ? COLORS.blue : COLORS.textMuted }}>
                  {formatSemesterGpa(sem.stats)}
                </Text>
                <View style={{ width: 34, height: h, backgroundColor: hasFinalGpa ? (isActive ? COLORS.blue : '#93C5FD') : isProvisionalGpa ? '#BFDBFE' : COLORS.border, borderRadius: 6, marginVertical: 4 }} />
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
          <View style={sem.status === 'Đang học' ? styles.badgeGreen : sem.status === 'Chưa xác nhận' ? styles.badgeAmber : styles.badgeGray}>
            <Text style={sem.status === 'Đang học' ? styles.badgeGreenText : sem.status === 'Chưa xác nhận' ? styles.badgeAmberText : styles.badgeGrayText}>{sem.status}</Text>
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
    const isProvisionalGpa = isSemesterGpaProvisional(sem.stats);
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
        {isProvisionalGpa && (
          <Text style={[styles.heroSub, { marginTop: 4 }]}>
            * Tạm tính: đã có điểm {sem.stats.gradedCount}/{sem.stats.count} môn
          </Text>
        )}
      </View>

      <View style={[styles.rowBetween, { marginTop: 8, marginBottom: 8 }]}>
        <Text style={[styles.sectionTitle, { flex: 1, paddingRight: 8, marginVertical: 0 }]}>
          Điểm các môn trong Học kỳ ({detailCourses.length})
        </Text>
        {sem.isConfirmed && (
          <View style={styles.badgeGreen}>
            <Text style={styles.badgeGreenText}>Đã xác nhận</Text>
          </View>
        )}
        {sem.canConfirm && (
          <TouchableOpacity
            style={styles.confirmGradesButton}
            accessibilityRole="button"
            onPress={() => openConfirmSemesterDialog(sem.id)}
          >
            <Ionicons name="checkmark-circle" size={15} color={COLORS.white} />
            <Text style={styles.confirmGradesButtonText}>Xác nhận điểm</Text>
          </TouchableOpacity>
        )}
      </View>
      {sem.isConfirmed && (
        <Text style={styles.lockedSemesterNotice}>
          🔒 Học kỳ đã xác nhận điểm — không thể sửa hoặc xóa điểm.
        </Text>
      )}
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
              CC: {formatComponentScore(course.cc, course.weights.cc)} ({course.weights.cc}%) • GK: {formatComponentScore(course.gk, course.weights.gk)} ({course.weights.gk}%) • CK: {formatComponentScore(course.ck, course.weights.ck)} ({course.weights.ck}%)
            </Text>
          </View>
        );
      })}

      <Modal
        visible={isConfirmSemesterDialogVisible}
        transparent
        animationType="fade"
        onRequestClose={closeConfirmSemesterDialog}
      >
        <View style={styles.deleteDialogBackdrop}>
          <View style={styles.deleteDialog}>
            <Text style={styles.deleteDialogTitle}>Xác nhận điểm học kỳ?</Text>
            <Text style={styles.deleteDialogMessage}>
              Bạn xác nhận đã hoàn thành “{sem.rawName} • {sem.year}”?
            </Text>
            <Text style={[styles.deleteDialogMessage, { marginTop: 8 }]}>
              Sau khi xác nhận, học kỳ sẽ chuyển sang <Text style={{ fontWeight: '700' }}>Hoàn thành</Text> và
              toàn bộ điểm của {detailCourses.length} môn sẽ bị khóa, không sửa hoặc xóa được nữa.
            </Text>
            <View style={styles.deleteDialogActions}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                disabled={isConfirmingSemester}
                onPress={closeConfirmSemesterDialog}
              >
                <Text style={styles.deleteCancelButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDialogButton, isConfirmingSemester && { opacity: 0.6 }]}
                disabled={isConfirmingSemester}
                onPress={() => confirmSemesterGrades(sem.id)}
              >
                <Text style={styles.confirmDialogButtonText}>
                  {isConfirmingSemester ? 'Đang xác nhận...' : 'Xác nhận điểm'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <TouchableOpacity
            style={[styles.importGradesButton, { flex: 1, alignItems: 'center' }]}
            accessibilityRole="button"
            accessibilityLabel="Nhập điểm từ file Excel"
            onPress={importGradesFromFile}
          >
            <Text style={styles.importGradesButtonText}>⇧ Nhập điểm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importGradesButton, { flex: 1, alignItems: 'center' }]}
            accessibilityRole="button"
            accessibilityLabel="Xuất bảng điểm ra file CSV"
            onPress={exportGradeData}
          >
            <Text style={styles.importGradesButtonText}>⇩ Xuất điểm</Text>
          </TouchableOpacity>
        </View>

        {!!profileNotice && (
          <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.green, marginBottom: 8 }}>
            {profileNotice}
          </Text>
        )}

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
          File Excel cần cột Tên môn học + điểm CC (QT/BT), GK, CK; có thể kèm Kỳ/Năm học, Số TC, Công thức điểm, Thang 10, Thang 4, Chữ. Môn chưa có trong app cần đủ Kỳ/Năm học + Số TC để tự tạo.
        </Text>
        {!!gradeImportMessage && (
          <Text style={[
            styles.importGradesMessage,
            gradeImportMessageType === 'error'
              ? styles.importGradesMessageError
              : styles.importGradesMessageSuccess,
          ]}>
            {gradeImportMessage}
          </Text>
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
            { label: 'CC', value: subject.cc, weight: subject.weights.cc },
            { label: 'GK', value: subject.gk, weight: subject.weights.gk },
            { label: 'CK', value: subject.ck, weight: subject.weights.ck },
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
                {gradeValues.map((grade) => {
                  const displayValue = grade.weight === undefined
                    ? grade.value
                    : formatComponentScore(grade.value, grade.weight);
                  return (
                    <View key={grade.label} style={styles.gradeCell}>
                      <Text style={styles.gradeCellLabel}>{grade.label}</Text>
                      <Text style={[styles.gradeCellValue, isFailed && styles.failedGradeValue, (grade.value === 'Chưa nhập' || displayValue === '--') && styles.pendingGradeValue]}>
                        {displayValue}
                      </Text>
                    </View>
                  );
                })}
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
              Bạn có chắc muốn xóa “{editingCourse.name}”? Toàn bộ điểm chuyên cần, giữa kỳ, cuối kỳ,
              điểm tổng kết và các nhắc thi của học phần này sẽ bị xóa vĩnh viễn, không thể hoàn tác.
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

    const targetOption =
      TARGET_GRADE_OPTIONS.find((option) => option.key === selectedTargetGrade) || TARGET_GRADE_OPTIONS[0];
    const targetTen = targetOption.ten;
    const targetPoint = targetOption.point;
    // Trọng số CK dùng để dự báo = 100% - (CC + GK). Nhờ vậy môn CK 100% vẫn dự báo được.
    const forecast = getWhatIfForecast({
      cc: activeCourse.cc,
      gk: activeCourse.gk,
      weights: activeCourse.weights,
      targetTen,
    });
    const ckWeight = forecast.ckWeight;
    const requiredScoreNumber = forecast.requiredScore;
    const hasPrediction = requiredScoreNumber !== null;
    const isFeasible = forecast.isFeasible;
    const requiredScore = hasPrediction
      ? `${Math.max(0, requiredScoreNumber).toFixed(2)} điểm`
      : '--';
    const feasibilityMessage = !hasPrediction
      ? 'Không khả thi (Chưa đủ điểm CC/GK để dự báo)'
      : !isFeasible
        ? 'Không khả thi (Cần trên 10.0 điểm)'
        : forecast.isAlreadyEnough
          ? 'Khả thi (Đã đủ điểm để đạt mục tiêu)'
          : 'Khả thi (Nằm trong khoảng 0.0 – 10.0)';
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

        <View style={[styles.card, (isWhatIfDropdownOpen || isTargetGradeDropdownOpen) && styles.openDropdownCard]}>
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
            accessibilityRole="button"
            accessibilityLabel="Chọn môn học What-if"
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
          <View style={styles.targetGradeWrap}>
            <TouchableOpacity
              style={styles.targetGradeSelect}
              accessibilityRole="button"
              accessibilityLabel="Chọn mức điểm tổng kết mong muốn"
              onPress={() => setIsTargetGradeDropdownOpen(!isTargetGradeDropdownOpen)}
            >
              <Text style={styles.targetGradeSelectText}>{targetOption.label}</Text>
              <Ionicons
                name={isTargetGradeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={15}
                color={COLORS.purple}
              />
            </TouchableOpacity>
            {isTargetGradeDropdownOpen && (
              <View style={styles.targetGradeMenu}>
                {TARGET_GRADE_OPTIONS.map((option, idx) => {
                  const isSelected = option.key === selectedTargetGrade;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.targetGradeOption,
                        idx < TARGET_GRADE_OPTIONS.length - 1 && styles.targetGradeOptionDivider,
                        isSelected && styles.targetGradeOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedTargetGrade(option.key);
                        setIsTargetGradeDropdownOpen(false);
                      }}
                    >
                      <Text style={[
                        styles.targetGradeOptionText,
                        isSelected && styles.targetGradeOptionTextSelected,
                      ]}>
                        {isSelected ? <Ionicons name="checkmark" size={13} color={COLORS.purple} /> : null} {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.resultBox}>
            <Text style={{ fontSize: 12, color: COLORS.purple, fontWeight: '600' }}>Điểm thi Cuối kỳ ({ckWeight}%) tối thiểu cần đạt:</Text>
            <Text style={{ fontSize: 28, fontWeight: '600', color: isFeasible ? COLORS.purple : COLORS.danger, marginVertical: 4 }}>{requiredScore}</Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isFeasible ? COLORS.green : COLORS.danger }}>
              <Ionicons name={isFeasible ? 'checkmark-circle' : 'close-circle'} size={11} color={isFeasible ? COLORS.green : COLORS.danger} />{' '}
              {feasibilityMessage}
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
  // MÀN HÌNH 10: NHẮC THI (THÀNH VIÊN 3 - MÀU XANH LÁ). Hồ sơ cá nhân đã chuyển sang modal ở trang Tổng quan.
  // ==========================================================================
  const renderScreen10Reminders = () => (
    <ScrollView contentContainerStyle={styles.notificationScreenPage}>
      <View style={styles.statusBarRow}>
        <Text style={styles.timeText}>09:41</Text>
        <Text style={styles.statusText}>5G • 100%</Text>
      </View>

      <View style={[styles.card, { borderColor: COLORS.green, borderWidth: 1.5, marginTop: 8 }]}> 
        <Text style={[styles.cardHeader, { color: COLORS.green, marginBottom: 12 }]}> 
          <Ionicons name="notifications-outline" size={14} color={COLORS.green} /> Hẹn giờ nhắc lịch thi (Expo Notify)
        </Text>

        {activeReminders.map((reminder) => (
          <View
            key={reminder.id}
            style={[styles.rowBetween, { backgroundColor: COLORS.bg, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border }]}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.textDark }}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textDark} /> {getReminderTypeLabel(reminder.type)}: {reminder.courseName}
              </Text>
              <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>
                {reminder.room} • Báo thức: {reminder.alarmDate && reminder.alarmTime
                  ? `${reminder.alarmDate} ${reminder.alarmTime}`
                  : getReminderAdvanceLabel(reminder.advance)}
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.green }}>{reminder.date} • {reminder.time}</Text>
          </View>
        ))}
        {activeReminders.length === 0 && (
          <Text style={[styles.itemSub, { textAlign: 'center', marginBottom: 12 }]}>
            Chưa có lịch thi nào đang cần nhắc.
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
    </ScrollView>
  );

  const renderScreen11AddExamReminder = () => {
    const renderBackLink = () => (
      <TouchableOpacity style={styles.backLinkRow} onPress={() => setCurrentScreen(10)}>
        <Ionicons name="arrow-back" size={16} color={COLORS.green} />
        <Text style={styles.backLinkGreen}>Quay lại</Text>
      </TouchableOpacity>
    );

    if (reminderCourseOptions.length === 0) {
      return (
        <ScrollView contentContainerStyle={styles.reminderScreenContent}>
          {renderBackLink()}
          <Text style={styles.screenTitle}>Thêm Lịch Nhắc Thi Mới</Text>
          <View style={styles.card}>
            <Text style={styles.itemSub}>
              Tất cả học phần trong học kỳ hiện tại đã có điểm cuối kỳ nên không cần nhắc thi nữa.
            </Text>
          </View>
        </ScrollView>
      );
    }

    const selectedOption =
      reminderCourseOptions.find((option) => option.course.id === newReminder.courseId) ||
      reminderCourseOptions[0];
    const selectedCourse = selectedOption.course;
    const selectedCourseSemester =
      semesters.find((sem) => sem.id === selectedCourse.sem)?.name || selectedCourse.semester;
    const remainingLabel = getReminderTypeSummary(selectedOption.allowedTypes);

    return (
      <ScrollView contentContainerStyle={styles.reminderScreenContent}>
        {renderBackLink()}

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
            accessibilityRole="button"
            accessibilityLabel="Chọn học phần nhắc thi"
            onPress={() => setIsReminderCourseOpen(!isReminderCourseOpen)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{selectedCourse.name} ({selectedCourse.credits} TC)</Text>
              <Text style={{ fontSize: 11, color: COLORS.green, marginTop: 2 }}>{selectedCourseSemester}</Text>
              <Text style={{ fontSize: 10.5, color: COLORS.textMuted, marginTop: 2 }}>
                Còn thi: {remainingLabel}
              </Text>
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
              {reminderCourseOptions.map((option, idx) => {
                const course = option.course;
                const isSelected = newReminder.courseId === course.id;
                const optionRemainingLabel = getReminderTypeSummary(option.allowedTypes);
                return (
                  <TouchableOpacity
                    key={course.id}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      backgroundColor: isSelected ? COLORS.greenLight : COLORS.white,
                      borderBottomWidth: idx < reminderCourseOptions.length - 1 ? 1 : 0,
                      borderBottomColor: COLORS.border,
                    }}
                    onPress={() => {
                      setNewReminder((current) => ({
                        ...current,
                        courseId: course.id,
                        type: option.allowedTypes.includes(current.type)
                          ? current.type
                          : option.allowedTypes[0],
                      }));
                      setIsReminderCourseOpen(false);
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? COLORS.green : COLORS.textDark }}>
                      {isSelected ? <Ionicons name="checkmark" size={13} color={COLORS.green} /> : null} {course.name} ({course.credits} TC)
                    </Text>
                    <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                      {course.semester} • Còn thi: {optionRemainingLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>2. Loại lịch nhắc</Text>
          <View style={[styles.rowGap, { marginBottom: 12 }]}>
            {REMINDER_TYPES.map((type) => {
              const isAllowed = selectedOption.allowedTypes.includes(type.key);
              const isActive = newReminder.type === type.key;
              return (
                <TouchableOpacity
                  key={type.key}
                  disabled={!isAllowed}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !isAllowed }}
                  accessibilityLabel={`${type.label}${isAllowed ? '' : ' (không khả dụng)'}`}
                  style={[
                    isActive ? [styles.chipActive, { backgroundColor: COLORS.green }] : styles.chipGray,
                    !isAllowed && styles.chipDisabled,
                  ]}
                  onPress={() => {
                    if (!isAllowed) return;
                    setNewReminder((current) => ({ ...current, type: type.key }));
                  }}
                >
                  <Text style={isActive ? styles.chipActiveText : styles.chipGrayText}>
                    {type.label}
                  </Text>
                  {!isAllowed && (
                    <Text style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 2 }}>
                      {type.key === 'mid'
                        ? (selectedOption.hasGkScore ? 'Đã có điểm GK' : 'Đã có nhắc thi')
                        : 'Đã có điểm CK'}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
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
          <Text style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
            Tự chọn ngày và giờ bạn muốn được báo thức trước khi ca thi bắt đầu.
          </Text>
          <View style={styles.rowGap}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Ngày báo thức *</Text>
              <TextInput
                style={styles.input}
                value={newReminder.alarmDate}
                onChangeText={(value) => setNewReminder((current) => ({ ...current, alarmDate: value }))}
                placeholder="DD/MM/YYYY"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Giờ báo thức *</Text>
              <TextInput
                style={styles.input}
                value={newReminder.alarmTime}
                onChangeText={(value) => setNewReminder((current) => ({ ...current, alarmTime: value }))}
                placeholder="HH:MM"
              />
            </View>
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
    const forecast = getWhatIfForecast({
      cc: detailCourse ? detailCourse.cc : null,
      gk: detailCourse ? detailCourse.gk : null,
      weights: detailCourse ? detailCourse.weights : {},
      targetTen,
    });
    const ckWeight = forecast.ckWeight;
    const requiredCkScore = forecast.requiredScore;
    const requiredCkText =
      requiredCkScore !== null && Number.isFinite(requiredCkScore) ? `${requiredCkScore.toFixed(2)} điểm` : '--';
    const alarmLabel = reminder.alarmDate && reminder.alarmTime
      ? `${reminder.alarmDate} • ${reminder.alarmTime}`
      : getReminderAdvanceLabel(reminder.advance);

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
            {reminder.semesterLabel} • Trọng số CK: {ckWeight}%
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
              <Text style={styles.infoLabel}>Báo thức:</Text>
              <Text style={styles.infoValueAmber}>{alarmLabel}</Text>
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
            accessibilityRole="button"
            accessibilityLabel="Mở thanh thông báo"
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
      {currentScreen === 10 && renderScreen10Reminders()}
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
        reminder={activeReminders[0]}
        onClose={() => setIsShadeOpen(false)}
        onOpen={() => {
          setIsShadeOpen(false);
          if (activeReminders[0]) openReminderDetail(activeReminders[0]);
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

      {/* MODAL HỒ SƠ CÁ NHÂN - mở từ avatar ở góc phải trang Tổng quan */}
      <Modal
        visible={isProfileModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeProfileModal}
      >
        <View style={styles.deleteDialogBackdrop}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel="Đóng hồ sơ khi bấm ra ngoài"
            onPress={closeProfileModal}
          />
          <View style={styles.deleteDialog}>
            {isProfileEditOpen ? (
              <>
                <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                  <Text style={styles.deleteDialogTitle}>Sửa hồ sơ</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Đóng hồ sơ cá nhân"
                    style={{ outlineStyle: 'none' }}
                    onPress={closeProfileModal}
                  >
                    <Ionicons name="close" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>GPA mục tiêu (Hệ 4)</Text>
                <TextInput
                  style={styles.input}
                  value={profileTargetGpa}
                  onChangeText={setProfileTargetGpa}
                  placeholder="VD: 3.20"
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Tổng tín chỉ chương trình</Text>
                <TextInput
                  style={styles.input}
                  value={profileTotalCredits}
                  onChangeText={setProfileTotalCredits}
                  placeholder="VD: 130"
                  keyboardType="number-pad"
                />

                {!!profileEditError && (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.danger, marginBottom: 8 }}>
                    {profileEditError}
                  </Text>
                )}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.deleteCancelButton, { flex: 1, marginTop: 0 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Quay lại hồ sơ cá nhân"
                    onPress={closeProfileEdit}
                    disabled={isSavingProfile}
                  >
                    <Text style={styles.deleteCancelButtonText}>Quay lại</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.registerConfirmButton, { flex: 1, marginTop: 0 }, isSavingProfile && { opacity: 0.6 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Lưu hồ sơ"
                    onPress={handleSaveProfile}
                    disabled={isSavingProfile}
                  >
                    <Text style={styles.registerConfirmButtonText}>
                      {isSavingProfile ? 'Đang lưu...' : 'Lưu'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.rowBetween, { marginBottom: 14 }]}>
                  <Text style={styles.deleteDialogTitle}>Hồ sơ cá nhân</Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Đóng hồ sơ cá nhân"
                    style={{ outlineStyle: 'none' }}
                    onPress={closeProfileModal}
                  >
                    <Ionicons name="close" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: COLORS.blue,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: COLORS.white, fontSize: 16, fontWeight: '700' }}>
                      {(profile?.fullName || firebaseUser?.displayName || 'SV').split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{profile?.fullName || firebaseUser?.displayName || 'Sinh viên'}</Text>
                    <Text style={styles.itemSub}>{profile?.email || firebaseUser?.email || ''}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={{
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: COLORS.blue,
                    backgroundColor: COLORS.blueLight,
                    alignItems: 'center',
                    marginBottom: 10,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Sửa hồ sơ"
                  onPress={openProfileEdit}
                >
                  <Text style={{ color: COLORS.blue, fontWeight: '600', fontSize: 13 }}>
                    <Ionicons name="create-outline" size={14} color={COLORS.blue} /> Sửa hồ sơ
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    paddingVertical: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: COLORS.danger,
                    backgroundColor: COLORS.dangerLight,
                    alignItems: 'center',
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Đăng xuất"
                  onPress={() => {
                    closeProfileModal();
                    handleLogout();
                  }}
                >
                  <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 13 }}>
                    <Ionicons name="log-out-outline" size={14} color={COLORS.danger} /> Đăng xuất
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}
