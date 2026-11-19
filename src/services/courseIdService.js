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
  const compact = compactDocumentId(semesterId);
  const match = compact.match(/(?:^|_)hk\d+_(\d{4})(?:_|$)/i)
    || compact.match(/(?:^|_)(\d{4})(?:_\d+)?$/);
  return match?.[1] || '';
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

// Vẫn tách được mã gốc khi thao tác với bản ghi đã có định dạng dài.
export const compactDocumentId = (id) =>
  String(id ?? '').split('~').pop().replace(/^copy_[a-f0-9]{24}_/, '');

export const addOwnerSuffix = (id, uid) => `${id}_${uid.slice(-4)}`;

export const buildCourseId = (name, semesterId) => {
  const code = buildCourseCode(name);
  const suffix = getSemesterYearSuffix(semesterId);
  return `crs_${code}${suffix ? `_${suffix}` : ''}`;
};

// Mã danh mục học phần (bảng courses, không phụ thuộc học kỳ): "An toàn thông tin" -> cat_att.
// Tách khỏi mã lần học (crs_...) để 1 môn học lại vẫn trỏ về cùng một dòng danh mục.
export const buildCatalogId = (name) => `cat_${buildCourseCode(name)}`;

// Mã dự báo điểm: mỗi lần học tối đa 1 bản ghi -> fc_crs_att_2627.
export const buildForecastId = (enrollmentId) => `fc_${compactDocumentId(enrollmentId)}`;

// Mã học kỳ dễ nhận diện: "Học kỳ 1" + "2026 - 2027" -> sem_hk1_2627.
export const buildSemesterDocumentId = (name, year) => {
  const termMatch = String(name ?? '').match(/(\d+)/);
  const term = termMatch?.[1] || (/\b(he|summer)\b/i.test(normalizeCourseName(name)) ? '3' : '1');
  const yearMatch = String(year ?? '').match(/(\d{4})\D+(\d{4})/);
  const suffix = yearMatch ? `${yearMatch[1].slice(-2)}${yearMatch[2].slice(-2)}` : '';
  return `sem_hk${term}${suffix ? `_${suffix}` : ''}`;
};

// Mã thông báo nhắc thi: crs_att_2627 + ck -> rem_att_2627_ck.
export const buildReminderId = (courseId, type) => {
  const courseCode = compactDocumentId(courseId).replace(/^crs_/, '') || 'mon';
  const typeCode = type === 'mid' ? 'gk' : 'ck';
  return `rem_${courseCode}_${typeCode}`;
};
