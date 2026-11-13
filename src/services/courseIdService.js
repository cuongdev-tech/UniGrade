// Sinh mã học phần dễ nhận diện, ví dụ:
// "Hệ thống máy" + sem_hk1_2627 -> crs_htm_2627
// "AC" + sem_hk1_2627 -> crs_AC_2627
// "Công nghệ Web" + sem_hk2_2526 -> crs_cnw_2526

// Bỏ dấu tiếng Việt để lấy chữ cái đầu của từng từ.
export const normalizeCourseName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim();

// Lấy 4 số cuối của mã học kỳ: sem_hk1_2627 -> 2627, sem_hk2_2425 -> 2425.
export const getSemesterYearSuffix = (semesterId) => {
  const match = String(semesterId ?? '').match(/(\d{2})(\d{2})$/);
  return match ? `${match[1]}${match[2]}` : '';
};

// Tên một từ viết hoa toàn bộ (AC, PBL...) giữ nguyên; còn lại lấy chữ cái đầu.
export const buildCourseCode = (name) => {
  const raw = String(name ?? '').trim();
  const normalized = normalizeCourseName(raw);
  if (!normalized) return 'mon';
  const words = normalized.split(/\s+/);
  if (words.length === 1) {
    const value = words[0].slice(0, 8);
    return /^[A-Z0-9]+$/.test(raw) ? value : value.toLowerCase();
  }
  return words.map((word) => word[0]).join('').toLowerCase().slice(0, 8);
};

// Thêm _2, _3... nếu mã đã dùng, để không ghi đè dữ liệu cũ.
const makeUniqueId = (base, existingIds = []) => {
  const used = new Set(existingIds);
  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
};

// existingIds: mã học phần đã có trong app để tránh ghi đè khi trùng viết tắt.
export const buildCourseId = (name, semesterId, existingIds = []) => {
  const code = buildCourseCode(name);
  const suffix = getSemesterYearSuffix(semesterId);
  const base = `crs_${code}${suffix ? `_${suffix}` : ''}`;
  return makeUniqueId(base, existingIds);
};

// Mã học kỳ dễ nhận diện: "Học kỳ 1" + "2026 - 2027" -> sem_hk1_2627.
export const buildSemesterDocumentId = (name, year, existingIds = []) => {
  const termMatch = String(name ?? '').match(/(\d+)/);
  const term = termMatch ? termMatch[1] : '1';
  const yearMatch = String(year ?? '').match(/(\d{4})\D+(\d{4})/);
  const suffix = yearMatch ? `${yearMatch[1].slice(-2)}${yearMatch[2].slice(-2)}` : '';
  return makeUniqueId(`sem_hk${term}${suffix ? `_${suffix}` : ''}`, existingIds);
};

// Mã thông báo nhắc thi: crs_att_2627 + ck -> rem_att_2627_ck.
export const buildReminderId = (courseId, type, existingIds = []) => {
  const courseCode = String(courseId ?? '').replace(/^crs_/, '') || 'mon';
  const typeCode = type === 'mid' ? 'gk' : 'ck';
  return makeUniqueId(`rem_${courseCode}_${typeCode}`, existingIds);
};
