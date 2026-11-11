// Model bảng users — ánh xạ giữa document Firestore và object dùng trong app.
import { firstValue, numericValue } from './utils';

// Tên field theo ERD (6 field).
export const FIELDS = [
  'user_id',
  'full_name',
  'email',
  'total_program_credits',
  'total_program_semesters',
  'target_gpa',
];

// Field phụ dùng cho chức năng thông báo/đăng ký sau này (không có trong ERD).
export const EXTRA_FIELDS = ['created_at'];

// Tên cũ đọc được để tương thích ngược với dữ liệu đã có.
export const ALIASES = {
  full_name: ['full_name', 'name', 'display_name'],
  email: ['email'],
  total_program_credits: ['total_program_credits', 'total_credits'],
  total_program_semesters: ['total_program_semesters', 'total_semesters'],
  target_gpa: ['target_gpa', 'target_gpa_4', 'target_cpa'],
};

export const fromFirestore = (snapshot) => {
  const data = snapshot.data();
  return {
    fullName: firstValue(data, ALIASES.full_name, 'Sinh viên'),
    email: firstValue(data, ALIASES.email, ''),
    totalProgramCredits: numericValue(firstValue(data, ALIASES.total_program_credits, 130), 130),
    totalProgramSemesters: numericValue(firstValue(data, ALIASES.total_program_semesters, 8), 8),
    targetGpa: numericValue(firstValue(data, ALIASES.target_gpa, 3.2), 3.2),
  };
};

export const toFirestore = (uid, profile) => ({
  user_id: uid,
  full_name: profile.fullName,
  email: profile.email,
  total_program_credits: profile.totalProgramCredits,
  total_program_semesters: profile.totalProgramSemesters,
  target_gpa: profile.targetGpa,
  created_at: new Date().toISOString(),
});
