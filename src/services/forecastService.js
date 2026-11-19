// Tầng Service: dự báo điểm thi cuối kỳ (What-if).
// Quy tắc: trọng số CK dùng để dự báo = 100% - (CC + GK).
// Nhờ vậy môn CK 100% (CC/GK 0%) vẫn dự báo được, còn môn 50/50 chỉ cần điểm GK.
import { parseDecimalValue, parseGradeValue } from './gradeService';

export const getRemainingFinalWeight = (weights = {}) =>
  Math.max(0, 100 - (parseDecimalValue(weights.cc) ?? 0) - (parseDecimalValue(weights.gk) ?? 0));

// Trả về toàn bộ dữ liệu cần hiển thị cho màn Dự báo và Chi tiết nhắc thi.
export const getWhatIfForecast = ({ cc, gk, weights, targetTen }) => {
  const ccWeight = parseDecimalValue(weights?.cc) ?? 0;
  const gkWeight = parseDecimalValue(weights?.gk) ?? 0;
  const ckWeight = getRemainingFinalWeight(weights);
  const ccValue = parseGradeValue(cc);
  const gkValue = parseGradeValue(gk);

  // Cột trọng số 0% không bắt buộc có điểm.
  const hasCcScore = ccWeight === 0 || ccValue !== null;
  const hasGkScore = gkWeight === 0 || gkValue !== null;
  const hasEnoughComponents = ckWeight > 0 && hasCcScore && hasGkScore;

  const requiredScore = hasEnoughComponents
    ? (targetTen * 100 - (ccValue ?? 0) * ccWeight - (gkValue ?? 0) * gkWeight) / ckWeight
    : null;
  const isFeasible =
    requiredScore !== null && Number.isFinite(requiredScore) && requiredScore <= 10;

  return {
    ccWeight,
    gkWeight,
    ckWeight,
    ccValue,
    gkValue,
    hasEnoughComponents,
    requiredScore,
    isFeasible,
    isAlreadyEnough: requiredScore !== null && Number.isFinite(requiredScore) && requiredScore < 0,
  };
};
