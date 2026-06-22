import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  ExternalLink,
  FileCode2,
  Link2,
  Palette,
} from 'lucide-react';
import {
  CODE_SUBMISSION_EXTENSIONS,
  CODE_SUBMISSION_MAX_FILES_PER_SESSION,
  CODE_SUBMISSION_MAX_FILE_BYTES,
} from '../../lib/codeSubmissionLimits.js';

const GUIDE_UPDATED = '18/06/2026';
const MAX_FILE_KB = Math.round(CODE_SUBMISSION_MAX_FILE_BYTES / 1024);
const EXT_LIST = CODE_SUBMISSION_EXTENSIONS.join(', ');

export const GUIDE_SECTIONS = {
  overview: 'overview',
  github: 'github',
  git: 'git',
  canva: 'canva',
  code: 'code',
};

function GuideAccordion({ id, icon: Icon, title, subtitle, open, onToggle, children }) {
  return (
    <section id={`guide-${id}`} className="scroll-mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3.5 text-left transition hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-400">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          {subtitle && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-200 px-4 py-4 dark:border-slate-700">{children}</div>}
    </section>
  );
}

function StepList({ steps }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{step.title}</p>
            {step.body && <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>}
            {step.tip && (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
                <span className="font-medium">Mẹo:</span> {step.tip}
              </p>
            )}
            {step.note && (
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{step.note}</p>
            )}
            {step.commands?.length > 0 && (
              <CmdBlock lines={step.commands} caption={step.commandsCaption} />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function CmdBlock({ lines, caption }) {
  return (
    <div className="space-y-1">
      {caption && <p className="text-xs text-slate-500 dark:text-slate-400">{caption}</p>}
      <pre className="overflow-x-auto rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs leading-relaxed text-emerald-300">
        {lines.map((line) => (
          <code key={line} className="block font-mono whitespace-pre">
            {line}
          </code>
        ))}
      </pre>
      <p className="text-[11px] text-slate-400">
        Gõ hoặc copy từng dòng vào terminal, nhấn Enter sau mỗi dòng. Thay phần trong &lt;...&gt; bằng thông tin của
        bạn.
      </p>
    </div>
  );
}

function GuidePart({ title, description, children }) {
  return (
    <div className="space-y-3 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0 dark:border-slate-700">
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Checklist({ items }) {
  return (
    <ul className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <li className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Checklist trước khi nộp
      </li>
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm text-emerald-900 dark:text-emerald-100">
          <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 stroke-[2]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CommonErrors({ items }) {
  return (
    <div className="mt-4 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        Lỗi thường gặp
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.problem}
            className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/10"
          >
            <p className="font-medium text-amber-900 dark:text-amber-100">{item.problem}</p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">{item.fix}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExternalGuideLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

const GITHUB_STEPS = [
  {
    title: 'Tạo tài khoản GitHub (nếu chưa có)',
    body: 'Vào github.com → Sign up → làm theo hướng dẫn. Xác nhận email nếu GitHub yêu cầu.',
    tip: 'Ghi nhớ tên đăng nhập — nó sẽ nằm trong link repo của bạn.',
  },
  {
    title: 'Tạo kho lưu trữ (repository) mới',
    body: 'Đăng nhập → nhấn dấu + góc trên phải → New repository. Đặt tên (ví dụ: du-an-cuoi-khoa). Chọn Public. Có thể bỏ qua README nếu bạn sẽ upload file ngay.',
  },
  {
    title: 'Đưa code lên GitHub bằng trình duyệt (cách dễ nhất)',
    body: 'Trong repo vừa tạo, chọn "uploading an existing file" hoặc "Add file" → "Upload files". Kéo thả thư mục/file code (.py, .html, …) vào. Kéo xuống cuối → Commit changes.',
    tip: 'Nếu file nằm trong nhiều thư mục, hãy upload từng thư mục hoặc dùng GitHub Desktop (bước 4).',
  },
  {
    title: '(Tuỳ chọn) Dùng GitHub Desktop khi có nhiều file',
    body: 'Tải GitHub Desktop từ desktop.github.com → đăng nhập → File → Add local repository hoặc Clone. Copy code vào thư mục repo → Commit → Push origin. Cách này tiện khi cập nhật code nhiều lần.',
    tip: 'Nếu bạn quen dùng terminal hoặc VS Code, xem thêm mục «Dùng Git: commit & push» bên dưới — hướng dẫn từng lệnh chi tiết.',
  },
  {
    title: 'Copy link repo',
    body: 'Mở trang chính của repo trên trình duyệt. Copy URL trên thanh địa chỉ — dạng https://github.com/ten-ban/ten-du-an. Hoặc nhấn nút Code (màu xanh) → tab HTTPS → copy URL.',
    note: 'Link đúng là trang repo, không phải link một file đơn lẻ trong repo.',
  },
  {
    title: 'Dán link vào cổng học sinh',
    body: 'Tab Báo cáo → mục Bổ sung dự án → Liên kết sản phẩm → ô GitHub → dán link → Lưu liên kết.',
  },
];

const GIT_INSTALL_STEPS = [
  {
    title: 'Tải và cài Git',
    body: 'Vào git-scm.com/download/win (Windows) hoặc git-scm.com/download/mac (Mac). Tải bản mới nhất và cài — cứ nhấn Next, giữ mặc định là được.',
    tip: 'Sau khi cài xong, có thể cần khởi động lại máy hoặc đóng/mở lại terminal.',
  },
  {
    title: 'Kiểm tra Git đã cài thành công',
    body: 'Mở Terminal (Mac) hoặc PowerShell / Terminal (Windows). Gõ lệnh bên dưới. Nếu hiện số phiên bản (ví dụ git version 2.43.0) là OK.',
    commands: ['git --version'],
  },
];

const GIT_CONFIG_STEPS = [
  {
    title: 'Cấu hình tên và email (chỉ làm một lần trên máy)',
    body: 'Git cần biết bạn là ai khi tạo commit. Dùng đúng tên hiển thị và email đã đăng ký GitHub.',
    commands: [
      'git config --global user.name "Ten cua ban"',
      'git config --global user.email "email@example.com"',
    ],
    commandsCaption: 'Ví dụ: git config --global user.name "Nguyen Van A"',
  },
  {
    title: 'Kiểm tra lại cấu hình',
    body: 'Chạy hai lệnh sau — phải hiện đúng tên và email vừa nhập.',
    commands: ['git config --global user.name', 'git config --global user.email'],
  },
];

const GIT_FIRST_PUSH_STEPS = [
  {
    title: 'Tạo repo trống trên GitHub trước',
    body: 'Làm bước 1–2 ở mục «Đưa code lên GitHub» (tạo tài khoản + New repository). Chọn Public. Không tick «Add a README» nếu bạn sẽ đẩy code từ máy lên.',
    note: 'Giữ tab GitHub mở — bạn sẽ cần copy URL repo.',
  },
  {
    title: 'Chuẩn bị thư mục code trên máy',
    body: 'Gom toàn bộ file dự án vào một thư mục (ví dụ D:\\DuAn\\du-an-cuoi-khoa hoặc ~/Documents/du-an-cuoi-khoa). Trong thư mục đó phải có file code (.py, .html, …).',
    tip: 'Mở File Explorer / Finder → vào đúng thư mục chứa file main.py hoặc index.html.',
  },
  {
    title: 'Mở terminal ngay trong thư mục dự án',
    body: 'Windows: trong File Explorer, vào thư mục dự án → thanh địa chỉ gõ cmd hoặc powershell → Enter. Hoặc chuột phải thư mục → «Open in Terminal». Mac: Finder → thư mục → chuột phải → New Terminal at Folder.',
    note: 'Quan trọng: terminal phải «đứng» trong thư mục có code, không phải Desktop hay ổ C:.',
  },
  {
    title: 'Khởi tạo Git trong thư mục (lần đầu)',
    body: 'Lệnh git init tạo kho Git cục bộ. Sau đó git status liệt kê file — ban đầu thường hiện màu đỏ (chưa được theo dõi).',
    commands: ['git init', 'git status'],
  },
  {
    title: 'Thêm tất cả file vào «khu vực chờ» (staging)',
    body: 'git add . nghĩa là chọn mọi file trong thư mục hiện tại để chuẩn bị commit. Dấu chấm . rất quan trọng — đừng bỏ.',
    commands: ['git add .', 'git status'],
    tip: 'Sau git add ., git status thường hiện file màu xanh lá — sẵn sàng commit.',
  },
  {
    title: 'Tạo commit (ghi lại phiên bản)',
    body: 'Commit giống như chụp ảnh trạng thái code tại thời điểm này. Phần trong ngoặc kép là mô tả ngắn — bạn tự đặt, tiếng Việt hoặc tiếng Anh đều được.',
    commands: ['git commit -m "Lan dau dua code len GitHub"'],
    note: 'Nếu báo «nothing to commit», kiểm tra lại bước 4–5: đã git add . chưa? Có file trong thư mục không?',
  },
  {
    title: 'Đặt tên nhánh là main',
    body: 'GitHub mặc định dùng nhánh main. Lệnh này đổi tên nhánh hiện tại thành main (an toàn chạy cả lần đầu).',
    commands: ['git branch -M main'],
  },
  {
    title: 'Liên kết thư mục máy với repo GitHub',
    body: 'Copy URL repo trên GitHub (nút Code → HTTPS). Dán thay cho <URL_REPO> trong lệnh dưới — không thêm dấu cách thừa.',
    commands: ['git remote add origin <URL_REPO>'],
    commandsCaption: 'Ví dụ: git remote add origin https://github.com/ten-ban/du-an-cuoi-khoa.git',
    tip: 'Nếu báo «remote origin already exists», bạn đã chạy lệnh này rồi — bỏ qua bước này.',
  },
  {
    title: 'Đẩy code lên GitHub (push)',
    body: 'Lần đầu dùng -u origin main để Git nhớ repo đích. Có thể hiện cửa sổ đăng nhập GitHub — đăng nhập và cho phép.',
    commands: ['git push -u origin main'],
    note: 'Push thành công khi terminal không báo lỗi đỏ và bạn thấy file trên github.com trong repo.',
  },
  {
    title: 'Kiểm tra trên trình duyệt',
    body: 'Mở repo trên GitHub → tab Code → phải thấy đủ file vừa push. Copy URL trang repo → dán vào cổng học sinh (tab Báo cáo → Liên kết sản phẩm → GitHub → Lưu).',
  },
];

const GIT_UPDATE_STEPS = [
  {
    title: 'Mở terminal trong thư mục dự án (như lần đầu)',
    body: 'Mỗi lần sửa code xong, quay lại đúng thư mục dự án rồi mở terminal.',
  },
  {
    title: 'Xem file nào đã thay đổi',
    body: 'git status liệt kê file mới hoặc file đã sửa (màu đỏ = chưa add).',
    commands: ['git status'],
  },
  {
    title: 'Chọn file cần đưa lên',
    body: 'Cách đơn giản nhất: add tất cả file đã sửa.',
    commands: ['git add .'],
    tip: 'Chỉ muốn add một file: git add ten_file.py',
  },
  {
    title: 'Commit với mô tả thay đổi',
    body: 'Viết mô tả ngắn gọn — giáo viên đọc được lịch sử commit trên GitHub.',
    commands: ['git commit -m "Sua loi game va them man hinh ket thuc"'],
  },
  {
    title: 'Push lên GitHub',
    body: 'Từ lần thứ hai trở đi chỉ cần git push (không cần -u origin main nữa).',
    commands: ['git push'],
  },
  {
    title: 'Refresh trang GitHub để xác nhận',
    body: 'F5 trên trang repo — file mới nhất phải khớp với code trên máy.',
  },
];

const GIT_VSCODE_STEPS = [
  {
    title: 'Mở thư mục dự án trong VS Code',
    body: 'File → Open Folder → chọn thư mục dự án.',
  },
  {
    title: 'Mở terminal tích hợp',
    body: 'Menu Terminal → New Terminal (hoặc Ctrl + `). Terminal mở sẵn đúng thư mục dự án — chạy các lệnh git như phần trên.',
    tip: 'Tab Source Control (Ctrl+Shift+G) cũng hiện file thay đổi, nhưng hướng dẫn này dùng lệnh để bạn hiểu rõ từng bước.',
  },
];

const GIT_CLI_ERRORS = [
  {
    problem: 'fatal: not a git repository',
    fix: 'Bạn chưa chạy git init hoặc đang đứng sai thư mục. Mở terminal trong thư mục có code → chạy git init.',
  },
  {
    problem: 'Please tell me who you are / user.email chưa cấu hình',
    fix: 'Chạy lại git config --global user.name và user.email (phần B), rồi commit lại.',
  },
  {
    problem: 'git push bị từ chối / Authentication failed',
    fix: 'Đăng nhập lại GitHub khi terminal hỏi. Windows: có thể cần Git Credential Manager. Thử đăng xuất GitHub trên trình duyệt rồi push lại để hiện cửa sổ đăng nhập.',
  },
  {
    problem: 'error: remote origin already exists',
    fix: 'Đã liên kết repo rồi. Bỏ qua git remote add. Nếu URL sai: git remote set-url origin <URL_REPO_MOI>.',
  },
  {
    problem: 'failed to push / rejected (fetch first)',
    fix: 'Repo trên GitHub có commit mà máy chưa có (ví dụ đã tạo README trên web). Chạy: git pull origin main --rebase rồi git push. Hoặc tạo repo mới trống không README.',
  },
  {
    problem: 'nothing to commit, working tree clean',
    fix: 'Không có thay đổi mới — bạn chưa lưu file code hoặc chưa sửa gì sau lần commit trước.',
  },
  {
    problem: 'src refspec main does not match any',
    fix: 'Chưa có commit nào. Chạy git add . rồi git commit -m "..." trước khi push.',
  },
  {
    problem: 'Lệnh git không được nhận (command not found)',
    fix: 'Git chưa cài hoặc chưa restart terminal sau khi cài. Cài lại từ git-scm.com và mở terminal mới.',
  },
];

const CANVA_STEPS = [
  {
    title: 'Mở thiết kế Canva của bạn',
    body: 'Đăng nhập canva.com → mở slide/thiết kế dự án cuối khóa.',
  },
  {
    title: 'Nhấn Share (Chia sẻ)',
    body: 'Nút Share ở góc trên phải (biểu tượng mũi tên hoặc chữ "Chia sẻ").',
  },
  {
    title: 'Đặt quyền xem cho người có link',
    body: 'Chọn "Anyone with the link" / "Bất kỳ ai có liên kết". Quyền nên là "Can view" / "Chỉ xem" — không để "Restricted" hay chỉ mình bạn xem được.',
    tip: 'Giáo viên không cần tài khoản Canva của bạn; chỉ cần mở được link.',
  },
  {
    title: 'Copy link',
    body: 'Nhấn Copy link. Canva có thể cho link dạng www.canva.com/design/... hoặc canva.link/... — cả hai đều được chấp nhận trên cổng học sinh.',
  },
  {
    title: 'Kiểm tra link trước khi nộp',
    body: 'Mở tab ẩn danh (Ctrl+Shift+N trên Chrome) → dán link → xem mở được không. Nếu bị yêu cầu đăng nhập hoặc "Access denied", quay lại bước 3 chỉnh quyền.',
  },
  {
    title: 'Dán vào cổng học sinh',
    body: 'Tab Báo cáo → Bổ sung dự án → Liên kết sản phẩm → ô Canva → dán link → Lưu liên kết.',
  },
];

const CODE_STEPS = [
  {
    title: 'Mở mục nộp file theo buổi',
    body: 'Tab Báo cáo → Bổ sung dự án → Nộp file code theo buổi.',
  },
  {
    title: 'Chọn đúng buổi học',
    body: 'Chọn số buổi tương ứng với file bạn nộp (ví dụ buổi 5 → chọn Buổi 5). Mỗi buổi có danh sách file riêng.',
  },
  {
    title: 'Chọn file và upload',
    body: `Nhấn chọn file từ máy. Định dạng cho phép: ${EXT_LIST}. Tối đa ${MAX_FILE_KB} KB mỗi file, tối đa ${CODE_SUBMISSION_MAX_FILES_PER_SESSION} file mỗi buổi.`,
    tip: 'Nếu file quá lớn, xóa dòng thừa hoặc tách file nhỏ hơn trước khi nộp.',
  },
  {
    title: 'Xác nhận đã nộp',
    body: 'Sau khi upload, tên file hiện trong danh sách. Có thể tải lại hoặc xóa nếu nộp nhầm, rồi upload file đúng.',
  },
];

export function ProjectSubmissionGuide({ initialSection = GUIDE_SECTIONS.overview, embedded = false }) {
  const [openSections, setOpenSections] = useState(() => new Set([initialSection]));
  const scrolledRef = useRef(false);

  useEffect(() => {
    setOpenSections((prev) => new Set([...prev, initialSection]));
    scrolledRef.current = false;
  }, [initialSection]);

  useEffect(() => {
    if (scrolledRef.current || initialSection === GUIDE_SECTIONS.overview) return;
    const el = document.getElementById(`guide-${initialSection}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrolledRef.current = true;
    }
  }, [initialSection]);

  const toggle = (id) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const wrapperClass = embedded ? 'space-y-4' : 'card space-y-4 p-5 sm:p-6';

  return (
    <div className={wrapperClass}>
      <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Hướng dẫn nộp dự án</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Làm theo từng bước bên dưới để nộp GitHub, Canva và file code theo buổi. Bạn có thể đọc một lần rồi quay
          lại tab <strong>Báo cáo</strong> để điền link và upload.
        </p>
        <p className="text-xs text-slate-400">Cập nhật: {GUIDE_UPDATED}</p>
      </header>

      <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-800 dark:text-brand-200">
          <Link2 className="h-4 w-4" />
          Nộp gì ở đâu?
        </p>
        <ul className="mt-3 space-y-2 text-sm text-brand-900/90 dark:text-brand-100/90">
          <li className="flex gap-2">
            <Code2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>GitHub</strong> — toàn bộ mã nguồn dự án (repo chính, giáo viên xem code tổng thể).
            </span>
          </li>
          <li className="flex gap-2">
            <Palette className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Canva</strong> — slide hoặc thiết kế trình bày (link xem, không cần quyền chỉnh sửa).
            </span>
          </li>
          <li className="flex gap-2">
            <FileCode2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>File theo buổi</strong> — file code từng buổi học trên cổng này ({EXT_LIST}).{' '}
              <em>Không thay thế GitHub.</em>
            </span>
          </li>
        </ul>
      </div>

      <GuideAccordion
        id={GUIDE_SECTIONS.github}
        icon={Code2}
        title="Đưa code lên GitHub"
        subtitle="Tạo repo, upload file, copy link"
        open={openSections.has(GUIDE_SECTIONS.github)}
        onToggle={() => toggle(GUIDE_SECTIONS.github)}
      >
        <StepList steps={GITHUB_STEPS} />
        <Checklist
          items={[
            'Repo để Public (công khai) hoặc giáo viên đã được mời xem nếu Private.',
            'Link dạng https://github.com/tên-bạn/tên-repo — mở được trên trình duyệt.',
            'Đã nhấn Lưu liên kết trên cổng học sinh sau khi dán.',
          ]}
        />
        <CommonErrors
          items={[
            {
              problem: 'Dán link một file thay vì link repo',
              fix: 'Mở trang chính của repo (có tab Code, Issues…) rồi copy URL đó.',
            },
            {
              problem: 'Repo Private, giáo viên không xem được',
              fix: 'Đổi sang Public: Settings → Danger Zone → Change visibility. Hoặc mời giáo viên làm collaborator.',
            },
            {
              problem: 'Chưa commit sau khi upload file trên web',
              fix: 'Kéo file xong phải nhấn Commit changes thì code mới lên GitHub.',
            },
          ]}
        />
        <p className="mt-4 text-xs text-slate-500">
          Tài liệu tham khảo:{' '}
          <ExternalGuideLink href="https://docs.github.com/en/get-started/start-your-journey/uploading-a-project-to-github">
            Upload project lên GitHub (tiếng Anh)
          </ExternalGuideLink>
        </p>
      </GuideAccordion>

      <GuideAccordion
        id={GUIDE_SECTIONS.git}
        icon={Code2}
        title="Dùng Git: commit & push (tuỳ chọn, nâng cao)"
        subtitle="Terminal · từng lệnh · cập nhật code nhiều lần"
        open={openSections.has(GUIDE_SECTIONS.git)}
        onToggle={() => toggle(GUIDE_SECTIONS.git)}
      >
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2.5 text-sm text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-100">
          <strong>Không bắt buộc.</strong> Nếu lần đầu dùng GitHub, hãy dùng upload trên web (mục trên) cho
          dễ. Chọn phần này khi bạn đã cài Git, quen terminal, và muốn <em>commit + push</em> mỗi khi sửa code.
        </div>

        <GuidePart
          title="Phần A — Cài đặt Git"
          description="Làm một lần trên máy tính của bạn."
        >
          <StepList steps={GIT_INSTALL_STEPS} />
        </GuidePart>

        <GuidePart
          title="Phần B — Cấu hình lần đầu (một lần / máy)"
          description="Git cần tên và email trước khi cho phép commit."
        >
          <StepList steps={GIT_CONFIG_STEPS} />
        </GuidePart>

        <GuidePart
          title="Phần C — Đẩy code lên GitHub lần đầu"
          description="Làm đủ 10 bước theo thứ tự. Đừng bỏ bước."
        >
          <StepList steps={GIT_FIRST_PUSH_STEPS} />
        </GuidePart>

        <GuidePart
          title="Phần D — Cập nhật code các lần sau"
          description="Mỗi khi sửa xong bài, lặp lại quy trình ngắn này."
        >
          <StepList steps={GIT_UPDATE_STEPS} />
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Tóm tắt 3 lệnh hay dùng nhất</p>
            <CmdBlock
              lines={['git add .', 'git commit -m "Mo ta thay doi"', 'git push']}
              caption="Chạy lần lượt sau mỗi lần chỉnh sửa code"
            />
          </div>
        </GuidePart>

        <GuidePart
          title="Phần E — Dùng terminal trong VS Code"
          description="Tiện nếu bạn code bằng VS Code."
        >
          <StepList steps={GIT_VSCODE_STEPS} />
        </GuidePart>

        <Checklist
          items={[
            'Đã chạy git --version và thấy số phiên bản.',
            'Đã cấu hình user.name và user.email (một lần).',
            'Terminal đang mở đúng thư mục chứa file code.',
            'Đã git add . → commit → push; thấy file trên github.com.',
            'Đã copy link repo và Lưu liên kết trên cổng học sinh.',
          ]}
        />
        <CommonErrors items={GIT_CLI_ERRORS} />
        <p className="mt-4 text-xs text-slate-500">
          Tài liệu tham khảo:{' '}
          <ExternalGuideLink href="https://docs.github.com/en/get-started/importing-your-projects-to-github/importing-source-code-to-github/adding-locally-hosted-code-to-github">
            Thêm code local lên GitHub (tiếng Anh)
          </ExternalGuideLink>
        </p>
      </GuideAccordion>

      <GuideAccordion
        id={GUIDE_SECTIONS.canva}
        icon={Palette}
        title="Chia sẻ link Canva"
        subtitle="Anyone with the link · Can view"
        open={openSections.has(GUIDE_SECTIONS.canva)}
        onToggle={() => toggle(GUIDE_SECTIONS.canva)}
      >
        <StepList steps={CANVA_STEPS} />
        <Checklist
          items={[
            'Quyền "Anyone with the link" + "Can view" (chỉ xem).',
            'Link canva.com hoặc canva.link mở được ở tab ẩn danh.',
            'Đã nhấn Lưu liên kết trên cổng học sinh.',
          ]}
        />
        <CommonErrors
          items={[
            {
              problem: 'Link chỉ mình bạn xem được',
              fix: 'Share → đổi từ Restricted sang Anyone with the link → Can view.',
            },
            {
              problem: 'Dán link chỉnh sửa (edit) thay vì xem',
              fix: 'Dùng link xem (view). Giáo viên chỉ cần xem slide, không cần sửa.',
            },
            {
              problem: 'Link hết hạn hoặc thiết kế đã xóa',
              fix: 'Mở lại thiết kế trên Canva, tạo link share mới và cập nhật trên cổng.',
            },
          ]}
        />
      </GuideAccordion>

      <GuideAccordion
        id={GUIDE_SECTIONS.code}
        icon={FileCode2}
        title="Nộp file code theo buổi"
        subtitle={`${EXT_LIST} · tối đa ${MAX_FILE_KB} KB/file`}
        open={openSections.has(GUIDE_SECTIONS.code)}
        onToggle={() => toggle(GUIDE_SECTIONS.code)}
      >
        <StepList steps={CODE_STEPS} />
        <Checklist
          items={[
            `Đúng buổi học và đúng định dạng (${EXT_LIST}).`,
            `Mỗi file ≤ ${MAX_FILE_KB} KB, tối đa ${CODE_SUBMISSION_MAX_FILES_PER_SESSION} file/buổi.`,
            'Tên file dễ nhận biết (ví dụ: buoi5_game.py).',
          ]}
        />
        <CommonErrors
          items={[
            {
              problem: 'File .zip hoặc .txt bị từ chối',
              fix: `Chỉ nộp từng file code đúng đuôi: ${EXT_LIST}. Giải nén zip trước khi upload.`,
            },
            {
              problem: 'Nhầm với GitHub',
              fix: 'GitHub = cả dự án. File theo buổi = bài làm từng buổi trên cổng. Nên làm cả hai nếu giáo viên yêu cầu.',
            },
            {
              problem: 'Upload nhầm buổi',
              fix: 'Xóa file sai buổi, chọn đúng buổi rồi upload lại.',
            },
          ]}
        />
      </GuideAccordion>
    </div>
  );
}
