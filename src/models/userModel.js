// Model bảng users — tài khoản sinh viên (không chứa cấu hình học vụ).
// Cấu hình học vụ (tổng tín chỉ, GPA mục tiêu) nằm ở academic_profiles.
import { firstValue, numericValue } from './utils';
import { ALIASES as ACADEMIC_PROFILE_ALIASES } from './academicProfileModel';

export const FIELDS = [
  'user_id',
  'full_name',
  'email',
  'avatar_initials',
  'created_at',
  'last_login_at',
];

export const ALIASES = {
  full_name: ['full_name', 'name', 'display_name'],
  email: ['email'],
  avatar_initials: ['avatar_initials', 'initials'],
};

// Alias các field cũ từng nằm trong users (đọc để tương thích ngược).
const LEGACY_PROFILE_ALIASES = {
  total_program_credits: ['total_program_credits', 'total_credits'],
  total_program_semesters: ['total_program_semesters', 'total_semesters'],
  target_gpa_4: ['target_gpa', 'target_gpa_4', 'target_cpa'],
};

export const getInitials = (fullName) => {
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'SV';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

// academicData: document academic_profiles (có thể null với dữ liệu cũ).
export const fromFirestore = (snapshot, academicData = null) => {
  const data = snapshot.data();
  const academic = academicData || {};
  const profileValue = (key, fallback) =>
    firstValue(academic, ACADEMIC_PROFILE_ALIASES[key], firstValue(data, LEGACY_PROFILE_ALIASES[key], fallback));
  return {
    fullName: firstValue(data, ALIASES.full_name, 'Sinh viên'),
    email: firstValue(data, ALIASES.email, ''),
    avatarInitials: firstValue(data, ALIASES.avatar_initials, getInitials(firstValue(data, ALIASES.full_name, ''))),
    totalProgramCredits: numericValue(profileValue('total_program_credits', 130), 130),
    totalProgramSemesters: numericValue(profileValue('total_program_semesters', 8), 8),
    targetGpa: numericValue(profileValue('target_gpa_4', 3.2), 3.2),
  };
};

// Tài liệu users chỉ giữ thông tin tài khoản.
export const toFirestore = (uid, profile) => ({
  user_id: uid,
  full_name: profile.fullName,
  email: profile.email,
  avatar_initials: String(profile.avatarInitials ?? '').trim() || getInitials(profile.fullName),
  created_at: new Date().toISOString(),
  last_login_at: null,
});

// Giữ 3 field cũ trong users để tài khoản chưa migrate vẫn đọc được.
export const toLegacyProfileUpdate = (profile) => ({
  total_program_credits: numericValue(profile.totalProgramCredits, 130),
  total_program_semesters: numericValue(profile.totalProgramSemesters, 8),
  target_gpa: numericValue(profile.targetGpa, 3.2),
});
