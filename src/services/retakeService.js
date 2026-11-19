// Nghiệp vụ học lại (Màn 7 — Thêm học phần mới).
//
// Quy ước: KHÔNG có nút "Đăng ký học lại". Khi người dùng gõ tên môn,
// app tự dò các lần học trước theo tên đã chuẩn hóa:
//   - chưa từng học              -> thêm mới bình thường
//   - đã trượt (status failed)   -> cho thêm, tự đánh dấu học lại lần N
//   - đã đạt (status passed)     -> CHẶN (đồng bộ với COURSES.is_passed của ERD)
//   - đang học (status pending)  -> CHẶN (tránh học trùng 2 kỳ)
//   - đã có trong cùng học kỳ    -> CHẶN
import { normalizeCourseName } from './courseIdService';
import { getCourseGradeTotal } from './gradeService';

// Khóa so khớp tên môn: bỏ dấu, bỏ ký tự đặc biệt, gộp khoảng trắng, viết thường.
export const getCourseNameKey = (name) =>
  normalizeCourseName(name).replace(/\s+/g, ' ').trim().toLowerCase();

// sem_hk1_2627 -> 26271, dùng để biết kỳ nào mới hơn khi dữ liệu cũ thiếu attempt_no.
export const getSemesterSortValue = (semesterId) => {
  const match = String(semesterId ?? '').split('~').pop().match(/hk(\d+)_(\d{2})(\d{2})/i);
  if (!match) return 0;
  return Number(`${match[2]}${match[3]}`) * 10 + Number(match[1]);
};

// Mọi lần học cùng tên, lần mới nhất đứng đầu (theo attempt_no, rồi tới học kỳ).
export const getCourseAttempts = (courses = [], name = '') => {
  const key = getCourseNameKey(name);
  if (!key) return [];
  return courses
    .filter((course) => getCourseNameKey(course.name) === key)
    .sort((a, b) => {
      const attemptDiff = (Number(b.attemptNo) || 1) - (Number(a.attemptNo) || 1);
      if (attemptDiff !== 0) return attemptDiff;
      return getSemesterSortValue(b.sem) - getSemesterSortValue(a.sem);
    });
};

// Lần học kế tiếp: môn mới = 1, học lại lần đầu = 2, ...
export const getNextAttemptNo = (courses = [], name = '') => {
  const highest = getCourseAttempts(courses, name).reduce(
    (max, course) => Math.max(max, Number(course.attemptNo) || 1),
    0
  );
  return Math.max(highest + 1, 2);
};

// Xem trước ngay khi gõ tên ở Màn 7.
// kind: empty (chưa gõ) | new | retake | blocked
export const getAddCoursePreview = ({ courses = [], name = '', semesterId = '' } = {}) => {
  const key = getCourseNameKey(name);
  if (!key) return { kind: 'empty', message: '' };

  const attempts = getCourseAttempts(courses, name);
  const sameSemester = attempts.find((course) => course.sem === semesterId);
  if (sameSemester) {
    return {
      kind: 'blocked',
      reason: 'same-semester',
      latest: sameSemester,
      message: `Học phần “${name.trim()}” đã có trong học kỳ này.`,
    };
  }
  if (attempts.length === 0) return { kind: 'new', message: '' };

  const latest = attempts[0];
  if (latest.status === 'passed') {
    return {
      kind: 'blocked',
      reason: 'passed',
      latest,
      message: `Môn này đã đạt (${latest.badge}) ở ${latest.semester} nên không thể thêm lại.`,
    };
  }
  if (latest.status === 'failed') {
    const attemptNo = getNextAttemptNo(courses, name);
    return {
      kind: 'retake',
      latest,
      attemptNo,
      message: `Bạn đã trượt môn này ở ${latest.semester} (${latest.badge}). Thêm bây giờ sẽ tính là học lại lần ${attemptNo}; điểm mới sẽ thay điểm F khi tính GPA tích lũy.`,
    };
  }
  return {
    kind: 'blocked',
    reason: 'studying',
    latest,
    message: `Môn này đang học ở ${latest.semester} nên không thể thêm trùng.`,
  };
};

// Kiểm tra toàn bộ học phần mới từ Excel trước khi ghi bất kỳ dữ liệu nào.
// Nếu một dòng bị chặn, hủy cả file; các lần học F vẫn được mô phỏng như học lại.
export const getCourseImportBlocker = (courses = [], importedCourses = []) => {
  const coursesWithImportRows = [...courses];

  for (const [index, course] of importedCourses.entries()) {
    const preview = getAddCoursePreview({
      courses: coursesWithImportRows,
      name: course.name,
      semesterId: course.sem,
    });
    if (preview.kind === 'blocked') return { course, preview };

    coursesWithImportRows.push({
      ...course,
      id: course.id || `excel-preview-${index}`,
      attemptNo: preview.kind === 'retake' ? preview.attemptNo : 1,
      retakeOf: preview.kind === 'retake' ? preview.latest.id : null,
    });
  }

  return null;
};

// CPA thay lần học cũ khi lần học lại có kết quả. GPA học kỳ dùng mọi lần học của kỳ đó.
export const getCpaCourses = (courses = []) => {
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const gradedRetakes = courses.filter((course) =>
    course.retakeOf && course.status !== 'pending' && getCourseGradeTotal(course) !== null
  );
  const gradedRetakeIds = new Set(gradedRetakes.map((course) => course.id));
  const replacedIds = new Set();
  for (const course of gradedRetakes) {
    let previousId = course.retakeOf;
    while (previousId && previousId !== course.id && !replacedIds.has(previousId)) {
      replacedIds.add(previousId);
      previousId = courseById.get(previousId)?.retakeOf;
    }
  }
  return courses.filter((course) =>
    !replacedIds.has(course.id) && (!courseById.has(course.retakeOf) || gradedRetakeIds.has(course.id))
  );
};
