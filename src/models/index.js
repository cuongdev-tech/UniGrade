// Điểm vào của tầng Model (MVVM).
// Mỗi model chịu trách nhiệm duy nhất: chuyển đổi giữa document Firestore
// và object mà giao diện đang dùng.
import * as userModel from './userModel';
import * as academicProfileModel from './academicProfileModel';
import * as semesterModel from './semesterModel';
import * as courseCatalogModel from './courseCatalogModel';
import * as courseModel from './courseModel';
import * as gradeForecastModel from './gradeForecastModel';
import * as reminderModel from './reminderModel';

export {
  userModel,
  academicProfileModel,
  semesterModel,
  courseCatalogModel,
  courseModel,
  gradeForecastModel,
  reminderModel,
};
export { firstValue, numericValue } from './utils';

export default {
  userModel,
  academicProfileModel,
  semesterModel,
  courseCatalogModel,
  courseModel,
  gradeForecastModel,
  reminderModel,
};
