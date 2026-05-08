import {
  createQuizItemId,
  normalizeQuizConfigRecord,
  normalizeQuizDifficulty,
  QUIZ_DIFFICULTY_EASY,
  QUIZ_DIFFICULTY_HARD,
  QUIZ_DIFFICULTY_MEDIUM,
  QUIZ_QUESTION_TYPE_FILL_BLANK,
  QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
} from './quiz.js';

const OPTION_RE = /^[-*]\s*\[(x|X|\s)\]\s+(.+)$/;
const INLINE_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+(?:\s+"[^"]*")?)\)/;

export const QUIZ_MARKDOWN_IMPORT_TEMPLATE = `# Kiểm tra trắc nghiệm buổi 9

Mô tả ngắn cho bài kiểm tra.

## Câu 1
Difficulty: easy
GameMaker dùng ngôn ngữ nào để viết logic?
Image: https://placehold.co/960x540/png?text=GameMaker+Code
Alt: Minh họa giao diện code
- [x] GML
- [ ] Python
- [ ] Java
- [ ] C#

## Câu 2
Độ khó: medium
![Sơ đồ khối](https://placehold.co/960x540/png?text=Object+Flow)
Lệnh nào dùng để tạo object mới?
- [ ] room_add()
- [x] instance_create_layer()
- [ ] sprite_add()
- [ ] draw_text()

## Câu 3
Difficulty: hard
Type: fill_blank
Python dùng hàm nào để in nội dung ra màn hình?
Placeholder: Nhập tên hàm
Answers: print | print()`;

function buildSampleMarkdown({ title, description, questions }) {
  return [
    `# ${title}`,
    '',
    description,
    '',
    ...questions.flatMap((question, index) => [
      `## Câu ${index + 1}`,
      `Difficulty: ${question.difficulty}`,
      ...(question.type === 'fill_blank'
        ? [
            'Type: fill_blank',
            question.prompt,
            `Placeholder: ${question.placeholder || 'Nhập câu trả lời'}`,
            `Answers: ${question.answers.join(' | ')}`,
          ]
        : [
            ...(question.image ? [`![${question.imageAlt || 'Minh họa'}](${question.image})`] : []),
            question.prompt,
            ...question.options.map((option) => `- [${option.correct ? 'x' : ' '}] ${option.text}`),
          ]),
      '',
    ]),
  ].join('\n').trim();
}

export const QUIZ_MARKDOWN_SAMPLE_SETS = [
  {
    id: 'python-basic',
    title: 'Python cơ bản',
    description: '10 câu mẫu đủ 4 dễ, 4 trung bình, 2 khó.',
    markdown: buildSampleMarkdown({
      title: 'Bộ mẫu Python cơ bản',
      description: 'Ôn nhanh kiến thức Python nền tảng cho bài kiểm tra ngắn.',
      questions: [
        {
          difficulty: 'easy',
          prompt: 'Hàm input() dùng để làm gì?',
          options: [
            { text: 'In dữ liệu ra màn hình' },
            { text: 'Nhận dữ liệu từ người dùng', correct: true },
            { text: 'Tạo biến số nguyên' },
            { text: 'Dừng chương trình' },
          ],
        },
        {
          difficulty: 'easy',
          prompt: 'Trong Python, ký hiệu nào dùng để viết chú thích một dòng?',
          options: [{ text: '//' }, { text: '/*' }, { text: '#', correct: true }, { text: '--' }],
        },
        {
          difficulty: 'easy',
          type: 'fill_blank',
          prompt: 'Từ khóa nào dùng để định nghĩa hàm trong Python?',
          placeholder: 'Nhập từ khóa',
          answers: ['def'],
        },
        {
          difficulty: 'easy',
          prompt: 'Giá trị boolean đúng trong Python viết là gì?',
          options: [{ text: 'true' }, { text: 'True', correct: true }, { text: 'TRUE' }, { text: 'yes' }],
        },
        {
          difficulty: 'medium',
          prompt: 'Kết quả của biểu thức 5 + 3 * 2 là bao nhiêu?',
          options: [{ text: '16' }, { text: '11', correct: true }, { text: '13' }, { text: '10' }],
        },
        {
          difficulty: 'medium',
          prompt: 'Đâu là cách tạo một list hợp lệ?',
          options: [
            { text: 'scores = [8, 9, 10]', correct: true },
            { text: 'scores = (8; 9; 10)' },
            { text: 'scores = <8, 9, 10>' },
            { text: 'scores = list: 8, 9, 10' },
          ],
        },
        {
          difficulty: 'medium',
          type: 'fill_blank',
          prompt: 'Hàm nào dùng để biết độ dài của một list hoặc chuỗi?',
          placeholder: 'Nhập tên hàm',
          answers: ['len', 'len()'],
        },
        {
          difficulty: 'medium',
          image: 'https://placehold.co/960x540/png?text=For+Loop',
          imageAlt: 'Minh họa vòng lặp',
          prompt: 'Vòng lặp for thường dùng khi nào?',
          options: [
            { text: 'Khi cần lặp qua một dãy giá trị hoặc danh sách', correct: true },
            { text: 'Khi muốn kết thúc chương trình' },
            { text: 'Khi muốn tạo file ảnh' },
            { text: 'Khi muốn đổi tên biến' },
          ],
        },
        {
          difficulty: 'hard',
          prompt: 'Đoạn code sau sẽ in ra gì?\n```python\nx = 10\nif x > 5:\n    print("Lớn hơn 5")\n```',
          options: [
            { text: 'Lớn hơn 5', correct: true },
            { text: 'Nhỏ hơn 5' },
            { text: '10' },
            { text: 'Không in gì' },
          ],
        },
        {
          difficulty: 'hard',
          prompt: 'Khi dùng if/else, phần else sẽ chạy khi nào?',
          options: [
            { text: 'Luôn luôn chạy' },
            { text: 'Khi điều kiện if đúng' },
            { text: 'Khi điều kiện if sai', correct: true },
            { text: 'Khi biến chưa được khai báo' },
          ],
        },
      ],
    }),
  },
  {
    id: 'gamemaker-basic',
    title: 'GameMaker cơ bản',
    description: '10 câu mẫu đủ 4 dễ, 4 trung bình, 2 khó.',
    markdown: buildSampleMarkdown({
      title: 'Bộ mẫu GameMaker cơ bản',
      description: 'Kiểm tra nhanh các khái niệm nền tảng khi làm game bằng GameMaker.',
      questions: [
        {
          difficulty: 'easy',
          prompt: 'Trong GameMaker, sprite dùng để làm gì?',
          options: [
            { text: 'Hiển thị hình ảnh/animation cho object', correct: true },
            { text: 'Lưu điểm số người chơi' },
            { text: 'Tạo phòng chơi mới' },
            { text: 'Viết điều kiện thắng thua' },
          ],
        },
        {
          difficulty: 'easy',
          prompt: 'Object trong GameMaker có vai trò nào?',
          options: [
            { text: 'Chỉ là một file âm thanh' },
            { text: 'Đại diện cho thực thể có hành vi trong game', correct: true },
            { text: 'Chỉ dùng để đổi màu nền' },
            { text: 'Chỉ dùng để xuất bản game' },
          ],
        },
        {
          difficulty: 'easy',
          type: 'fill_blank',
          prompt: 'Ngôn ngữ lập trình chính trong GameMaker là gì?',
          placeholder: 'Nhập tên ngôn ngữ',
          answers: ['GML', 'GameMaker Language'],
        },
        {
          difficulty: 'easy',
          prompt: 'Room trong GameMaker thường được hiểu là gì?',
          options: [
            { text: 'Một biến lưu máu nhân vật' },
            { text: 'Một loại sprite đặc biệt' },
            { text: 'Không gian/cảnh nơi các object xuất hiện', correct: true },
            { text: 'Một hàm tạo âm thanh' },
          ],
        },
        {
          difficulty: 'medium',
          prompt: 'Event nào thường chạy liên tục mỗi frame?',
          options: [
            { text: 'Create Event' },
            { text: 'Step Event', correct: true },
            { text: 'Destroy Event' },
            { text: 'Alarm Event' },
          ],
        },
        {
          difficulty: 'medium',
          type: 'fill_blank',
          prompt: 'Event nào thường dùng để khởi tạo biến ban đầu cho object?',
          placeholder: 'Nhập tên event',
          answers: ['Create', 'Create Event'],
        },
        {
          difficulty: 'medium',
          prompt: 'Lệnh nào thường dùng để vẽ chữ lên màn hình?',
          options: [
            { text: 'sprite_add()' },
            { text: 'room_restart()' },
            { text: 'draw_text()', correct: true },
            { text: 'keyboard_check()' },
          ],
        },
        {
          difficulty: 'medium',
          prompt: 'keyboard_check(vk_left) dùng để kiểm tra điều gì?',
          options: [
            { text: 'Người chơi đang giữ phím mũi tên trái', correct: true },
            { text: 'Người chơi đã thắng game' },
            { text: 'Room đã tải xong' },
            { text: 'Sprite đang bị xóa' },
          ],
        },
        {
          difficulty: 'hard',
          type: 'fill_blank',
          prompt: 'Biến nào thường dùng để thay đổi vị trí ngang của instance?',
          placeholder: 'Nhập tên biến',
          answers: ['x'],
        },
        {
          difficulty: 'hard',
          prompt: 'Khi muốn instance biến mất khỏi room, ta thường dùng lệnh nào?',
          options: [
            { text: 'instance_create_layer()' },
            { text: 'instance_destroy()', correct: true },
            { text: 'room_add()' },
            { text: 'show_debug_message()' },
          ],
        },
      ],
    }),
  },
  {
    id: 'web-basic',
    title: 'Web cơ bản',
    description: '10 câu mẫu đủ 4 dễ, 4 trung bình, 2 khó.',
    markdown: buildSampleMarkdown({
      title: 'Bộ mẫu Web cơ bản',
      description: 'Ôn tập nhanh HTML, CSS và JavaScript.',
      questions: [
        {
          difficulty: 'easy',
          prompt: 'HTML chủ yếu dùng để làm gì?',
          options: [
            { text: 'Tạo cấu trúc nội dung cho trang web', correct: true },
            { text: 'Chấm điểm bài kiểm tra' },
            { text: 'Lưu dữ liệu trong database' },
            { text: 'Nén hình ảnh' },
          ],
        },
        {
          difficulty: 'easy',
          prompt: 'Thẻ nào dùng để tạo tiêu đề lớn nhất trong HTML?',
          options: [{ text: '<p>' }, { text: '<h6>' }, { text: '<h1>', correct: true }, { text: '<title>' }],
        },
        {
          difficulty: 'easy',
          type: 'fill_blank',
          prompt: 'Trong HTML, thuộc tính nào dùng để đặt đường dẫn cho thẻ a?',
          placeholder: 'Nhập thuộc tính',
          answers: ['href'],
        },
        {
          difficulty: 'easy',
          prompt: 'CSS dùng để điều chỉnh phần nào của trang web?',
          options: [
            { text: 'Giao diện/kiểu dáng', correct: true },
            { text: 'Tài khoản đăng nhập' },
            { text: 'Database server' },
            { text: 'Mật khẩu Wi-Fi' },
          ],
        },
        {
          difficulty: 'medium',
          prompt: 'Trong CSS, thuộc tính nào đổi màu chữ?',
          options: [{ text: 'color', correct: true }, { text: 'background-image' }, { text: 'border-radius' }, { text: 'display' }],
        },
        {
          difficulty: 'medium',
          prompt: 'JavaScript trong trình duyệt thường dùng để làm gì?',
          options: [
            { text: 'Chỉ để viết tiêu đề trang' },
            { text: 'Thêm tương tác và xử lý logic phía client', correct: true },
            { text: 'Thay thế hoàn toàn HTML' },
            { text: 'Chỉ để tạo font chữ' },
          ],
        },
        {
          difficulty: 'medium',
          type: 'fill_blank',
          prompt: 'Phương thức nào thường dùng để in thông tin ra console trong JavaScript?',
          placeholder: 'Nhập phương thức',
          answers: ['console.log', 'console.log()'],
        },
        {
          difficulty: 'medium',
          prompt: 'Trong CSS, selector .card sẽ chọn phần tử nào?',
          options: [
            { text: 'Tất cả thẻ card' },
            { text: 'Các phần tử có class là card', correct: true },
            { text: 'Phần tử có id là card' },
            { text: 'Phần tử đầu tiên trong body' },
          ],
        },
        {
          difficulty: 'hard',
          prompt: 'Thuộc tính display: flex thường giúp làm gì?',
          options: [
            { text: 'Sắp xếp phần tử con linh hoạt theo hàng/cột', correct: true },
            { text: 'Tự động gửi form' },
            { text: 'Tạo database mới' },
            { text: 'Tắt JavaScript' },
          ],
        },
        {
          difficulty: 'hard',
          prompt: 'Đâu là cách khai báo biến hiện đại trong JavaScript?',
          options: [
            { text: 'var-name score = 10' },
            { text: 'const score = 10', correct: true },
            { text: 'variable score: 10' },
            { text: 'int score = 10' },
          ],
        },
      ],
    }),
  },
];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isQuestionHeading(line = '') {
  return /^#{2,6}\s*(cau|question)\b/.test(normalizeComparableText(line));
}

function extractMetadataValue(line = '', supportedKeys = []) {
  const normalizedLine = normalizeComparableText(line);

  for (const key of supportedKeys) {
    const normalizedKey = normalizeComparableText(key);

    if (normalizedLine.startsWith(`${normalizedKey}:`)) {
      return normalizeText(line.slice(line.indexOf(':') + 1));
    }
  }

  return '';
}

function stripQuotes(value) {
  const trimmed = normalizeText(value);
  return trimmed.replace(/^"(.*)"$/, '$1');
}

function splitQuestionSections(lines = []) {
  const sections = [];
  let current = [];

  lines.forEach((line) => {
    if (isQuestionHeading(line)) {
      if (current.length > 0) {
        sections.push(current);
      }
      current = [line];
      return;
    }

    current.push(line);
  });

  if (current.length > 0) {
    sections.push(current);
  }

  return sections;
}

function extractHeadingPrompt(line = '') {
  const headingText = normalizeText(line.replace(/^#{2,6}\s*/, ''));
  const normalizedHeadingText = normalizeComparableText(headingText);
  const prefixMatch = normalizedHeadingText.match(/^(cau|question)\s*\d*[\s.:_-]*/i);
  const promptFromHeading = prefixMatch
    ? normalizeText(headingText.slice(prefixMatch[0].length))
    : headingText;
  return /^\d+$/.test(promptFromHeading) ? '' : promptFromHeading;
}

function extractInlineImage(lines = []) {
  let imageUrl = '';
  let imageAlt = '';

  const nextLines = lines
    .map((line) => {
      const match = line.match(INLINE_IMAGE_RE);

      if (!match || imageUrl) {
        return line;
      }

      imageAlt = normalizeText(match[1]);
      imageUrl = stripQuotes(match[2].split(/\s+"/)[0]);
      return normalizeText(line.replace(match[0], ''));
    })
    .filter((line, index, array) => normalizeText(line) || array.some((item) => normalizeText(item)));

  return {
    lines: nextLines,
    imageUrl,
    imageAlt,
  };
}

function parseQuestionSection(sectionLines = [], sectionIndex = 0) {
  const [headingLine = '', ...bodyLines] = sectionLines;
  const promptLines = [];
  const options = [];
  const acceptedAnswers = [];
  let correctOptionId = '';
  let imageUrl = '';
  let imageAlt = '';
  let blankPlaceholder = '';
  let difficulty = QUIZ_DIFFICULTY_MEDIUM;
  let questionType = QUIZ_QUESTION_TYPE_SINGLE_CHOICE;

  const headingPrompt = extractHeadingPrompt(headingLine);

  if (headingPrompt) {
    promptLines.push(headingPrompt);
  }

  bodyLines.forEach((line) => {
    const normalizedLine = String(line ?? '').trimEnd();
    const optionMatch = normalizedLine.match(OPTION_RE);
    const imageValue = extractMetadataValue(normalizedLine, ['image', 'ảnh', 'anh']);
    const altValue = extractMetadataValue(normalizedLine, ['alt', 'image-alt', 'ảnh-alt', 'anh-alt', 'mô tả ảnh']);
    const typeValue = extractMetadataValue(normalizedLine, ['type', 'loại', 'loai']);
    const difficultyValue = extractMetadataValue(normalizedLine, ['difficulty', 'độ khó', 'do kho', 'level']);
    const placeholderValue = extractMetadataValue(normalizedLine, ['placeholder', 'gợi ý', 'goi y', 'hint']);
    const answersValue = extractMetadataValue(normalizedLine, ['answers', 'answer', 'đáp án', 'dap an']);

    if (optionMatch) {
      const optionId = createQuizItemId(`quiz-option-${sectionIndex + 1}`);
      const optionText = normalizeText(optionMatch[2]);
      options.push({
        id: optionId,
        text: optionText,
        order: options.length + 1,
      });

      if (optionMatch[1].toLowerCase() === 'x') {
        correctOptionId = optionId;
      }
      return;
    }

    if (difficultyValue) {
      difficulty = normalizeQuizDifficulty(difficultyValue);
      return;
    }

    if (typeValue) {
      const normalizedType = normalizeComparableText(typeValue);
      questionType =
        normalizedType.includes('fill') ||
        normalizedType.includes('blank') ||
        normalizedType.includes('khuyet')
          ? QUIZ_QUESTION_TYPE_FILL_BLANK
          : QUIZ_QUESTION_TYPE_SINGLE_CHOICE;
      return;
    }

    if (imageValue) {
      imageUrl = imageValue;
      return;
    }

    if (altValue) {
      imageAlt = altValue;
      return;
    }

    if (placeholderValue) {
      blankPlaceholder = placeholderValue;
      return;
    }

    if (answersValue) {
      answersValue
        .split('|')
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .forEach((item) => acceptedAnswers.push(item));
      return;
    }

    promptLines.push(normalizedLine);
  });

  const inlineImageResult = extractInlineImage(promptLines);
  const prompt = normalizeText(inlineImageResult.lines.join('\n'));

  if (!imageUrl && inlineImageResult.imageUrl) {
    imageUrl = inlineImageResult.imageUrl;
  }

  if (!imageAlt && inlineImageResult.imageAlt) {
    imageAlt = inlineImageResult.imageAlt;
  }

  if (!prompt) {
    throw new Error(`Câu ${sectionIndex + 1} trong file markdown chưa có nội dung câu hỏi.`);
  }

  if (questionType === QUIZ_QUESTION_TYPE_FILL_BLANK) {
    if (acceptedAnswers.length === 0) {
      throw new Error(`Câu ${sectionIndex + 1} dạng điền vào chỗ trống cần có dòng Answers:.`);
    }

    return {
      id: createQuizItemId(`quiz-question-${sectionIndex + 1}`),
      type: QUIZ_QUESTION_TYPE_FILL_BLANK,
      difficulty,
      prompt,
      imageUrl,
      imageAlt,
      blankPlaceholder,
      acceptedAnswers,
      order: sectionIndex + 1,
      options: [],
      correctOptionId: '',
    };
  }

  if (options.length < 2) {
    throw new Error(`Câu ${sectionIndex + 1} trong file markdown cần ít nhất 2 đáp án.`);
  }

  if (!correctOptionId) {
    throw new Error(`Câu ${sectionIndex + 1} trong file markdown chưa đánh dấu đáp án đúng bằng [x].`);
  }

  return {
    id: createQuizItemId(`quiz-question-${sectionIndex + 1}`),
    type: QUIZ_QUESTION_TYPE_SINGLE_CHOICE,
    difficulty,
    prompt,
    imageUrl,
    imageAlt,
    order: sectionIndex + 1,
    options,
    correctOptionId,
  };
}

export function parseQuizMarkdown(source, { sessionNumber = 5, quizMode = undefined, subject = '', level = '' } = {}) {
  const text = String(source ?? '').replace(/\r\n/g, '\n').trim();

  if (!text) {
    throw new Error('File markdown đang rỗng.');
  }

  const lines = text.split('\n');
  const titleMatch = lines.find((line) => /^#\s+/.test(line));
  const title = titleMatch ? normalizeText(titleMatch.replace(/^#\s+/, '')) : '';
  const contentLines = titleMatch ? lines.slice(lines.indexOf(titleMatch) + 1) : lines;
  const firstQuestionIndex = contentLines.findIndex((line) => isQuestionHeading(line));

  if (firstQuestionIndex < 0) {
    throw new Error('Không tìm thấy câu hỏi hợp lệ. Hãy dùng heading dạng "## Câu 1".');
  }

  const description =
    firstQuestionIndex > 0
      ? normalizeText(contentLines.slice(0, firstQuestionIndex).join('\n'))
      : '';
  const sections = splitQuestionSections(contentLines.slice(firstQuestionIndex));
  const questions = sections.map((section, index) => parseQuestionSection(section, index));

  return normalizeQuizConfigRecord(
    {
      sessionNumber,
      quizMode,
      subject,
      level,
      title: title || `Kiểm tra trắc nghiệm buổi ${Number(sessionNumber || 0)}`,
      description,
      questions,
    },
    sessionNumber,
    { subject, level },
  );
}
