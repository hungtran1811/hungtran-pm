import { STAGES } from '../constants/index.js';

/**
 * Soft waterfall guide for final-project students.
 * Keys must match STAGES in constants/index.js.
 */
export const PRODUCT_WATERFALL = {
  [STAGES[0]]: {
    shortLabel: 'Phân tích',
    meaning:
      'Làm rõ vấn đề bạn muốn giải quyết trước khi viết code. Giai đoạn này giúp sản phẩm có lý do tồn tại, không làm “cho có”.',
    howTo: [
      'Viết 1–2 câu: ai dùng sản phẩm và họ gặp khó khăn gì?',
      'Liệt kê 3 việc người dùng cần làm được (chức năng cốt lõi).',
      'Ghi rõ phạm vi: lần này làm gì / chưa làm gì (tránh ôm đồm).',
      'Tìm ví dụ thực tế (app/web quen thuộc) để hình dung kết quả.',
    ],
    lessonsHint: 'Xem lại bài tư duy giải quyết vấn đề, sơ đồ khối nếu lớp đã học.',
    doneTodayPlaceholder:
      'Ví dụ: xác định người dùng là học sinh lớp 10; liệt kê 3 chức năng: nhập điểm, xem điểm TB, xuất cảnh báo...',
    nextGoalPlaceholder:
      'Ví dụ: chốt danh sách chức năng cốt lõi và bắt đầu phác thảo màn hình chính...',
    tip: 'Đừng vội code. Nếu chưa nói rõ “ai – vấn đề – kết quả mong muốn”, hãy ở lại giai đoạn này thêm một báo cáo.',
  },
  [STAGES[1]]: {
    shortLabel: 'Thiết kế',
    meaning:
      'Biến ý tưởng thành kế hoạch làm việc: màn hình, luồng thao tác, cấu trúc dữ liệu — trước khi xây dựng.',
    howTo: [
      'Phác thảo 2–4 màn hình chính (giấy/Canva đều được).',
      'Viết luồng: người dùng bấm gì → hệ thống làm gì → hiện gì.',
      'Chọn cấu trúc dữ liệu đơn giản (biến, list, dict) phù hợp bài đã học.',
      'Chia việc thành bước nhỏ có thể hoàn thành trong 1–2 buổi.',
    ],
    lessonsHint: 'Ôn lại bài cấu trúc dữ liệu, hàm, và cách chia chương trình thành phần.',
    doneTodayPlaceholder:
      'Ví dụ: vẽ 3 màn hình (đăng nhập giả, danh sách, chi tiết); quyết định dùng list chứa dict cho mỗi học sinh...',
    nextGoalPlaceholder:
      'Ví dụ: tạo file dự án trên GitHub và viết khung chương trình theo thiết kế...',
    tip: 'Thiết kế tốt giúp bạn biết “làm gì tiếp theo” khi code. Nếu còn mơ hồ, quay lại phân tích hoặc đơn giản hóa phạm vi.',
  },
  [STAGES[2]]: {
    shortLabel: 'Xây dựng',
    meaning:
      'Hiện thực hóa thiết kế bằng code: làm từng chức năng nhỏ, chạy thử ngay, rồi mới làm phần kế tiếp.',
    howTo: [
      'Làm theo thứ tự: khung chương trình → chức năng 1 → chức năng 2…',
      'Mỗi buổi chỉ nhắm 1 mục tiêu rõ (ví dụ: “nhập và lưu danh sách”).',
      'Commit / lưu phiên bản thường xuyên; ghi chú chỗ còn lỗi.',
      'Khi kẹt: xem lại bài giảng liên quan trước khi nhờ hỗ trợ.',
    ],
    lessonsHint: 'Mở tab Bài giảng để xem lại cú pháp, vòng lặp, hàm, xử lý lỗi đã học.',
    doneTodayPlaceholder:
      'Ví dụ: hoàn thành hàm thêm phần tử vào list; chương trình chạy được menu chọn 1–2...',
    nextGoalPlaceholder:
      'Ví dụ: làm chức năng tìm kiếm theo tên và kiểm tra với 5 dữ liệu mẫu...',
    tip: 'Ưu tiên “chạy được ít chức năng” hơn “viết nhiều nhưng chưa chạy”. Báo cáo nên nêu được file/hàm bạn vừa đụng tới.',
  },
  [STAGES[3]]: {
    shortLabel: 'Kiểm thử',
    meaning:
      'Chủ động tìm lỗi: thử các trường hợp thường gặp và biên, ghi lại lỗi rồi sửa — giống quy trình phần mềm thật.',
    howTo: [
      'Lập checklist thử: dữ liệu hợp lệ, rỗng, sai định dạng, trùng lặp…',
      'Ghi lỗi theo mẫu: bước tái hiện → kết quả sai → bạn đã sửa thế nào.',
      'Nhờ bạn cùng lớp thử 1 lần (góc nhìn người dùng mới).',
      'Chỉ đánh dấu gần xong khi các chức năng cốt lõi chạy ổn.',
    ],
    lessonsHint: 'Nhớ lại bài debug & xử lý lỗi; dùng print / kiểm tra điều kiện để khoanh vùng bug.',
    doneTodayPlaceholder:
      'Ví dụ: thử 6 case; phát hiện lỗi khi nhập số âm; đã thêm kiểm tra và thông báo...',
    nextGoalPlaceholder:
      'Ví dụ: sửa nốt 2 lỗi còn lại và chuẩn bị link GitHub/Canva để nộp...',
    tip: 'Kiểm thử không phải “chạy một lần thấy ổn”. Hãy cố tình làm hỏng để biết chương trình chịu được gì.',
  },
  [STAGES[4]]: {
    shortLabel: 'Bảo trì',
    meaning:
      'Hoàn thiện để người khác dùng được: dọn code, hướng dẫn chạy, cải tiến nhỏ sau phản hồi — rồi nộp sản phẩm.',
    howTo: [
      'Viết README ngắn: cách chạy, chức năng chính, giới hạn đã biết.',
      'Dọn tên biến/hàm, xóa code thừa, thêm comment chỗ khó.',
      'Cập nhật Canva (nếu có) và link GitHub cho đúng bản cuối.',
      'Ghi 1–2 ý muốn cải tiến sau này (kể cả chưa kịp làm).',
    ],
    lessonsHint: 'Xem lại hướng dẫn nộp GitHub/Canva ở tab Hướng dẫn nộp khi chuẩn bị bàn giao.',
    doneTodayPlaceholder:
      'Ví dụ: viết README; đổi tên biến cho dễ hiểu; cập nhật link GitHub bản cuối...',
    nextGoalPlaceholder:
      'Ví dụ: nộp sản phẩm, chuẩn bị demo 2 phút cho giáo viên...',
    tip: 'Sản phẩm “xong” là người khác chạy được và hiểu bạn làm gì — không chỉ máy bạn chạy được.',
  },
};

export function getWaterfallStage(stageName) {
  return PRODUCT_WATERFALL[stageName] || PRODUCT_WATERFALL[STAGES[0]];
}

export function waterfallStageIndex(stageName) {
  const idx = STAGES.indexOf(stageName);
  return idx >= 0 ? idx : 0;
}
