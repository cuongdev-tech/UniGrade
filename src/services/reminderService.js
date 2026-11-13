// Tầng Service: xác định một học phần còn phải thi môn nào.
// Dùng cho form "Thêm lịch nhắc thi mới" (Màn 11):
// - Chưa có điểm CK -> còn được nhắc (nhắc GK nếu chưa có điểm GK).
// - Đã có điểm GK -> khóa "Thi Giữa kỳ", chỉ còn "Thi Cuối kỳ".
// - Đã có điểm CK -> coi như đã thi xong, loại khỏi danh sách chọn học phần.
// - Đã tạo lịch nhắc Giữa kỳ (dù đã xác nhận hay chưa) -> khóa lựa chọn Giữa kỳ,
//   không cho tạo trùng; vẫn nhắc được Cuối kỳ.
// - Đã tạo lịch nhắc Cuối kỳ -> môn coi như đã có lịch, biến mất khỏi danh sách
//   để không tạo nhắc thi trùng.
import { parseGradeValue } from './gradeService';
import { getRemainingFinalWeight } from './forecastService';

export const getReminderAvailability = (course, existingTypes = []) => {
  const scheduled = new Set(existingTypes);
  const gkWeight = Number(course?.weights?.gk) || 0;
  const ckWeight = getRemainingFinalWeight(course?.weights);
  const hasGkScore = parseGradeValue(course?.gk) !== null;
  const hasCkScore = parseGradeValue(course?.ck) !== null;
  const finalAlreadyHandled = hasCkScore || scheduled.has('final');

  const allowedTypes = [];
  if (!finalAlreadyHandled) {
    // Cột GK 0%, đã có điểm, hoặc đã có lịch nhắc giữa kỳ thì không nhắc giữa kỳ nữa.
    if (gkWeight > 0 && !hasGkScore && !scheduled.has('mid')) allowedTypes.push('mid');
    if (ckWeight > 0) allowedTypes.push('final');
  }

  return {
    allowedTypes,
    hasGkScore,
    hasCkScore,
    scheduledTypes: [...scheduled],
    isEligible: allowedTypes.length > 0,
  };
};

// Nhãn hiển thị cho các loại thi còn lại, VD "Giữa kỳ • Cuối kỳ".
export const getReminderTypeSummary = (allowedTypes = []) =>
  allowedTypes.map((key) => (key === 'mid' ? 'Giữa kỳ' : 'Cuối kỳ')).join(' • ');
