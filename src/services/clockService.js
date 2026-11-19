// Đồng hồ thật cho thanh trạng thái mô phỏng (thay cho giờ tĩnh 09:41/07:00).
// Tách khỏi component để kiểm thử được bằng Node.
export const formatClockTime = (date = new Date()) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// "Thứ Ba, 18/11/2026" — dùng khi cần hiện cả ngày.
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const formatClockDate = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${WEEKDAYS[date.getDay()]}, ${day}/${month}/${date.getFullYear()}`;
};
