require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const { fromFirestore, toFirestore } = require('./courseModel');
const { canConfirmSemester } = require('./semesterModel');

test('corrects stored GK and CK values when the reversed order matches the saved total', () => {
  const course = fromFirestore({
    id: 'course-1',
    data: () => ({
      score_cc: 8,
      score_gk: 9,
      score_ck: 5.4,
      weight_cc: 20,
      weight_gk: 20,
      weight_ck: 60,
      total_10: 8.1,
      total_4: 3.5,
      letter_grade: 'B+',
      status: 'passed',
    }),
  }, {
    id: 'semester-1',
    name: 'Học kỳ 1 (2025-2026)',
    status: 'Đang học',
  });

  assert.equal(course.gk, '5.4');
  assert.equal(course.ck, '9');
  assert.equal(course.total, '8.08');
  assert.equal(course.badge, 'B+ (3.5)');
  assert.equal(course.status, 'passed');
});

test('normalizes a conflicting old total on read and derives all stored grade fields on write', () => {
  const course = fromFirestore({
    id: 'legacy-course',
    data: () => ({ total_10: 3.5, total_4: 3.7, letter_grade: 'A', status: 'passed' }),
  }, { id: 'legacy-semester', name: 'Học kỳ 1', status: 'Đang học' });
  assert.equal(course.total, '3.50');
  assert.equal(course.badge, 'F (0.0)');
  assert.equal(course.status, 'failed');

  const saved = toFirestore('user', { ...course, total: '3.995', badge: 'F (0.0)' });
  assert.equal(saved.total_10, 4);
  assert.equal(saved.total_4, 1);
  assert.equal(saved.letter_grade, 'D');
  assert.equal(saved.status, 'passed');
});

test('can read an old course with only a 4-point grade, including zero', () => {
  const course = fromFirestore({
    id: 'legacy-course',
    data: () => ({ total_4: 0, status: 'failed' }),
  }, { id: 'legacy-semester', name: 'Học kỳ 1', status: 'Đang học' });
  assert.equal(course.total, '0.00');
  assert.equal(course.status, 'failed');
});

test('an explicitly pending legacy record with a draft total cannot be finalized with the semester', () => {
  const course = fromFirestore({
    id: 'draft-course',
    data: () => ({ total_10: 8.5, status: 'pending' }),
  }, { id: 'semester-1', name: 'Học kỳ 1', status: 'Đang học' });
  assert.equal(course.total, '8.50');
  assert.equal(course.status, 'pending');
  assert.equal(toFirestore('user', course).status, 'pending');
  assert.equal(canConfirmSemester('learning', [course]), false);
});
