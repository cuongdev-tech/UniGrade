require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  calcCourseTotal,
  calcSemesterStats,
  clearZeroWeightGrades,
  getGradeLetter,
  isGradeValueInvalid,
  parseCourseCredits,
  parseTargetGpa,
  reconcileGkCkOrder,
} = require('./gradeService');

test('clears scores for zero-weight components while retaining enabled component grades', () => {
  const grades = { cc: '9', gk: '8', ck: '7' };
  const weights = { cc: '0', gk: '30', ck: '70' };

  assert.deepEqual(clearZeroWeightGrades(grades, weights), { cc: '', gk: '8', ck: '7' });
  assert.equal(calcCourseTotal(clearZeroWeightGrades(grades, weights), weights), 7.3);
});

test('keeps entered scores when all component weights are positive', () => {
  const grades = { cc: '9', gk: '8', ck: '7' };
  const weights = { cc: '10', gk: '30', ck: '60' };

  assert.deepEqual(clearZeroWeightGrades(grades, weights), grades);
});

test('swaps GK and CK only when the swapped total matches the official total', () => {
  const result = reconcileGkCkOrder(
    { cc: '8', gk: '9', ck: '5.4' },
    { cc: '20', gk: '20', ck: '60' },
    '8.1'
  );

  assert.equal(result.swapped, true);
  assert.deepEqual(result.grades, { cc: '8', gk: '5.4', ck: '9' });
  assert.ok(Math.abs(result.total - 8.08) < 1e-9);
});

test('preserves GK and CK when the current total already matches', () => {
  const grades = { cc: '8', gk: '5.4', ck: '9' };
  const result = reconcileGkCkOrder(grades, { cc: '20', gk: '20', ck: '60' }, '8.1');

  assert.equal(result.swapped, false);
  assert.equal(result.grades, grades);
});

test('uses the rounded 10-point score for the letter, GPA, and earned credits', () => {
  const total = calcCourseTotal({ cc: '3,995' }, { cc: 100, gk: 0, ck: 0 });
  assert.equal(total, 4);
  assert.equal(getGradeLetter(total).letter, 'D');
  assert.equal(getGradeLetter('8.495').letter, 'A');
  assert.equal(getGradeLetter('3.994').status, 'failed');
  const stats = calcSemesterStats([{ total: '3.995', status: 'failed', credits: 3 }]);
  assert.equal(stats.gpa, 1);
  assert.equal(stats.avg10, 4);
  assert.equal(stats.earnedCredits, 3);
  assert.equal(stats.failedCredits, 0);
});

test('rejects invalid input without coercing it into a grade, course credit, or GPA', () => {
  for (const grade of ['-2', '10.001', '8abc', '8..5', 'Infinity']) {
    assert.equal(isGradeValueInvalid(grade), true);
  }
  assert.equal(isGradeValueInvalid(''), false);
  assert.equal(isGradeValueInvalid('8,5'), false);
  for (const credits of ['', '-2', '99', '20.1', '3abc', '0']) {
    assert.equal(parseCourseCredits(credits), null);
  }
  assert.equal(parseCourseCredits('1'), 1);
  assert.equal(parseCourseCredits('20'), 20);
  for (const gpa of ['', ' ', '0', '-2', '4.01', '3.2abc']) {
    assert.equal(parseTargetGpa(gpa), null);
  }
  assert.equal(parseTargetGpa('4.0'), 4);
  assert.equal(parseTargetGpa('3,25'), 3.25);
});
