// Model bảng exam_reminders — ánh xạ giữa document Firestore và object dùng trong app.
import { firstValue } from './utils';

// Tên field theo ERD (8 field).
export const FIELDS = [
  'reminder_id',
  'course_id',
  'reminder_type',
  'exam_date',
  'exam_time',
  'exam_room',
  'note',
  'is_acknowledged',
];

// Field phụ: mốc báo trước, phục vụ chức năng thông báo (không có trong ERD).
export const EXTRA_FIELDS = ['advance'];

// Tên cũ đọc được để tương thích ngược với dữ liệu đã có.
export const ALIASES = {
  reminder_type: ['reminder_type', 'type', 'exam_type'],
  exam_date: ['exam_date', 'date'],
  exam_time: ['exam_time', 'time'],
  exam_room: ['exam_room', 'room'],
  note: ['note', 'description'],
  advance: ['advance', 'remind_before'],
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

export const fromFirestore = (snapshot, course) => {
  const data = snapshot.data();
  const dbType = String(firstValue(data, ALIASES.reminder_type, 'ck')).toLowerCase();
  return {
    id: snapshot.id,
    courseId: course.id,
    courseName: course.name,
    credits: course.credits,
    semesterLabel: course.semester,
    type: ['gk', 'mid', 'midterm'].includes(dbType) ? 'mid' : 'final',
    date: formatDateForUi(firstValue(data, ALIASES.exam_date, '')),
    time: firstValue(data, ALIASES.exam_time, ''),
    room: firstValue(data, ALIASES.exam_room, ''),
    note: firstValue(data, ALIASES.note, ''),
    advance: firstValue(data, ALIASES.advance, '1d'),
  };
};

export const toFirestore = (reminderId, reminder) => ({
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
