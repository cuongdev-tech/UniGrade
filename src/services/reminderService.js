import { getCourseGradeTotal, parseDecimalValue, parseGradeValue } from './gradeService';

export const REMINDER_GRADE_FIELDS = { mid: 'gk', final: 'ck' };

// Xét điểm và lịch đã đặt riêng cho từng phần thi.
export const getReminderAvailability = (course, existingTypes = []) => {
  const scheduled = new Set(existingTypes);
  const hasFinalGrade = course?.status !== 'pending' && getCourseGradeTotal(course) !== null;
  const pendingTypes = [];
  const allowedTypes = [];
  const unavailableReasons = {};
  for (const [type, field] of Object.entries(REMINDER_GRADE_FIELDS)) {
    const label = field.toUpperCase();
    const weight = parseDecimalValue(course?.weights?.[field]) ?? 0;
    if (weight === 0) {
      unavailableReasons[type] = `Không tính điểm ${label}`;
    } else if (parseGradeValue(course?.[field]) !== null) {
      unavailableReasons[type] = `Đã có điểm ${label}`;
    } else if (hasFinalGrade) {
      unavailableReasons[type] = 'Đã có điểm tổng kết';
    } else {
      pendingTypes.push(type);
      if (scheduled.has(type)) unavailableReasons[type] = 'Đã có lịch nhắc';
      else allowedTypes.push(type);
    }
  }

  return { pendingTypes, allowedTypes, unavailableReasons };
};

// Gỡ lịch đang chờ của phần thi đã có điểm hoặc không còn tính điểm.
export const getRemindersToDelete = (reminders, course) => {
  const { pendingTypes } = getReminderAvailability(course);
  return reminders.filter((reminder) =>
    reminder.courseId === course.id
    && !reminder.isAcknowledged
    && !pendingTypes.includes(reminder.type)
  );
};

// Đọc ngày DD/MM/YYYY + giờ HH:MM thành Date để so sánh giờ thi / báo thức.
export const parseDateTimeInput = (dateValue, timeValue) => {
  const dateMatch = String(dateValue || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const timeMatch = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return null;
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

export const getReminderAlarmError = (alarmDateTime, examDateTime, now = Date.now()) => {
  if (alarmDateTime.getTime() <= now) return 'Thời điểm báo thức phải sau thời điểm hiện tại.';
  if (alarmDateTime.getTime() >= examDateTime.getTime()) return 'Thời điểm báo thức phải trước giờ thi.';
  return null;
};

export const DUPLICATE_EXAM_SLOT_MESSAGE =
  'Trùng lịch thi! Bạn đã có ca thi môn khác vào đúng ngày và giờ này.';

// Kiểm tra 3 quy tắc khi bấm "Lưu" ở Màn 11:
// 1. Không trùng ngày + giờ thi với lịch nhắc đang chờ của môn khác.
// 2. Không tạo trùng loại lịch (Giữa kỳ / Cuối kỳ) cho cùng một môn.
// 3. Không đặt ngày giờ thi trong quá khứ.
// Trả về chuỗi lỗi để hiển thị, hoặc null nếu hợp lệ.
export const getNewReminderError = ({
  courseId,
  type,
  examDateTime,
  reminders = [],
  now = Date.now(),
}) => {
  if (!(examDateTime instanceof Date) || Number.isNaN(examDateTime.getTime())) {
    return 'Ngày thi cần đúng dạng DD/MM/YYYY và giờ thi dạng HH:MM.';
  }
  if (examDateTime.getTime() <= now) {
    return 'Ngày giờ thi không được nhỏ hơn thời điểm hiện tại.';
  }
  const pending = reminders.filter(
    (reminder) => !reminder.isAcknowledged && !isReminderBeforeToday(reminder, now)
  );
  const duplicate = pending.find(
    (reminder) => reminder.courseId === courseId && reminder.type === type
  );
  if (duplicate) {
    return type === 'mid'
      ? 'Môn này đã có lịch nhắc Thi Giữa kỳ đang chờ.'
      : 'Môn này đã có lịch nhắc Thi Cuối kỳ đang chờ.';
  }
  const conflicting = pending.find((reminder) => {
    const existing = parseDateTimeInput(reminder.date, reminder.time);
    return existing !== null && existing.getTime() === examDateTime.getTime();
  });
  if (conflicting) {
    return conflicting.courseId === courseId
      ? 'Môn này đã có lịch nhắc thi khác trùng ngày và giờ thi.'
      : DUPLICATE_EXAM_SLOT_MESSAGE;
  }
  return null;
};

// Nhãn hiển thị cho các loại thi còn lại, VD "Giữa kỳ • Cuối kỳ".
export const getReminderTypeSummary = (allowedTypes = []) =>
  allowedTypes.map((key) => (key === 'mid' ? 'Giữa kỳ' : 'Cuối kỳ')).join(' • ');

// ---------- "Báo lại 10p" trên khay thông báo ----------
// Khay tự bật khi vừa tới mốc báo thức; nếu người dùng bấm "Báo lại 10p" thì
// dời alarm_date/alarm_time tới hiện tại + 10 phút để 10 phút sau khay tự mở lại.
export const SNOOZE_MINUTES = 10;

// Cho phép mở khay khi vào app trong vòng 10 phút kể từ giờ báo thức.
export const ALARM_SHOW_WINDOW_MS = 10 * 60 * 1000;

const pad2 = (value) => String(value).padStart(2, '0');

// Trả về cùng lúc 3 dạng: UI (DD/MM/YYYY + HH:MM) và Firestore (YYYY-MM-DD).
export const getSnoozeAlarm = (baseTime = Date.now(), minutes = SNOOZE_MINUTES) => {
  const target = new Date(baseTime + minutes * 60 * 1000);
  const day = pad2(target.getDate());
  const month = pad2(target.getMonth() + 1);
  const year = target.getFullYear();
  return {
    alarmDate: `${day}/${month}/${year}`,
    alarmTime: `${pad2(target.getHours())}:${pad2(target.getMinutes())}`,
    isoDate: `${year}-${month}-${day}`,
    dateTime: target,
  };
};

// 07:30 -> Sáng, 13:30 -> Chiều, 19:00 -> Tối.
export const getExamPeriodLabel = (timeValue) => {
  const match = String(timeValue || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hour = Number(match[1]);
  if (hour < 12) return 'Sáng';
  if (hour < 18) return 'Chiều';
  return 'Tối';
};

export const getExamCountdownMinutes = (dateValue, timeValue, now = Date.now()) => {
  const examDateTime = parseDateTimeInput(dateValue, timeValue);
  if (!examDateTime) return null;
  return Math.ceil((examDateTime.getTime() - now) / 60000);
};

// "Còn 30 phút" / "Còn 1 giờ 20 phút" / "Còn 3 ngày" / "Đã bắt đầu".
export const formatExamCountdown = (dateValue, timeValue, now = Date.now()) => {
  const minutes = getExamCountdownMinutes(dateValue, timeValue, now);
  if (minutes === null) return '';
  if (minutes <= 0) return 'Đã bắt đầu';
  if (minutes < 60) return `Còn ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) {
    return restMinutes > 0 ? `Còn ${hours} giờ ${restMinutes} phút` : `Còn ${hours} giờ`;
  }
  return `Còn ${Math.floor(hours / 24)} ngày`;
};

// Lịch thi đã qua ngày thi (ngày thi trước hôm nay) thì không nhắc nữa:
// không hiện trên khay thông báo, không nằm trong danh sách Nhắc thi và
// cũng không tự bật khay dù báo thức còn sót lại.
export const isReminderBeforeToday = (reminder, now = new Date()) => {
  const examDateTime = parseDateTimeInput(reminder?.date, reminder?.time);
  if (!examDateTime) return false;
  const base = now instanceof Date ? now : new Date(now);
  const todayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  return examDateTime.getTime() < todayStart;
};

const getAlarmElapsedMs = (reminder, now) => {
  const alarm = parseDateTimeInput(reminder?.alarmDate, reminder?.alarmTime);
  return alarm ? now - alarm.getTime() : null;
};

// Báo thức đã tới giờ và còn trong cửa sổ tự bật khay hay chưa.
export const isAlarmInShowWindow = (
  reminder,
  now = Date.now(),
  windowMs = ALARM_SHOW_WINDOW_MS
) => {
  const elapsed = getAlarmElapsedMs(reminder, now);
  return elapsed !== null && elapsed >= 0 && elapsed <= windowMs;
};

export const formatReminderAlarmAge = (reminder, now = Date.now()) => {
  const elapsed = getAlarmElapsedMs(reminder, now);
  if (elapsed === null || elapsed < 0) return '';
  const minutes = Math.floor(elapsed / 60000);
  return minutes === 0 ? 'Bây giờ' : `${minutes} phút trước`;
};

export const getReminderAlarmStatus = (reminder, now = Date.now()) => {
  const exam = parseDateTimeInput(reminder.date, reminder.time);
  const alarm = parseDateTimeInput(reminder.alarmDate, reminder.alarmTime);
  if (exam && exam.getTime() <= now) return 'exam-started';
  if (!alarm || (exam && alarm.getTime() >= exam.getTime())) return 'unscheduled';
  if (alarm.getTime() > now) return 'scheduled';
  return isAlarmInShowWindow(reminder, now) ? 'due' : 'missed';
};

export const findAlarmToAutoShow = (
  reminders = [],
  now = Date.now(),
  shownAlarmKeys = new Set()
) =>
  reminders.find((reminder) => {
    if (reminder.isAcknowledged || getReminderAlarmStatus(reminder, now) !== 'due') return false;
    const key = `${reminder.id}|${reminder.alarmDate}|${reminder.alarmTime}`;
    return !shownAlarmKeys.has(key);
  }) || null;
