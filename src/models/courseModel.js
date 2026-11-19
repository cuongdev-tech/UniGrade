// Model bảng course_enrollments — mỗi document là MỘT LẦN HỌC một học phần trong một học kỳ.
// Thông tin gốc (tên môn, số tín chỉ) nằm ở bảng courses (danh mục), điểm/trọng số nằm ở đây.
// enrollment_id giữ đúng mã cũ (crs_att_2627) để lịch nhắc thi và URL cũ không đổi.
import { firstValue, numericValue } from './utils';
import {
  getCourseGradeTotal,
  getGradeLetter,
  LETTER_POINTS,
  parseDecimalValue,
  parseGradeValue,
  reconcileGkCkOrder,
  resolveGradeTotal,
} from '../services/gradeService';

// Tên field theo ERD.
export const FIELDS = [
  'enrollment_id',
  'user_id',
  'course_id',
  'semester_id',
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
  // Học lại: attempt_no = lần học thứ mấy, retake_of = enrollment_id của lần bị thay thế.
  'attempt_no',
  'retake_of',
];

// Tên cũ đọc được để tương thích ngược (dữ liệu trước khi tách bảng).
export const ALIASES = {
  course_id: ['course_id', 'courseId'],
  course_name: ['course_name', 'name', 'subject_name'],
  credits: ['credits', 'credit', 'credit_count'],
  score_cc: ['score_cc', 'cc_score', 'attendance_score', 'attendance_grade', 'grade_cc', 'cc'],
  score_gk: ['score_gk', 'gk_score', 'midterm_score', 'midterm_grade', 'grade_gk', 'gk'],
  score_ck: ['score_ck', 'ck_score', 'final_score', 'final_exam_grade', 'grade_ck', 'ck'],
  total_10: ['total_10', 'total_score', 'total_grade', 'final_grade', 'total'],
  total_4: ['total_4', 'grade_point', 'gpa_4'],
  weight_cc: ['weight_cc', 'cc_weight', 'attendance_weight', 'weight_attendance'],
  weight_gk: ['weight_gk', 'gk_weight', 'midterm_weight', 'weight_midterm'],
  weight_ck: ['weight_ck', 'ck_weight', 'final_weight', 'weight_final'],
  status: ['status', 'course_status'],
  letter_grade: ['letter_grade', 'grade_letter', 'grade'],
  attempt_no: ['attempt_no', 'attemptNo'],
  retake_of: ['retake_of', 'retakeOf'],
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

// catalog: document tương ứng ở bảng courses (có thể null nếu dữ liệu cũ chưa tách).
export const fromFirestore = (snapshot, semester, catalog = null) => {
  const data = snapshot.data();
  const cc = firstValue(data, ALIASES.score_cc);
  const gk = firstValue(data, ALIASES.score_gk);
  const ck = firstValue(data, ALIASES.score_ck);
  const storedTotal = firstValue(data, ALIASES.total_10);
  const weights = {
    cc: String(firstValue(data, ALIASES.weight_cc, catalog?.weights?.cc ?? 10)),
    gk: String(firstValue(data, ALIASES.weight_gk, catalog?.weights?.gk ?? 30)),
    ck: String(firstValue(data, ALIASES.weight_ck, catalog?.weights?.ck ?? 60)),
  };
  const componentGrades = {
    cc: cc === null ? '' : String(cc),
    gk: gk === null ? '' : String(gk),
    ck: ck === null ? '' : String(ck),
  };
  const reconciledGrades = reconcileGkCkOrder(componentGrades, weights, storedTotal);
  const total = reconciledGrades.total ?? resolveGradeTotal(
    storedTotal,
    firstValue(data, ALIASES.total_4),
    firstValue(data, ALIASES.letter_grade)
  );
  const grade = getGradeLetter(total);
  const statusValue = firstValue(data, ALIASES.status);
  const storedStatus = ['passed', 'failed', 'pending'].includes(statusValue) ? statusValue : 'pending';
  const status = statusValue === 'pending' ? 'pending' : grade?.status || storedStatus;
  return {
    id: snapshot.id,
    courseId: firstValue(data, ALIASES.course_id, catalog?.id || null),
    name: firstValue(data, ALIASES.course_name, catalog?.name || 'Môn học'),
    credits: numericValue(firstValue(data, ALIASES.credits, catalog?.credits ?? 0)),
    semester: semester.name,
    sem: semester.id,
    weights,
    status,
    badge: grade?.text || (status === 'pending' ? 'Chờ nhập điểm' : status === 'failed' ? 'F (0.0)' : 'Đã đạt'),
    cc: cc === null ? 'Chưa nhập' : String(cc),
    gk: reconciledGrades.grades.gk === '' ? 'Chưa nhập' : String(reconciledGrades.grades.gk),
    ck: reconciledGrades.grades.ck === '' ? 'Chưa nhập' : String(reconciledGrades.grades.ck),
    total: total === null ? '--' : total.toFixed(2),
    canEdit: semester.status !== 'Hoàn thành',
    attemptNo: numericValue(firstValue(data, ALIASES.attempt_no, 1), 1),
    retakeOf: firstValue(data, ALIASES.retake_of, null) || null,
  };
};

export const toFirestore = (uid, enrollment) => {
  const total = getCourseGradeTotal(enrollment);
  const grade = getGradeLetter(total);
  return {
    enrollment_id: enrollment.id,
    user_id: uid,
    course_id: enrollment.courseId || null,
    semester_id: enrollment.sem,
    weight_cc: parseDecimalValue(enrollment.weights.cc) ?? 0,
    weight_gk: parseDecimalValue(enrollment.weights.gk) ?? 0,
    weight_ck: parseDecimalValue(enrollment.weights.ck) ?? 0,
    score_cc: parseGradeValue(enrollment.cc),
    score_gk: parseGradeValue(enrollment.gk),
    score_ck: parseGradeValue(enrollment.ck),
    total_10: total,
    total_4: grade?.point ?? null,
    letter_grade: grade?.letter ?? null,
    status: enrollment.status === 'pending' ? 'pending' : grade?.status ?? 'pending',
    attempt_no: numericValue(enrollment.attemptNo, 1),
    retake_of: enrollment.retakeOf || null,
  };
};
