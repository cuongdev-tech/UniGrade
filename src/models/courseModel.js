// Model bảng courses — ánh xạ giữa document Firestore và object dùng trong app.
import { firstValue, numericValue } from './utils';
import { LETTER_POINTS } from '../services/gradeService';

// Tên field theo ERD (14 field).
export const FIELDS = [
  'course_id',
  'semester_id',
  'course_name',
  'credits',
  'weight_cc',
  'weight_gk',
  'weight_ck',
  'score_cc',
  'score_gk',
  'score_ck',
  'total_10',
  'total_4',
  'letter_grade',
  'status',
];

// Tên cũ đọc được để tương thích ngược với dữ liệu đã có.
export const ALIASES = {
  course_name: ['course_name', 'name', 'subject_name'],
  credits: ['credits', 'credit', 'credit_count'],
  score_cc: ['score_cc', 'cc_score', 'attendance_score', 'attendance_grade', 'grade_cc', 'cc'],
  score_gk: ['score_gk', 'gk_score', 'midterm_score', 'midterm_grade', 'grade_gk', 'gk'],
  score_ck: ['score_ck', 'ck_score', 'final_score', 'final_exam_grade', 'grade_ck', 'ck'],
  total_10: ['total_10', 'total_score', 'total_grade', 'final_grade', 'total'],
  weight_cc: ['weight_cc', 'cc_weight', 'attendance_weight', 'weight_attendance'],
  weight_gk: ['weight_gk', 'gk_weight', 'midterm_weight', 'weight_midterm'],
  weight_ck: ['weight_ck', 'ck_weight', 'final_weight', 'weight_final'],
  status: ['status', 'course_status'],
  letter_grade: ['letter_grade', 'grade_letter', 'grade'],
};

// Bảng quy đổi điểm chữ ↔ hệ 4 (dùng chung với gradeService).
export { LETTER_POINTS };

// "A+ (4.0)" -> "A+" ; "Chờ nhập CK" -> null
export const toLetterGrade = (badge) => {
  const letter = String(badge || '').trim().split(/\s+/)[0];
  return Object.prototype.hasOwnProperty.call(LETTER_POINTS, letter) ? letter : null;
};

// "A+" -> "A+ (4.0)" ; giá trị cũ "A+ (4.0)" giữ nguyên để không đổi giao diện
export const toLetterBadge = (value) => {
  const letter = String(value || '').trim();
  if (Object.prototype.hasOwnProperty.call(LETTER_POINTS, letter)) {
    return `${letter} (${LETTER_POINTS[letter].toFixed(1)})`;
  }
  return letter || null;
};

export const fromFirestore = (snapshot, semester) => {
  const data = snapshot.data();
  const cc = firstValue(data, ALIASES.score_cc);
  const gk = firstValue(data, ALIASES.score_gk);
  const ck = firstValue(data, ALIASES.score_ck);
  const total = firstValue(data, ALIASES.total_10);
  const weights = {
    cc: String(firstValue(data, ALIASES.weight_cc, 10)),
    gk: String(firstValue(data, ALIASES.weight_gk, 30)),
    ck: String(firstValue(data, ALIASES.weight_ck, 60)),
  };
  const statusValue = firstValue(data, ALIASES.status, 'pending');
  const status = ['passed', 'failed', 'pending'].includes(statusValue) ? statusValue : 'pending';
  const letter = toLetterBadge(firstValue(data, ALIASES.letter_grade, null));
  return {
    id: snapshot.id,
    name: firstValue(data, ALIASES.course_name, 'Môn học'),
    credits: numericValue(firstValue(data, ALIASES.credits, 0)),
    semester: semester.name,
    sem: semester.id,
    weights,
    status,
    badge: letter || (status === 'pending' ? 'Chờ nhập điểm' : status === 'failed' ? 'F (0.0)' : 'Đã đạt'),
    cc: cc === null ? 'Chưa nhập' : String(cc),
    gk: gk === null ? 'Chưa nhập' : String(gk),
    ck: ck === null ? 'Chưa nhập' : String(ck),
    total: total === null ? '--' : numericValue(total).toFixed(2),
    canEdit: semester.status !== 'Hoàn thành',
  };
};

export const toFirestore = (course) => {
  const letter = toLetterGrade(course.badge);
  return {
    course_id: course.id,
    semester_id: course.sem,
    course_name: course.name,
    credits: course.credits,
    weight_cc: numericValue(course.weights.cc),
    weight_gk: numericValue(course.weights.gk),
    weight_ck: numericValue(course.weights.ck),
    score_cc: course.cc === 'Chưa nhập' ? null : numericValue(course.cc, null),
    score_gk: course.gk === 'Chưa nhập' ? null : numericValue(course.gk, null),
    score_ck: course.ck === 'Chưa nhập' ? null : numericValue(course.ck, null),
    total_10: course.total === '--' ? null : numericValue(course.total, null),
    total_4: letter === null ? null : LETTER_POINTS[letter],
    letter_grade: letter,
    status: course.status,
  };
};
