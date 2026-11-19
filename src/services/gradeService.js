// Tầng Service: toàn bộ nghiệp vụ tính điểm của UniGrade.
// Các hàm thuần (pure) — không phụ thuộc React, không đọc/ghi Firestore,
// nên có thể test riêng và tái sử dụng ở ViewModel / màn hình.

export const parseDecimalValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

// "8,5" -> 8.5 ; "" -> null
export const parseGradeValue = (value) => {
  const grade = parseDecimalValue(value);
  return grade !== null && grade <= 10 ? grade : null;
};

// Ô điểm có hợp lệ không (rỗng = hợp lệ vì chưa nhập).
export const isGradeValueInvalid = (value) =>
  String(value ?? '').trim() !== '' && parseGradeValue(value) === null;

export const parseCourseCredits = (value) => {
  const credits = parseDecimalValue(value);
  return Number.isInteger(credits) && credits >= 1 && credits <= 20 ? credits : null;
};

export const parseTargetGpa = (value) => {
  const gpa = parseDecimalValue(value);
  return gpa !== null && gpa > 0 && gpa <= 4 ? gpa : null;
};

export const roundGradeTotal = (value) => {
  const grade = parseGradeValue(value);
  if (grade === null) return null;
  return Math.round((grade + Number.EPSILON * Math.max(1, grade)) * 100) / 100;
};

// Cột trọng số 0% không cần nhập điểm -> hiển thị "--" thay vì "Chưa nhập".
export const formatComponentScore = (value, weight) => {
  if ((parseDecimalValue(weight) ?? 0) === 0) return '--';
  return value;
};

export const clearZeroWeightGrades = (grades = {}, weights = {}) =>
  ['cc', 'gk', 'ck'].reduce((result, key) => ({
    ...result,
    [key]: (parseDecimalValue(weights[key]) ?? 0) === 0 ? '' : (grades[key] ?? ''),
  }), {});

// Bảng quy đổi điểm chữ ↔ hệ 4. Dùng chung cho model, nhập Excel và xuất CSV
// để tránh mỗi nơi định nghĩa một kiểu.
export const LETTER_POINTS = {
  'A+': 4.0,
  A: 3.7,
  'B+': 3.5,
  B: 3.0,
  'C+': 2.5,
  C: 2.0,
  'D+': 1.5,
  D: 1.0,
  F: 0,
};

// "A+ (4.0)" | "a+" | "A" -> { letter: 'A+', point: 4 }
// Chỉ nhận đúng ký tự điểm chữ, không nhận nhầm badge dạng "Chờ nhập CK".
export const parseLetterGrade = (value) => {
  const text = String(value ?? '').trim().toUpperCase();
  if (!text) return null;
  const match = text.match(/^([A-F]\+?)(?:\s|\(|$)/);
  if (!match) return null;
  const letter = match[1];
  if (!Object.prototype.hasOwnProperty.call(LETTER_POINTS, letter)) return null;
  return { letter, point: LETTER_POINTS[letter] };
};

// 3.7 -> "A" ; không khớp bảng (ví dụ 3.9) -> null
export const getLetterByPoint = (point) => {
  const value = parseDecimalValue(point);
  if (value === null || value > 4) return null;
  const letter = Object.keys(LETTER_POINTS).find(
    (item) => Math.abs(LETTER_POINTS[item] - value) < 0.05
  );
  return letter || null;
};

const GRADE_SCALE = [
  { letter: 'A+', minimum: 9, rank: 'Xuất sắc' },
  { letter: 'A', minimum: 8.5, rank: 'Giỏi' },
  { letter: 'B+', minimum: 8, rank: 'Khá giỏi' },
  { letter: 'B', minimum: 7, rank: 'Khá' },
  { letter: 'C+', minimum: 6.5, rank: 'Trung bình khá' },
  { letter: 'C', minimum: 5.5, rank: 'Trung bình' },
  { letter: 'D+', minimum: 5, rank: 'Trung bình yếu' },
  { letter: 'D', minimum: 4, rank: 'Yếu' },
  { letter: 'F', minimum: 0, rank: 'Kém' },
];

export const getGradeTenFromLetter = (value) => {
  const grade = parseLetterGrade(value);
  return GRADE_SCALE.find(({ letter }) => grade?.letter === letter)?.minimum ?? null;
};

// Chỉ quy đổi từ hệ 4 hoặc điểm chữ khi bản ghi thiếu điểm hệ 10.
export const resolveGradeTotal = (total10, total4, letter) =>
  roundGradeTotal(total10) ?? getGradeTenFromLetter(letter) ?? getGradeTenFromLetter(getLetterByPoint(total4));

export const getCourseGradeTotal = (course) =>
  roundGradeTotal(course?.total) ?? resolveGradeTotal(course?.total_10, course?.total_4);

// Điểm hệ 10 -> điểm chữ, hệ 4, trạng thái và xếp loại.
export const getGradeLetter = (value) => {
  const total = roundGradeTotal(value);
  if (total === null) return null;
  const { letter, rank } = GRADE_SCALE.find(({ minimum }) => total >= minimum);
  const point = LETTER_POINTS[letter];
  return { letter, text: `${letter} (${point.toFixed(1)})`, point, status: total >= 4 ? 'passed' : 'failed', rank };
};

export const getCourseWeightTotal = (weights) => {
  const values = ['cc', 'gk', 'ck'].map((key) =>
    String(weights?.[key] ?? '').trim() ? parseDecimalValue(weights[key]) : 0
  );
  if (values.some((value) => value === null || value > 100)) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.abs(total - 100) < 1e-9 ? 100 : total;
};

// Tổng kết môn theo trọng số. Trả null nếu chưa đủ điểm cần nhập.
export const calcCourseTotal = (grades, weights) => {
  if (Object.values(grades).some(isGradeValueInvalid)) return null;
  if (getCourseWeightTotal(weights) !== 100) return null;
  const cc = parseGradeValue(grades.cc);
  const gk = parseGradeValue(grades.gk);
  const ck = parseGradeValue(grades.ck);
  const wc = parseDecimalValue(weights.cc) ?? 0;
  const wg = parseDecimalValue(weights.gk) ?? 0;
  const wk = parseDecimalValue(weights.ck) ?? 0;
  // Đầu điểm có trọng số 0% thì không bắt buộc phải nhập.
  if ((wc > 0 && cc === null) || (wg > 0 && gk === null) || (wk > 0 && ck === null)) return null;
  const total = ((cc ?? 0) * wc + (gk ?? 0) * wg + (ck ?? 0) * wk) / (wc + wg + wk);
  return roundGradeTotal(Math.min(10, total));
};

export const reconcileGkCkOrder = (grades, weights, referenceTotal) => {
  const expected = parseGradeValue(referenceTotal);
  const total = calcCourseTotal(grades, weights);
  if (expected === null || total === null || Math.abs(total - expected) <= 0.051) {
    return { grades, total, swapped: false };
  }

  const swappedGrades = { ...grades, gk: grades.ck, ck: grades.gk };
  const swappedTotal = calcCourseTotal(swappedGrades, weights);
  if (swappedTotal !== null && Math.abs(swappedTotal - expected) <= 0.051) {
    return { grades: swappedGrades, total: swappedTotal, swapped: true };
  }
  return { grades, total, swapped: false };
};

// GPA hệ 4 -> xếp loại + tông màu hiển thị.
export const getRankByGPA = (gpa) => {
  if (gpa >= 3.6) return { text: 'Xuất sắc', tone: 'green' };
  if (gpa >= 3.2) return { text: 'Giỏi', tone: 'green' };
  if (gpa >= 2.5) return { text: 'Khá', tone: 'blue' };
  if (gpa >= 2.0) return { text: 'Trung bình', tone: 'amber' };
  if (gpa >= 1.0) return { text: 'Yếu', tone: 'amber' };
  return { text: 'Kém', tone: 'red' };
};

// Thống kê một học kỳ (hoặc toàn bộ chương trình) từ danh sách môn.
export const calcSemesterStats = (list) => {
  const graded = list.flatMap((item) => {
    if (item.status === 'pending') return [];
    const total = getCourseGradeTotal(item);
    return total === null ? [] : [{ total, grade: getGradeLetter(total), credits: item.credits }];
  });
  const gradedCredits = graded.reduce((sum, item) => sum + item.credits, 0);
  const totalCredits = list.reduce((sum, item) => sum + item.credits, 0);
  const earnedCredits = graded
    .filter((item) => item.grade.status === 'passed')
    .reduce((sum, item) => sum + item.credits, 0);
  const failedCredits = graded
    .filter((item) => item.grade.status === 'failed')
    .reduce((sum, item) => sum + item.credits, 0);
  const gpa = gradedCredits
    ? graded.reduce((sum, item) => sum + item.grade.point * item.credits, 0) / gradedCredits
    : 0;
  const avg10 = gradedCredits
    ? graded.reduce((sum, item) => sum + item.total * item.credits, 0) / gradedCredits
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

// Học kỳ chỉ được hiện GPA khi mọi môn đều đã có điểm.
export const hasFinalSemesterGpa = (stats) => stats.count > 0 && stats.gradedCount === stats.count;
