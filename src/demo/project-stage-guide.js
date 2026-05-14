import { STAGES } from '../constants/stages.js';

const STAGE_KEYS = [
  'waterfall-analysis',
  'waterfall-design',
  'waterfall-implementation',
  'waterfall-testing',
  'waterfall-maintenance',
];

const PROJECT_STAGE_CONTENT = [
  {
    description:
      'Tìm hiểu vấn đề thực tế mà sản phẩm muốn giải quyết, người dùng là ai và vì sao họ cần sản phẩm này.',
    studentGuide:
      'Hãy tự hỏi: sản phẩm của em giúp ai, họ đang gặp khó khăn gì, nếu không có sản phẩm thì vấn đề đó bất tiện như thế nào.',
    exampleOutput:
      'Ví dụ: Học sinh hay quên thời khóa biểu, nên em làm app nhắc lịch học và việc cần chuẩn bị cho từng môn.',
  },
  {
    description:
      'Biến vấn đề đã phân tích thành giải pháp rõ ràng: màn hình, chức năng chính, dữ liệu cần có và cách người dùng thao tác.',
    studentGuide:
      'Hãy tự hỏi: người dùng sẽ bấm vào đâu, xem thông tin gì, nhập dữ liệu gì và sản phẩm cần có những phần nào để giải quyết vấn đề.',
    exampleOutput:
      'Ví dụ: Vẽ 3 màn hình: danh sách môn học, chi tiết việc cần làm và nút đánh dấu đã hoàn thành.',
  },
  {
    description:
      'Bắt đầu hiện thực hóa thiết kế thành sản phẩm thật bằng code, nội dung, giao diện, nhân vật, dữ liệu hoặc chức năng.',
    studentGuide:
      'Em đang ở bước này khi mỗi buổi đều tạo thêm được phần dùng được: giao diện mới, chức năng mới, dữ liệu mới hoặc tương tác mới.',
    exampleOutput:
      'Ví dụ: Làm được màn hình thêm việc cần làm, lưu được dữ liệu và hiển thị danh sách việc theo từng ngày.',
  },
  {
    description:
      'Chạy thử sản phẩm như một người dùng thật để tìm lỗi, điểm khó hiểu hoặc phần chưa giải quyết đúng vấn đề ban đầu.',
    studentGuide:
      'Hãy tự hỏi: sản phẩm có chạy đúng không, người khác dùng có hiểu không, có lỗi nào làm người dùng không đạt được mục tiêu không.',
    exampleOutput:
      'Ví dụ: Nhờ bạn thử thêm lịch học, phát hiện nút lưu chưa rõ ràng rồi sửa lại thông báo sau khi lưu thành công.',
  },
  {
    description:
      'Sau khi sản phẩm đã dùng được, tiếp tục sửa lỗi, làm rõ nội dung, cải thiện trải nghiệm và bổ sung phần giúp sản phẩm hữu ích hơn.',
    studentGuide:
      'Hãy tự hỏi: nếu dùng sản phẩm nhiều ngày thì còn điểm nào bất tiện, cần thêm gì, bớt gì hoặc làm thế nào để sản phẩm đáng tin cậy hơn.',
    exampleOutput:
      'Ví dụ: Thêm trạng thái ưu tiên, sửa giao diện mobile và ghi lại các lỗi đã sửa để lần sau phát triển tiếp dễ hơn.',
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
