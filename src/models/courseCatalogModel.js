// Model bảng courses — danh mục học phần gốc (1 dòng cho 1 môn, không chứa điểm).
// Điểm và trọng số theo từng kỳ nằm ở course_enrollments.
import { firstValue, numericValue } from './utils';
import { buildCourseCode } from '../services/courseIdService';

export const FIELDS = [
  'course_id',
  'user_id',
  'course_code',
  'course_name',
  'credits',
  'default_weight_cc',
  'default_weight_gk',
  'default_weight_ck',
  'is_passed',
];

export const ALIASES = {
  course_code: ['course_code', 'code'],
  course_name: ['course_name', 'name', 'subject_name'],
  credits: ['credits', 'credit', 'credit_count'],
  default_weight_cc: ['default_weight_cc', 'weight_cc', 'cc_weight'],
  default_weight_gk: ['default_weight_gk', 'weight_gk', 'gk_weight'],
  default_weight_ck: ['default_weight_ck', 'weight_ck', 'ck_weight'],
  is_passed: ['is_passed', 'passed'],
};

export const fromFirestore = (snapshot) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: firstValue(data, ALIASES.course_name, 'Môn học'),
    code: firstValue(data, ALIASES.course_code, ''),
    credits: numericValue(firstValue(data, ALIASES.credits, 0)),
    weights: {
      cc: String(firstValue(data, ALIASES.default_weight_cc, 10)),
      gk: String(firstValue(data, ALIASES.default_weight_gk, 30)),
      ck: String(firstValue(data, ALIASES.default_weight_ck, 60)),
    },
    isPassed: firstValue(data, ALIASES.is_passed, false) === true,
  };
};

export const toFirestore = (catalogId, uid, course, isPassed = false) => ({
  course_id: catalogId,
  user_id: uid,
  course_code: course.courseCode || buildCourseCode(course.name),
  course_name: course.name,
  credits: numericValue(course.credits, 0),
  default_weight_cc: numericValue(course.weights?.cc, 10),
  default_weight_gk: numericValue(course.weights?.gk, 30),
  default_weight_ck: numericValue(course.weights?.ck, 60),
  is_passed: isPassed === true,
});

// Chỉ cập nhật phần thông tin gốc, giữ nguyên user_id/course_id.
export const toCatalogUpdate = (course, isPassed = false) => ({
  course_code: course.courseCode || buildCourseCode(course.name),
  course_name: course.name,
  credits: numericValue(course.credits, 0),
  default_weight_cc: numericValue(course.weights?.cc, 10),
  default_weight_gk: numericValue(course.weights?.gk, 30),
  default_weight_ck: numericValue(course.weights?.ck, 60),
  is_passed: isPassed === true,
});
