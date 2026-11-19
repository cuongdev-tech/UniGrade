// Đọc bảng điểm từ CSV hoặc Excel: nhận diện tiêu đề, ghép tên môn, đọc điểm và trọng số.
// Tách khỏi ViewModel để dễ kiểm thử độc lập với Firebase/giao diện.
import { read, utils } from 'xlsx';
import {
  parseGradeValue,
  parseCourseCredits,
  parseDecimalValue,
  calcCourseTotal,
  clearZeroWeightGrades,
  getCourseWeightTotal,
  getGradeLetter,
  parseLetterGrade,
  getLetterByPoint,
  reconcileGkCkOrder,
  resolveGradeTotal,
} from './gradeService';

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
  // Cột "Điểm" chung (đề bài yêu cầu) được hiểu là điểm tổng kết thang 10.
  total10: [
    'diem', 'thang10', 'diemthang10', 'thangdiem10', 'he10', 'diemhe10', 'tongket', 'diemtongket',
  ],
  total4: ['thang4', 'diemthang4', 'thangdiem4', 'he4', 'diemhe4'],
  // Chữ: A+, A, B+ ... F.
  letter: ['chu', 'diemchu', 'chudiem', 'letter', 'lettergrade'],
};

// Đọc nhãn học kỳ kiểu "1/2026-2027", "HK1 (2026 - 2027)", "Học kỳ 2 (2025-2026)".
// Trả về khóa chuẩn để so với môn đang có trong app (không phụ thuộc cách viết).
export const parseSemesterLabel = (value) => {
  const normalized = String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = normalized.match(/^(?:(?:hoc\s*ky|hk|ky|semester|term)\s*)?(\d{1,2}|he|summer)(\s*\(\s*|\s*[/:-]\s*|\s+)(\d{4})\s*[-–]\s*(\d{4})(\s*\))?$/i);
  if (!match) return null;
  const [, rawTerm, separator, startYear, endYear, closing] = match;
  if (separator.includes('(') !== Boolean(closing) || Number(endYear) !== Number(startYear) + 1) return null;
  const term = String(/^\d+$/.test(rawTerm) ? Number(rawTerm) : 3);
  if (term === '0') return null;
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
  const tokens = raw.split('+').map((part) => part.match(/^\[([a-z0-9]+)\][*x×](\d+(?:[.,]\d+)?)(%?)$/));
  if (tokens.some((token) => !token || !Object.prototype.hasOwnProperty.call(FORMULA_KEY_BY_TOKEN, token[1]))) return null;

  const parts = { cc: 0, gk: 0, ck: 0 };
  const ccTokens = [];
  const percent = tokens[0][3];
  if (tokens.some((token) => token[3] !== percent)) return null;
  for (const [, token, rawWeight] of tokens) {
    const weight = parseDecimalValue(rawWeight);
    if (weight === null) return null;
    const key = FORMULA_KEY_BY_TOKEN[token];
    parts[key] += weight;
    if (key === 'cc' && !ccTokens.includes(token)) ccTokens.push(token);
  }
  const sum = parts.cc + parts.gk + parts.ck;
  const factor = !percent && Math.abs(sum - 1) < 1e-9 ? 100 : 1;
  const weights = Object.fromEntries(Object.entries(parts).map(([key, weight]) =>
    [key, String(Number((weight * factor).toFixed(8)))]
  ));
  return getCourseWeightTotal(weights) === 100 ? { weights, ccTokens } : null;
};

// Dựng lại chuỗi "Công thức điểm" từ trọng số để xuất CSV nhập lại được.
// Tổng luôn bằng 1.00; trọng số 0% bị bỏ khỏi công thức.
export const buildGradeFormula = (weights) => {
  const parts = [
    { token: 'CC', weight: parseDecimalValue(weights?.cc) ?? 0 },
    { token: 'GK', weight: parseDecimalValue(weights?.gk) ?? 0 },
    { token: 'CK', weight: parseDecimalValue(weights?.ck) ?? 0 },
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

// File Excel nhập điểm bắt buộc đủ 5 cột: Học kỳ, Tên môn, Số TC, Trọng số, Điểm.
// "Điểm" chấp nhận một trong các cột điểm: CC/QT/BT, GK, CK, Thang 10, Thang 4, Chữ.
export const getMissingImportHeaderColumns = (foundColumns = {}) => {
  const isMissing = (key) => foundColumns[key] === undefined || foundColumns[key] === -1;
  const missing = [];
  if (isMissing('semester')) missing.push('Học kỳ');
  if (isMissing('name')) missing.push('Tên môn');
  if (isMissing('credits')) missing.push('Số TC');
  if (isMissing('formula')) missing.push('Trọng số');
  const hasGradeColumn = ['cc', 'gk', 'ck', 'total10', 'total4', 'letter']
    .some((key) => !isMissing(key));
  if (!hasGradeColumn) missing.push('Điểm');
  return missing;
};

export const IMPORT_REQUIRED_COLUMNS_MESSAGE =
  'Cần đủ 5 cột: Học kỳ, Tên môn, Số TC, Trọng số, Điểm.';

export const readGradeImportRows = (data, type) => {
  const workbook = type === 'string'
    ? read(data.replace(/^\uFEFF/, ''), { type, raw: true })
    : read(data, { type });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return null;
  return utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    defval: '',
    raw: false,
  });
};

// rows: mảng các dòng (mảng ô) đọc từ sheet đầu tiên.
// subjects: danh sách môn đang có trong app.
// newCourses: môn chưa có trong app nhưng dòng Excel có đủ Kỳ/Năm học + Số TC + điểm.
export const parseGradeSheet = (rows, subjects) => {
  const emptyResult = {
    headerRowIndex: -1,
    missingColumns: [],
    gradesBySubject: new Map(),
    weightsBySubject: new Map(),
    creditsBySubject: new Map(),
    total10BySubject: new Map(),
    total4BySubject: new Map(),
    letterBySubject: new Map(),
    newCourses: [],
    skippedRows: 0,
    invalidRows: [],
  };
  if (!Array.isArray(rows) || rows.length === 0) return emptyResult;

  let headerRowIndex = -1;
  let headerCells = [];
  let columns = {};
  let bestMissingColumns = null;
  let bestMatchedCount = -1;
  // Quét 50 dòng đầu: bảng điểm thật thường có tiêu đề/thông tin sinh viên phía trên.
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 50); rowIndex += 1) {
    const headers = rows[rowIndex].map(normalizeImportHeader);
    const foundColumns = {};
    Object.entries(IMPORT_HEADER_ALIASES).forEach(([key, aliases]) => {
      foundColumns[key] = headers.findIndex((header) => aliases.includes(header));
    });
    const missingColumns = getMissingImportHeaderColumns(foundColumns);
    const matchedCount = Object.values(foundColumns).filter((index) => index !== -1).length;
    // Ghi nhớ dòng giống tiêu đề nhất để báo đúng các cột còn thiếu.
    if (missingColumns.length > 0 && foundColumns.name !== -1 && matchedCount > bestMatchedCount) {
      bestMatchedCount = matchedCount;
      bestMissingColumns = missingColumns;
    }
    if (missingColumns.length === 0) {
      headerRowIndex = rowIndex;
      headerCells = headers;
      columns = foundColumns;
      break;
    }
  }
  if (headerRowIndex === -1) {
    return {
      ...emptyResult,
      missingColumns: bestMissingColumns
        || ['Học kỳ', 'Tên môn', 'Số TC', 'Trọng số', 'Điểm'],
    };
  }

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
  const invalidRows = [];
  let skippedRows = 0;

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const readCell = (index) => String(row[index] ?? '').trim();
    const name = readCell(columns.name);
    if (!name) continue;

    const rowSemester = parseSemesterLabel(readCell(columns.semester));
    const rawCredits = readCell(columns.credits);
    const rowCredits = parseCourseCredits(rawCredits);
    const rawFormula = readCell(columns.formula);
    const rowFormula = parseGradeFormula(rawFormula);
    const invalidFields = [];
    if (!rowSemester) invalidFields.push('Học kỳ');
    if (rawCredits && rowCredits === null) invalidFields.push('Số TC');
    if (rawFormula && !rowFormula) invalidFields.push('Trọng số');

    const readScore = (index, label, maximum = 10) => {
      const raw = readCell(index);
      const value = parseGradeValue(raw);
      if (raw && (value === null || value > maximum)) {
        invalidFields.push(label);
        return null;
      }
      return value;
    };
    const rawLetter = readCell(columns.letter);
    const importedLetter = /^[A-F]\+?(?:\s*\(\s*\d+(?:[.,]\d+)?\s*\))?$/i.test(rawLetter)
      ? parseLetterGrade(rawLetter)?.letter ?? null
      : null;
    if (rawLetter && !importedLetter) invalidFields.push('Điểm chữ');
    const importedTotal10 = readScore(columns.total10, 'Thang 10');
    const importedTotal4 = readScore(columns.total4, 'Thang 4', 4);

    // Kiểm tra mọi cột CC/QT/BT, rồi mới chọn giá trị theo thứ tự ưu tiên của công thức.
    const preferredCcIndexes = rowFormula?.ccTokens.map(findColumnForToken).filter((index) => index !== -1) || [];
    const ccIndexes = [...new Set([...preferredCcIndexes, ...ccColumnIndexes])];
    const ccScores = ccIndexes.map((index) => readScore(index, 'CC/QT/BT'));
    const gk = readScore(columns.gk, 'GK');
    const ck = readScore(columns.ck, 'CK');
    if (invalidFields.length > 0) {
      skippedRows += 1;
      invalidRows.push({ rowNumber: rowIndex + 1, fields: [...new Set(invalidFields)] });
      continue;
    }

    const candidates = subjectsByName.get(normalizeImportHeader(name)) || [];
    const subject = candidates.find((item) =>
      parseSemesterLabel(item.semester)?.canonical === rowSemester.canonical
    );
    const cc = ccScores.find((value) => value !== null);
    let grades = {};
    for (const [key, score] of Object.entries({ cc, gk, ck })) {
      if (score != null) grades[key] = Number.isInteger(score) ? score.toFixed(1) : String(score);
    }
    if (rowFormula && gk !== null && ck !== null && importedTotal10 !== null) {
      grades = reconcileGkCkOrder(grades, rowFormula.weights, importedTotal10).grades;
    }
    const hasGrade = Object.keys(grades).length > 0;
    if (importedTotal4 !== null && getLetterByPoint(importedTotal4) === null &&
        importedTotal10 === null && !importedLetter && !hasGrade) {
      skippedRows += 1;
      invalidRows.push({ rowNumber: rowIndex + 1, fields: ['Thang 4'] });
      continue;
    }
    const hasGradeData = hasGrade || importedTotal10 !== null || importedTotal4 !== null || importedLetter !== null;
    if (!hasGradeData && rowCredits === null) {
      skippedRows += 1;
      continue;
    }

    // Môn mới cần có số tín chỉ và ít nhất một dữ liệu điểm.
    if (!subject) {
      if (rowCredits === null || !hasGradeData) {
        skippedRows += 1;
        continue;
      }
      const key = `${rowSemester.canonical}|${normalizeImportHeader(name)}`;
      newCoursesByKey.set(key, mergeNewCourse(newCoursesByKey.get(key), {
        name,
        semesterInfo: rowSemester,
        credits: rowCredits,
        weights: rowFormula ? rowFormula.weights : null,
        cc: grades.cc ?? null,
        gk: grades.gk ?? null,
        ck: grades.ck ?? null,
        total10: importedTotal10,
        total4: importedTotal4,
        letter: importedLetter,
      }));
      continue;
    }

    if (hasGrade) gradesBySubject.set(subject.id, { ...gradesBySubject.get(subject.id), ...grades });
    if (rowCredits !== null) creditsBySubject.set(subject.id, rowCredits);
    // Công thức chỉ đi kèm dòng có dữ liệu điểm; dòng chỉ có tín chỉ không đổi trọng số.
    if (hasGradeData && rowFormula) weightsBySubject.set(subject.id, rowFormula.weights);
    if (importedTotal10 !== null) total10BySubject.set(subject.id, importedTotal10);
    if (importedTotal4 !== null) total4BySubject.set(subject.id, importedTotal4);
    if (importedLetter) letterBySubject.set(subject.id, importedLetter);
  }

  return {
    headerRowIndex,
    missingColumns: [],
    gradesBySubject,
    weightsBySubject,
    creditsBySubject,
    total10BySubject,
    total4BySubject,
    letterBySubject,
    newCourses: [...newCoursesByKey.values()],
    skippedRows,
    invalidRows,
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

const getImportedCourseGrades = (values, weights, total10, total4, letter, existingTotal = null) => {
  const grades = clearZeroWeightGrades(values, weights);
  // Dùng điểm thành phần khi đủ, rồi đến tổng hệ 10 hoặc quy đổi từ điểm còn lại.
  const total = calcCourseTotal(grades, weights)
    ?? resolveGradeTotal(total10, total4, letter)
    ?? existingTotal;
  const grade = getGradeLetter(total);
  const missingParts = ['cc', 'gk', 'ck'].filter(
    (key) => parseDecimalValue(weights[key]) > 0 && parseGradeValue(grades[key]) === null
  );
  return {
    cc: grades.cc || 'Chưa nhập',
    gk: grades.gk || 'Chưa nhập',
    ck: grades.ck || 'Chưa nhập',
    total: total === null ? '--' : total.toFixed(2),
    status: grade?.status ?? 'pending',
    badge: grade?.text ?? (missingParts.length ? `Chờ nhập ${missingParts.join('/')}` : 'Chờ điểm'),
  };
};

// Ghép kết quả đọc Excel vào danh sách môn hiện tại.
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

    return {
      ...subject,
      weights,
      credits,
      ...getImportedCourseGrades(
        grades, weights, importedTotal10, importedTotal4, importedLetter, resolveGradeTotal(subject.total)
      ),
    };
  });

// Dựng object học phần mới từ một dòng Excel chưa có trong app.
// semester: { id, rawName, year, status } — học kỳ đã có hoặc vừa tạo.
export const buildCourseFromImportRow = (row, semester) => {
  const weights = row.weights || { cc: '10', gk: '30', ck: '60' };
  return {
    name: row.name,
    credits: row.credits,
    semester: `${semester.rawName} (${semester.year.replace(' - ', '-')})`,
    sem: semester.id,
    weights,
    ...getImportedCourseGrades(row, weights, row.total10, row.total4, row.letter),
    canEdit: semester.status !== 'Hoàn thành',
  };
};

