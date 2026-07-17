export const SPY_WORD_CATEGORIES = [
  {
    id: 'jobs',
    label: 'Nghề nghiệp',
    pairs: [
      { civilian: 'Bác sĩ', spy: 'Y tá' },
      { civilian: 'Giáo viên', spy: 'Gia sư' },
      { civilian: 'Kỹ sư', spy: 'Kiến trúc sư' },
      { civilian: 'Phi công', spy: 'Tiếp viên hàng không' },
      { civilian: 'Nha sĩ', spy: 'Bác sĩ răng' },
      { civilian: 'Đầu bếp', spy: 'Phụ bếp' },
      { civilian: 'Công an', spy: 'Bảo vệ' },
      { civilian: 'Thợ may', spy: 'Thợ cắt tóc' },
      { civilian: 'Nhà báo', spy: 'Biên tập viên' },
      { civilian: 'Thủy thủ', spy: 'Ngư dân' },
    ],
  },
  {
    id: 'places',
    label: 'Địa điểm',
    pairs: [
      { civilian: 'Thư viện', spy: 'Bảo tàng' },
      { civilian: 'Siêu thị', spy: 'Cửa hàng tiện lợi' },
      { civilian: 'Bể bơi', spy: 'Công viên nước' },
      { civilian: 'Rạp chiếu phim', spy: 'Nhà hát' },
      { civilian: 'Sân bay', spy: 'Ga tàu' },
      { civilian: 'Chợ', spy: 'Chợ đêm' },
      { civilian: 'Nhà thờ', spy: 'Chùa' },
      { civilian: 'Công viên', spy: 'Vườn hoa' },
      { civilian: 'Bệnh viện', spy: 'Phòng khám' },
      { civilian: 'Trường học', spy: 'Thư viện' },
    ],
  },
  {
    id: 'food',
    label: 'Đồ ăn',
    pairs: [
      { civilian: 'Phở', spy: 'Bún bò' },
      { civilian: 'Pizza', spy: 'Bánh mì kẹp' },
      { civilian: 'Sushi', spy: 'Gimbap' },
      { civilian: 'Bánh flan', spy: 'Kem' },
      { civilian: 'Chè', spy: 'Sữa chua' },
      { civilian: 'Bánh mì', spy: 'Bánh cuốn' },
      { civilian: 'Cơm tấm', spy: 'Cơm rang' },
      { civilian: 'Trà sữa', spy: 'Sinh tố' },
      { civilian: 'Bánh bao', spy: 'Há cảo' },
      { civilian: 'Mì xào', spy: 'Phở xào' },
    ],
  },
  {
    id: 'animals',
    label: 'Động vật',
    pairs: [
      { civilian: 'Mèo', spy: 'Chó' },
      { civilian: 'Voi', spy: 'Tê giác' },
      { civilian: 'Cá heo', spy: 'Cá voi' },
      { civilian: 'Đại bàng', spy: 'Diều hâu' },
      { civilian: 'Bướm', spy: 'Chuồn chuồn' },
      { civilian: 'Hổ', spy: 'Báo' },
      { civilian: 'Khỉ', spy: 'Vượn' },
      { civilian: 'Rùa', spy: 'Ba ba' },
      { civilian: 'Ong', spy: 'Kiến' },
      { civilian: 'Cú', spy: 'Cò' },
    ],
  },
  {
    id: 'school',
    label: 'Trường học',
    pairs: [
      { civilian: 'Bảng đen', spy: 'Bảng trắng' },
      { civilian: 'Bút bi', spy: 'Bút chì' },
      { civilian: 'Vở', spy: 'Sổ tay' },
      { civilian: 'Thư viện', spy: 'Phòng đọc sách' },
      { civilian: 'Sân chơi', spy: 'Sân bóng' },
      { civilian: 'Tiết học', spy: 'Buổi học thêm' },
      { civilian: 'Bài kiểm tra', spy: 'Bài tập về nhà' },
      { civilian: 'Lớp trưởng', spy: 'Lớp phó' },
      { civilian: 'Giáo viên chủ nhiệm', spy: 'Giáo viên bộ môn' },
      { civilian: 'Học kỳ', spy: 'Năm học' },
    ],
  },
  {
    id: 'tech',
    label: 'Công nghệ',
    pairs: [
      { civilian: 'Máy tính', spy: 'Laptop' },
      { civilian: 'Điện thoại', spy: 'Máy tính bảng' },
      { civilian: 'Tai nghe', spy: 'Loa bluetooth' },
      { civilian: 'Bàn phím', spy: 'Chuột máy tính' },
      { civilian: 'Màn hình', spy: 'Máy chiếu' },
      { civilian: 'Wifi', spy: 'Dữ liệu di động' },
      { civilian: 'Email', spy: 'Tin nhắn' },
      { civilian: 'Facebook', spy: 'Zalo' },
      { civilian: 'YouTube', spy: 'TikTok' },
      { civilian: 'Ổ cứng', spy: 'USB' },
    ],
  },
];

const MAX_WORD_LEN = 40;

export function validateWordPair(civilian, spy) {
  const c = String(civilian || '').trim();
  const s = String(spy || '').trim();
  if (!c || !s) return { error: 'Nhập đủ hai cụm từ.' };
  if (c.length > MAX_WORD_LEN || s.length > MAX_WORD_LEN) {
    return { error: `Mỗi từ tối đa ${MAX_WORD_LEN} ký tự.` };
  }
  if (c.toLowerCase() === s.toLowerCase()) {
    return { error: 'Hai cụm từ phải khác nhau.' };
  }
  return { civilian: c, spy: s };
}

export function pickRandomPair(categoryId) {
  const category = SPY_WORD_CATEGORIES.find((c) => c.id === categoryId) || SPY_WORD_CATEGORIES[0];
  const pair = category.pairs[Math.floor(Math.random() * category.pairs.length)];
  return { category, pair };
}

export function getCategoryPairs(categoryId) {
  return SPY_WORD_CATEGORIES.find((c) => c.id === categoryId)?.pairs ?? [];
}
