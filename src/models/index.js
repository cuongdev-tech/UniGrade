// Điểm vào của tầng Model (MVVM).
// Mỗi model chịu trách nhiệm duy nhất: chuyển đổi giữa document Firestore
// và object mà giao diện đang dùng.
import * as userModel from './userModel';
import * as semesterModel from './semesterModel';
import * as courseModel from './courseModel';
import * as reminderModel from './reminderModel';

export { userModel, semesterModel, courseModel, reminderModel };
export { firstValue, numericValue } from './utils';

export default { userModel, semesterModel, courseModel, reminderModel };
