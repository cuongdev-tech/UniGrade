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

export async function createSemesterRecord(uid, semester, previousSemesterIds) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  const reference = doc(collection(db, 'semesters'));
  const semesterId = reference.id;

  previousSemesterIds.forEach((id) => {
    batch.update(doc(db, 'semesters', id), semesterModel.toStatusUpdate());
  });
  batch.set(reference, semesterModel.toFirestore(semesterId, uid, semester));
  await batch.commit();
  return semesterId;
}

export async function createCourseRecord(course) {
  const { db } = getFirebaseServices();
  const reference = doc(collection(db, 'courses'));
  const id = reference.id;
  await setDoc(reference, courseModel.toFirestore({ ...course, id }));
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

export async function createReminderRecord(reminder) {
  const { db } = getFirebaseServices();
  const reference = doc(collection(db, 'exam_reminders'));
  const reminderId = reference.id;
  await setDoc(reference, reminderModel.toFirestore(reminderId, reminder));
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
