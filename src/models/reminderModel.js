// Model bảng exam_reminders — lịch nhắc thi gắn với MỘT LẦN HỌC (course_enrollments).
// Trước đây field liên kết tên là course_id; nay đổi thành enrollment_id nhưng vẫn đọc
// được course_id cũ để không mất dữ liệu khi migrate.
import { firstValue } from './utils';

// Tên field theo ERD (8 field).
export const FIELDS = [
  'reminder_id',
  'enrollment_id',
  'reminder_type',
  'exam_date',
  'exam_time',
  'exam_room',
  'note',
  'is_acknowledged',
];

// Field phụ: mốc báo trước + user_id (dùng cho Firestore Rules), không có trong ERD.
// alarm_date / alarm_time là thời điểm báo thức người dùng tự chọn (thay cho advance).
export const EXTRA_FIELDS = ['user_id', 'advance', 'alarm_date', 'alarm_time'];

// Tên cũ đọc được để tương thích ngược với dữ liệu đã có.
export const ALIASES = {
  enrollment_id: ['enrollment_id', 'course_id', 'enrollmentId'],
  reminder_type: ['reminder_type', 'type', 'exam_type'],
  exam_date: ['exam_date', 'date'],
  exam_time: ['exam_time', 'time'],
  exam_room: ['exam_room', 'room'],
  note: ['note', 'description'],
  advance: ['advance', 'remind_before'],
  alarm_date: ['alarm_date', 'remind_date', 'notify_date'],
  alarm_time: ['alarm_time', 'remind_time', 'notify_time'],
  is_acknowledged: ['is_acknowledged', 'acknowledged', 'isAcknowledged'],
};

export const formatDateForUi = (value) => {
  const date = String(value || '');
  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return isoMatch ? `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}` : date;
};

export const formatDateForDatabase = (value) => {
  const match = String(value || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || '').trim();
};

// course: object enrollment (id, name, credits, semester) để giao diện hiển thị.
export const fromFirestore = (snapshot, course) => {
  const data = snapshot.data();
  const dbType = String(firstValue(data, ALIASES.reminder_type, 'ck')).toLowerCase();
  return {
    id: snapshot.id,
    courseId: course?.id || firstValue(data, ALIASES.enrollment_id, ''),
    courseName: course?.name || 'Môn học',
    credits: course?.credits ?? 0,
    semesterLabel: course?.semester || '',
    type: ['gk', 'mid', 'midterm'].includes(dbType) ? 'mid' : 'final',
    date: formatDateForUi(firstValue(data, ALIASES.exam_date, '')),
    time: firstValue(data, ALIASES.exam_time, ''),
    room: firstValue(data, ALIASES.exam_room, ''),
    note: firstValue(data, ALIASES.note, ''),
    advance: firstValue(data, ALIASES.advance, '1d'),
    alarmDate: formatDateForUi(firstValue(data, ALIASES.alarm_date, '')),
    alarmTime: firstValue(data, ALIASES.alarm_time, ''),
    isAcknowledged: firstValue(data, ALIASES.is_acknowledged, false) === true,
  };
};

export const toFirestore = (reminderId, uid, reminder) => ({
  reminder_id: reminderId,
  user_id: uid,
  enrollment_id: reminder.courseId,
  reminder_type: reminder.type === 'mid' ? 'gk' : 'ck',
  exam_date: formatDateForDatabase(reminder.date),
  exam_time: reminder.time,
  exam_room: reminder.room,
  note: reminder.note || null,
  advance: reminder.advance || null,
  alarm_date: reminder.alarmDate ? formatDateForDatabase(reminder.alarmDate) : null,
  alarm_time: reminder.alarmTime || null,
  is_acknowledged: reminder.isAcknowledged === true,
});
