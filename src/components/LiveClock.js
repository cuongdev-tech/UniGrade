import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { formatClockDate, formatClockTime } from '../services/clockService';

// Đồng hồ chạy theo giờ máy, cập nhật mỗi 5 giây để không lệch khi máy ngủ/thức.
export default function LiveClock({ style, withDate = false, prefix = '', suffix = '' }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5000);
    return () => clearInterval(timer);
  }, []);

  const text = withDate
    ? `${formatClockTime(now)} • ${formatClockDate(now)}`
    : formatClockTime(now);

  return <Text style={style}>{`${prefix}${text}${suffix}`}</Text>;
}
