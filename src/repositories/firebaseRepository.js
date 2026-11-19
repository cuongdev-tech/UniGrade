// Repository: toàn bộ điểm nối Firestore của UniGrade.
// Cấu trúc 7 bảng theo ERD:
//   users              – tài khoản
//   academic_profiles  – cấu hình học vụ (1:1 với users)
//   semesters          – học kỳ
//   courses            – danh mục học phần gốc (không chứa điểm)
//   course_enrollments – mỗi lần học một môn trong một kỳ (chứa điểm + học lại)
//   grade_forecasts    – kết quả dự báo What-if của từng lần học
//   exam_reminders     – lịch nhắc thi gắn với lần học
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseServices } from '../firebase';
import {
  userModel,
  academicProfileModel,
  semesterModel,
  courseCatalogModel,
  courseModel,
  gradeForecastModel,
  reminderModel,
  firstValue,
  numericValue,
} from '../models';
import {
  buildCatalogId,
  buildCourseId,
  buildForecastId,
  buildReminderId,
  buildSemesterDocumentId,
  compactDocumentId,
  normalizeCourseName,
} from '../services/courseIdService';
import { writeWithCompactIds } from './firestoreDocumentWrites';

// UID đang đăng nhập — dùng để gắn user_id cho mọi document mới (Firestore Rules).
const getCurrentUid = () => getFirebaseServices().auth?.currentUser?.uid || null;

// ---------- ĐỌC TOÀN BỘ KHÔNG GIAN LÀM VIỆC ----------

export async function loadUserWorkspace(uid, authUser = null) {
  const { db } = getFirebaseServices();
  const userReference = doc(db, 'users', uid);
  const profileSnapshot = await getDoc(userReference);
  const academicSnapshots = await getDocs(
    query(collection(db, 'academic_profiles'), where('user_id', '==', uid))
  );
  const profileId = academicProfileModel.getProfileDocumentId(uid);
  const academicSnapshot = academicSnapshots.docs.find((snapshot) => snapshot.id === profileId)
    || academicSnapshots.docs[0] || null;
  const academicData = academicSnapshot?.data() || null;
  const fullName = String(authUser?.displayName || '').trim() || 'Sinh viên';
  const profile = profileSnapshot.exists()
    ? userModel.fromFirestore(profileSnapshot, academicData)
    : {
        fullName,
        email: authUser?.email || '',
        avatarInitials: userModel.getInitials(fullName),
        totalProgramCredits: numericValue(
          firstValue(academicData || {}, academicProfileModel.ALIASES.total_program_credits, 130),
          130
        ),
        totalProgramSemesters: numericValue(
          firstValue(academicData || {}, academicProfileModel.ALIASES.total_program_semesters, 8),
          8
        ),
        targetGpa: numericValue(
          firstValue(academicData || {}, academicProfileModel.ALIASES.target_gpa_4, 3.2),
          3.2
        ),
      };

  if (!profileSnapshot.exists() || !academicSnapshot) {
    const batch = writeBatch(db);
    if (!profileSnapshot.exists()) {
      batch.set(userReference, userModel.toFirestore(uid, profile));
    }
    if (!academicSnapshot) {
      batch.set(
        doc(db, 'academic_profiles', profileId),
        academicProfileModel.toFirestore(profileId, uid, profile)
      );
    }
    await batch.commit();
  }

  const semesterSnapshots = await getDocs(
    query(collection(db, 'semesters'), where('user_id', '==', uid))
  );
  const semesters = semesterSnapshots.docs.map(semesterModel.fromFirestore);
  const semesterById = new Map(semesters.map((semester) => [semester.id, semester]));
  const semesterOrder = new Map(semesters.map((semester, index) => [semester.id, index]));

  // Danh mục học phần của riêng tài khoản này.
  const catalogSnapshots = await getDocs(
    query(collection(db, 'courses'), where('user_id', '==', uid))
  );
  const catalog = catalogSnapshots.docs.map(courseCatalogModel.fromFirestore);
  const catalogById = new Map(catalog.map((course) => [course.id, course]));

  const enrollmentSnapshots = await getDocs(
    query(collection(db, 'course_enrollments'), where('user_id', '==', uid))
  );

  const legacySnapshots = await Promise.all(semesters.map(async (semester) => {
    try {
      const snapshot = await getDocs(query(collection(db, 'courses'), where('semester_id', '==', semester.id)));
      return snapshot.docs;
    } catch (error) {
      if (error?.code !== 'permission-denied') throw error;
      return catalogSnapshots.docs.filter((snapshot) => snapshot.data().semester_id === semester.id);
    }
  }));
  const courseById = new Map();
  legacySnapshots.forEach((snapshots, index) => {
    snapshots.forEach((snapshot) => {
      const owner = snapshot.data().user_id;
      if (owner != null && owner !== uid) return;
      const course = courseModel.fromFirestore(snapshot, semesters[index]);
      courseById.set(course.id, { ...course, legacyCourseId: snapshot.id, enrollmentDocumentId: null });
    });
  });
  // Bản ghi mới ưu tiên khi cùng ID, các môn chưa chuyển vẫn đọc từ courses.
  enrollmentSnapshots.docs.forEach((snapshot) => {
    const data = snapshot.data();
    const semester = semesterById.get(data.semester_id);
    if (!semester) return;
    const legacyCandidate = courseById.get(data.legacy_course_id || snapshot.id);
    const legacy = legacyCandidate?.sem === semester.id ? legacyCandidate : null;
    const id = legacyCandidate && !legacy ? snapshot.id : data.legacy_course_id || snapshot.id;
    if (!data.legacy_course_id && legacy?.enrollmentDocumentId) return;
    const course = courseModel.fromFirestore(snapshot, semester, catalogById.get(data.course_id) || legacy);
    courseById.set(id, {
      ...course,
      id,
      legacyCourseId: legacy?.legacyCourseId,
      enrollmentDocumentId: snapshot.id,
    });
  });
  const courses = [...courseById.values()].sort((a, b) =>
    (semesterOrder.get(a.sem) - semesterOrder.get(b.sem)) || a.id.localeCompare(b.id)
  );

  const reminderSnapshots = await Promise.all(
    courses.flatMap((course) => ['course_id', 'enrollment_id'].map(async (field) => {
      try {
        const source = query(collection(db, 'exam_reminders'), where(field, '==', course.id));
        const snapshot = await getDocs(source);
        return snapshot.docs;
      } catch {
        return [];
      }
    }))
  );
  const reminderById = new Map();
  reminderSnapshots.flat().forEach((snapshot) => {
    const data = snapshot.data();
    if (data.user_id != null && data.user_id !== uid) return;
    const courseId = firstValue(data, reminderModel.ALIASES.enrollment_id, '');
    const course = courseById.get(courseId);
    if (course) reminderById.set(snapshot.id, reminderModel.fromFirestore(snapshot, course));
  });

  return { profile, semesters, courses, reminders: [...reminderById.values()] };
}

// ---------- HỌC KỲ ----------

export async function createSemesterRecord(uid, semester, previousSemesterIds, existingIds = []) {
  const { db, auth } = getFirebaseServices();
  const user = auth?.currentUser;
  if (!uid || user?.uid !== uid) throw new Error('Chưa đăng nhập nên không tạo được học kỳ.');
  return writeWithCompactIds(db, user, async (allocate) => {
    const base = buildSemesterDocumentId(semester.rawName, semester.year);
    const { reference } = await allocate('semesters', base, { existingIds });
    const writes = previousSemesterIds.map((id) => ({
      reference: doc(db, 'semesters', id), type: 'update', data: semesterModel.toStatusUpdate(),
    }));
    writes.push({
      reference, type: 'create', data: semesterModel.toFirestore(reference.id, uid, semester),
    });
    return { writes, result: reference.id };
  });
}

// Đảm bảo học kỳ lịch sử tồn tại với mã cố định (sem_hk1_2425...).
// Không tạo trùng, không đụng tới học kỳ đang học hiện tại.
export async function ensureSemesterRecord(uid, baseId, semester) {
  const { db, auth } = getFirebaseServices();
  const user = auth?.currentUser;
  if (!uid || user?.uid !== uid) throw new Error('Chưa đăng nhập nên không nhập được học kỳ.');
  return writeWithCompactIds(db, user, async (allocate) => {
    const { reference, existing } = await allocate('semesters', baseId, {
      reuse: (data) => {
        const name = firstValue(data, semesterModel.ALIASES.semester_name, '');
        const year = firstValue(data, semesterModel.ALIASES.academic_year, '');
        return getCourseNameKey(name) === getCourseNameKey(semester.rawName)
          && semesterModel.normalizeYear(year) === semesterModel.normalizeYear(semester.year);
      },
    });
    const writes = existing ? [] : [{
      reference, type: 'create', data: semesterModel.toFirestore(reference.id, uid, semester),
    }];
    return { writes, result: reference.id };
  });
}

// Chốt điểm học kỳ và lưu kết quả tổng hợp trong cùng một lần ghi.
export async function confirmSemesterRecord(semesterId, stats) {
  const { db } = getFirebaseServices();
  const uid = getCurrentUid();
  if (!uid) throw new Error('Chưa đăng nhập nên không xác nhận được học kỳ.');
  const summary = semesterModel.toSemesterSummaryUpdate(stats);
  const reference = doc(db, 'semesters', semesterId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const data = snapshot.data();
    if (data?.user_id !== uid) throw new Error('Không tìm thấy học kỳ của tài khoản này.');
    const status = firstValue(data, semesterModel.ALIASES.status);
    if (semesterModel.normalizeStatus(status) === 'Hoàn thành') return;
    transaction.update(reference, { ...semesterModel.toStatusUpdate(), ...summary });
  });
}

// ---------- HỌC PHẦN (danh mục courses + lần học course_enrollments) ----------

const getCourseNameKey = (name) => normalizeCourseName(name).replace(/\s+/g, ' ').trim().toLowerCase();

// Tạo 1 lần học. Tên môn trùng với danh mục đã có (học lại) thì dùng lại dòng danh mục đó.
// Trả về { id (enrollment_id), catalogId (course_id) }.
export async function createCourseRecord(course, existingIds = []) {
  const { db, auth } = getFirebaseServices();
  const user = auth?.currentUser;
  const uid = user?.uid;
  if (!uid) throw new Error('Chưa đăng nhập nên không ghi được học phần.');

  return writeWithCompactIds(db, user, async (allocate) => {
    const catalogSnapshots = await getDocs(
      query(collection(db, 'courses'), where('user_id', '==', uid))
    );
    const catalog = catalogSnapshots.docs
      .filter((snapshot) => !snapshot.data().semester_id)
      .map(courseCatalogModel.fromFirestore);
    const nameKey = getCourseNameKey(course.name);
    const catalogEntry = catalog.find((item) => item.id === course.courseId)
      || catalog.find((item) => getCourseNameKey(item.name) === nameKey);
    const { reference: enrollment } = await allocate(
      'course_enrollments', buildCourseId(course.name, course.sem), { existingIds }
    );
    const writes = [];
    let catalogId = catalogEntry?.id;
    if (!catalogEntry) {
      const { reference } = await allocate('courses', buildCatalogId(course.name), {
        existingIds: catalogSnapshots.docs.map(({ id }) => id),
      });
      catalogId = reference.id;
      writes.push({
        reference, type: 'create',
        data: courseCatalogModel.toFirestore(catalogId, uid, course, course.status === 'passed'),
      });
    } else if (course.status === 'passed' && !catalogEntry.isPassed) {
      writes.push({ reference: doc(db, 'courses', catalogId), type: 'update', data: { is_passed: true } });
    }
    writes.push({
      reference: enrollment,
      type: 'create',
      data: courseModel.toFirestore(uid, { ...course, id: enrollment.id, courseId: catalogId }),
    });
    return { writes, result: { id: enrollment.id, catalogId } };
  });
}

export async function updateCourseRecord(course) {
  await updateCourseRecords([course], []);
}

export async function updateCourseRecords(courses, remindersToDelete = []) {
  const { db, auth } = getFirebaseServices();
  const user = auth?.currentUser;
  const uid = user?.uid;
  if (!uid) throw new Error('Chưa đăng nhập nên không lưu được điểm.');

  return writeWithCompactIds(db, user, async (allocate) => {
    const writes = [];
    const enrollmentIds = new Map();
    for (const course of courses) {
      let reference = doc(db, 'course_enrollments', course.enrollmentDocumentId || course.id);
      let existing = true;
      if (!course.enrollmentDocumentId && course.legacyCourseId) {
        ({ reference, existing } = await allocate('course_enrollments', `legacy_${compactDocumentId(course.legacyCourseId)}`, {
          reuse: (data) => data.legacy_course_id === course.legacyCourseId,
        }));
      }
      const updates = courseModel.toFirestore(uid, { ...course, id: reference.id });
      if (course.legacyCourseId) {
        updates.legacy_course_id = course.legacyCourseId;
        updates.course_name = course.name;
        updates.credits = course.credits;
      }
      if (existing) delete updates.user_id;
      writes.push({ reference, type: existing ? 'update' : 'create', data: updates });
      enrollmentIds.set(course.id, reference.id);

      if (course.courseId && !course.legacyCourseId) {
        writes.push({ reference: doc(db, 'courses', course.courseId), type: 'update', data: {
          course_name: course.name,
          credits: numericValue(course.credits, 0),
          ...(course.status === 'passed' ? { is_passed: true } : {}),
        } });
      }
    }
    remindersToDelete.forEach((reminder) => {
      writes.push({ reference: doc(db, 'exam_reminders', reminder.id), type: 'delete' });
    });
    return { writes, result: enrollmentIds };
  });
}

// Xóa 1 lần học: xóa enrollment + lịch nhắc + dự báo. Danh mục courses được giữ lại.
export async function deleteCourseAndReminders(course, reminders) {
  const { db } = getFirebaseServices();
  const uid = getCurrentUid();
  if (!uid) throw new Error('Chưa đăng nhập nên không xóa được học phần.');
  const forecasts = await getCourseForecasts(db, uid, course.id);
  const batch = writeBatch(db);
  if (course.enrollmentDocumentId !== null) {
    batch.delete(doc(db, 'course_enrollments', course.enrollmentDocumentId || course.id));
  }
  if (course.legacyCourseId) batch.delete(doc(db, 'courses', course.legacyCourseId));
  forecasts.forEach((snapshot) => batch.delete(snapshot.ref));
  reminders
    .filter((reminder) => reminder.courseId === course.id)
    .forEach((reminder) => batch.delete(doc(db, 'exam_reminders', reminder.id)));
  await batch.commit();
}

// ---------- NHẮC THI ----------

export async function createReminderRecord(reminder, existingIds = []) {
  const { db, auth } = getFirebaseServices();
  const user = auth?.currentUser;
  const uid = user?.uid;
  if (!uid) throw new Error('Chưa đăng nhập nên không tạo được lịch nhắc thi.');
  return writeWithCompactIds(db, user, async (allocate) => {
    const base = buildReminderId(reminder.courseId, reminder.type);
    const { reference } = await allocate('exam_reminders', base, { existingIds });
    return {
      writes: [{ reference, type: 'create', data: reminderModel.toFirestore(reference.id, uid, reminder) }],
      result: reference.id,
    };
  });
}

export async function acknowledgeReminderRecord(reminderId) {
  const { db } = getFirebaseServices();
  const uid = getCurrentUid();
  if (!uid) throw new Error('Chưa đăng nhập nên không xác nhận được lịch nhắc.');
  await updateDoc(doc(db, 'exam_reminders', reminderId), { user_id: uid, is_acknowledged: true });
}

// "Báo lại 10p": chỉ dời giờ báo thức, giữ nguyên lịch nhắc trong database
// và giữ is_acknowledged = false để khay tự bật lại sau 10 phút.
export async function updateReminderAlarmRecord(reminderId, alarmDateIso, alarmTime) {
  if (!reminderId) throw new Error('Thiếu mã lịch nhắc để báo lại.');
  const { db } = getFirebaseServices();
  const uid = getCurrentUid();
  if (!uid) throw new Error('Chưa đăng nhập nên không dời được lịch nhắc.');
  await updateDoc(doc(db, 'exam_reminders', reminderId), {
    user_id: uid,
    alarm_date: alarmDateIso, // YYYY-MM-DD
    alarm_time: alarmTime,    // HH:MM
    is_acknowledged: false,
  });
}

// ---------- DỰ BÁO ĐIỂM (WHAT-IF) ----------

async function getCourseForecasts(db, uid, enrollmentId) {
  const matches = await Promise.all(gradeForecastModel.ALIASES.enrollment_id.map((field) =>
    getDocs(query(collection(db, 'grade_forecasts'), where('user_id', '==', uid), where(field, '==', enrollmentId)))
  ));
  return [...new Map(matches.flatMap(({ docs }) => docs.map((snapshot) => [snapshot.id, snapshot]))).values()];
}

// Mỗi lần học có tối đa 1 dự báo (fc_<enrollment_id>) nên ghi lại là upsert.
export async function upsertForecastRecord(enrollmentId, forecast) {
  const { db, auth } = getFirebaseServices();
  const user = auth?.currentUser;
  const uid = user?.uid;
  if (!uid || !enrollmentId) return null;
  return writeWithCompactIds(db, user, async (allocate) => {
    const saved = await getCourseForecasts(db, uid, enrollmentId);
    const matched = saved.find((entry) => entry.id === buildForecastId(enrollmentId)) || saved[0];
    const { reference, existing } = matched
      ? { reference: matched.ref, existing: true }
      : await allocate('grade_forecasts', buildForecastId(enrollmentId), {
        reuse: (data) => firstValue(data, gradeForecastModel.ALIASES.enrollment_id, '') === enrollmentId,
      });
    const data = gradeForecastModel.toFirestore(reference.id, uid, { ...forecast, enrollmentId });
    if (existing) delete data.user_id;
    return { writes: [{ reference, type: existing ? 'update' : 'create', data }], result: reference.id };
  });
}

// ---------- HỒ SƠ ----------

export async function createUserProfile(uid, profile) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  const profileId = academicProfileModel.getProfileDocumentId(uid);
  batch.set(doc(db, 'users', uid), userModel.toFirestore(uid, profile));
  batch.set(
    doc(db, 'academic_profiles', profileId),
    academicProfileModel.toFirestore(profileId, uid, profile)
  );
  await batch.commit();
}

// Cập nhật GPA mục tiêu / tổng tín chỉ từ màn "Sửa hồ sơ".
// Ghi vào academic_profiles, đồng thời mirror 3 field cũ trong users để bản build cũ vẫn đọc được.
export async function updateUserProfileRecord(uid, profile) {
  const { db } = getFirebaseServices();
  const profileId = academicProfileModel.getProfileDocumentId(uid);
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'academic_profiles', profileId),
    {
      profile_id: profileId,
      user_id: uid,
      ...academicProfileModel.toProfileUpdate(profile),
    },
    { merge: true }
  );
  batch.set(doc(db, 'users', uid), userModel.toLegacyProfileUpdate(profile), { merge: true });
  await batch.commit();
}
