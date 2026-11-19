import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { formatExamCountdown } from '../services/reminderService';

export default function ExamCountdownText({ date, time, style, prefix = '', suffix = '' }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [date, time]);

  const countdown = formatExamCountdown(date, time, now);
  return (
    <Text style={style}>
      {countdown ? `${prefix}${countdown}${suffix}` : 'Không xác định thời gian'}
    </Text>
  );
}
