require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  compareSemesters,
  canConfirmSemester,
  getSemesterDisplayStatus,
} = require('./semesterModel');

test('orders semesters by academic year and then HK1, HK2, and summer', () => {
  const semesters = [
    { id: 'summer', rawName: 'Học kỳ Hè', year: '2025 - 2026', status: 'Đang học' },
    { id: 'next-year', rawName: 'Học kỳ 1', year: '2026 - 2027', status: 'Đang học' },
    { id: 'term-2', rawName: 'Học kỳ 2', year: '2025 - 2026', status: 'Đang học' },
    { id: 'term-1', rawName: 'Học kỳ 1', year: '2025 - 2026', status: 'Đang học' },
  ];

  assert.deepEqual(
    semesters.sort(compareSemesters).map((semester) => semester.id),
    ['term-1', 'term-2', 'summer', 'next-year']
  );
});

test('marks earlier semesters in the same year as unconfirmed', () => {
  const semesters = [
    { rawName: 'Học kỳ 1', year: '2025 - 2026', status: 'Đang học' },
    { rawName: 'Học kỳ 2', year: '2025 - 2026', status: 'Đang học' },
    { rawName: 'Học kỳ Hè', year: '2025 - 2026', status: 'Đang học' },
  ];

  assert.equal(
    getSemesterDisplayStatus('Đang học', '2025 - 2026', semesters, 'Học kỳ 1'),
    'Chưa xác nhận'
  );
  assert.equal(
    getSemesterDisplayStatus('Đang học', '2025 - 2026', semesters, 'Học kỳ 2'),
    'Chưa xác nhận'
  );
  assert.equal(
    getSemesterDisplayStatus('Đang học', '2025 - 2026', semesters, 'Học kỳ Hè'),
    'Đang học'
  );
});

test('confirms only semesters where every course has a completed status and valid result', () => {
  const failed = { status: 'failed', total: '0.00' };
  const scale4Only = { status: 'passed', total_4: 3.7 };
  assert.equal(canConfirmSemester('learning', [failed, scale4Only]), true);
  assert.equal(canConfirmSemester('completed', [failed, scale4Only]), false);
  assert.equal(canConfirmSemester('learning', []), false);
  for (const course of [
    { status: 'pending', total: '8.5' },
    { status: 'passed', total: '--' },
    { status: 'failed', total: '8abc' },
    { status: 'passed', total: '11' },
  ]) {
    assert.equal(canConfirmSemester('learning', [failed, course]), false);
  }
});
