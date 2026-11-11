// Model bảng semesters — ánh xạ giữa document Firestore và object dùng trong app.
import { firstValue } from './utils';

// Tên field theo ERD (8 field).
export const FIELDS = [
  'semester_id',
  'user_id',
  'semester_name',
  'academic_year',
  'status',
  'semester_gpa_4',
  'semester_avg_10',
  'earned_credits',
];

// Tên cũ đọc được để tương thích ngược với dữ liệu đã có.
export const ALIASES = {
  semester_name: ['semester_name', 'name', 'semesterName'],
  academic_year: ['academic_year', 'school_year', 'year'],
  status: ['status', 'semester_status'],
};

export const normalizeYear = (value) => String(value || '').replace(/\s*[-–]\s*/, ' - ');

export const normalizeStatus = (value) => {
  if (value === 'learning' || value === 'Đang học') return 'Đang học';
  if (value === 'completed' || value === 'Hoàn thành') return 'Hoàn thành';
  return value || 'Đang học';
};

export const fromFirestore = (snapshot) => {
  const data = snapshot.data();
  const rawName = firstValue(data, ALIASES.semester_name, 'Học kỳ');
  const year = normalizeYear(firstValue(data, ALIASES.academic_year, ''));
  return {
    id: snapshot.id,
    rawName,
    year,
    name: year ? `${rawName} (${year})` : rawName,
    status: normalizeStatus(firstValue(data, ALIASES.status, 'learning')),
  };
};

// Ghi học kỳ mới. Giữ nguyên giá trị đầu vào (không chuẩn hóa) như code cũ.
// status: 'Đang học' -> learning, 'Hoàn thành' -> completed.
export const toFirestore = (semesterId, uid, semester) => ({
  semester_id: semesterId,
  user_id: uid,
  semester_name: semester.rawName,
  academic_year: semester.year,
  status: semester.status === 'Hoàn thành' ? 'completed' : 'learning',
  semester_gpa_4: null,
  semester_avg_10: null,
  earned_credits: 0,
});

export const toStatusUpdate = () => ({ status: 'completed' });
