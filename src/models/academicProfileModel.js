// Model bảng academic_profiles — cấu hình học vụ 1:1 với users.
// Tách khỏi users theo ERD: mỗi tài khoản có tối đa 1 hồ sơ học vụ.
import { firstValue, numericValue } from './utils';

export const FIELDS = [
  'profile_id',
  'user_id',
  'total_program_credits',
  'total_program_semesters',
  'target_gpa_4',
  'updated_at',
];

// Tên cũ đọc được để tương thích ngược.
export const ALIASES = {
  total_program_credits: ['total_program_credits', 'total_credits'],
  total_program_semesters: ['total_program_semesters', 'total_semesters'],
  target_gpa_4: ['target_gpa_4', 'target_gpa', 'target_cpa'],
};

export const getProfileDocumentId = (uid) => `prof_${uid}`;

export const fromFirestore = (snapshot) => {
  const data = snapshot.data();
  return {
    totalProgramCredits: numericValue(firstValue(data, ALIASES.total_program_credits, 130), 130),
    totalProgramSemesters: numericValue(firstValue(data, ALIASES.total_program_semesters, 8), 8),
    targetGpa: numericValue(firstValue(data, ALIASES.target_gpa_4, 3.2), 3.2),
  };
};

export const toFirestore = (profileId, uid, profile) => ({
  profile_id: profileId,
  user_id: uid,
  total_program_credits: numericValue(profile.totalProgramCredits, 130),
  total_program_semesters: numericValue(profile.totalProgramSemesters, 8),
  target_gpa_4: numericValue(profile.targetGpa, 3.2),
  updated_at: new Date().toISOString(),
});

// Chỉ cập nhật 2 field người dùng sửa được ở màn "Sửa hồ sơ".
export const toProfileUpdate = (profile) => ({
  total_program_credits: numericValue(profile.totalProgramCredits, 130),
  target_gpa_4: numericValue(profile.targetGpa, 3.2),
  updated_at: new Date().toISOString(),
});
