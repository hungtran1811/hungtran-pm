import { STAGES } from '../constants/index.js';

/**
 * Soft waterfall guide for final-project students.
 * Keys must match STAGES in constants/index.js.
 * Dùng chung cho Scratch, Game Maker, Python App, Web, Computer Science.
 */
export const PRODUCT_WATERFALL = {
  [STAGES[0]]: {
    shortLabel: 'Phân tích',
    meaning:
      'Chốt người dùng, vấn đề và tính năng cốt lõi trước khi thiết kế hay dựng sản phẩm. Dùng được cho Scratch, Game Maker, Python App, Web và Computer Science.',
    howTo: [
      'Viết 1–2 câu: ai dùng hoặc chơi sản phẩm, và họ cần gì?',
      'Liệt kê 3–5 tính năng chính (ví dụ: menu, nhân vật di chuyển, nộp bài, xem kết quả).',
      'Ghi phạm vi lần này: làm gì / chưa làm gì để tránh ôm đồm.',
      'Tìm 1 sản phẩm tương tự (game, app hoặc website) để hình dung kết quả.',
    ],
    doneTodayPlaceholder:
      'Ví dụ: người dùng là học sinh; 4 tính năng: màn hình chính, nhân vật, tính điểm, lưu kết quả...',
    nextGoalPlaceholder:
      'Ví dụ: chốt danh sách tính năng rồi bắt đầu phác thảo giao diện và nhân vật...',
    tip: 'Chưa vẽ giao diện hay dựng sản phẩm nếu chưa nói rõ ai dùng, vấn đề gì và tính năng nào là bắt buộc.',
  },
  [STAGES[1]]: {
    shortLabel: 'Thiết kế',
    meaning:
      'Lên giao diện, hình ảnh nhân vật / vật phẩm và luồng từng tính năng — trước khi ráp vào công cụ lớp đang học.',
    howTo: [
      'Phác thảo 2–4 màn hình, phòng hoặc scene chính (giấy, Canva hoặc công cụ vẽ).',
      'Thiết kế nhân vật, vật phẩm, nút bấm, nền: kiểu dáng, màu sắc, kích thước.',
      'Viết luồng mỗi tính năng: người dùng làm gì → sản phẩm phản hồi gì.',
      'Chia việc nhỏ theo từng màn hình hoặc từng tính năng, đủ làm trong 1–2 buổi.',
    ],
    doneTodayPlaceholder:
      'Ví dụ: vẽ menu, màn chơi và màn kết quả; chọn hình nhân vật + 3 vật phẩm; ghi luồng tính điểm...',
    nextGoalPlaceholder:
      'Ví dụ: tạo dự án trên nền tảng lớp đang học và dựng khung giao diện theo bản phác...',
    tip: 'Thiết kế xong phải chỉ được: màn hình nào, nhân vật / ảnh nào, tính năng nào làm trước.',
  },
  [STAGES[2]]: {
    shortLabel: 'Xây dựng',
    meaning:
      'Dựng sản phẩm theo thiết kế: giao diện trước, rồi gắn hành vi cho từng tính năng trên Scratch, Game Maker, Python, Web hoặc bài CS.',
    howTo: [
      'Tạo dự án rồi dựng khung giao diện (sân khấu, room, cửa sổ hoặc trang web).',
      'Thêm hình nhân vật, vật phẩm, nút và nền đúng như bản thiết kế.',
      'Làm lần lượt từng tính năng; mỗi buổi chỉ nhắm 1 mục tiêu chạy được.',
      'Lưu phiên bản thường xuyên; ghi chỗ còn lỗi hoặc tính năng chưa làm.',
    ],
    doneTodayPlaceholder:
      'Ví dụ: đã có menu và nhân vật di chuyển; nút Bắt đầu vào màn chơi được...',
    nextGoalPlaceholder:
      'Ví dụ: làm tính năng tính điểm và chuyển sang màn kết quả...',
    tip: 'Ưu tiên vài tính năng chạy được hơn làm nhiều thứ nhưng chưa mở được sản phẩm.',
  },
  [STAGES[3]]: {
    shortLabel: 'Kiểm thử',
    meaning:
      'Tự chơi / tự dùng như người mới: thử các tình huống thường gặp và lệch, ghi lỗi rồi sửa.',
    howTo: [
      'Thử đủ luồng chính: mở sản phẩm, dùng từng tính năng, kết thúc đúng.',
      'Thử trường hợp lệch: bấm lung tung, để trống, chọn sai, chơi lại từ đầu.',
      'Xem giao diện và hình nhân vật / vật phẩm có bị lệch, mất, quá to hoặc quá nhỏ không.',
      'Nhờ bạn cùng lớp thử 1 lần rồi sửa theo phản hồi.',
    ],
    doneTodayPlaceholder:
      'Ví dụ: thử 6 tình huống; nhân vật xuyên tường khi bấm nhanh; đã chỉnh va chạm...',
    nextGoalPlaceholder:
      'Ví dụ: sửa nốt 2 lỗi giao diện và chuẩn bị file nộp + báo cáo...',
    tip: 'Đừng chỉ chạy một lần thấy ổn. Hãy cố tình làm lệch để biết sản phẩm chịu được gì.',
  },
  [STAGES[4]]: {
    shortLabel: 'Bảo trì',
    meaning:
      'Chỉnh cho người khác dùng được: dọn giao diện, tên, file thừa, rồi nộp sản phẩm kèm cách mở.',
    howTo: [
      'Dọn màn hình, nhân vật, âm thanh, file không dùng; đặt tên dễ hiểu.',
      'Kiểm tra lại chữ, nút, hình ảnh cho đều và đọc được.',
      'Ghi cách mở / chạy (file Scratch, Game Maker, Python, link web hoặc bài CS).',
      'Nộp file sản phẩm, gửi báo cáo, và ghi 1–2 ý muốn cải tiến sau.',
    ],
    doneTodayPlaceholder:
      'Ví dụ: xóa sprite thừa, chỉnh nút cho đều; viết cách mở file; nộp bản cuối...',
    nextGoalPlaceholder:
      'Ví dụ: nộp sản phẩm và chuẩn bị demo 1–2 phút cho giáo viên...',
    tip: 'Sản phẩm xong là người khác mở được, hiểu tính năng và thấy giao diện rõ — không chỉ máy bạn chạy được.',
  },
};

export function getWaterfallStage(stageName) {
  return PRODUCT_WATERFALL[stageName] || PRODUCT_WATERFALL[STAGES[0]];
}

export function waterfallStageIndex(stageName) {
  const idx = STAGES.indexOf(stageName);
  return idx >= 0 ? idx : 0;
}
