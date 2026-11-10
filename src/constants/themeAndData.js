// src/constants/themeAndData.js
// Bảng màu Design System chuẩn Tuần 2 (Nền sáng & Bộ 3 màu Xanh dương - Tím - Xanh lá)
export const COLORS = {
  bg: '#F8FAFC',
  white: '#FFFFFF',
  blue: '#2563EB',      // Thành viên 1: Dashboard & Học kỳ
  blueLight: '#EFF6FF',
  purple: '#7C3AED',    // Thành viên 2: Môn học, Sửa điểm & Dự báo GPA
  purpleLight: '#F5F3FF',
  green: '#10B981',     // Thành viên 3: Đăng nhập, Đăng ký & Thông báo nhắc thi
  greenLight: '#ECFDF5',
  amber: '#D97706',
  amberLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  textDark: '#0F172A',
  textMuted: '#64748B',
  border: '#E2E8F0',
};

// Dữ liệu mẫu tĩnh (Static Mock Data cho Tuần 2)
export const INITIAL_USER_PROFILE = {
  fullName: 'Nguyễn Văn A',
  email: 'sinhvien@student.edu.vn',
  totalProgramCredits: 130, // Tổng số tín chỉ chương trình đào tạo
  totalProgramSemesters: 8, // Tổng số học kỳ
  accumulatedCredits: 85,   // Đã tích lũy (Không tính môn trượt điểm F < 4.0)
  remainingCredits: 45,     // Số tín chỉ còn lại = 130 - 85
  currentSemestersCount: 5,
  cpa4: 3.45,
  cpa10: 8.32,
  targetCpa: 3.20,
};

export const INITIAL_SEMESTERS = [
  { id: 'hk1_2627', code: 'hk1', name: 'Học kỳ 1', year: '2026 - 2027', credits: 15, gpa: 3.60, avg10: 8.52, status: 'Đang học', courseCount: 5 },
  { id: 'hk2_2526', code: 'hk2', name: 'Học kỳ 2', year: '2025 - 2026', credits: 15, gpa: 3.45, avg10: 8.15, status: 'Hoàn thành', courseCount: 6, note: 'Đạt 15/18 TC (Trượt 3 TC)' },
];

export const INITIAL_SEMESTER1_COURSES = [
  { id: 'c1', order: 1, name: 'Lập trình Di động', credits: 3, weights: '10% - 30% - 60%', cc: 9.0, gk: 8.5, ck: 9.0, total10: 8.85, letter: 'A', gpa4: 4.0 },
  { id: 'c2', order: 2, name: 'Cơ sở Dữ liệu', credits: 4, weights: '20% - 30% - 50%', cc: 8.5, gk: 8.0, ck: 8.0, total10: 8.10, letter: 'B+', gpa4: 3.5 },
  { id: 'c3', order: 3, name: 'Công nghệ Phần mềm', credits: 3, weights: '10% - 30% - 60%', cc: 9.0, gk: 8.5, ck: 8.5, total10: 8.60, letter: 'A', gpa4: 4.0 },
  { id: 'c4', order: 4, name: 'Mạng Máy tính', credits: 2, weights: '10% - 30% - 60%', cc: 8.0, gk: 7.5, ck: 8.0, total10: 7.85, letter: 'B', gpa4: 3.0 },
  { id: 'c5', order: 5, name: 'Kiểm thử Phần mềm', credits: 3, weights: '10% - 30% - 60%', cc: 9.0, gk: 8.0, ck: 8.5, total10: 8.40, letter: 'B+', gpa4: 3.5 },
];

export const INITIAL_SUBJECTS = [
  {
    id: 'sub1',
    name: 'Kiểm thử Phần mềm (Đã tạo)',
    credits: 3,
    semesterCode: 'hk1',
    semesterLabel: 'HK1 (2026-2027)',
    weights: '10%-30%-60%',
    cc: 9.0,
    gk: 8.0,
    ck: null,
    total10: null,
    letter: 'Chờ nhập CK',
    gpa4: null,
    status: 'pending',
  },
  {
    id: 'sub2',
    name: 'Lập trình Di động',
    credits: 3,
    semesterCode: 'hk1',
    semesterLabel: 'HK1 (2026-2027)',
    weights: '10%-30%-60%',
    cc: 9.0,
    gk: 8.5,
    ck: 9.0,
    total10: 8.85,
    letter: 'A',
    gpa4: 4.0,
    status: 'passed',
  },
  {
    id: 'sub3',
    name: 'Giải tích 1 (Trượt - Học lại)',
    credits: 3,
    semesterCode: 'hk2',
    semesterLabel: 'HK2 (2025-2026)',
    weights: '10%-30%-60%',
    cc: 5.0,
    gk: 3.5,
    ck: 3.0,
    total10: 3.35,
    letter: 'F',
    gpa4: 0.0,
    status: 'failed',
  },
];
