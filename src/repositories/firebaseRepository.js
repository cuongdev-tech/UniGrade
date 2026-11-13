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
import { getFirebaseServices } from '../firebase';
import { userModel, semesterModel, courseModel, reminderModel } from '../models';
import { buildCourseId, buildSemesterDocumentId, buildReminderId } from '../services/courseIdService';

export async function loadUserWorkspace(uid) {
  const { db } = getFirebaseServices();
  const profileSnapshot = await getDoc(doc(db, 'users', uid));
  if (!profileSnapshot.exists()) {
    throw new Error('Tài khoản này chưa có hồ sơ users/{UID} trong Firestore. Hãy kiểm tra document ID và trường user_id có trùng UID đăng nhập không.');
  }

  const profile = userModel.fromFirestore(profileSnapshot);

  const semesterSnapshots = await getDocs(
    query(collection(db, 'semesters'), where('user_id', '==', uid))
  );
  const semesters = semesterSnapshots.docs.map(semesterModel.fromFirestore);
  const courseSnapshotsBySemester = await Promise.all(
    semesters.map((semester) =>
      getDocs(query(collection(db, 'courses'), where('semester_id', '==', semester.id)))
    )
  );
  const courses = courseSnapshotsBySemester.flatMap((snapshots, index) =>
    snapshots.docs.map((snapshot) => courseModel.fromFirestore(snapshot, semesters[index]))
  );
  const reminderSnapshotsByCourse = await Promise.all(
    courses.map((course) =>
      getDocs(query(collection(db, 'exam_reminders'), where('course_id', '==', course.id)))
    )
  );
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const reminders = reminderSnapshotsByCourse.flatMap((snapshots, index) =>
    snapshots.docs.map((snapshot) => reminderModel.fromFirestore(snapshot, courseById.get(courses[index].id)))
  );

  return { profile, semesters, courses, reminders };
}

export async function createSemesterRecord(uid, semester, previousSemesterIds, existingIds = []) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  // Mã dễ nhận diện: sem_hk1_2627 thay vì ID ngẫu nhiên dài.
  const semesterId = buildSemesterDocumentId(semester.rawName, semester.year, existingIds);
  const reference = doc(db, 'semesters', semesterId);

  previousSemesterIds.forEach((id) => {
    batch.update(doc(db, 'semesters', id), semesterModel.toStatusUpdate());
  });
  batch.set(reference, semesterModel.toFirestore(semesterId, uid, semester));
  await batch.commit();
  return semesterId;
}

// Đảm bảo học kỳ lịch sử tồn tại với mã cố định (sem_hk1_2425...).
// Không tạo trùng, không đụng tới học kỳ đang học hiện tại.
export async function ensureSemesterRecord(uid, semesterId, semester) {
  const { db } = getFirebaseServices();
  const reference = doc(db, 'semesters', semesterId);
  try {
    const snapshot = await getDoc(reference);
    if (snapshot.exists()) return semesterId;
  } catch {
    // Firestore rules có thể chặn đọc document chưa tồn tại -> cứ tạo bên dưới.
  }
  await setDoc(
    reference,
    semesterModel.toFirestore(semesterId, uid, semester)
  );
  return semesterId;
}

// Chốt điểm học kỳ: learning -> completed, sau đó mọi thao tác sửa/xóa điểm bị khóa.
export async function confirmSemesterRecord(semesterId) {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'semesters', semesterId), { status: 'completed' });
}

export async function createCourseRecord(course, existingIds = []) {
  const { db } = getFirebaseServices();
  // Mã dễ nhận diện: crs_htm_2627, crs_AC_2627... thay vì ID ngẫu nhiên dài.
  const id = buildCourseId(course.name, course.sem, existingIds);
  await setDoc(doc(db, 'courses', id), courseModel.toFirestore({ ...course, id }));
  return id;
}

export async function updateCourseRecord(course) {
  const { db } = getFirebaseServices();
  const { course_id, ...updates } = courseModel.toFirestore(course);
  await updateDoc(doc(db, 'courses', course.id), updates);
}

export async function updateCourseRecords(courses) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  courses.forEach((course) => {
    const { course_id, ...updates } = courseModel.toFirestore(course);
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

export async function createReminderRecord(reminder, existingIds = []) {
  const { db } = getFirebaseServices();
  // Mã dễ nhận diện: rem_att_2627_ck thay vì ID ngẫu nhiên dài.
  const reminderId = buildReminderId(reminder.courseId, reminder.type, existingIds);
  await setDoc(doc(db, 'exam_reminders', reminderId), reminderModel.toFirestore(reminderId, reminder));
  return reminderId;
}

export async function acknowledgeReminderRecord(reminderId) {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'exam_reminders', reminderId), { is_acknowledged: true });
}

export async function createUserProfile(uid, profile) {
  const { db } = getFirebaseServices();
  await setDoc(doc(db, 'users', uid), userModel.toFirestore(uid, profile));
}

// Cập nhật GPA mục tiêu / tổng tín chỉ từ màn "Sửa hồ sơ".
export async function updateUserProfileRecord(uid, profile) {
  const { db } = getFirebaseServices();
  await updateDoc(doc(db, 'users', uid), userModel.toProfileUpdate(profile));
}
