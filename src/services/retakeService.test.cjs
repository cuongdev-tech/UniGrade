require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const { getCourseImportBlocker, getCpaCourses } = require('./retakeService');
const { calcSemesterStats } = require('./gradeService');

const course = (id, sem, status) => ({
  id,
  name: 'Công nghệ Web',
  sem,
  semester: `Học kỳ ${sem}`,
  status,
  badge: status === 'passed' ? 'A (3.7)' : status === 'failed' ? 'F (0.0)' : 'Chờ điểm',
});

test('rejects the whole Excel import when the same course is already passed or pending', () => {
  const imported = [course('excel-1', 'sem_hk1_2627', 'pending')];

  for (const status of ['passed', 'pending']) {
    const blocker = getCourseImportBlocker(
      [course('existing', 'sem_hk1_2526', status)],
      imported
    );

    assert.ok(blocker);
    assert.equal(blocker.preview.kind, 'blocked');
  }
});

test('allows an F course to be retaken but rejects another duplicate attempt in the same import', () => {
  const failed = course('failed-attempt', 'sem_hk1_2526', 'failed');
  const retake = course('excel-1', 'sem_hk1_2627', 'pending');
  const duplicateRetake = course('excel-2', 'sem_hk2_2627', 'pending');

  assert.equal(getCourseImportBlocker([failed], [retake]), null);

  const blocker = getCourseImportBlocker([failed], [retake, duplicateRetake]);
  assert.ok(blocker);
  assert.equal(blocker.preview.reason, 'studying');
});

test('keeps the earlier result in CPA until the retake has a final grade', () => {
  const failed = { ...course('first', 'sem_hk1_2526', 'failed'), credits: 3, total: '3.50' };
  const retake = { ...course('second', 'sem_hk1_2627', 'pending'), credits: 3, retakeOf: failed.id, total: '--' };
  const other = { id: 'another', credits: 3, total: '9.00', status: 'passed' };
  assert.deepEqual(getCpaCourses([failed, retake, other]), [failed, other]);
  assert.equal(calcSemesterStats(getCpaCourses([failed, retake, other])).gpa, 2);
  assert.deepEqual(getCpaCourses([failed, { ...retake, status: 'passed' }]), [failed]);

  const gradedRetake = { ...retake, status: 'passed', total: '8.00' };
  assert.deepEqual(getCpaCourses([failed, gradedRetake, other]), [gradedRetake, other]);
  assert.equal(calcSemesterStats(getCpaCourses([failed, gradedRetake, other])).gpa, 3.75);
});
