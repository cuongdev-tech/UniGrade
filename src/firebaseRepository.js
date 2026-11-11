import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseServices } from './firebase';

const firstValue = (data, keys, fallback = null) => {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') return data[key];
  }
  return fallback;
};

const numericValue = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeYear = (value) => String(value || '').replace(/\s*[-–]\s*/, ' - ');

const normalizeStatus = (value) => {
  if (value === 'learning' || value === 'Đang học') return 'Đang học';
  if (value === 'completed' || value === 'Hoàn thành') return 'Hoàn thành';
  return value || 'Đang học';
};

// Bảng quy đổi điểm chữ ↔ hệ 4, khớp với getGradeLetter() trong App.js.
const LETTER_POINTS = {
  'A+': 4.0,
  A: 3.7,
  'B+': 3.5,
  B: 3.0,
  'C+': 2.5,
  C: 2.0,
  'D+': 1.5,
  D: 1.0,
  F: 0,
};

// "A+ (4.0)" -> "A+" ; "Chờ nhập CK" -> null
const toLetterGrade = (badge) => {
  const letter = String(badge || '').trim().split(/\s+/)[0];
  return Object.prototype.hasOwnProperty.call(LETTER_POINTS, letter) ? letter : null;
};

// "A+" -> "A+ (4.0)" ; giá trị cũ "A+ (4.0)" giữ nguyên để không đổi giao diện
const toLetterBadge = (value) => {
  const letter = String(value || '').trim();
  if (Object.prototype.hasOwnProperty.call(LETTER_POINTS, letter)) {
    return `${letter} (${LETTER_POINTS[letter].toFixed(1)})`;
  }
  return letter || null;
};

const mapSemester = (snapshot) => {
  const data = snapshot.data();
  const rawName = firstValue(data, ['semester_name', 'name', 'semesterName'], 'Học kỳ');
  const year = normalizeYear(firstValue(data, ['academic_year', 'school_year', 'year'], ''));
  return {
    id: snapshot.id,
    rawName,
    year,
    name: year ? `${rawName} (${year})` : rawName,
    status: normalizeStatus(firstValue(data, ['status', 'semester_status'], 'learning')),
  };
};

const mapCourse = (snapshot, semester) => {
  const data = snapshot.data();
  const cc = firstValue(data, ['score_cc', 'cc_score', 'attendance_score', 'attendance_grade', 'grade_cc', 'cc']);
  const gk = firstValue(data, ['score_gk', 'gk_score', 'midterm_score', 'midterm_grade', 'grade_gk', 'gk']);
  const ck = firstValue(data, ['score_ck', 'ck_score', 'final_score', 'final_exam_grade', 'grade_ck', 'ck']);
  const total = firstValue(data, ['total_10', 'total_score', 'total_grade', 'final_grade', 'total']);
  const weights = {
    cc: String(firstValue(data, ['weight_cc', 'cc_weight', 'attendance_weight', 'weight_attendance'], 10)),
    gk: String(firstValue(data, ['weight_gk', 'gk_weight', 'midterm_weight', 'weight_midterm'], 30)),
    ck: String(firstValue(data, ['weight_ck', 'ck_weight', 'final_weight', 'weight_final'], 60)),
  };
  const statusValue = firstValue(data, ['status', 'course_status'], 'pending');
  const status = ['passed', 'failed', 'pending'].includes(statusValue) ? statusValue : 'pending';
  const letter = toLetterBadge(firstValue(data, ['letter_grade', 'grade_letter', 'grade'], null));
  return {
    id: snapshot.id,
    name: firstValue(data, ['course_name', 'name', 'subject_name'], 'Môn học'),
    credits: numericValue(firstValue(data, ['credits', 'credit', 'credit_count'], 0)),
    semester: semester.name,
    sem: semester.id,
    weights,
    status,
    badge: letter || (status === 'pending' ? 'Chờ nhập điểm' : status === 'failed' ? 'F (0.0)' : 'Đã đạt'),
    cc: cc === null ? 'Chưa nhập' : String(cc),
    gk: gk === null ? 'Chưa nhập' : String(gk),
    ck: ck === null ? 'Chưa nhập' : String(ck),
    total: total === null ? '--' : numericValue(total).toFixed(2),
    canEdit: semester.status !== 'Hoàn thành',
  };
};

const formatDateForUi = (value) => {
  const date = String(value || '');
  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return isoMatch ? `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}` : date;
};

const formatDateForDatabase = (value) => {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || '').trim();
};

const mapReminder = (snapshot, course) => {
  const data = snapshot.data();
  const dbType = String(firstValue(data, ['reminder_type', 'type', 'exam_type'], 'ck')).toLowerCase();
  return {
    id: snapshot.id,
    courseId: course.id,
    courseName: course.name,
    credits: course.credits,
    semesterLabel: course.semester,
    type: ['gk', 'mid', 'midterm'].includes(dbType) ? 'mid' : 'final',
    date: formatDateForUi(firstValue(data, ['exam_date', 'date'], '')),
    time: firstValue(data, ['exam_time', 'time'], ''),
    room: firstValue(data, ['exam_room', 'room'], ''),
    note: firstValue(data, ['note', 'description'], ''),
    advance: firstValue(data, ['advance', 'remind_before'], '1d'),
  };
};

export async function loadUserWorkspace(uid) {
  const { db } = getFirebaseServices();
  const profileSnapshot = await getDoc(doc(db, 'users', uid));
  if (!profileSnapshot.exists()) {
    throw new Error('Tài khoản này chưa có hồ sơ users/{UID} trong Firestore. Hãy kiểm tra document ID và trường user_id có trùng UID đăng nhập không.');
  }

  const profileData = profileSnapshot.data();
  const profile = {
    fullName: firstValue(profileData, ['full_name', 'name', 'display_name'], 'Sinh viên'),
    email: firstValue(profileData, ['email'], ''),
    totalProgramCredits: numericValue(firstValue(profileData, ['total_program_credits', 'total_credits'], 130), 130),
    totalProgramSemesters: numericValue(firstValue(profileData, ['total_program_semesters', 'total_semesters'], 8), 8),
    targetGpa: numericValue(firstValue(profileData, ['target_gpa', 'target_gpa_4', 'target_cpa'], 3.2), 3.2),
  };

  const semesterSnapshots = await getDocs(
    query(collection(db, 'semesters'), where('user_id', '==', uid))
  );
  const semesters = semesterSnapshots.docs.map(mapSemester);
  const courseSnapshotsBySemester = await Promise.all(
    semesters.map((semester) =>
      getDocs(query(collection(db, 'courses'), where('semester_id', '==', semester.id)))
    )
  );
  const courses = courseSnapshotsBySemester.flatMap((snapshots, index) =>
    snapshots.docs.map((snapshot) => mapCourse(snapshot, semesters[index]))
  );
  const reminderSnapshotsByCourse = await Promise.all(
    courses.map((course) =>
      getDocs(query(collection(db, 'exam_reminders'), where('course_id', '==', course.id)))
    )
  );
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const reminders = reminderSnapshotsByCourse.flatMap((snapshots, index) =>
    snapshots.docs.map((snapshot) => mapReminder(snapshot, courseById.get(courses[index].id)))
  );

  return { profile, semesters, courses, reminders };
}

export async function createSemesterRecord(uid, semester, previousSemesterIds) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  const reference = doc(collection(db, 'semesters'));
  const semesterId = reference.id;

  previousSemesterIds.forEach((id) => {
    batch.update(doc(db, 'semesters', id), { status: 'completed' });
  });
  batch.set(reference, {
    semester_id: semesterId,
    user_id: uid,
    semester_name: semester.rawName,
    academic_year: semester.year,
    status: 'learning',
    semester_gpa_4: null,
    semester_avg_10: null,
    earned_credits: 0,
  });
  await batch.commit();
  return semesterId;
}

const courseRecord = (course) => {
  const letter = toLetterGrade(course.badge);
  return {
    course_id: course.id,
    semester_id: course.sem,
    course_name: course.name,
    credits: course.credits,
    weight_cc: numericValue(course.weights.cc),
    weight_gk: numericValue(course.weights.gk),
    weight_ck: numericValue(course.weights.ck),
    score_cc: course.cc === 'Chưa nhập' ? null : numericValue(course.cc, null),
    score_gk: course.gk === 'Chưa nhập' ? null : numericValue(course.gk, null),
    score_ck: course.ck === 'Chưa nhập' ? null : numericValue(course.ck, null),
    total_10: course.total === '--' ? null : numericValue(course.total, null),
    total_4: letter === null ? null : LETTER_POINTS[letter],
    letter_grade: letter,
    status: course.status,
  };
};

export async function createCourseRecord(course) {
  const { db } = getFirebaseServices();
  const reference = doc(collection(db, 'courses'));
  const id = reference.id;
  await setDoc(reference, courseRecord({ ...course, id }));
  return id;
}

export async function updateCourseRecord(course) {
  const { db } = getFirebaseServices();
  const { course_id, ...updates } = courseRecord(course);
  await updateDoc(doc(db, 'courses', course.id), updates);
}

export async function updateCourseRecords(courses) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  courses.forEach((course) => {
    const { course_id, ...updates } = courseRecord(course);
    batch.update(doc(db, 'courses', course.id), updates);
  });
  await batch.commit();
}

export async function deleteCourseAndReminders(courseId, reminders) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'courses', courseId));
  reminders
    .filter((reminder) => reminder.courseId === courseId)
    .forEach((reminder) => batch.delete(doc(db, 'exam_reminders', reminder.id)));
  await batch.commit();
}

export async function createReminderRecord(reminder) {
  const { db } = getFirebaseServices();
  const reference = doc(collection(db, 'exam_reminders'));
  const reminderId = reference.id;
  await setDoc(reference, {
    reminder_id: reminderId,
    course_id: reminder.courseId,
    reminder_type: reminder.type === 'mid' ? 'gk' : 'ck',
    exam_date: formatDateForDatabase(reminder.date),
    exam_time: reminder.time,
    exam_room: reminder.room,
    note: reminder.note || null,
    advance: reminder.advance,
    is_acknowledged: false,
  });
  return reminderId;
}

export async function acknowledgeReminderRecord(reminderId) {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'exam_reminders', reminderId), { is_acknowledged: true });
}

export async function createUserProfile(uid, profile) {
  const { db } = getFirebaseServices();
  await setDoc(doc(db, 'users', uid), {
    user_id: uid,
    full_name: profile.fullName,
    email: profile.email,
    total_program_credits: profile.totalProgramCredits,
    total_program_semesters: profile.totalProgramSemesters,
    target_gpa: profile.targetGpa,
    created_at: new Date().toISOString(),
  });
}
