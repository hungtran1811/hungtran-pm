import { getProjectStageChecklist } from './project-stage-guide.js';

function createLessons(programId, topicTitles, programLabel) {
  return topicTitles.map((title, index) => {
    const sessionNumber = index + 1;

    return {
      id: `${programId}-session-${sessionNumber}`,
      sessionNumber,
      title,
      summary: `Buổi ${sessionNumber} tập trung vào ${title.toLowerCase()} để học sinh nắm chắc kiến thức trước khi làm bài lớn.`,
      keyPoints: [
        `Hiểu mục tiêu chính của phần ${title.toLowerCase()}.`,
        'Biết cách áp dụng kiến thức vào sản phẩm hoặc bài tập thực hành.',
        'Ghi lại lỗi thường gặp để xem lại ở các buổi sau.',
      ],
      practiceTask: `Hoàn thành một bài luyện tập ngắn thuộc ${programLabel} và chuẩn bị sản phẩm nhỏ liên quan đến ${title.toLowerCase()}.`,
      reviewLinks: [
        'Slide bài học trên lớp',
        'Video ghi lại thao tác mẫu',
        'Bài tập thực hành về nhà',
      ],
      teacherNote: 'Có thể chỉnh ví dụ minh họa và bài tập tùy theo tốc độ tiếp thu của lớp.',
      archived: false,
    };
  });
}

function createExamChecklist(programLabel) {
  return [
    {
      id: `${programLabel}-exam-1`,
      order: 1,
      title: 'Ôn lại toàn bộ kiến thức trọng tâm',
      description: 'Tổng hợp lại các buổi đã học, đặc biệt là phần dễ nhầm hoặc hay quên.',
      archived: false,
    },
    {
      id: `${programLabel}-exam-2`,
      order: 2,
      title: 'Làm bài luyện tập',
      description: 'Làm lại các dạng bài mẫu để kiểm tra xem đã hiểu kiến thức đến đâu.',
      archived: false,
    },
    {
      id: `${programLabel}-exam-3`,
      order: 3,
      title: 'Rà lại lỗi thường gặp',
      description: 'Ghi chú các lỗi sai hay xuất hiện và cách sửa để tránh lặp lại khi kiểm tra.',
      archived: false,
    },
    {
      id: `${programLabel}-exam-4`,
      order: 4,
      title: 'Sẵn sàng cho bài kiểm tra cuối khóa',
      description: 'Chuẩn bị tâm lý, thời gian và cách làm bài gọn gàng, rõ ràng.',
      archived: false,
    },
  ];
}

export const DEMO_TOTAL_SESSION_COUNT = 14;

const PROGRAM_DEFINITIONS = [
  {
    id: 'scratch-basic',
    name: 'Scratch Basic',
    subject: 'Scratch',
    level: 'Basic',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Làm quen tư duy lập trình bằng kéo thả và xây dựng trò chơi, câu chuyện đơn giản.',
    lessonTopics: [
      'Làm quen giao diện Scratch',
      'Khối lệnh chuyển động và âm thanh',
      'Sự kiện và điều khiển nhân vật',
      'Biến số và điểm số',
      'Điều kiện và vòng lặp',
      'Tạo mini game có luật chơi',
      'Thiết kế màn chơi và thử nghiệm',
      'Ghép hoàn chỉnh dự án mẫu',
    ],
  },
  {
    id: 'scratch-advanced',
    name: 'Scratch Advanced',
    subject: 'Scratch',
    level: 'Advanced',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Phát triển dự án Scratch có nhiều màn chơi hơn, có điểm số, luật chơi và tương tác rõ ràng hơn.',
    lessonTopics: [
      'Ôn nhanh Scratch và nâng cấp tư duy làm game',
      'Thiết kế nhiều nhân vật và vai trò riêng',
      'Biến số, trạng thái và hệ thống điểm',
      'Nhiều màn chơi và chuyển cảnh',
      'Điều kiện thắng thua nâng cao',
      'Hiệu ứng, âm thanh và trải nghiệm người chơi',
      'Kiểm thử và cân bằng dự án',
      'Ghép dự án mẫu để chuẩn bị sản phẩm cuối khóa',
    ],
  },
  {
    id: 'scratch-intensive',
    name: 'Scratch Intensive',
    subject: 'Scratch',
    level: 'Intensive',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Lộ trình Scratch tăng tốc, tập trung vào tư duy làm sản phẩm hoàn chỉnh sau giai đoạn học kiến thức chính.',
    lessonTopics: [
      'Làm chủ giao diện và quy trình tạo dự án Scratch',
      'Nhân vật, nền và chuyển động có mục đích',
      'Biến, điểm và hệ thống nhiệm vụ',
      'Sự kiện, điều kiện và vòng lặp trong game',
      'Nhiều màn chơi và nhịp độ game',
      'Âm thanh, hiệu ứng và phản hồi người chơi',
      'Sửa lỗi và tối ưu dự án',
      'Chuẩn bị sản phẩm Scratch cuối khóa',
    ],
  },
  {
    id: 'gamemaker-basic',
    name: 'Gamemaker Basic',
    subject: 'Gamemaker',
    level: 'Basic',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Học nền tảng thiết kế game đơn giản, nhân vật, luật chơi và trải nghiệm người dùng.',
    lessonTopics: [
      'Ý tưởng game và luật chơi',
      'Thiết kế nhân vật và bối cảnh',
      'Điều khiển người chơi',
      'Điểm số và vật phẩm',
      'Va chạm và điều kiện thắng thua',
      'Âm thanh và hiệu ứng',
      'Cân bằng game và thử chơi',
      'Hoàn thiện game mẫu',
    ],
  },
  {
    id: 'gamemaker-advanced',
    name: 'Gamemaker Advanced',
    subject: 'Gamemaker',
    level: 'Advanced',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Làm game với Gamemaker ở mức nâng cao hơn, tập trung vào cơ chế chơi, giao diện và cấu trúc dự án rõ ràng.',
    lessonTopics: [
      'Cấu trúc dự án và tài nguyên trong Gamemaker',
      'Tạo nhân vật, vật thể và tương tác chính',
      'Điều khiển, va chạm và phản hồi',
      'Hệ thống điểm, máu hoặc nhiệm vụ',
      'Phòng chơi, màn chơi và chuyển cảnh',
      'Giao diện người chơi và âm thanh',
      'Kiểm thử, sửa lỗi và tối ưu',
      'Ghép game mẫu hoàn chỉnh để chuẩn bị dự án cuối khóa',
    ],
  },
  {
    id: 'gamemaker-intensive',
    name: 'Gamemaker Intensive',
    subject: 'Gamemaker',
    level: 'Intensive',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Lộ trình Gamemaker tăng tốc, ưu tiên làm chủ các phần cốt lõi để nhanh chóng bước vào dự án cuối khóa.',
    lessonTopics: [
      'Làm quen nhanh với giao diện và quy trình dựng game',
      'Nhân vật, điều khiển và quy tắc cơ bản',
      'Va chạm và xử lý tình huống trong game',
      'Màn chơi, vật phẩm và thử thách',
      'Điểm số, thanh máu hoặc tiến trình',
      'Âm thanh, hiệu ứng và UX trong game',
      'Kiểm thử và sửa lỗi dự án',
      'Chuẩn bị game cuối khóa',
    ],
  },
  {
    id: 'web-basic',
    name: 'Web Basic',
    subject: 'Web',
    level: 'Basic',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Làm quen với xây dựng website cơ bản, từ nội dung, bố cục đến tương tác đơn giản.',
    lessonTopics: [
      'Làm quen với cấu trúc một trang web',
      'Tiêu đề, đoạn văn, hình ảnh và liên kết',
      'Bố cục cơ bản với CSS',
      'Màu sắc, font chữ và khoảng cách',
      'Tạo menu và các phần nội dung chính',
      'Tương tác đơn giản với JavaScript',
      'Responsive cơ bản cho điện thoại',
      'Ghép thành website mẫu hoàn chỉnh',
    ],
  },
  {
    id: 'web-advanced',
    name: 'Web Advanced',
    subject: 'Web',
    level: 'Advanced',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Phát triển website có cấu trúc rõ, có thành phần tương tác và dữ liệu cơ bản.',
    lessonTopics: [
      'Tổ chức cấu trúc một website',
      'Bố cục nâng cao với CSS',
      'Responsive cho điện thoại và laptop',
      'Tương tác bằng JavaScript',
      'Làm việc với form và dữ liệu nhập',
      'Hiển thị danh sách và bộ lọc',
      'Tối ưu giao diện người dùng',
      'Ghép thành website mẫu hoàn chỉnh',
    ],
  },
  {
    id: 'web-intensive',
    name: 'Web Intensive',
    subject: 'Web',
    level: 'Intensive',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Học nhanh và sâu hơn về UI, tương tác và cách tổ chức website theo dự án.',
    lessonTopics: [
      'Khung dự án web và quy trình làm bài',
      'Thiết kế giao diện có chủ đích',
      'Responsive và trải nghiệm người dùng',
      'Tương tác nâng cao bằng JavaScript',
      'Xử lý dữ liệu và danh sách',
      'Tối ưu luồng thao tác trên web',
      'Kiểm thử và sửa lỗi giao diện',
      'Chuẩn bị dự án cuối khóa',
    ],
  },
  {
    id: 'python-app-basic',
    name: 'Python App Basic',
    subject: 'Python App',
    level: 'Basic',
    knowledgePhaseEndSession: 13,
    finalMode: 'exam',
    description: 'Học nền tảng Python theo lộ trình dài hơn để chuẩn bị cho bài kiểm tra cuối khóa.',
    lessonTopics: [
      'Làm quen với Python và câu lệnh đầu tiên',
      'Biến và kiểu dữ liệu cơ bản',
      'Nhập xuất dữ liệu',
      'Điều kiện if else',
      'Vòng lặp for và while',
      'Danh sách list',
      'Xử lý chuỗi',
      'Hàm cơ bản',
      'Tách bài toán thành bước nhỏ',
      'Làm việc với dữ liệu nhiều dòng',
      'Sửa lỗi và đọc thông báo lỗi',
      'Ôn tập dạng bài tổng hợp',
      'Luyện đề kiểm tra cuối khóa',
    ],
  },
  {
    id: 'python-app-advanced',
    name: 'Python App Advanced',
    subject: 'Python App',
    level: 'Advanced',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Học đủ phần nền tảng nâng cao rồi chuyển sang xây dựng sản phẩm Python cuối khóa.',
    lessonTopics: [
      'Thiết kế cấu trúc chương trình',
      'Hàm và chia nhỏ chức năng',
      'Làm việc với list và dict',
      'Xử lý dữ liệu người dùng nhập',
      'Điều kiện và nhánh xử lý nâng cao',
      'Kết hợp nhiều chức năng trong một app',
      'Kiểm tra lỗi và tối ưu luồng sử dụng',
      'Ghép thành app mẫu để chuẩn bị sản phẩm',
    ],
  },
  {
    id: 'python-intensive',
    name: 'Python Intensive',
    subject: 'Python App',
    level: 'Intensive',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Lộ trình Python tăng tốc, ưu tiên xây sản phẩm nhỏ sau giai đoạn học kiến thức cốt lõi.',
    lessonTopics: [
      'Tư duy giải bài toán với Python',
      'Biến, điều kiện và vòng lặp',
      'Tổ chức code thành hàm',
      'Làm việc với danh sách và dữ liệu',
      'Xây menu và luồng sử dụng app',
      'Ghép các phần thành chương trình hoàn chỉnh',
      'Kiểm tra lỗi và cải thiện trải nghiệm',
      'Chuẩn bị app cuối khóa',
    ],
  },
  {
    id: 'computer-science-basic',
    name: 'Computer Science Basic',
    subject: 'Computer Science',
    level: 'Basic',
    knowledgePhaseEndSession: 13,
    finalMode: 'exam',
    description: 'Học nền tảng khoa học máy tính theo hướng kiến thức và bài kiểm tra cuối khóa.',
    lessonTopics: [
      'Máy tính hoạt động như thế nào',
      'Dữ liệu và biểu diễn thông tin',
      'Thuật toán cơ bản',
      'Sơ đồ khối và cách mô tả quy trình',
      'Biến và trạng thái',
      'Điều kiện và lựa chọn',
      'Lặp lại và tối ưu bước làm',
      'Danh sách và nhóm dữ liệu',
      'Tư duy chia bài toán',
      'Phân tích lỗi thường gặp',
      'Ứng dụng kiến thức vào bài toán gần gũi',
      'Ôn tập dạng bài tổng hợp',
      'Luyện bài kiểm tra cuối khóa',
    ],
  },
  {
    id: 'computer-science-advanced',
    name: 'Computer Science Advanced',
    subject: 'Computer Science',
    level: 'Advanced',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Học phần cốt lõi của khoa học máy tính rồi chuyển sang xây dựng sản phẩm hoặc bài trình bày.',
    lessonTopics: [
      'Phân tích bài toán và đầu ra',
      'Thiết kế thuật toán rõ ràng',
      'Tối ưu bước xử lý',
      'Dữ liệu và cấu trúc thông tin',
      'Mô phỏng hệ thống đơn giản',
      'Kết nối kiến thức với sản phẩm',
      'Kiểm thử ý tưởng và sửa logic',
      'Chuẩn bị bài cuối khóa',
    ],
  },
  {
    id: 'computer-science-intensive',
    name: 'Computer Science Intensive',
    subject: 'Computer Science',
    level: 'Intensive',
    knowledgePhaseEndSession: 8,
    finalMode: 'project',
    description: 'Lộ trình tăng tốc cho khoa học máy tính, tập trung vào tư duy và ứng dụng vào sản phẩm cuối khóa.',
    lessonTopics: [
      'Tư duy thuật toán cốt lõi',
      'Phân rã bài toán',
      'Điều kiện và vòng lặp trong tư duy giải quyết vấn đề',
      'Dữ liệu và cách tổ chức thông tin',
      'Mô phỏng quy trình có nhiều bước',
      'Nối các phần thành một hệ thống nhỏ',
      'Đánh giá và sửa lỗi logic',
      'Chuẩn bị sản phẩm hoặc bài trình bày cuối khóa',
    ],
  },
];

export const DEMO_CURRICULUM_PROGRAMS = PROGRAM_DEFINITIONS.map((program) => ({
  id: program.id,
  name: program.name,
  subject: program.subject,
  level: program.level,
  knowledgePhaseEndSession: program.knowledgePhaseEndSession,
  totalSessionCount: DEMO_TOTAL_SESSION_COUNT,
  finalMode: program.finalMode,
  description: program.description,
  lessonCount: program.lessonTopics.length,
}));

export const DEMO_LESSONS_BY_PROGRAM = Object.fromEntries(
  PROGRAM_DEFINITIONS.map((program) => [
    program.id,
    createLessons(program.id, program.lessonTopics, program.name),
  ]),
);

export const DEMO_FINAL_CHECKLIST_BY_PROGRAM = Object.fromEntries(
  PROGRAM_DEFINITIONS.map((program) => [
    program.id,
    program.finalMode === 'project' ? getProjectStageChecklist(program.id) : createExamChecklist(program.id),
  ]),
);

export function getDemoProgram(programId) {
  return DEMO_CURRICULUM_PROGRAMS.find((program) => program.id === programId) || DEMO_CURRICULUM_PROGRAMS[0] || null;
}

export function getDemoLessons(programId) {
  return DEMO_LESSONS_BY_PROGRAM[programId] || [];
}

export function getDemoFinalChecklist(programId) {
  return DEMO_FINAL_CHECKLIST_BY_PROGRAM[programId] || [];
}
