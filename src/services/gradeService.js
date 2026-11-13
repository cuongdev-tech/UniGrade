// Tầng Service: toàn bộ nghiệp vụ tính điểm của UniGrade.
// Các hàm thuần (pure) — không phụ thuộc React, không đọc/ghi Firestore,
// nên có thể test riêng và tái sử dụng ở ViewModel / màn hình.

// "8,5" -> 8.5 ; "" -> null
export const parseGradeValue = (value) => {
  const num = parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isNaN(num) ? null : num;
};

// Ô điểm có hợp lệ không (rỗng = hợp lệ vì chưa nhập).
export const isGradeValueInvalid = (value) => {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return false;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return true;
  const grade = Number(normalized);
  return !Number.isFinite(grade) || grade < 0 || grade > 10;
};

// Cột trọng số 0% không cần nhập điểm -> hiển thị "--" thay vì "Chưa nhập".
export const formatComponentScore = (value, weight) => {
  if (Number(weight) === 0) return '--';
  return value;
};

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
  const value = Number(point);
  if (!Number.isFinite(value)) return null;
  const letter = Object.keys(LETTER_POINTS).find(
    (item) => Math.abs(LETTER_POINTS[item] - value) < 0.05
  );
  return letter || null;
};

// Điểm hệ 10 -> điểm chữ, hệ 4, trạng thái và xếp loại.
export const getGradeLetter = (total) => {
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

// Tổng kết môn theo trọng số. Trả null nếu chưa đủ điểm cần nhập.
export const calcCourseTotal = (grades, weights) => {
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

// Học kỳ chỉ được hiện GPA khi mọi môn đều đã có điểm.
export const hasFinalSemesterGpa = (stats) => stats.count > 0 && stats.gradedCount === stats.count;
