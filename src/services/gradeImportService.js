// Đọc bảng điểm từ Excel: nhận diện tiêu đề, ghép tên môn, đọc điểm và trọng số.
// Tách khỏi ViewModel để dễ kiểm thử độc lập với Firebase/giao diện.
import { parseGradeValue, calcCourseTotal, getGradeLetter, parseLetterGrade, getLetterByPoint, LETTER_POINTS } from './gradeService';

// Bỏ dấu tiếng Việt + ký tự lạ để so tên cột/tên môn.
// Lưu ý: NFD không tách được "đ" nên phải đổi tay ("Điểm CC" -> "diemcc").
export const normalizeImportHeader = (value) =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');

export const IMPORT_HEADER_ALIASES = {
  name: [
    'tenmonhoc', 'tenmon', 'monhoc', 'tenhocphan', 'hocphan',
    'tenlophocphan', 'tenlop', 'subject', 'course',
  ],
  // CC là "điểm quá trình": trường có thể đặt tên là CC, QT (quá trình) hoặc BT (bài tập).
  cc: [
    'cc', 'diemcc', 'chuyencan', 'diemchuyencan',
    'qt', 'diemqt', 'quatrinh', 'diemquatrinh',
    'bt', 'diembt', 'baitap', 'diembaitap',
  ],
  gk: ['gk', 'diemgk', 'giuaky', 'diemgiuaky'],
  ck: ['ck', 'diemck', 'cuoiky', 'diemcuoiky'],
  formula: ['congthucdiem', 'congthuc', 'formula', 'trongso'],
  semester: [
    'kynamhoc', 'kynienhoc', 'hocky', 'hockynamhoc', 'kynam', 'ky', 'semester', 'term',
  ],
  credits: ['sotc', 'sotinchi', 'tinchi', 'tc', 'credits', 'credit'],
  // Điểm tổng kết trường đã tính sẵn: dùng để đối chiếu/ưu tiên hơn tự tính.
  total10: [
    'thang10', 'diemthang10', 'thangdiem10', 'he10', 'diemhe10', 'tongket', 'diemtongket',
  ],
  total4: ['thang4', 'diemthang4', 'thangdiem4', 'he4', 'diemhe4'],
  // Chữ: A+, A, B+ ... F.
  letter: ['chu', 'diemchu', 'chudiem', 'letter', 'lettergrade'],
};

// Đọc nhãn học kỳ kiểu "1/2026-2027", "HK1 (2026 - 2027)", "Học kỳ 2 (2025-2026)".
// Trả về khóa chuẩn để so với môn đang có trong app (không phụ thuộc cách viết).
export const parseSemesterLabel = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = raw.match(/(\d)\D{0,8}(\d{4})\s*[-–]\s*(\d{4})/);
  if (!match) return null;
  const term = match[1];
  const startYear = match[2];
  const endYear = match[3];
  return {
    term,
    startYear,
    endYear,
    year: `${startYear}-${endYear}`,
    canonical: `hocky${term}${startYear}${endYear}`,
  };
};

// Mã học kỳ cố định theo kỳ + năm học, giống dữ liệu mẫu hiện có (sem_hk1_2627).
// Ví dụ: kỳ 1 năm 2024-2025 -> sem_hk1_2425 ; kỳ 2 năm 2025-2026 -> sem_hk2_2526.
export const buildSemesterId = (semesterInfo) => {
  if (!semesterInfo) return null;
  return `sem_hk${semesterInfo.term}_${semesterInfo.startYear.slice(-2)}${semesterInfo.endYear.slice(-2)}`;
};

const FORMULA_KEY_BY_TOKEN = {
  cc: 'cc', chuyencan: 'cc',
  qt: 'cc', quatrinh: 'cc',
  bt: 'cc', baitap: 'cc',
  gk: 'gk', giuaky: 'gk',
  ck: 'ck', cuoiky: 'ck',
};

// Đọc cột "Công thức điểm" dạng [GK]*0.20+[BT]*0.20+[CK]*0.60
// để biết BT/QT nào là điểm CC và trọng số thật của môn.
export const parseGradeFormula = (value) => {
  const raw = String(value ?? '').replace(/\s+/g, '').toLowerCase();
  if (!raw) return null;
  const tokens = [...raw.matchAll(/\[([a-z0-9]+)\][*x×](\d+(?:[.,]\d+)?)/g)];
  if (tokens.length === 0) return null;

  const parts = { cc: 0, gk: 0, ck: 0 };
  const ccTokens = [];
  let total = 0;
  tokens.forEach((match) => {
    const token = match[1];
    const weight = parseFloat(match[2].replace(',', '.'));
    if (!Number.isFinite(weight)) return;
    total += weight;
    const key = FORMULA_KEY_BY_TOKEN[token];
    if (!key) return;
    parts[key] += weight;
    if (key === 'cc' && !ccTokens.includes(token)) ccTokens.push(token);
  });

  const isFraction = Math.abs(total - 1) < 0.001;
  const isPercent = Math.abs(total - 100) < 0.01;
  if (!isFraction && !isPercent) return null;

  const factor = isFraction ? 100 : 1;
  const weights = {
    cc: parts.cc * factor,
    gk: parts.gk * factor,
    ck: parts.ck * factor,
  };
  if (Math.abs(weights.cc + weights.gk + weights.ck - 100) > 0.1) return null;

  return {
    weights: {
      cc: String(Number(weights.cc.toFixed(2))),
      gk: String(Number(weights.gk.toFixed(2))),
      ck: String(Number(weights.ck.toFixed(2))),
    },
    ccTokens,
  };
};

// Dựng lại chuỗi "Công thức điểm" từ trọng số để xuất CSV nhập lại được.
// Tổng luôn bằng 1.00; trọng số 0% bị bỏ khỏi công thức.
export const buildGradeFormula = (weights) => {
  const parts = [
    { token: 'CC', weight: Number(weights?.cc) || 0 },
    { token: 'GK', weight: Number(weights?.gk) || 0 },
    { token: 'CK', weight: Number(weights?.ck) || 0 },
  ].filter((part) => part.weight > 0);
  if (parts.length === 0) return '';

  const sum = parts.reduce((total, part) => total + part.weight, 0);
  const fractions = parts.map((part) => Math.round((part.weight / sum) * 10000) / 10000);
  // Bù sai số làm tròn vào phần tử cuối để tổng đúng 1.0000.
  const diff = Math.round((1 - fractions.reduce((total, value) => total + value, 0)) * 10000) / 10000;
  fractions[fractions.length - 1] = Math.round((fractions[fractions.length - 1] + diff) * 10000) / 10000;

  const formatNumber = (value) => {
    const text = value.toFixed(4).replace(/0+$/, '');
    if (text.endsWith('.')) return `${text}00`;
    return text.split('.')[1]?.length === 1 ? `${text}0` : text;
  };

  return parts
    .map((part, index) => `[${part.token}]*${formatNumber(fractions[index])}`)
    .join('+');
};

// Gộp nhiều dòng cùng một môn mới (cùng tên + cùng kỳ) trong một file.
const mergeNewCourse = (previous, next) => {
  if (!previous) return next;
  return {
    ...previous,
    ...next,
    weights: next.weights || previous.weights,
    cc: next.cc ?? previous.cc,
    gk: next.gk ?? previous.gk,
    ck: next.ck ?? previous.ck,
    total10: next.total10 ?? previous.total10,
    total4: next.total4 ?? previous.total4,
    letter: next.letter || previous.letter,
    credits: next.credits ?? previous.credits,
  };
};

// rows: mảng các dòng (mảng ô) đọc từ sheet đầu tiên.
// subjects: danh sách môn đang có trong app.
// newCourses: môn chưa có trong app nhưng dòng Excel có đủ Kỳ/Năm học + Số TC + điểm.
export const parseGradeSheet = (rows, subjects) => {
  const emptyResult = {
    headerRowIndex: -1,
    gradesBySubject: new Map(),
    weightsBySubject: new Map(),
    creditsBySubject: new Map(),
    total10BySubject: new Map(),
    total4BySubject: new Map(),
    letterBySubject: new Map(),
    newCourses: [],
    skippedRows: 0,
  };
  if (!Array.isArray(rows) || rows.length === 0) return emptyResult;

  let headerRowIndex = -1;
  let headerCells = [];
  let columns = {};
  // Quét 50 dòng đầu: bảng điểm thật thường có tiêu đề/thông tin sinh viên phía trên.
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 50); rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizeImportHeader);
    const foundColumns = {};
    Object.entries(IMPORT_HEADER_ALIASES).forEach(([key, aliases]) => {
      foundColumns[key] = headers.findIndex((header) => aliases.includes(header));
    });
    if (
      foundColumns.name !== -1
      && ['cc', 'gk', 'ck', 'total10', 'total4', 'letter'].some((key) => foundColumns[key] !== -1)
    ) {
      headerRowIndex = rowIndex;
      headerCells = headers;
      columns = foundColumns;
      break;
    }
  }
  if (headerRowIndex === -1) return emptyResult;

  // Các cột có thể chứa điểm CC (CC / QT / BT...). Dùng cột nào có số trước.
  const ccColumnIndexes = headerCells.reduce((list, header, index) => {
    if (IMPORT_HEADER_ALIASES.cc.includes(header)) list.push(index);
    return list;
  }, []);

  const findColumnForToken = (token) => {
    const candidates = [token, `diem${token}`, `${token}diem`];
    for (const candidate of candidates) {
      const index = headerCells.indexOf(candidate);
      if (index !== -1) return index;
    }
    return -1;
  };

  // Một tên môn có thể xuất hiện ở nhiều học kỳ (học lại) -> giữ danh sách để chọn đúng kỳ.
  const subjectsByName = new Map();
  subjects.forEach((subject) => {
    const key = normalizeImportHeader(subject.name);
    const list = subjectsByName.get(key) || [];
    list.push(subject);
    subjectsByName.set(key, list);
  });

  const gradesBySubject = new Map();
  const weightsBySubject = new Map();
  const creditsBySubject = new Map();
  const total10BySubject = new Map();
  const total4BySubject = new Map();
  const letterBySubject = new Map();
  const newCoursesByKey = new Map();
  let skippedRows = 0;

  for (const row of rows.slice(headerRowIndex + 1)) {
    const name = String(row[columns.name] || '').trim();
    if (!name) continue;

    const candidates = subjectsByName.get(normalizeImportHeader(name)) || [];
    const rowSemester = columns.semester !== -1 ? parseSemesterLabel(row[columns.semester]) : null;
    let subject = null;
    if (rowSemester) {
      subject = candidates.find((item) => {
        const itemSemester = parseSemesterLabel(item.semester);
        return itemSemester && itemSemester.canonical === rowSemester.canonical;
      }) || null;
    }
    // Không có cột Kỳ/Năm học: nhận theo tên nếu tên môn là duy nhất.
    // Có Kỳ/Năm học nhưng khác kỳ của mọi môn trùng tên: coi là môn mới, không sửa nhầm môn cũ.
    if (!subject && !rowSemester && candidates.length === 1) subject = candidates[0];

    // Đọc tín chỉ vào biến tạm; chỉ ghi vào kết quả khi dòng hợp lệ.
    let rowCredits = null;
    if (columns.credits !== -1) {
      const rawCredits = String(row[columns.credits] ?? '').replace(',', '.');
      const creditsValue = parseFloat(rawCredits);
      const credits = Number.isFinite(creditsValue) ? Math.round(creditsValue) : NaN;
      if (Number.isFinite(credits) && credits > 0 && credits <= 30) {
        rowCredits = credits;
      }
    }

    const rowFormula = columns.formula !== -1 ? parseGradeFormula(row[columns.formula]) : null;

    const nextGrades = subject ? (gradesBySubject.get(subject.id) || {}) : {};
    let hasGrade = false;
    let invalidGrade = false;
    const applyGrade = (key, columnIndex) => {
      if (columnIndex === -1 || columnIndex === undefined) return false;
      const raw = String(row[columnIndex] ?? '').trim();
      if (raw === '') return false;
      const grade = parseGradeValue(raw);
      if (grade === null || grade < 0 || grade > 10) {
        invalidGrade = true;
        return false;
      }
      nextGrades[key] = grade.toFixed(1);
      hasGrade = true;
      return true;
    };

    // Điểm CC: ưu tiên đúng cột mà công thức dùng (BT hay QT), sau đó cột CC/QT/BT đầu tiên có số.
    const preferredCcIndexes = rowFormula
      ? rowFormula.ccTokens.map(findColumnForToken).filter((index) => index !== -1)
      : [];
    const ccIndexes = [...new Set([...preferredCcIndexes, ...ccColumnIndexes])];
    for (const columnIndex of ccIndexes) {
      if (applyGrade('cc', columnIndex)) break;
    }
    applyGrade('gk', columns.gk);
    applyGrade('ck', columns.ck);

    if (invalidGrade) {
      skippedRows += 1;
      continue;
    }

    // Thang 10 / Thang 4 / Chữ do trường tính sẵn.
    let importedTotal10 = null;
    if (columns.total10 !== -1) {
      const raw = String(row[columns.total10] ?? '').trim();
      const value = parseGradeValue(raw);
      if (value !== null && value >= 0 && value <= 10) importedTotal10 = value;
    }
    let importedTotal4 = null;
    if (columns.total4 !== -1) {
      const raw = String(row[columns.total4] ?? '').trim();
      const value = parseGradeValue(raw);
      if (value !== null && value >= 0 && value <= 4) importedTotal4 = value;
    }
    let importedLetter = null;
    if (columns.letter !== -1) {
      const info = parseLetterGrade(row[columns.letter]);
      if (info) importedLetter = info.letter;
    }

    // Dòng chỉ có Thang 10 / Thang 4 / Chữ (không có điểm thành phần) vẫn nhập được.
    // Dòng chỉ có Số TC cũng hợp lệ: chỉ cập nhật tín chỉ.
    const hasGradeData = hasGrade
      || importedTotal10 !== null
      || importedTotal4 !== null
      || importedLetter !== null;
    if (!hasGradeData && rowCredits === null) {
      skippedRows += 1;
      continue;
    }

// Dòng không khớp môn nào: chỉ tạo môn mới khi có đủ Kỳ/Năm học + Số TC + ít nhất một dữ liệu điểm.
    // Nhờ vậy nhập điểm năm 1/năm 2 vẫn được dù app đang ở học kỳ khác.
    if (!subject) {
      if (!rowSemester || rowCredits === null || !hasGradeData) {
        skippedRows += 1;
        continue;
      }
      const key = `${rowSemester.canonical}|${normalizeImportHeader(name)}`;
      newCoursesByKey.set(key, mergeNewCourse(newCoursesByKey.get(key), {
        name,
        semesterInfo: rowSemester,
        credits: rowCredits,
        weights: rowFormula ? rowFormula.weights : null,
        cc: nextGrades.cc ?? null,
        gk: nextGrades.gk ?? null,
        ck: nextGrades.ck ?? null,
        total10: importedTotal10,
        total4: importedTotal4,
        letter: importedLetter,
      }));
      continue;
    }

    if (hasGrade) gradesBySubject.set(subject.id, nextGrades);
    if (rowCredits !== null) creditsBySubject.set(subject.id, rowCredits);
    // Công thức chỉ đi kèm dòng có dữ liệu điểm; dòng chỉ có tín chỉ không đổi trọng số.
    if (hasGradeData && rowFormula) weightsBySubject.set(subject.id, rowFormula.weights);
    if (importedTotal10 !== null) total10BySubject.set(subject.id, importedTotal10);
    if (importedTotal4 !== null) total4BySubject.set(subject.id, importedTotal4);
    if (importedLetter) letterBySubject.set(subject.id, importedLetter);
  }

  return {
    headerRowIndex,
    gradesBySubject,
    weightsBySubject,
    creditsBySubject,
    total10BySubject,
    total4BySubject,
    letterBySubject,
    newCourses: [...newCoursesByKey.values()],
    skippedRows,
  };
};

// Tất cả môn có bất kỳ dữ liệu nhập nào (điểm thành phần, Thang 10/4, Chữ hoặc Số TC).
export const getImportedSubjectIds = (result) => {
  const ids = new Set(result.gradesBySubject?.keys() || []);
  [
    result.creditsBySubject,
    result.total10BySubject,
    result.total4BySubject,
    result.letterBySubject,
  ].forEach((map) => {
    if (map) map.forEach((_value, key) => ids.add(key));
  });
  return ids;
};

// Ghép kết quả đọc Excel vào danh sách môn hiện tại (tính lại tổng kết, xếp loại, badge).
export const applyImportedGrades = (subjects, result) =>
  subjects.map((subject) => {
    const imported = result.gradesBySubject.get(subject.id);
    const importedCredits = result.creditsBySubject?.get(subject.id);
    const importedTotal10 = result.total10BySubject?.get(subject.id);
    const importedTotal4 = result.total4BySubject?.get(subject.id);
    const importedLetter = result.letterBySubject?.get(subject.id);
    const hasGradeData = imported
      || importedTotal10 !== undefined
      || importedTotal4 !== undefined
      || importedLetter !== undefined;
    // Dòng chỉ có Số TC: chỉ đổi tín chỉ, giữ nguyên tổng/xếp loại đang có.
    if (!hasGradeData) {
      return importedCredits === undefined ? subject : { ...subject, credits: importedCredits };
    }

    const grades = {
      cc: parseGradeValue(subject.cc) === null ? '' : String(subject.cc),
      gk: parseGradeValue(subject.gk) === null ? '' : String(subject.gk),
      ck: parseGradeValue(subject.ck) === null ? '' : String(subject.ck),
      ...(imported || {}),
    };
    const weights = result.weightsBySubject.get(subject.id) || subject.weights;
    const credits = importedCredits !== undefined ? importedCredits : subject.credits;
    const calculatedTotal = calcCourseTotal(grades, weights);
    // Thang 10 của trường là chuẩn; không có mới tự tính từ CC/GK/CK.
    // Nếu vẫn chưa đủ điểm thì giữ tổng đang có trong app, không xóa thành "--".
    const existingTotal = parseGradeValue(subject.total);
    const total = importedTotal10 !== undefined
      ? importedTotal10
      : (calculatedTotal !== null ? calculatedTotal : existingTotal);

    // Chữ của trường là chuẩn; thiếu thì suy từ Thang 4, rồi từ Thang 10/tự tính.
    let letterInfo = importedLetter ? parseLetterGrade(importedLetter) : null;
    if (!letterInfo && importedTotal4 !== undefined) {
      const letter = getLetterByPoint(importedTotal4);
      if (letter) letterInfo = { letter, point: LETTER_POINTS[letter] };
    }
    if (!letterInfo && total !== null) {
      letterInfo = parseLetterGrade(getGradeLetter(total).text);
    }

    const missingParts = ['cc', 'gk', 'ck'].filter(
      (key) => Number(weights[key]) > 0 && parseGradeValue(grades[key]) === null
    );
    const status = letterInfo
      ? (letterInfo.point > 0 ? 'passed' : 'failed')
      : (total === null ? 'pending' : getGradeLetter(total).status);
    const badge = letterInfo
      ? `${letterInfo.letter} (${letterInfo.point.toFixed(1)})`
      : total !== null
        ? getGradeLetter(total).text
        : missingParts.length
          ? `Chờ nhập ${missingParts.join('/')}`
          : 'Chờ điểm';

    return {
      ...subject,
      weights,
      credits,
      cc: grades.cc || 'Chưa nhập',
      gk: grades.gk || 'Chưa nhập',
      ck: grades.ck || 'Chưa nhập',
      total: total === null ? '--' : total.toFixed(2),
      status,
      badge,
    };
  });

// Dựng object học phần mới từ một dòng Excel chưa có trong app.
// semester: { id, rawName, year, status } — học kỳ đã có hoặc vừa tạo.
export const buildCourseFromImportRow = (row, semester) => {
  const weights = row.weights || { cc: '10', gk: '30', ck: '60' };
  const grades = { cc: row.cc || '', gk: row.gk || '', ck: row.ck || '' };
  const calculatedTotal = calcCourseTotal(grades, weights);
  // Thang 10 trong file là chuẩn; không có mới tự tính từ CC/GK/CK.
  const total = row.total10 !== null && row.total10 !== undefined ? row.total10 : calculatedTotal;

  let letterInfo = row.letter ? parseLetterGrade(row.letter) : null;
  if (!letterInfo && row.total4 !== null && row.total4 !== undefined) {
    const letter = getLetterByPoint(row.total4);
    if (letter) letterInfo = { letter, point: LETTER_POINTS[letter] };
  }
  if (!letterInfo && total !== null) letterInfo = parseLetterGrade(getGradeLetter(total).text);

  const missingParts = ['cc', 'gk', 'ck'].filter(
    (key) => Number(weights[key]) > 0 && parseGradeValue(grades[key]) === null
  );
  const status = letterInfo
    ? (letterInfo.point > 0 ? 'passed' : 'failed')
    : (total === null ? 'pending' : getGradeLetter(total).status);
  const badge = letterInfo
    ? `${letterInfo.letter} (${letterInfo.point.toFixed(1)})`
    : total !== null
      ? getGradeLetter(total).text
      : missingParts.length
        ? `Chờ nhập ${missingParts.join('/')}`
        : 'Chờ điểm';

  return {
    name: row.name,
    credits: row.credits,
    semester: `${semester.rawName} (${semester.year.replace(' - ', '-')})`,
    sem: semester.id,
    weights,
    status,
    badge,
    cc: grades.cc || 'Chưa nhập',
    gk: grades.gk || 'Chưa nhập',
    ck: grades.ck || 'Chưa nhập',
    total: total === null ? '--' : total.toFixed(2),
    canEdit: semester.status !== 'Hoàn thành',
  };
};

