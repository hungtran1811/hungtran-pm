import {
  normalizeQuizConfigRecord,
  QUIZ_DEFAULT_PICK_POLICY,
  QUIZ_MODE_OFFICIAL,
  QUIZ_QUESTION_TYPE_FILL_BLANK,
  QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
} from './quiz.js';

function normalizeSubjectKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function choice(difficulty, prompt, options, correctIndex = 0) {
  return {
    type: QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
    difficulty,
    prompt,
    options,
    correctIndex,
  };
}

function blank(difficulty, prompt, answers, placeholder = 'Nhập câu trả lời') {
  return {
    type: QUIZ_QUESTION_TYPE_FILL_BLANK,
    difficulty,
    prompt,
    acceptedAnswers: answers,
    blankPlaceholder: placeholder,
  };
}

const SAMPLE_QUESTIONS = {
  'python-app': {
    5: [
      choice('easy', 'Trong Python, hàm print() dùng để làm gì?', ['Nhập dữ liệu từ bàn phím', 'In nội dung ra màn hình', 'Xóa biến', 'Tạo file mới'], 1),
      choice('easy', 'Kiểu dữ liệu nào dùng để lưu giá trị đúng/sai?', ['int', 'str', 'bool', 'list'], 2),
      blank('easy', 'Từ khóa nào dùng để tạo hàm trong Python?', ['def'], 'Nhập từ khóa'),
      choice('easy', 'Ký hiệu nào dùng để viết chú thích một dòng trong Python?', ['//', '#', '<!-- -->', '--'], 1),
      choice('medium', 'Kết quả của biểu thức 5 + 3 * 2 là gì?', ['16', '11', '13', '10'], 1),
      choice('medium', 'Cách tạo list nào là hợp lệ?', ['scores = [8, 9, 10]', 'scores = (8; 9; 10)', 'scores = <8, 9, 10>', 'scores = list: 8, 9, 10'], 0),
      blank('medium', 'Hàm nào dùng để lấy độ dài của chuỗi hoặc list?', ['len', 'len()'], 'Nhập tên hàm'),
      choice('medium', 'Vòng lặp for phù hợp nhất khi nào?', ['Khi cần lặp qua một dãy giá trị', 'Khi muốn dừng chương trình ngay', 'Khi tạo ảnh', 'Khi đổi tên file'], 0),
      choice('hard', 'Đoạn code `if x > 5:` sẽ chạy khối lệnh bên trong khi nào?', ['Khi x nhỏ hơn 5', 'Khi x bằng 5', 'Khi x lớn hơn 5', 'Luôn luôn chạy'], 2),
      blank('hard', 'Trong Python, từ khóa nào dùng cho nhánh ngược lại khi điều kiện if sai?', ['else'], 'Nhập từ khóa'),
    ],
    9: [
      choice('easy', 'Trong app Python, biến thường dùng để làm gì?', ['Lưu dữ liệu tạm thời', 'Trang trí giao diện', 'Xóa chương trình', 'Tắt máy tính'], 0),
      choice('easy', 'Hàm input() trả về dữ liệu dạng gì?', ['int mặc định', 'str mặc định', 'list mặc định', 'bool mặc định'], 1),
      blank('easy', 'Từ khóa nào dùng để kiểm tra điều kiện đầu tiên?', ['if'], 'Nhập từ khóa'),
      choice('easy', 'Dấu `==` trong Python dùng để làm gì?', ['Gán giá trị', 'So sánh bằng', 'Cộng chuỗi', 'Tạo list'], 1),
      choice('medium', 'Nếu muốn chuyển chuỗi `"10"` thành số nguyên, dùng hàm nào?', ['str()', 'float()', 'int()', 'input()'], 2),
      blank('medium', 'Phương thức nào thường dùng để thêm phần tử vào cuối list?', ['append', 'append()'], 'Nhập phương thức'),
      choice('medium', 'Khi viết hàm, câu lệnh return dùng để làm gì?', ['Trả kết quả về nơi gọi hàm', 'In ra màn hình', 'Tạo vòng lặp', 'Xóa biến'], 0),
      choice('medium', 'Cách xử lý lỗi cơ bản trong Python thường dùng cặp nào?', ['try/except', 'if/for', 'while/list', 'print/input'], 0),
      choice('hard', 'Vì sao nên tách chương trình thành nhiều hàm nhỏ?', ['Để code khó đọc hơn', 'Để dễ tái sử dụng và kiểm thử', 'Để chương trình luôn chậm hơn', 'Để không cần biến'], 1),
      blank('hard', 'Từ khóa nào dùng để lặp khi điều kiện còn đúng?', ['while'], 'Nhập từ khóa'),
    ],
  },
  gamemaker: {
    5: [
      choice('easy', 'Trong GameMaker, sprite dùng để làm gì?', ['Hiển thị hình ảnh/animation', 'Lưu điểm số', 'Tạo điều kiện thắng', 'Xuất bản game'], 0),
      choice('easy', 'Object trong GameMaker đại diện cho gì?', ['Âm thanh', 'Thực thể có hành vi trong game', 'Font chữ', 'File cài đặt'], 1),
      blank('easy', 'Ngôn ngữ lập trình chính của GameMaker là gì?', ['GML', 'GameMaker Language'], 'Nhập tên ngôn ngữ'),
      choice('easy', 'Room trong GameMaker là gì?', ['Không gian/cảnh của game', 'Một biến', 'Một kiểu âm thanh', 'Một hàm vẽ chữ'], 0),
      choice('medium', 'Event nào chạy liên tục mỗi frame?', ['Create', 'Step', 'Destroy', 'Clean Up'], 1),
      blank('medium', 'Event nào thường dùng để khởi tạo biến ban đầu?', ['Create', 'Create Event'], 'Nhập tên event'),
      choice('medium', 'Lệnh nào thường dùng để vẽ chữ?', ['sprite_add()', 'room_restart()', 'draw_text()', 'keyboard_check()'], 2),
      choice('medium', 'keyboard_check(vk_left) kiểm tra điều gì?', ['Giữ phím trái', 'Game đã thắng', 'Room đã tải', 'Sprite bị xóa'], 0),
      blank('hard', 'Biến nào thay đổi vị trí ngang của instance?', ['x'], 'Nhập tên biến'),
      choice('hard', 'Muốn instance biến mất khỏi room, thường dùng lệnh nào?', ['instance_create_layer()', 'instance_destroy()', 'room_add()', 'show_debug_message()'], 1),
    ],
    9: [
      choice('easy', 'Biến score thường dùng để lưu thông tin gì?', ['Điểm số', 'Tốc độ mạng', 'Tên file ảnh', 'Màu nền hệ điều hành'], 0),
      choice('easy', 'Collision Event dùng để xử lý gì?', ['Khi hai object va chạm', 'Khi đổi font', 'Khi xuất game', 'Khi mở project'], 0),
      blank('easy', 'Hàm nào thường dùng để kiểm tra phím đang được giữ?', ['keyboard_check', 'keyboard_check()'], 'Nhập tên hàm'),
      choice('easy', 'Alarm Event phù hợp để làm gì?', ['Tạo hành động sau một khoảng thời gian', 'Tạo sprite mới', 'Đổi tên project', 'Xóa room'], 0),
      choice('medium', 'Khi nhân vật đi quá nhanh, biến nào thường cần điều chỉnh?', ['speed hoặc hspeed/vspeed', 'room_width', 'sprite_index', 'font_size'], 0),
      blank('medium', 'Biến nào thường dùng để đổi sprite đang hiển thị của instance?', ['sprite_index'], 'Nhập tên biến'),
      choice('medium', 'instance_create_layer() dùng để làm gì?', ['Tạo instance mới trên layer', 'Xóa instance', 'Đổi màu chữ', 'Dừng game'], 0),
      choice('medium', 'Khi cần kiểm tra máu nhân vật về 0, nên dùng cấu trúc nào?', ['if', 'repeat', 'draw_text', 'room_add'], 0),
      choice('hard', 'Vì sao nên tách logic điểm, máu, va chạm thành các đoạn rõ ràng?', ['Để dễ sửa lỗi và mở rộng game', 'Để code dài hơn vô ích', 'Để game không chạy', 'Để mất sprite'], 0),
      blank('hard', 'Hàm nào thường dùng để chuyển sang room khác?', ['room_goto', 'room_goto()'], 'Nhập tên hàm'),
    ],
  },
  scratch: {
    5: [
      choice('easy', 'Trong Scratch, sprite là gì?', ['Nhân vật/đối tượng trên sân khấu', 'Mật khẩu dự án', 'Một trình duyệt', 'Một kiểu database'], 0),
      choice('easy', 'Khối lệnh màu vàng thường liên quan đến nhóm nào?', ['Sự kiện', 'Âm thanh', 'Biến', 'Bút vẽ'], 0),
      blank('easy', 'Khu vực nơi sprite hoạt động trong Scratch gọi là gì?', ['sân khấu', 'stage'], 'Nhập tên khu vực'),
      choice('easy', 'Khối “khi bấm cờ xanh” dùng để làm gì?', ['Bắt đầu kịch bản', 'Xóa tài khoản', 'Tạo website', 'Tắt âm thanh máy'], 0),
      choice('medium', 'Biến trong Scratch dùng để làm gì?', ['Lưu giá trị thay đổi như điểm', 'Chỉ để trang trí', 'Đổi ngôn ngữ máy', 'Xóa nhân vật'], 0),
      blank('medium', 'Khối lặp lại mãi mãi trong Scratch thường gọi là gì?', ['forever', 'lặp mãi mãi'], 'Nhập tên khối'),
      choice('medium', 'Nếu muốn kiểm tra sprite chạm cạnh, dùng nhóm lệnh nào?', ['Cảm biến', 'Âm thanh', 'Ngoại hình', 'Bút vẽ'], 0),
      choice('medium', 'Broadcast trong Scratch dùng để làm gì?', ['Gửi tín hiệu giữa các sprite', 'Tạo biến số', 'Đổi hình nền tự động', 'Xóa toàn bộ code'], 0),
      choice('hard', 'Khi game có nhiều màn, vì sao nên dùng broadcast?', ['Để điều phối trạng thái giữa các phần', 'Để tăng lỗi', 'Để thay cờ xanh', 'Để khóa dự án'], 0),
      blank('hard', 'Khối điều kiện trong Scratch thường có chữ nào?', ['nếu', 'if'], 'Nhập từ khóa'),
    ],
    9: [
      choice('easy', 'Một game Scratch tốt nên có yếu tố nào?', ['Luật chơi rõ ràng', 'Không có tương tác', 'Không có mục tiêu', 'Chỉ có một khối lệnh'], 0),
      choice('easy', 'Backdrop dùng để làm gì?', ['Tạo phông nền sân khấu', 'Tạo biến', 'Tạo âm thanh', 'Xuất file exe'], 0),
      blank('easy', 'Biến thường dùng để lưu điểm trong game gọi là gì?', ['điểm', 'score'], 'Nhập tên biến'),
      choice('easy', 'Khối “ẩn” trong Scratch làm gì?', ['Làm sprite không hiển thị', 'Xóa code', 'Tạo clone', 'Dừng project'], 0),
      choice('medium', 'Clone trong Scratch phù hợp để tạo gì?', ['Nhiều kẻ địch/vật phẩm giống nhau', 'Một tài khoản mới', 'Một database', 'Một font mới'], 0),
      blank('medium', 'Khối nào thường dùng để tạo bản sao của sprite?', ['create clone', 'tạo bản sao'], 'Nhập tên khối'),
      choice('medium', 'Khi muốn game kết thúc nếu điểm đủ lớn, dùng gì?', ['Điều kiện if kết hợp biến điểm', 'Đổi backdrop ngẫu nhiên', 'Xóa sprite chính', 'Tăng âm lượng'], 0),
      choice('medium', 'Cách làm game dễ hiểu hơn là gì?', ['Đặt tên sprite/biến rõ ràng', 'Đặt mọi thứ tên a', 'Không dùng comment', 'Ghép mọi code vào một sprite'], 0),
      choice('hard', 'Vì sao cần kiểm thử game với người khác?', ['Để phát hiện lỗi và điểm khó hiểu', 'Để xóa dự án', 'Để đổi máy tính', 'Để mất điểm'], 0),
      blank('hard', 'Tín hiệu dùng để chuyển màn có thể tạo bằng khối nào?', ['broadcast', 'phát tin'], 'Nhập tên khối'),
    ],
  },
  web: {
    5: [
      choice('easy', 'HTML dùng để làm gì?', ['Tạo cấu trúc nội dung trang web', 'Chấm điểm', 'Nén ảnh', 'Tạo mật khẩu Wi-Fi'], 0),
      choice('easy', 'Thẻ nào là tiêu đề lớn nhất?', ['<p>', '<h6>', '<h1>', '<title>'], 2),
      blank('easy', 'Thuộc tính nào đặt đường dẫn cho thẻ a?', ['href'], 'Nhập thuộc tính'),
      choice('easy', 'CSS dùng để điều chỉnh gì?', ['Giao diện/kiểu dáng', 'Database server', 'Tài khoản admin', 'Tên miền'], 0),
      choice('medium', 'Thuộc tính CSS nào đổi màu chữ?', ['color', 'display', 'padding', 'font-size'], 0),
      choice('medium', 'Selector `.card` chọn phần tử nào?', ['Có class card', 'Có id card', 'Thẻ card', 'Phần tử đầu tiên'], 0),
      blank('medium', 'Phương thức nào in thông tin ra console trong JavaScript?', ['console.log', 'console.log()'], 'Nhập phương thức'),
      choice('medium', 'JavaScript phía client thường dùng để làm gì?', ['Thêm tương tác và xử lý logic', 'Thay thế hoàn toàn HTML', 'Tạo font chữ', 'Xóa trình duyệt'], 0),
      choice('hard', 'display: flex giúp ích gì?', ['Sắp xếp phần tử con linh hoạt', 'Tự gửi form', 'Tạo database', 'Tắt CSS'], 0),
      blank('hard', 'Thuộc tính CSS nào thường dùng để bo góc?', ['border-radius'], 'Nhập thuộc tính'),
    ],
    9: [
      choice('easy', 'Form trên web thường dùng để làm gì?', ['Thu thập dữ liệu người dùng nhập', 'Tạo ổ cứng', 'Đổi hệ điều hành', 'Xóa HTML'], 0),
      choice('easy', 'Nút bấm trong HTML thường dùng thẻ nào?', ['<button>', '<image>', '<box>', '<screen>'], 0),
      blank('easy', 'Sự kiện click trong JavaScript thường viết là gì?', ['click'], 'Nhập tên sự kiện'),
      choice('easy', 'Responsive web nghĩa là gì?', ['Giao diện thích ứng nhiều kích thước màn hình', 'Web chỉ chạy trên desktop', 'Web không có ảnh', 'Web không cần HTML'], 0),
      choice('medium', 'addEventListener dùng để làm gì?', ['Gắn hàm xử lý sự kiện', 'Đổi tên file', 'Nén CSS', 'Tạo database'], 0),
      blank('medium', 'Phương thức nào thường dùng để lấy phần tử theo id?', ['getElementById', 'document.getElementById'], 'Nhập phương thức'),
      choice('medium', 'Khi validate form, ta cần kiểm tra gì?', ['Dữ liệu nhập có hợp lệ không', 'Màn hình có sáng không', 'File CSS có tên dài không', 'Máy có pin không'], 0),
      choice('medium', 'LocalStorage dùng để làm gì?', ['Lưu dữ liệu nhỏ trên trình duyệt', 'Tạo server', 'Gửi email hàng loạt', 'Vẽ ảnh vector'], 0),
      choice('hard', 'Vì sao nên tách HTML, CSS, JS rõ ràng?', ['Dễ bảo trì và mở rộng', 'Để code khó đọc', 'Để web chậm hơn', 'Để mất dữ liệu'], 0),
      blank('hard', 'API DOM dùng để thao tác với phần nào của trang?', ['document', 'DOM'], 'Nhập câu trả lời'),
    ],
  },
  'computer-science': {
    5: [
      choice('easy', 'Thuật toán là gì?', ['Các bước giải quyết vấn đề', 'Một loại màn hình', 'Một file ảnh', 'Một mật khẩu'], 0),
      choice('easy', 'Flowchart dùng để làm gì?', ['Mô tả luồng xử lý bằng sơ đồ', 'Tăng tốc Wi-Fi', 'Thiết kế logo', 'Xóa code'], 0),
      blank('easy', 'Trong lập trình, dữ liệu đúng/sai thường gọi là kiểu gì?', ['boolean', 'bool'], 'Nhập kiểu dữ liệu'),
      choice('easy', 'Biến dùng để làm gì?', ['Lưu giá trị có thể thay đổi', 'Trang trí giao diện', 'Tạo loa', 'Đổi màu màn hình'], 0),
      choice('medium', 'Cấu trúc rẽ nhánh giúp chương trình làm gì?', ['Quyết định theo điều kiện', 'Luôn chạy một đường', 'Xóa dữ liệu', 'Tạo ảnh'], 0),
      blank('medium', 'Cấu trúc lặp thường dùng khi cần thực hiện việc gì nhiều lần?', ['lặp', 'loop'], 'Nhập khái niệm'),
      choice('medium', 'Input trong bài toán là gì?', ['Dữ liệu đầu vào', 'Kết quả cuối', 'Tên chương trình', 'Lỗi hệ thống'], 0),
      choice('medium', 'Output trong bài toán là gì?', ['Kết quả đầu ra', 'Dữ liệu nhập', 'Tên biến', 'Câu lệnh sai'], 0),
      choice('hard', 'Vì sao cần chia bài toán lớn thành bài toán nhỏ?', ['Dễ hiểu, dễ xử lý và kiểm tra', 'Để làm rối hơn', 'Để không cần thuật toán', 'Để mất dữ liệu'], 0),
      blank('hard', 'Lỗi logic là lỗi làm chương trình chạy nhưng cho kết quả gì?', ['sai', 'không đúng'], 'Nhập kết quả'),
    ],
    9: [
      choice('easy', 'Dữ liệu dạng danh sách phù hợp khi nào?', ['Cần lưu nhiều giá trị cùng nhóm', 'Chỉ có một giá trị duy nhất', 'Không cần xử lý', 'Muốn xóa chương trình'], 0),
      choice('easy', 'Debug nghĩa là gì?', ['Tìm và sửa lỗi', 'Vẽ hình nền', 'Tăng âm lượng', 'Đổi tên máy'], 0),
      blank('easy', 'Từ nào chỉ việc kiểm tra sản phẩm có lỗi hay không?', ['testing', 'kiểm thử'], 'Nhập khái niệm'),
      choice('easy', 'Pseudocode là gì?', ['Mô tả thuật toán bằng ngôn ngữ gần tự nhiên', 'Một kiểu ảnh', 'Một thiết bị', 'Một mật khẩu'], 0),
      choice('medium', 'Khi thiết kế sản phẩm giải quyết vấn đề, bước đầu tiên nên làm gì?', ['Hiểu vấn đề và người dùng', 'Trang trí màu ngay', 'Xuất bản ngay', 'Xóa yêu cầu'], 0),
      blank('medium', 'Trong mô hình waterfall, bước sau thiết kế thường là gì?', ['xây dựng', 'implementation', 'coding'], 'Nhập bước'),
      choice('medium', 'Test case dùng để làm gì?', ['Kiểm tra một tình huống cụ thể', 'Tạo ảnh', 'Đổi font', 'Tắt máy'], 0),
      choice('medium', 'Khi yêu cầu thay đổi, tài liệu giúp ích gì?', ['Giữ rõ mục tiêu và phạm vi', 'Làm mất thông tin', 'Tự viết code', 'Xóa bug'], 0),
      choice('hard', 'Vì sao cần đánh giá sản phẩm bằng người dùng thật?', ['Để biết sản phẩm có giải quyết đúng vấn đề không', 'Để bỏ qua lỗi', 'Để giảm chất lượng', 'Để không cần cải tiến'], 0),
      blank('hard', 'Bước cuối của waterfall trong bản 5 bước là gì?', ['bảo trì và cải tiến', 'maintenance'], 'Nhập tên bước'),
    ],
  },
};

function getSubjectSamples(subject = '') {
  const subjectKey = normalizeSubjectKey(subject);
  return SAMPLE_QUESTIONS[subjectKey] || null;
}

function toQuestionRecord(subjectKey, sessionNumber, source, index) {
  const id = `sample-${subjectKey}-${sessionNumber}-q${index + 1}`;

  if (source.type === QUIZ_QUESTION_TYPE_FILL_BLANK) {
    return {
      id,
      type: QUIZ_QUESTION_TYPE_FILL_BLANK,
      difficulty: source.difficulty,
      prompt: source.prompt,
      imageUrl: '',
      imageAlt: '',
      blankPlaceholder: source.blankPlaceholder || '',
      acceptedAnswers: source.acceptedAnswers || [],
      caseSensitive: false,
      order: index + 1,
      options: [],
      correctOptionId: '',
    };
  }

  const options = (source.options || []).map((text, optionIndex) => ({
    id: `${id}-o${optionIndex + 1}`,
    text,
    order: optionIndex + 1,
  }));

  return {
    id,
    type: QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
    difficulty: source.difficulty,
    prompt: source.prompt,
    imageUrl: '',
    imageAlt: '',
    blankPlaceholder: '',
    acceptedAnswers: [],
    caseSensitive: false,
    order: index + 1,
    options,
    correctOptionId: options[source.correctIndex || 0]?.id || options[0]?.id || '',
  };
}

export function hasQuizSampleSet(subject = '', sessionNumber = 0) {
  const samples = getSubjectSamples(subject);
  return Boolean(samples?.[Number(sessionNumber || 0)]);
}

export function buildQuizSampleConfig({
  subject = '',
  level = '',
  sessionNumber = 5,
} = {}) {
  const subjectKey = normalizeSubjectKey(subject);
  const samples = getSubjectSamples(subject);
  const normalizedSessionNumber = Number(sessionNumber || 5);
  const questions = samples?.[normalizedSessionNumber];

  if (!questions) {
    throw new Error(`Chưa có bộ đề mẫu cho ${subject || 'môn này'} buổi ${normalizedSessionNumber}.`);
  }

  return normalizeQuizConfigRecord(
    {
      subject,
      level,
      sessionNumber: normalizedSessionNumber,
      quizMode: QUIZ_MODE_OFFICIAL,
      questionPickPolicy: QUIZ_DEFAULT_PICK_POLICY,
      title: `Bộ mẫu ${subject || 'môn học'} ${level || ''} buổi ${normalizedSessionNumber}`.replace(/\s+/g, ' ').trim(),
      description: `Bộ đề mẫu buổi ${normalizedSessionNumber}, đủ 4 câu dễ, 4 câu trung bình và 2 câu khó.`,
      questions: questions.map((question, index) => toQuestionRecord(subjectKey, normalizedSessionNumber, question, index)),
    },
    normalizedSessionNumber,
    { subject, level },
  );
}
