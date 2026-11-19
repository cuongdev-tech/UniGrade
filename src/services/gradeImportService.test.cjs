require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const { calcSemesterStats } = require('./gradeService');
const {
  applyImportedGrades,
  buildCourseFromImportRow,
  parseGradeSheet,
  readGradeImportRows,
  getMissingImportHeaderColumns,
} = require('./gradeImportService');

test('imports a UniGrade CSV with a UTF-8 BOM and escaped Vietnamese course names', () => {
  const csv = [
    '\uFEFFKỳ/Năm học,Tên môn học,Số TC,Công thức điểm,CC,GK,CK,Thang 10,Thang 4,Chữ',
    '"Học kỳ 2 (2025-2026)","Đọc, ghi ""dữ liệu""","2","[CK]*1","","","8.5","8.50","3.7","A"',
  ].join('\r\n');
  const result = parseGradeSheet(readGradeImportRows(csv, 'string'), []);

  assert.deepEqual(result.invalidRows, []);
  assert.equal(result.newCourses.length, 1);
  const [course] = result.newCourses;
  assert.equal(course.name, 'Đọc, ghi "dữ liệu"');
  assert.deepEqual(course.weights, { cc: '0', gk: '0', ck: '100' });
  assert.equal(course.total10, 8.5);
});

test('validates semicolon-separated CSV and accepts a comma decimal score', () => {
  const csv = [
    'Học kỳ;Tên môn;Số TC;Trọng số;CK',
    'HK2 (2025-2026);Cơ sở dữ liệu;3;[CK]*1;8,5',
    'HK2 (2025-2026);Mạng máy tính;3;[CK]*1;8abc',
  ].join('\n');
  const result = parseGradeSheet(readGradeImportRows(csv, 'string'), []);

  assert.equal(result.newCourses.length, 1);
  assert.equal(result.newCourses[0].ck, '8.5');
  assert.deepEqual(result.invalidRows, [{ rowNumber: 3, fields: ['CK'] }]);
});

const existingCourse = {
  id: 'course-1',
  name: 'Cơ sở dữ liệu',
  semester: 'Học kỳ 1 (2025-2026)',
  sem: 'sem_hk1_2526',
  credits: 3,
  weights: { cc: '10', gk: '30', ck: '60' },
  cc: 'Chưa nhập',
  gk: 'Chưa nhập',
  ck: 'Chưa nhập',
  total: '--',
  status: 'pending',
  badge: 'Chờ nhập điểm',
};

// File hợp lệ phải có đủ 5 cột: Học kỳ, Tên môn, Số TC, Trọng số, Điểm.
const HEADER_5 = ['Học kỳ', 'Tên môn học', 'Số TC', 'Trọng số', 'Điểm'];
const headerWith = (gradeHeader) => ['Học kỳ', 'Tên môn học', 'Số TC', 'Trọng số', gradeHeader];
const FORMULA = '[CC]*0.1+[GK]*0.3+[CK]*0.6';

test('derives the 10-point total from an imported 4-point grade', () => {
  const result = parseGradeSheet(
    [headerWith('Thang 4'), ['Học kỳ 1 (2025 - 2026)', 'Cơ sở dữ liệu', '3', FORMULA, '3.7']],
    [existingCourse]
  );
  assert.notEqual(result.headerRowIndex, -1);
  const [updated] = applyImportedGrades([existingCourse], result);

  assert.equal(updated.total, '8.50');
  assert.equal(updated.status, 'passed');
  assert.ok(Math.abs(calcSemesterStats([updated]).gpa - 3.7) < 1e-9);
});

test('derives a failing total from an imported letter grade', () => {
  const result = parseGradeSheet(
    [headerWith('Điểm chữ'), ['Học kỳ 1 (2025 - 2026)', 'Cơ sở dữ liệu', '3', FORMULA, 'F']],
    [existingCourse]
  );
  assert.notEqual(result.headerRowIndex, -1);
  const [updated] = applyImportedGrades([existingCourse], result);

  assert.equal(updated.total, '0.00');
  assert.equal(updated.status, 'failed');
  assert.equal(calcSemesterStats([updated]).gpa, 0);
});

test('derives the 10-point total for a newly imported course with a 4-point grade', () => {
  const result = parseGradeSheet(
    [headerWith('Thang 4'), ['Học kỳ 1 (2025 - 2026)', 'Môn mới', '3', FORMULA, '3.5']],
    []
  );
  assert.notEqual(result.headerRowIndex, -1);
  const imported = buildCourseFromImportRow(result.newCourses[0], {
    id: 'sem_hk1_2526',
    rawName: 'Học kỳ 1',
    year: '2025 - 2026',
    status: 'Đang học',
  });

  assert.equal(imported.total, '8.00');
  assert.equal(imported.status, 'passed');
  assert.ok(Math.abs(calcSemesterStats([imported]).gpa - 3.5) < 1e-9);
});

test('prefers weighted component grades over conflicting imported totals and letters', () => {
  const result = {
    gradesBySubject: new Map([['course-1', { cc: '8', gk: '9', ck: '5.4' }]]),
    weightsBySubject: new Map([['course-1', { cc: '20', gk: '20', ck: '60' }]]),
    total10BySubject: new Map([['course-1', 8.1]]),
    total4BySubject: new Map([['course-1', 3.5]]),
    letterBySubject: new Map([['course-1', 'B+']]),
  };
  const [updated] = applyImportedGrades([existingCourse], result);

  assert.equal(updated.total, '6.64');
  assert.equal(updated.badge, 'C+ (2.5)');
  assert.equal(updated.status, 'passed');
});

test('calculates a new course total from components when imported totals conflict', () => {
  const imported = buildCourseFromImportRow({
    name: 'Môn mới',
    credits: 3,
    weights: { cc: '20', gk: '20', ck: '60' },
    cc: '8',
    gk: '9',
    ck: '5.4',
    total10: 8.1,
    total4: 3.5,
    letter: 'B+',
  }, {
    id: 'sem_hk1_2526',
    rawName: 'Học kỳ 1',
    year: '2025 - 2026',
    status: 'Đang học',
  });

  assert.equal(imported.total, '6.64');
  assert.equal(imported.badge, 'C+ (2.5)');
  assert.equal(imported.status, 'passed');
});

test('corrects reversed GK and CK columns when the swapped scores match Excel total', () => {
  const rows = [
    ['Kỳ/Năm học', 'Tên môn học', 'Số TC', 'Công thức điểm', 'BT', 'QT', 'GK', 'CK', 'Thang 10', 'Thang 4', 'Chữ'],
    ['2/2025-2026', 'Công nghệ Web', '2', '[GK]*0.20+[BT]*0.20+[CK]*0.60', '8', '', '9', '5.4', '8.1', '3.5', 'B+'],
  ];
  const result = parseGradeSheet(rows, []);
  const imported = buildCourseFromImportRow(result.newCourses[0], {
    id: 'sem_hk2_2526',
    rawName: 'Học kỳ 2',
    year: '2025 - 2026',
    status: 'Đang học',
  });

  assert.equal(imported.gk, '5.4');
  assert.equal(imported.ck, '9.0');
  assert.equal(imported.total, '8.08');
  assert.equal(imported.badge, 'B+ (3.5)');
});

test('calculates existing-course totals from components when Excel has no total scale columns', () => {
  const rows = [
    ['Kỳ/Năm học', 'Tên môn học', 'Số TC', 'Công thức điểm', 'BT', 'GK', 'CK'],
    ['1/2025-2026', 'Cơ sở dữ liệu', '3', '[BT]*0.10+[GK]*0.30+[CK]*0.60', '9', '8', '7'],
  ];
  const result = parseGradeSheet(rows, [existingCourse]);
  const [updated] = applyImportedGrades([existingCourse], result);

  assert.equal(result.total10BySubject.size, 0);
  assert.equal(result.total4BySubject.size, 0);
  assert.equal(updated.total, '7.50');
  assert.equal(updated.badge, 'B (3.0)');
});

test('calculates new-course totals from components when Excel has no total scale columns', () => {
  const rows = [
    ['Kỳ/Năm học', 'Tên môn học', 'Số TC', 'Công thức điểm', 'BT', 'GK', 'CK'],
    ['1/2025-2026', 'Môn mới', '3', '[BT]*0.10+[GK]*0.30+[CK]*0.60', '9', '8', '7'],
  ];
  const result = parseGradeSheet(rows, []);
  const imported = buildCourseFromImportRow(result.newCourses[0], {
    id: 'sem_hk1_2526',
    rawName: 'Học kỳ 1',
    year: '2025 - 2026',
    status: 'Đang học',
  });

  assert.equal(imported.total, '7.50');
  assert.equal(imported.badge, 'B (3.0)');
});

// ---------- Bắt buộc đủ 5 cột ----------
test('rejects a sheet missing the Học kỳ column', () => {
  const result = parseGradeSheet(
    [['Tên môn học', 'Số TC', 'Trọng số', 'Điểm'], ['Cơ sở dữ liệu', '3', FORMULA, '8']],
    [existingCourse]
  );
  assert.equal(result.headerRowIndex, -1);
  assert.deepEqual(result.missingColumns, ['Học kỳ']);
});

test('rejects a sheet missing the Tên môn column', () => {
  const result = parseGradeSheet(
    [['Học kỳ', 'Số TC', 'Trọng số', 'Điểm'], ['Học kỳ 1 (2025 - 2026)', '3', FORMULA, '8']],
    [existingCourse]
  );
  assert.equal(result.headerRowIndex, -1);
  assert.ok(result.missingColumns.includes('Tên môn'));
});

test('rejects a sheet missing the Số TC column', () => {
  const result = parseGradeSheet(
    [['Học kỳ', 'Tên môn học', 'Trọng số', 'Điểm'],
      ['Học kỳ 1 (2025 - 2026)', 'Cơ sở dữ liệu', FORMULA, '8']],
    [existingCourse]
  );
  assert.equal(result.headerRowIndex, -1);
  assert.deepEqual(result.missingColumns, ['Số TC']);
});

test('rejects a sheet missing the Trọng số column', () => {
  const result = parseGradeSheet(
    [['Học kỳ', 'Tên môn học', 'Số TC', 'Điểm'],
      ['Học kỳ 1 (2025 - 2026)', 'Cơ sở dữ liệu', '3', '8']],
    [existingCourse]
  );
  assert.equal(result.headerRowIndex, -1);
  assert.deepEqual(result.missingColumns, ['Trọng số']);
});

test('rejects a sheet missing every grade column', () => {
  const result = parseGradeSheet(
    [['Học kỳ', 'Tên môn học', 'Số TC', 'Trọng số'],
      ['Học kỳ 1 (2025 - 2026)', 'Cơ sở dữ liệu', '3', FORMULA]],
    [existingCourse]
  );
  assert.equal(result.headerRowIndex, -1);
  assert.deepEqual(result.missingColumns, ['Điểm']);
});

test('accepts a 5-column sheet and lists nothing missing', () => {
  const result = parseGradeSheet(
    [HEADER_5, ['Học kỳ 1 (2025 - 2026)', 'Cơ sở dữ liệu', '3', FORMULA, '8']],
    [existingCourse]
  );
  assert.notEqual(result.headerRowIndex, -1);
  assert.deepEqual(result.missingColumns, []);
});

test('getMissingImportHeaderColumns reports all five groups when nothing matches', () => {
  assert.deepEqual(
    getMissingImportHeaderColumns({}),
    ['Học kỳ', 'Tên môn', 'Số TC', 'Trọng số', 'Điểm']
  );
});

test('rejects every field in a malformed row before it can overwrite an earlier valid row', () => {
  const term = 'HK1 (2025-2026)';
  const name = existingCourse.name;
  const result = parseGradeSheet([
    ['Học kỳ', 'Tên môn học', 'Số TC', 'Trọng số', 'CC', 'QT', 'GK', 'CK', 'Thang 10', 'Thang 4', 'Chữ'],
    [term, name, '3', FORMULA, '8'],
    [term, name, '4', FORMULA, '9', '', '20'],
    [term, name, '3abc', FORMULA, '9'],
    [term, name, '4', FORMULA, '8abc'],
    [term, name, '4', FORMULA, '9', '8xyz'],
    ['HK1 (2026-2035)', name, '4', FORMULA, '9'],
    [term, name, '4', '[CK]*1+garbage', '9'],
    [term, name, '4', FORMULA, '9', '', '', '', '8abc', '4abc', 'A xyz'],
    [term, name, '21', FORMULA, '9'],
  ], [existingCourse]);

  assert.equal(result.skippedRows, 8);
  assert.deepEqual(result.invalidRows.map(({ fields }) => fields), [
    ['GK'], ['Số TC'], ['CC/QT/BT'], ['CC/QT/BT'], ['Học kỳ'],
    ['Trọng số'], ['Điểm chữ', 'Thang 10', 'Thang 4'], ['Số TC'],
  ]);
  assert.equal(result.newCourses.length, 0);
  assert.equal(result.creditsBySubject.get(existingCourse.id), 3);
  assert.deepEqual(result.gradesBySubject.get(existingCourse.id), { cc: '8.0' });
  assert.equal(existingCourse.cc, 'Chưa nhập');
});

test('preserves component precision and derives outcome consistently from the rounded 10-point total', () => {
  const [existing] = applyImportedGrades([existingCourse], parseGradeSheet([
    ['Học kỳ', 'Tên môn học', 'Số TC', 'Trọng số', 'Điểm', 'Thang 4', 'Chữ'],
    ['HK1 (2025-2026)', existingCourse.name, '3', FORMULA, '3,995', '3.7', 'A'],
  ], [existingCourse]));
  assert.equal(existing.total, '4.00');
  assert.equal(existing.badge, 'D (1.0)');
  assert.equal(existing.status, 'passed');
  assert.equal(calcSemesterStats([existing]).gpa, 1);

  const [component] = applyImportedGrades([existingCourse], parseGradeSheet([
    headerWith('CC'),
    ['HK1 (2025-2026)', existingCourse.name, '3', '[CC]*100%', '8.49'],
  ], [existingCourse]));
  assert.equal(component.cc, '8.49');
  assert.equal(component.total, '8.49');
  assert.equal(component.badge, 'B+ (3.5)');
});
