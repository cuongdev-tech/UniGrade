// Model bảng grade_forecasts — kết quả dự báo điểm (What-if) cho một lần học.
// Mỗi lần học có tối đa 1 bản ghi, id = fc_<enrollment_id> nên ghi lại là upsert.
import { firstValue, numericValue } from './utils';
import { buildForecastId } from '../services/courseIdService';

export const FIELDS = [
  'forecast_id',
  'user_id',
  'enrollment_id',
  'target_grade',
  'target_score_10',
  'required_final_score',
  'projected_gpa_4',
  'updated_at',
];

export const ALIASES = {
  enrollment_id: ['enrollment_id', 'course_id'],
  target_grade: ['target_grade', 'target_letter', 'target'],
  target_score_10: ['target_score_10', 'target_ten', 'target_score'],
  required_final_score: ['required_final_score', 'required_score', 'required_final'],
  projected_gpa_4: ['projected_gpa_4', 'projected_gpa', 'forecast_gpa'],
};

export const getForecastDocumentId = buildForecastId;

export const fromFirestore = (snapshot) => {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    enrollmentId: firstValue(data, ALIASES.enrollment_id, ''),
    targetGrade: firstValue(data, ALIASES.target_grade, ''),
    targetScore10: numericValue(firstValue(data, ALIASES.target_score_10, 0)),
    requiredFinalScore: numericValue(firstValue(data, ALIASES.required_final_score, 0)),
    projectedGpa4: numericValue(firstValue(data, ALIASES.projected_gpa_4, 0)),
  };
};

export const toFirestore = (forecastId, uid, forecast) => ({
  forecast_id: forecastId,
  user_id: uid,
  enrollment_id: forecast.enrollmentId,
  target_grade: forecast.targetGrade,
  target_score_10: numericValue(forecast.targetScore10, 0),
  // null = không đủ điểm CC/GK để dự báo hoặc cần trên 10 điểm.
  required_final_score: forecast.requiredFinalScore === null
    ? null
    : Number(numericValue(forecast.requiredFinalScore, 0).toFixed(2)),
  projected_gpa_4: Number(numericValue(forecast.projectedGpa4, 0).toFixed(2)),
  updated_at: new Date().toISOString(),
});
