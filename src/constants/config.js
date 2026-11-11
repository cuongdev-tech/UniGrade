// Cấu hình + thông báo dùng chung (tách từ App.js, bước 4/5 MVVM).
// Không đổi nội dung, chỉ đổi chỗ để cả App.js và ViewModel cùng dùng.

// CẤU HÌNH NHẮC THI (MÀN 10, 11, 13)
export const REMINDER_TYPES = [
  { key: 'final', label: 'Thi Cuối kỳ' },
  { key: 'mid', label: 'Thi Giữa kỳ' },
];

export const REMINDER_ADVANCES = [
  { key: '1d', label: 'Trước 1 ngày' },
  { key: '2h', label: 'Trước 2 giờ' },
  { key: '30m', label: 'Trước 30 phút' },
];

export const getReminderTypeLabel = (key) => (REMINDER_TYPES.find((item) => item.key === key) || REMINDER_TYPES[0]).label;
export const getReminderAdvanceLabel = (key) => (REMINDER_ADVANCES.find((item) => item.key === key) || REMINDER_ADVANCES[0]).label;
export const getSemesterOptionLabel = (semester) =>
  `${semester.rawName.replace(/^Học kỳ\s*/, 'HK')} ${semester.year.replace(/\s*-\s*/, '-')}`.trim();

export const EMAIL_ALREADY_EXISTS_MESSAGE = 'Email này đã tồn tại. Vui lòng dùng email khác.';

export const getFirebaseErrorMessage = (error) => {
  const messages = {
    'auth/invalid-email': 'Email không đúng định dạng.',
    'auth/user-not-found': 'Không tìm thấy tài khoản với email này.',
    'auth/wrong-password': 'Mật khẩu không chính xác.',
    'auth/invalid-credential': 'Email hoặc mật khẩu không chính xác.',
    'auth/email-already-in-use': EMAIL_ALREADY_EXISTS_MESSAGE,
    'auth/weak-password': 'Mật khẩu cần có ít nhất 6 ký tự.',
    'auth/network-request-failed': 'Không thể kết nối mạng. Hãy kiểm tra Internet rồi thử lại.',
    'permission-denied': 'Firestore từ chối thao tác. Hãy kiểm tra Rules và UID của tài khoản.',
  };
  return messages[error?.code] || error?.message || 'Đã xảy ra lỗi không xác định.';
};
