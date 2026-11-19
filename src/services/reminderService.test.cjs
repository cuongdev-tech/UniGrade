require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ALARM_SHOW_WINDOW_MS,
  findAlarmToAutoShow,
  formatExamCountdown,
  formatReminderAlarmAge,
  getExamPeriodLabel,
  getNewReminderError,
  getReminderAvailability,
  getReminderAlarmError,
  getReminderAlarmStatus,
  getRemindersToDelete,
  getSnoozeAlarm,
  isAlarmInShowWindow,
  isReminderBeforeToday,
} = require('./reminderService');

const pendingCourse = {
  id: 'crs_example',
  status: 'pending',
  weights: { cc: '20', gk: '20', ck: '60' },
  gk: 'Chưa nhập',
  ck: 'Chưa nhập',
  total: '--',
};

test('only offers exams with a positive course weight and a missing score', () => {
  assert.deepEqual(getReminderAvailability(pendingCourse).allowedTypes, ['mid', 'final']);

  const withMidterm = getReminderAvailability({ ...pendingCourse, gk: '0' });
  assert.deepEqual(withMidterm.pendingTypes, ['final']);
  assert.equal(withMidterm.unavailableReasons.mid, 'Đã có điểm GK');

  const finalOnly = getReminderAvailability({
    ...pendingCourse,
    weights: { cc: '0', gk: '0', ck: '100' },
  });
  assert.deepEqual(finalOnly.allowedTypes, ['final']);
  assert.equal(finalOnly.unavailableReasons.mid, 'Không tính điểm GK');

  const noFinal = getReminderAvailability({
    ...pendingCourse,
    weights: { ...pendingCourse.weights, ck: '0' },
  });
  assert.deepEqual(noFinal.allowedTypes, ['mid']);
  assert.equal(noFinal.unavailableReasons.final, 'Không tính điểm CK');
});

test('an existing final reminder blocks only its own type while both exam scores are missing', () => {
  const availability = getReminderAvailability(pendingCourse, ['final']);
  assert.deepEqual(availability.pendingTypes, ['mid', 'final']);
  assert.deepEqual(availability.allowedTypes, ['mid']);
  assert.equal(availability.unavailableReasons.final, 'Đã có lịch nhắc');
  assert.deepEqual(getReminderAvailability(pendingCourse, ['mid']).allowedTypes, ['final']);
  assert.deepEqual(getReminderAvailability(pendingCourse, ['mid', 'final']).allowedTypes, []);
});

test('a final component score leaves an ungraded midterm eligible until the course has a final result', () => {
  const withFinal = { ...pendingCourse, ck: '8,5' };
  const availability = getReminderAvailability(withFinal);
  assert.deepEqual(availability.allowedTypes, ['mid']);
  assert.equal(availability.unavailableReasons.final, 'Đã có điểm CK');
  assert.deepEqual(getReminderAvailability({ ...withFinal, total: '8.50' }).allowedTypes, ['mid']);
  assert.deepEqual(getReminderAvailability({ ...withFinal, total: '8.50', status: 'passed' }).pendingTypes, []);
});

test('grade updates remove only obsolete reminders for the same enrollment and preserve acknowledged records', () => {
  const reminders = [
    { id: 'gk', courseId: pendingCourse.id, type: 'mid' },
    { id: 'ck', courseId: pendingCourse.id, type: 'final' },
    { id: 'ck-confirmed', courseId: pendingCourse.id, type: 'final', isAcknowledged: true },
    { id: 'other', courseId: 'another_attempt', type: 'final' },
  ];
  const idsToDelete = (course) => getRemindersToDelete(reminders, course).map((reminder) => reminder.id);
  assert.deepEqual(idsToDelete(pendingCourse), []);
  assert.deepEqual(idsToDelete({ ...pendingCourse, gk: '9' }), ['gk']);
  assert.deepEqual(idsToDelete({ ...pendingCourse, ck: '8' }), ['ck']);
  assert.deepEqual(idsToDelete({ ...pendingCourse, weights: { cc: '0', gk: '0', ck: '100' } }), ['gk']);
  assert.deepEqual(idsToDelete({ ...pendingCourse, status: 'failed', total: '0' }), ['gk', 'ck']);
});

const formatDate = (date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

const alarmReminder = (id, alarmDateTime, overrides = {}) => ({
  id,
  alarmDate: formatDate(alarmDateTime),
  alarmTime: `${String(alarmDateTime.getHours()).padStart(2, '0')}:${String(alarmDateTime.getMinutes()).padStart(2, '0')}`,
  isAcknowledged: false,
  ...overrides,
});

test('requires the alarm to be strictly after now and before the exam', () => {
  const now = new Date(2026, 10, 18, 8, 0);
  const exam = new Date(2026, 10, 18, 9, 0);
  assert.match(getReminderAlarmError(new Date(2026, 10, 18, 7, 59), exam, now.getTime()), /hiện tại/);
  assert.match(getReminderAlarmError(now, exam, now.getTime()), /hiện tại/);
  assert.match(getReminderAlarmError(exam, exam, now.getTime()), /giờ thi/);
  assert.match(getReminderAlarmError(new Date(2026, 10, 18, 9, 5), exam, now.getTime()), /giờ thi/);
  assert.equal(getReminderAlarmError(new Date(2026, 10, 18, 8, 30), exam, now.getTime()), null);
});

test('auto-show accepts alarms from now through the ten-minute grace window', () => {
  const alarm = new Date(2026, 10, 18, 8, 0);
  const reminder = alarmReminder('exam-1', alarm);

  assert.equal(ALARM_SHOW_WINDOW_MS, 600000);
  assert.equal(isAlarmInShowWindow(reminder, alarm.getTime()), true);
  assert.equal(findAlarmToAutoShow([reminder], alarm.getTime() + 300000)?.id, reminder.id);
  assert.equal(findAlarmToAutoShow([reminder], alarm.getTime() + 601000), null);
  assert.equal(isAlarmInShowWindow(reminder, alarm.getTime() + ALARM_SHOW_WINDOW_MS), true);
  assert.equal(isAlarmInShowWindow(reminder, alarm.getTime() + ALARM_SHOW_WINDOW_MS + 1), false);
  assert.equal(isAlarmInShowWindow(reminder, alarm.getTime() - 1), false);
});

test('reports whole minutes since the alarm, including across midnight', () => {
  const alarm = new Date(2026, 10, 18, 23, 58);
  const reminder = alarmReminder('exam-1', alarm);
  const start = alarm.getTime();

  assert.equal(formatReminderAlarmAge(reminder, start - 1), '');
  assert.equal(formatReminderAlarmAge(reminder, start + 59000), 'Bây giờ');
  assert.equal(formatReminderAlarmAge(reminder, start + 60000), '1 phút trước');
  assert.equal(formatReminderAlarmAge(reminder, start + 120000), '2 phút trước');
  assert.equal(formatReminderAlarmAge(reminder, start + 300000), '5 phút trước');
  assert.equal(formatReminderAlarmAge(reminder, start + 600000), '10 phút trước');
});

test('auto-show skips acknowledged, stale, future, and already-shown alarms', () => {
  const now = new Date(2026, 10, 18, 8, 2).getTime();
  const due = alarmReminder('due', new Date(2026, 10, 18, 8, 1));
  const old = alarmReminder('old', new Date(2026, 10, 18, 7, 51));
  const acknowledged = alarmReminder('acknowledged', new Date(2026, 10, 18, 8, 1), { isAcknowledged: true });
  const future = alarmReminder('future', new Date(2026, 10, 18, 8, 3));

  assert.equal(findAlarmToAutoShow([old, acknowledged, future, due], now)?.id, 'due');
  assert.equal(findAlarmToAutoShow([due], now, new Set(['due|18/11/2026|08:01'])), null);
});

test('keeps a scheduled December alarm separate from its exam date and current November time', () => {
  const alarmTime = new Date(2026, 11, 14, 23, 0).getTime();
  const reminder = alarmReminder('december', new Date(alarmTime), {
    date: '15/12/2026',
    time: '07:30',
  });
  const now = new Date(2026, 10, 18, 22, 59).getTime();
  assert.equal(getReminderAlarmStatus(reminder, now), 'scheduled');
  assert.equal(findAlarmToAutoShow([reminder], now), null);
  assert.equal(getReminderAlarmStatus(reminder, alarmTime), 'due');
  assert.equal(getReminderAlarmStatus(reminder, alarmTime + ALARM_SHOW_WINDOW_MS + 1), 'missed');
  assert.equal(getReminderAlarmStatus({ ...reminder, alarmDate: '14/11/2026' }, now), 'missed');
  assert.equal(getReminderAlarmStatus({ ...reminder, alarmTime: '' }, now), 'unscheduled');
});

test('a same-day exam that has already started cannot trigger an alarm', () => {
  const now = new Date(2026, 10, 18, 8, 1).getTime();
  const reminder = alarmReminder('exam-started', new Date(2026, 10, 18, 7, 59), {
    date: '18/11/2026',
    time: '08:00',
  });
  assert.equal(isAlarmInShowWindow(reminder, now), true);
  assert.equal(getReminderAlarmStatus(reminder, now), 'exam-started');
  assert.equal(findAlarmToAutoShow([reminder], now), null);
});

test('snooze moves the next alarm ten minutes forward, including across midnight', () => {
  const alarm = getSnoozeAlarm(new Date(2026, 10, 18, 23, 55).getTime());

  assert.equal(alarm.alarmDate, '19/11/2026');
  assert.equal(alarm.alarmTime, '00:05');
  assert.equal(alarm.isoDate, '2026-11-19');
});

test('exam countdown and period labels reflect the scheduled local exam time', () => {
  const exam = new Date(2026, 10, 18, 9, 0).getTime();
  const now = new Date(2026, 10, 18, 8, 30).getTime();

  assert.equal(formatExamCountdown('18/11/2026', '09:00', now), 'Còn 30 phút');
  assert.equal(formatExamCountdown('18/11/2026', '09:00', exam), 'Đã bắt đầu');
  assert.equal(getExamPeriodLabel('07:30'), 'Sáng');
  assert.equal(getExamPeriodLabel('13:30'), 'Chiều');
  assert.equal(getExamPeriodLabel('19:00'), 'Tối');
  assert.equal(getExamPeriodLabel(''), '');
});

test('reminders whose exam date already passed are no longer active', () => {
  const now = new Date(2026, 10, 18, 12, 50);

  assert.equal(isReminderBeforeToday({ date: '14/11/2026', time: '07:00' }, now), true);
  assert.equal(isReminderBeforeToday({ date: '13/11/2026', time: '13:00' }, now), true);
  // Đúng ngày hôm nay (kể cả giờ đã qua) vẫn còn trong danh sách nhắc.
  assert.equal(isReminderBeforeToday({ date: '18/11/2026', time: '07:00' }, now), false);
  assert.equal(isReminderBeforeToday({ date: '15/12/2026', time: '07:30' }, now), false);
  // Ngày không đọc được thì không coi là đã qua.
  assert.equal(isReminderBeforeToday({ date: '', time: '' }, now), false);
});

test('auto-show never reopens the shade for a reminder whose exam date passed', () => {
  const now = new Date(2026, 10, 18, 12, 50).getTime();
  // Báo thức mới qua 1 phút nhưng ngày thi đã qua.
  const stale = alarmReminder('stale', new Date(2026, 10, 18, 12, 49), {
    date: '14/11/2026',
    time: '07:00',
  });
  const upcoming = alarmReminder('upcoming', new Date(2026, 10, 18, 12, 49), {
    date: '15/12/2026',
    time: '07:30',
  });

  assert.equal(findAlarmToAutoShow([stale], now), null);
  assert.equal(findAlarmToAutoShow([stale, upcoming], now)?.id, 'upcoming');
});

test('a passed reminder no longer blocks creating a new schedule for the same course', () => {
  const now = new Date(2026, 10, 18, 12, 50).getTime();
  const passed = {
    id: 'old',
    courseId: 'crs_att_2627',
    type: 'final',
    date: '13/11/2026',
    time: '13:00',
    isAcknowledged: false,
  };

  assert.equal(
    getNewReminderError({
      courseId: 'crs_att_2627',
      type: 'final',
      examDateTime: new Date(2026, 11, 20, 9, 0),
      reminders: [passed],
      now,
    }),
    null
  );
});
