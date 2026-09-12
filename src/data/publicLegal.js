export const OAUTH_APP_NAME = 'HungTranPM';
export const SUPPORT_EMAIL = 'hungtran00.nt@gmail.com';
export const PRIVACY_UPDATED_ISO = '2026-09-12';
export const PRIVACY_UPDATED_LABEL = '12 September 2026 / 12/09/2026';

export const HOME_PURPOSE_EN = [
  'HungTranPM is a classroom web app for one teacher who runs programming classes.',
  'Students join with a class code. They do not create a Google account login and they do not grant Google Drive access. They can view lessons, send progress reports, and upload homework files.',
  'The teacher signs in to the admin area to manage classes, review reports, and open submitted files. Homework files are stored in the teacher’s own Google Drive after the teacher authorizes Drive access for this app.',
];

export const HOME_PURPOSE_VI = [
  'HungTranPM là webapp quản lý lớp học lập trình cho một giáo viên.',
  'Học sinh vào lớp bằng mã lớp — không đăng nhập Google, không cấp quyền Drive. Trong lớp có thể xem bài giảng, gửi báo cáo tiến độ và nộp file bài.',
  'Giáo viên đăng nhập khu quản trị để quản lý lớp, xem báo cáo và mở file. File bài nộp được lưu trên Google Drive của giáo viên sau khi giáo viên ủy quyền Drive cho ứng dụng này.',
];

export const PRIVACY_SECTIONS_EN = [
  {
    title: 'Who we are',
    paragraphs: [
      'HungTranPM (also shown as hungtranPM) is a private classroom tool operated by the teacher who created this site. It is not a consumer social app and is not offered to the general public as a product marketplace.',
      `Contact: ${SUPPORT_EMAIL}`,
    ],
  },
  {
    title: 'What the app does',
    paragraphs: [
      'The app helps a teacher run programming classes: class codes, student rosters, lessons, progress reports, and homework file submissions.',
      'Students enter a class code and pick their name from the class roster. Teachers use the admin area to review work and open files.',
    ],
  },
  {
    title: 'Google user data we access',
    paragraphs: [
      'The only Google account that grants OAuth access is the teacher’s account. Students never sign in with Google and the app never requests access to a student’s Gmail, Drive, Contacts, Calendar, or other Google data.',
      'For the teacher’s authorized account, the app requests the Google Drive scope https://www.googleapis.com/auth/drive so it can create folders and files used for homework submissions.',
      'Google user data used by the app includes: the OAuth grant for that teacher account; folders the app creates (class / student / lesson); and files the app uploads (student homework) plus their Drive file metadata (name, size, id, parent folder, modified time) needed to confirm an upload and let the teacher open the file.',
      'The app does not read Gmail, does not send email on the teacher’s behalf, and does not use Drive data to build advertising profiles.',
    ],
  },
  {
    title: 'How we use Google user data',
    paragraphs: [
      'Drive access is used only to store and organize student homework in the teacher’s Drive (typically under a root folder such as “HungTranPM - Submissions”), verify that an upload finished, and allow the teacher to open those files from the admin reports screen.',
      'OAuth tokens stay on the server (Netlify Functions). They are not sent to student browsers.',
      'HungTranPM’s use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.',
    ],
  },
  {
    title: 'Other data we collect',
    paragraphs: [
      'Student portal: class code and the selected student name may be stored in the browser (local storage) so the student does not have to re-enter them every visit.',
      'Progress reports and submission metadata (class, student name, lesson, file name, time) are stored in Google Cloud Firestore.',
      'Teacher admin sign-in uses Firebase Authentication (email/password or Google sign-in). Admin Google sign-in only identifies the teacher on this app. It is separate from the Drive OAuth grant used to store homework files.',
      'Lesson images uploaded by the teacher may be stored on Cloudinary. That is teaching material, not student Google data.',
    ],
  },
  {
    title: 'Storage, sharing, and processors',
    paragraphs: [
      'We do not sell personal data. We do not share Google user data with third parties for advertising, credit, or data-broker use.',
      'Infrastructure processors: Google (Firebase Authentication, Cloud Firestore, Google Drive), Netlify (website hosting and server functions), and Cloudinary (teacher-uploaded lesson images).',
      'Homework file contents live in the teacher’s Google Drive. The teacher controls sharing of those Drive files.',
    ],
  },
  {
    title: 'Retention and your choices',
    paragraphs: [
      'Homework files remain in the teacher’s Drive until the teacher deletes them. Firestore records remain until the teacher deletes them or archives the class.',
      'The teacher can revoke Drive access at any time in their Google Account permissions. After revoke, new Drive uploads stop until the teacher authorizes the app again.',
      'Students can clear browser storage to remove the locally saved class code and name.',
    ],
  },
  {
    title: 'Children and classroom use',
    paragraphs: [
      'The app is used in a classroom. Students do not sign in with Google. The teacher is responsible for the class roster and for files stored in the teacher’s Drive.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [
      `Questions about this policy or Google user data: ${SUPPORT_EMAIL}`,
    ],
  },
];

export const PRIVACY_SECTIONS_VI = [
  {
    title: 'Chúng tôi là ai',
    paragraphs: [
      'HungTranPM (còn gọi hungtranPM) là công cụ lớp học do giáo viên vận hành, không phải mạng xã hội hay chợ ứng dụng đại chúng.',
      `Liên hệ: ${SUPPORT_EMAIL}`,
    ],
  },
  {
    title: 'Ứng dụng làm gì',
    paragraphs: [
      'Ứng dụng giúp một giáo viên quản lý lớp lập trình: mã lớp, danh sách học sinh, bài giảng, báo cáo tiến độ và nộp file bài.',
      'Học sinh nhập mã lớp và chọn tên trong roster. Giáo viên dùng khu quản trị để xem bài và mở file.',
    ],
  },
  {
    title: 'Dữ liệu Google mà ứng dụng truy cập',
    paragraphs: [
      'Chỉ tài khoản Google của giáo viên ủy quyền OAuth. Học sinh không đăng nhập Google; ứng dụng không xin Gmail, Drive, Contacts hay Calendar của học sinh.',
      'Với tài khoản giáo viên, ứng dụng xin quyền Drive (https://www.googleapis.com/auth/drive) để tạo thư mục và file bài nộp.',
      'Dữ liệu Google được dùng gồm: quyền OAuth của giáo viên; thư mục do app tạo (lớp / học sinh / buổi); file bài nộp và metadata Drive (tên, dung lượng, id, thư mục cha, thời điểm) để xác nhận upload và để giáo viên mở file.',
      'Ứng dụng không đọc Gmail, không gửi email hộ, không dùng dữ liệu Drive để quảng cáo.',
    ],
  },
  {
    title: 'Cách dùng dữ liệu Google',
    paragraphs: [
      'Quyền Drive chỉ để lưu và sắp xếp bài nộp trên Drive của giáo viên, xác nhận upload xong, và cho giáo viên mở file từ trang báo cáo quản trị.',
      'Token OAuth chỉ chạy trên máy chủ (Netlify Functions), không đưa lên trình duyệt học sinh.',
      'Việc dùng và chuyển thông tin nhận từ Google API của HungTranPM tuân thủ Google API Services User Data Policy, gồm yêu cầu Limited Use.',
    ],
  },
  {
    title: 'Dữ liệu khác',
    paragraphs: [
      'Cổng học sinh có thể lưu mã lớp và tên đã chọn trên trình duyệt.',
      'Báo cáo tiến độ và metadata bài nộp (lớp, tên, buổi, tên file, thời điểm) lưu trên Firestore.',
      'Đăng nhập quản trị dùng Firebase Authentication (email/mật khẩu hoặc Google). Đăng nhập admin chỉ định danh giáo viên trên app, tách với quyền Drive để lưu file.',
      'Ảnh bài giảng do giáo viên tải có thể nằm trên Cloudinary — đó là học liệu, không phải dữ liệu Google của học sinh.',
    ],
  },
  {
    title: 'Lưu trữ và chia sẻ',
    paragraphs: [
      'Không bán dữ liệu. Không chia dữ liệu Google cho bên thứ ba để quảng cáo, tín dụng hay môi giới dữ liệu.',
      'Hạ tầng: Google (Firebase Auth, Firestore, Drive), Netlify (hosting và functions), Cloudinary (ảnh bài giảng).',
      'Nội dung file bài nộp nằm trên Drive giáo viên. Giáo viên tự quyết định chia sẻ file đó.',
    ],
  },
  {
    title: 'Thời gian lưu và lựa chọn của bạn',
    paragraphs: [
      'File giữ trên Drive đến khi giáo viên xóa. Bản ghi Firestore giữ đến khi giáo viên xóa hoặc lưu trữ lớp.',
      'Giáo viên có thể thu hồi quyền Drive trong phần quyền tài khoản Google. Sau đó không nộp file mới được cho đến khi ủy quyền lại.',
      'Học sinh có thể xóa dữ liệu trình duyệt để bỏ mã lớp và tên đã lưu.',
    ],
  },
  {
    title: 'Trẻ em và lớp học',
    paragraphs: [
      'Ứng dụng dùng trong lớp. Học sinh không đăng nhập Google. Giáo viên chịu trách nhiệm roster và file trên Drive của mình.',
    ],
  },
  {
    title: 'Liên hệ',
    paragraphs: [
      `Thắc mắc về chính sách hoặc dữ liệu Google: ${SUPPORT_EMAIL}`,
    ],
  },
];
