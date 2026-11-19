require('@babel/register')({ presets: ['babel-preset-expo'] });

const assert = require('node:assert/strict');
const test = require('node:test');
const { formatClockDate, formatClockTime } = require('./clockService');

test('formats the current time as HH:MM with leading zeros', () => {
  assert.equal(formatClockTime(new Date(2026, 10, 18, 9, 5)), '09:05');
  assert.equal(formatClockTime(new Date(2026, 10, 18, 23, 59)), '23:59');
  assert.equal(formatClockTime(new Date(2026, 10, 18, 0, 0)), '00:00');
});

test('status bar clock reflects the real current time', () => {
  const now = new Date();
  const expected = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  assert.equal(formatClockTime(now), expected);
});

test('formats the current date with Vietnamese weekday', () => {
  // 18/11/2026 là Thứ Tư.
  assert.equal(formatClockDate(new Date(2026, 10, 18, 9, 5)), 'Thứ Tư, 18/11/2026');
  assert.equal(formatClockDate(new Date(2026, 10, 22, 9, 5)), 'Chủ nhật, 22/11/2026');
});
