export const SPY_WORD_CATEGORIES = [
  {
    id: 'jobs',
    label: 'Nghề nghiệp',
    pairs: [
      { civilian: 'Bác sĩ', spy: 'Công an' },
      { civilian: 'Giáo viên', spy: 'Đầu bếp' },
      { civilian: 'Kỹ sư', spy: 'Kiến trúc sư' },
      { civilian: 'Phi công', spy: 'Thủy thủ' },
      { civilian: 'Nha sĩ', spy: 'Y tá' },
    ],
  },
  {
    id: 'places',
    label: 'Địa điểm',
    pairs: [
      { civilian: 'Thư viện', spy: 'Bảo tàng' },
      { civilian: 'Siêu thị', spy: 'Chợ' },
      { civilian: 'Bể bơi', spy: 'Công viên nước' },
      { civilian: 'Rạp chiếu phim', spy: 'Nhà hát' },
      { civilian: 'Sân bay', spy: 'Ga tàu' },
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
