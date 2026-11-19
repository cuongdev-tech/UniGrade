// Model bảng semesters — ánh xạ giữa document Firestore và object dùng trong app.
import { firstValue } from './utils';
import { getCourseGradeTotal, hasFinalSemesterGpa } from '../services/gradeService';

// Tên field theo ERD (8 field).
export const FIELDS = [
  'semester_id',
  'user_id',
  'semester_name',
  'academic_year',
  'status',
  'semester_gpa_4',
  'semester_avg_10',
  'earned_credits',
];

// Tên cũ đọc được để tương thích ngược với dữ liệu đã có.
export const ALIASES = {
  semester_name: ['semester_name', 'name', 'semesterName'],
  academic_year: ['academic_year', 'school_year', 'year'],
  status: ['status', 'semester_status'],
};

export const normalizeYear = (value) => String(value || '').replace(/\s*[-–]\s*/, ' - ');

// Năm bắt đầu của năm học: "2025 - 2026" -> 2025.
export const getAcademicYearStart = (value) => {
  const match = String(value || '').match(/(\d{4})\D+(\d{4})/);
  return match ? Number(match[1]) : null;
};

export const getSemesterTermOrder = (value) => {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/\b(he|summer)\b/.test(normalized)) return 3;
  const match = normalized.match(/(?:hoc\s*ky|hk|ky|semester)\s*(\d+)/);
  return match ? Number(match[1]) : 0;
};

export const compareSemesters = (left, right) => {
  const yearDifference =
    (getAcademicYearStart(left?.year) || 0) - (getAcademicYearStart(right?.year) || 0);
  if (yearDifference !== 0) return yearDifference;
  return getSemesterTermOrder(left?.rawName || left?.name) -
    getSemesterTermOrder(right?.rawName || right?.name);
};

// Năm học cũ hơn năm học lớn nhất đã có -> kỳ lịch sử (hiển thị "Chưa xác nhận" nếu chưa chốt).
export const isPastAcademicYear = (year, semesters = []) => {
  const startYear = getAcademicYearStart(year);
  const latestStartYear = semesters.reduce((max, semester) => {
    const value = getAcademicYearStart(semester.year);
    return value !== null && value > max ? value : max;
  }, 0);
  return startYear !== null && latestStartYear > 0 && startYear < latestStartYear;
};

export const isPastSemester = (semester, semesters = []) => {
  const latestSemester = semesters.reduce(
    (latest, candidate) => (!latest || compareSemesters(candidate, latest) > 0 ? candidate : latest),
    null
  );
  return Boolean(latestSemester && compareSemesters(semester, latestSemester) < 0);
};

export const normalizeStatus = (value) => {
  if (value === 'learning' || value === 'Đang học') return 'Đang học';
  if (value === 'unconfirmed' || value === 'Chưa xác nhận') return 'Chưa xác nhận';
  if (value === 'completed' || value === 'Hoàn thành') return 'Hoàn thành';
  return value || 'Đang học';
};

// Trạng thái hiển thị 3 mức:
// - Hoàn thành: đã bấm xác nhận, khóa sửa điểm.
// - Chưa xác nhận: đã học xong (năm cũ) nhưng chưa bấm xác nhận.
// - Đang học: học kỳ mới nhất theo năm học và thứ tự kỳ, chưa chốt.
export const getSemesterDisplayStatus = (status, year, semesters = [], semesterName = '') => {
  const normalized = normalizeStatus(status);
  if (normalized === 'Hoàn thành') return 'Hoàn thành';
  if (normalized === 'Chưa xác nhận') return 'Chưa xác nhận';
  return isPastSemester({ year, rawName: semesterName }, semesters) ? 'Chưa xác nhận' : 'Đang học';
};

// Chỉ cho xác nhận khi kỳ chưa chốt, có ít nhất 1 môn và 100% môn đã có điểm tổng kết.
export const canConfirmSemester = (status, courses = []) =>
  normalizeStatus(status) !== 'Hoàn thành' &&
  courses.length > 0 &&
  courses.every((course) =>
    (course?.status === 'passed' || course?.status === 'failed') && getCourseGradeTotal(course) !== null
  );

export const fromFirestore = (snapshot) => {
  const data = snapshot.data();
  const rawName = firstValue(data, ALIASES.semester_name, 'Học kỳ');
  const year = normalizeYear(firstValue(data, ALIASES.academic_year, ''));
  return {
    id: snapshot.id,
    rawName,
    year,
    name: year ? `${rawName} (${year})` : rawName,
    status: normalizeStatus(firstValue(data, ALIASES.status, 'learning')),
  };
};

// Ghi học kỳ mới. Giữ nguyên giá trị đầu vào (không chuẩn hóa) như code cũ.
// status: 'Đang học' -> learning, 'Hoàn thành' -> completed.
export const toFirestore = (semesterId, uid, semester) => ({
  semester_id: semesterId,
  user_id: uid,
  semester_name: semester.rawName,
  academic_year: semester.year,
  status: semester.status === 'Hoàn thành' ? 'completed' : 'learning',
  semester_gpa_4: null,
  semester_avg_10: null,
  earned_credits: 0,
});

export const toStatusUpdate = () => ({ status: 'completed' });

export const toSemesterSummaryUpdate = (stats) => {
  if (!stats || !hasFinalSemesterGpa(stats) || !(stats.gradedCredits > 0)
    || ![stats.gpa, stats.avg10, stats.earnedCredits].every(Number.isFinite)) {
    throw new Error('Học kỳ cần đủ điểm tổng kết và tín chỉ hợp lệ để lưu GPA.');
  }
  return {
    semester_gpa_4: Number(stats.gpa.toFixed(2)),
    semester_avg_10: Number(stats.avg10.toFixed(2)),
    earned_credits: stats.earnedCredits,
  };
};
