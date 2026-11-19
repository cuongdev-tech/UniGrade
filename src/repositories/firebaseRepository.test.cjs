require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

let records;
let currentUid;
const projectId = 'unigrade-test';
const documentsPath = `projects/${projectId}/databases/(default)/documents/`;
const reference = (collection, id) => ({ collection, id, path: `${collection}/${id}` });
const keyOf = ({ collection, id }) => `${collection}/${id}`;
const snapshot = (ref) => ({
  id: ref.id,
  ref,
  data: () => records.get(keyOf(ref)),
  exists: () => records.has(keyOf(ref)),
});
const store = (ref, value, { merge = false } = {}) => {
  const key = keyOf(ref);
  records.set(key, merge ? { ...records.get(key), ...value } : value);
};
const firestore = {
  collection: (_db, name) => name,
  doc: (_db, name, id) => reference(name, id),
  documentId: () => '__name__',
  query: (name, ...filters) => ({ name, filters }),
  where: (field, _op, value) => ({ field, value }),
  getDoc: async (ref) => snapshot(ref),
  getDocs: async ({ name, filters }) => ({
    docs: [...records.keys()].filter((key) => key.startsWith(`${name}/`))
      .map((key) => snapshot(reference(name, key.slice(name.length + 1))))
      .filter((doc) => filters.every(({ field, value }) =>
        (field === '__name__' ? doc.id : doc.data()[field]) === value)),
  }),
  setDoc: async (...args) => store(...args),
  runTransaction: async (_db, work) => {
    const updates = [];
    await work({
      get: async (ref) => snapshot(ref),
      update: (ref, data) => updates.push([ref, data]),
    });
    updates.forEach(([ref, data]) => store(ref, data, { merge: true }));
  },
  writeBatch: () => {
    const operations = [];
    return {
      set: (...args) => operations.push(() => store(...args)),
      delete: (ref) => operations.push(() => records.delete(keyOf(ref))),
      commit: async () => operations.forEach((apply) => apply()),
    };
  },
};
firestore.getDocsFromServer = firestore.getDocs;

test.beforeEach((context) => {
  context.mock.method(global, 'fetch', async (_url, { body }) => {
    const { writes } = JSON.parse(body);
    for (const write of writes) {
      if (!write.update) continue;
      const key = write.update.name.slice(documentsPath.length);
      if (write.currentDocument.exists === false && records.has(key)) {
        return { ok: false, json: async () => ({
          error: { status: 'ALREADY_EXISTS', message: `Document already exists: ${write.update.name}` },
        }) };
      }
      if (write.currentDocument.exists === true && !records.has(key)) {
        return { ok: false, json: async () => ({ error: { status: 'NOT_FOUND' } }) };
      }
    }
    for (const write of writes) {
      if (write.delete) {
        records.delete(write.delete.slice(documentsPath.length));
        continue;
      }
      const key = write.update.name.slice(documentsPath.length);
      const fields = Object.fromEntries(Object.entries(write.update.fields).map(([name, value]) =>
        [name, 'integerValue' in value ? Number(value.integerValue) : Object.values(value)[0]]
      ));
      records.set(key, write.updateMask ? { ...records.get(key), ...fields } : fields);
    }
    return { ok: true, json: async () => ({}) };
  });
});

const loadModule = Module._load;
let repository;
try {
  Module._load = function (request, parent, isMain) {
    if (request === 'firebase/firestore') return firestore;
    if (request === '../firebase') return { getFirebaseServices: () => ({
      db: { app: { options: { projectId } } },
      auth: { currentUser: { uid: currentUid, getIdToken: async () => 'test-token' } },
    }) };
    return loadModule.call(this, request, parent, isMain);
  };
  repository = require('./firebaseRepository');
} finally {
  Module._load = loadModule;
}

const semester = { rawName: 'Học kỳ 1', name: 'Học kỳ 1 (2026-2027)', year: '2026 - 2027', status: 'Đang học' };
const course = {
  name: 'Công nghệ Web',
  credits: 3,
  weights: { cc: '10', gk: '30', ck: '60' },
  cc: 'Chưa nhập',
  gk: 'Chưa nhập',
  ck: 'Chưa nhập',
  total: '--',
  status: 'pending',
};

test('uses compact IDs and applies the last four UID characters on cross-account collisions', async () => {
  records = new Map();
  const created = [];
  for (const uid of ['student-A101', 'student-B202']) {
    currentUid = uid;
    const semesterId = await repository.createSemesterRecord(uid, semester, []);
    assert.equal(await repository.ensureSemesterRecord(uid, 'sem_hk1_2627', semester), semesterId);
    const { id, catalogId } = await repository.createCourseRecord({ ...course, sem: semesterId });
    const reminderId = await repository.createReminderRecord({ courseId: 'crs_cnw_2627', type: 'final', date: '20/11/2026', time: '10:00', room: 'A1' });
    created.push({ semesterId, catalogId, id, reminderId });
  }
  assert.deepEqual(created, [
    { semesterId: 'sem_hk1_2627', catalogId: 'cat_cnw', id: 'crs_cnw_2627', reminderId: 'rem_cnw_2627_ck' },
    { semesterId: 'sem_hk1_2627_B202', catalogId: 'cat_cnw_B202', id: 'crs_cnw_2627_B202', reminderId: 'rem_cnw_2627_ck_B202' },
  ]);
  assert.equal(records.size, 8);
  assert.equal(records.get(`course_enrollments/${created[0].id}`).user_id, 'student-A101');
  assert.equal(records.get(`course_enrollments/${created[1].id}`).semester_id, 'sem_hk1_2627_B202');
  assert.equal(records.get(`course_enrollments/${created[1].id}`).course_id, 'cat_cnw_B202');
});

test('increments same-owner collisions and also protects collisions with a reused UID suffix', async () => {
  currentUid = 'student-A101';
  records = new Map();
  assert.equal(await repository.createSemesterRecord(currentUid, semester, []), 'sem_hk1_2627');
  assert.equal(await repository.createSemesterRecord(currentUid, semester, []), 'sem_hk1_2627_2');
  records.set('semesters/sem_hk1_2627_B202', { user_id: 'another-user-B202' });
  currentUid = 'student-B202';
  assert.equal(await repository.ensureSemesterRecord(currentUid, 'sem_hk1_2627', semester), 'sem_hk1_2627_B202_2');
  assert.equal(await repository.ensureSemesterRecord(currentUid, 'sem_hk1_2627', semester), 'sem_hk1_2627_B202_2');
  assert.equal(records.get('semesters/sem_hk1_2627_B202').user_id, 'another-user-B202');
});

test('updates the actual forecast ID and keeps new forecast IDs compact for legacy enrollments', async () => {
  currentUid = 'student-A101';
  const enrollmentId = 'u_old-long-uid~copy_1234567890abcdef12345678_crs_cnw_2627';
  records = new Map([
    ['grade_forecasts/fc_crs_cnw_2627', { user_id: 'another-user', enrollment_id: 'crs_cnw_2627' }],
  ]);
  const first = { targetGrade: 'A', targetScore10: 8.5, requiredFinalScore: 9.166666666666666, projectedGpa4: 3.5100000000000002 };
  const id = await repository.upsertForecastRecord(enrollmentId, first);
  assert.equal(id, 'fc_crs_cnw_2627_A101');
  assert.equal(records.get(`grade_forecasts/${id}`).required_final_score, 9.17);
  assert.equal(await repository.upsertForecastRecord(enrollmentId, { ...first, targetGrade: 'B', requiredFinalScore: null }), id);
  assert.equal(records.get(`grade_forecasts/${id}`).enrollment_id, enrollmentId);
  assert.equal(records.get(`grade_forecasts/${id}`).target_grade, 'B');
  assert.equal(records.get(`grade_forecasts/${id}`).projected_gpa_4, 3.51);
  assert.equal(records.get(`grade_forecasts/${id}`).required_final_score, null);
  assert.equal(records.get('grade_forecasts/fc_crs_cnw_2627').user_id, 'another-user');
  assert.equal(records.size, 2);
});

test('loads old and new courses and reminders together and preserves legacy links after a save', async () => {
  currentUid = 'student-a';
  const oldCourse = { semester_id: 'old-semester', course_name: 'Môn cũ', credits: 3, total_10: 6 };
  records = new Map([
    ['semesters/old-semester', { user_id: currentUid, semester_name: semester.rawName, academic_year: semester.year }],
    ['courses/old-course', oldCourse],
    ['courses/another-owner', { ...oldCourse, user_id: 'student-b' }],
    ['courses/catalog', { user_id: currentUid, course_name: 'Môn mới', credits: 4 }],
    ['course_enrollments/new-course', { user_id: currentUid, semester_id: 'old-semester', course_id: 'catalog' }],
    ['course_enrollments/old-course', { user_id: 'student-b', semester_id: 'other-semester' }],
    ['exam_reminders/old-reminder', { course_id: 'old-course' }],
    ['exam_reminders/new-reminder', { enrollment_id: 'new-course', user_id: currentUid }],
  ]);
  const workspace = await repository.loadUserWorkspace(currentUid);
  assert.deepEqual(workspace.courses.map(({ id }) => id).sort(), ['new-course', 'old-course']);
  assert.deepEqual(workspace.reminders.map(({ id }) => id).sort(), ['new-reminder', 'old-reminder']);
  const legacy = workspace.courses.find(({ id }) => id === 'old-course');
  const saved = await repository.updateCourseRecords([{ ...legacy, name: 'Môn cũ đã sửa', credits: 5, total: '3.995' }]);

  assert.notEqual(saved.get('old-course'), 'old-course');
  assert.deepEqual(records.get('courses/old-course'), oldCourse);
  assert.equal(records.get('course_enrollments/old-course').user_id, 'student-b');

  const reloaded = await repository.loadUserWorkspace(currentUid);
  assert.equal(reloaded.courses.length, 2);
  const edited = reloaded.courses.find(({ id }) => id === 'old-course');
  assert.equal(edited.name, 'Môn cũ đã sửa');
  assert.equal(edited.credits, 5);
  assert.equal(edited.total, '4.00');
  assert.equal(edited.badge, 'D (1.0)');
  assert.equal(reloaded.reminders.find(({ id }) => id === 'old-reminder').courseId, 'old-course');
});

test('loads the canonical academic profile and the avatar initials stored on the account', async () => {
  currentUid = 'student-a';
  records = new Map([
    ['users/student-a', { full_name: 'Tên Hồ Sơ', avatar_initials: 'C', target_gpa: 3.2 }],
    ['academic_profiles/legacy', { user_id: currentUid, target_gpa_4: 2.5 }],
    ['academic_profiles/prof_student-a', { user_id: currentUid, target_gpa_4: 3.75, total_program_credits: 135 }],
  ]);

  const { profile } = await repository.loadUserWorkspace(currentUid);
  assert.equal(profile.fullName, 'Tên Hồ Sơ');
  assert.equal(profile.avatarInitials, 'C');
  assert.equal(profile.targetGpa, 3.75);
  assert.equal(profile.totalProgramCredits, 135);
});

test('saves the displayed semester totals together with confirmation and protects the finalized snapshot', async () => {
  currentUid = 'student-a';
  const semesterId = 'demo-semester';
  const key = `semesters/${semesterId}`;
  records = new Map([[key, {
    user_id: currentUid,
    status: 'learning',
    semester_gpa_4: null,
    semester_avg_10: null,
    earned_credits: 0,
  }]]);

  const { calcSemesterStats } = require('../services/gradeService');
  const stats = calcSemesterStats([
    { status: 'passed', total: 8.70, credits: 2 },
    { status: 'passed', total: 6.20, credits: 1 },
  ]);
  await assert.rejects(
    repository.confirmSemesterRecord(semesterId, { ...stats, gradedCount: 1 }),
    /cần đủ điểm/
  );
  assert.equal(records.get(key).status, 'learning');
  await repository.confirmSemesterRecord(semesterId, stats);
  assert.deepEqual(records.get(key), {
    user_id: currentUid,
    status: 'completed',
    semester_gpa_4: 3.13,
    semester_avg_10: 7.87,
    earned_credits: 3,
  });

  await repository.confirmSemesterRecord(semesterId, { ...stats, gpa: 4 });
  assert.equal(records.get(key).semester_gpa_4, 3.13);
});
