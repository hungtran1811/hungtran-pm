export const APP_NAME = 'hungtranPM';
export const EMPTY_VALUE = 'Chưa có';
export const DEFAULT_FALLBACK_ERROR = 'Đã có lỗi xảy ra. Vui lòng thử lại.';

export const VALIDATION_MESSAGES = {
  classRequired: 'Vui lòng chọn mã lớp.',
  studentRequired: 'Vui lòng chọn học sinh.',
  classCodeMinLength: 'Mã lớp cần tối thiểu 3 ký tự.',
  classNameMinLength: 'Tên lớp cần tối thiểu 3 ký tự.',
  fullNameMinLength: 'Họ tên cần tối thiểu 3 ký tự.',
  projectNameMinLength: 'Tên dự án cần tối thiểu 3 ký tự.',
  doneTodayMinLength: 'Mục "Đã làm được gì" cần tối thiểu 10 ký tự.',
  nextGoalMinLength: 'Mục "Mục tiêu buổi tiếp theo" cần tối thiểu 10 ký tự.',
  stageInvalid: 'Vui lòng chọn giai đoạn hợp lệ.',
  statusInvalid: 'Vui lòng chọn trạng thái hợp lệ.',
  progressRange: 'Phần trăm tiến độ phải nằm trong khoảng 0-100.',
  supportNeedsDetails: 'Khi cần hỗ trợ, vui lòng mô tả khó khăn tối thiểu 15 ký tự.',
  completedNeeds100: 'Trạng thái Hoàn thành chỉ hợp lệ khi tiến độ bằng 100%.',
  invalidDateRange: 'Ngày kết thúc phải sau hoặc trùng ngày bắt đầu.',
};

export const FIREBASE_ERROR_MESSAGES = {
  internal: 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.',
  unavailable: 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  'permission-denied': 'Bạn không có quyền thực hiện thao tác này.',
  'not-found': 'Không tìm thấy dữ liệu phù hợp.',
  'failed-precondition': 'Dữ liệu hiện không ở trạng thái cho phép để thực hiện thao tác này.',
  'invalid-argument': 'Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
  unauthenticated: 'Vui lòng đăng nhập để tiếp tục.',
  cancelled: 'Thao tác đã bị hủy.',
  'already-exists': 'Dữ liệu này đã tồn tại.',
  'resource-exhausted': 'Hệ thống đang quá tải. Vui lòng thử lại sau.',
  'functions/internal': 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.',
  'functions/unavailable': 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.',
  'functions/permission-denied': 'Bạn không có quyền thực hiện thao tác này.',
  'functions/not-found': 'Không tìm thấy dữ liệu phù hợp.',
  'functions/failed-precondition': 'Dữ liệu hiện không ở trạng thái cho phép để thực hiện thao tác này.',
  'functions/invalid-argument': 'Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
  'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.',
  'auth/cancelled-popup-request': 'Yêu cầu đăng nhập đã bị hủy.',
  'auth/popup-blocked': 'Trình duyệt đang chặn cửa sổ đăng nhập. Vui lòng cho phép pop-up và thử lại.',
  'auth/network-request-failed': 'Không thể kết nối để đăng nhập. Vui lòng kiểm tra mạng và thử lại.',
  'auth/unauthorized-domain': 'Domain hiện tại chưa được thêm vào Authorized domains trong Firebase Authentication. Hãy thêm localhost và domain deploy của bạn.',
  'auth/operation-not-allowed': 'Google Sign-In chưa được bật trong Firebase Authentication. Hãy bật provider Google trước khi đăng nhập.',
  'auth/configuration-not-found': 'Firebase Authentication chưa được cấu hình đầy đủ cho đăng nhập Google.',
  'auth/invalid-api-key': 'Firebase config hiện tại không hợp lệ. Kiểm tra lại VITE_FIREBASE_API_KEY và project đang dùng.',
};
