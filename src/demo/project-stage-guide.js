import { STAGES } from '../constants/stages.js';

const STAGE_KEYS = [
  'idea',
  'planning',
  'design',
  'build',
  'testing',
  'polish',
  'presentation',
];

const PROJECT_STAGE_CONTENT = [
  {
    description:
      'Chốt rõ sản phẩm sẽ làm gì, dành cho ai và sản phẩm cần có những phần chính nào.',
    studentGuide:
      'Hãy tự hỏi: sản phẩm của em giải quyết vấn đề gì, người dùng là ai và sản phẩm cần có 2-3 phần quan trọng nào.',
    exampleOutput:
      'Ví dụ: Website giới thiệu câu lạc bộ, có trang chủ, trang hoạt động và form đăng ký tham gia.',
  },
  {
    description:
      'Chia việc theo từng buổi, xác định phần nào làm trước, phần nào làm sau và chuẩn bị tài nguyên cần thiết.',
    studentGuide:
      'Em nên ghi ra các việc nhỏ như làm giao diện, thêm dữ liệu, làm chức năng, kiểm tra lỗi để biết mình đang ở bước nào.',
    exampleOutput:
      'Ví dụ: Buổi 9 làm bố cục, buổi 10 thêm nội dung, buổi 11 làm chức năng tìm kiếm.',
  },
  {
    description:
      'Phác thảo giao diện, nhân vật, màn hình hoặc luồng sử dụng để khi bắt tay làm sẽ rõ ràng hơn.',
    studentGuide:
      'Nếu em chưa code ngay được, hãy vẽ sơ đồ màn hình, phác thảo nhân vật hoặc mô tả luồng sử dụng trước.',
    exampleOutput:
      'Ví dụ: Vẽ bố cục trang chủ, trang chi tiết và màn hình đăng nhập trên giấy hoặc Figma.',
  },
  {
    description:
      'Bắt đầu làm các phần chính của sản phẩm như chức năng, tương tác, nội dung hoặc cách sản phẩm hoạt động.',
    studentGuide:
      'Em đang ở giai đoạn này khi đã bắt đầu dựng sản phẩm thật và mỗi buổi đều thêm được chức năng hoặc nội dung mới.',
    exampleOutput:
      'Ví dụ: Thêm đăng nhập, lưu dữ liệu người dùng, điều khiển nhân vật hoặc hoàn thiện các màn hình chính.',
  },
  {
    description:
      'Chạy thử sản phẩm, phát hiện lỗi hoặc điểm chưa ổn và sửa để sản phẩm hoạt động tốt hơn.',
    studentGuide:
      'Nếu em đang thử nhiều lần, ghi ra lỗi và sửa từng phần để sản phẩm bớt lỗi hơn, đó là lúc em ở giai đoạn kiểm thử.',
    exampleOutput:
      'Ví dụ: Sửa lỗi nút không bấm được, trang bị lệch trên điện thoại hoặc game chưa tính điểm đúng.',
  },
  {
    description:
      'Chỉnh lại giao diện, nội dung, chi tiết nhỏ và làm cho sản phẩm ổn định, dễ dùng hơn.',
    studentGuide:
      'Khi chức năng chính đã xong, em tập trung làm đẹp hơn, rõ hơn, mượt hơn thì đó là giai đoạn hoàn thiện.',
    exampleOutput:
      'Ví dụ: Sửa màu sắc, căn lề, thay hình đẹp hơn, rút gọn nội dung và tối ưu thao tác người dùng.',
  },
  {
    description:
      'Chuẩn bị cách giới thiệu sản phẩm, luyện trình bày và sẵn sàng nộp hoặc demo cuối khóa.',
    studentGuide:
      'Em nên chuẩn bị bài nói ngắn: sản phẩm làm gì, có điểm mạnh gì, em đã gặp khó khăn gì và đã vượt qua ra sao.',
    exampleOutput:
      'Ví dụ: Chuẩn bị 3-5 ý chính để demo sản phẩm và sẵn sàng trả lời câu hỏi từ giáo viên hoặc phụ huynh.',
  },
];

export function getProjectStageChecklist(scopeKey = 'project') {
  return STAGES.map((stage, index) => ({
    id: `${scopeKey}-project-stage-${index + 1}`,
    stageKey: STAGE_KEYS[index] || `stage-${index + 1}`,
    order: index + 1,
    title: stage,
    description: PROJECT_STAGE_CONTENT[index]?.description || '',
    studentGuide: PROJECT_STAGE_CONTENT[index]?.studentGuide || '',
    exampleOutput: PROJECT_STAGE_CONTENT[index]?.exampleOutput || '',
  }));
}

export function getProjectFinalRangeLabel(program) {
  const start = Number(program?.knowledgePhaseEndSession || 1) + 1;
  const end = Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || start);
  return `Buổi ${start}-${end}`;
}
