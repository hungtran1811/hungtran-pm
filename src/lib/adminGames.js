export function adminGameCards({ showdownEnabled = false } = {}) {
  const cards = [
    { id: 'random-student', title: 'Quay tên', detail: 'Chọn ngẫu nhiên một học sinh' },
    { id: 'card-flip', title: 'Lật bài', detail: 'Lật thẻ trong lớp' },
    { id: 'mystery-box', title: 'Hộp bí ẩn', detail: 'Câu hỏi và thử thách' },
    { id: 'number-guess', title: 'Đoán số', detail: 'Trò chơi suy luận số' },
    { id: 'spy-game', title: 'Truy tìm gián điệp', detail: 'Học sinh tham gia từ cổng riêng' },
  ];
  if (showdownEnabled) {
    cards.push({
      id: 'coding-showdown',
      title: 'Coding Showdown',
      detail: 'Chỉ hiện khi tính năng được bật',
    });
  }
  return cards;
}
