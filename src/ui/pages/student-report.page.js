import { getClassCurriculumView } from '../../services/curriculum.service.js';
import { getClassRoster, listActiveClasses, submitStudentReport } from '../../services/public-api.service.js';
import { attachHiddenAdminShortcut } from '../../utils/admin-shortcut.js';
import { isToday } from '../../utils/date.js';
import { escapeHtml } from '../../utils/html.js';
import { getLockedReportClassCode } from '../../utils/route.js';
import { validateReportForm } from '../../utils/validators.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderClassSelect } from '../components/ClassSelect.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderProjectSummary } from '../components/ProjectSummary.js';
import { renderProjectWaterfallGuide } from '../components/ProjectWaterfallGuide.js';
import { renderReportForm } from '../components/ReportForm.js';
import { renderStudentLibraryCta } from '../components/StudentLibraryCta.js';
import { renderStudentSelect } from '../components/StudentSelect.js';
import { renderToastStack, showToast } from '../components/ToastStack.js';

function getErrorMessage(error, fallback) {
  return error?.message || fallback;
}

function getFormDefaults(student) {
  return {
    doneToday: '',
    nextGoal: '',
    difficulties: '',
    progressPercent: student?.currentProgressPercent ?? '',
    stage: student?.currentStage ?? '',
    status: student?.currentStatus ?? '',
  };
}

function renderLockedClassField(classInfo) {
  const classCode = classInfo?.classCode || 'Chưa xác định';
  const className = classInfo?.className || 'Lớp này đang được mở theo đường dẫn riêng.';

  return `
    <div class="student-report-field">
      <label class="form-label">Mã lớp</label>
      <div class="student-report-locked-class">
        <strong title="${escapeHtml(classCode)}">${escapeHtml(classCode)}</strong>
        <span>${escapeHtml(className)}</span>
      </div>
    </div>
  `;
}

function shouldShowProgressForm(curriculumPreview) {
  if (!curriculumPreview?.program || !curriculumPreview?.assignment) {
    return true;
  }

  return curriculumPreview.assignment.curriculumPhase === 'final' && curriculumPreview.program.finalMode === 'project';
}

function renderReportAvailabilityNotice(curriculumPreview) {
  if (!curriculumPreview?.program || !curriculumPreview?.assignment) {
    return '';
  }

  if (curriculumPreview.assignment.curriculumPhase !== 'final') {
    return renderAlert(
      'Form báo cáo tiến độ sản phẩm sẽ mở khi lớp chuyển sang giai đoạn làm sản phẩm cuối khóa.',
      'info',
    );
  }

  if (curriculumPreview.program.finalMode !== 'project') {
    return renderAlert(
      'Lớp này đang ở giai đoạn ôn kiểm tra cuối khóa, nên không dùng form báo cáo tiến độ sản phẩm.',
      'info',
    );
  }

  return '';
}

function renderCurriculumSlot(curriculumPreview, selectedClassInfo, curriculumLoading, curriculumError) {
  if (!selectedClassInfo?.classCode) {
    return '';
  }

  return renderStudentLibraryCta(curriculumPreview, selectedClassInfo, curriculumLoading, curriculumError);
}

export const studentReportPage = {
  title: 'Học tập & báo cáo dự án',
  async render() {
    return `
      <div class="student-layout student-report-layout">
        <main class="student-report-page">
          <div class="container-fluid student-page-shell">
            <header class="student-report-header">
              ${renderBrandLogo({
                id: 'student-brand-trigger',
                className: 'student-report-brand',
                tone: 'dark',
                compact: true,
              })}
            </header>

            <div id="student-page-alert"></div>

            <section class="student-report-command-card" aria-label="Chọn lớp và học sinh">
              <div class="student-report-command-grid">
                <div id="class-select-slot">${renderLoadingOverlay('Đang tải thông tin lớp...')}</div>
                <div id="student-select-slot">${renderStudentSelect([])}</div>
              </div>
            </section>

            <section class="student-report-context-card" aria-label="Tóm tắt học sinh">
              <div id="project-summary-slot">${renderProjectSummary(null)}</div>
              <div id="curriculum-review-slot"></div>
            </section>

            <div id="project-waterfall-slot"></div>

            <div id="student-report-form-slot">${renderReportForm({}, { disabled: true })}</div>
          </div>
        </main>
        ${renderToastStack()}
      </div>
    `;
  },
  async mount() {
    const pageAlert = document.getElementById('student-page-alert');
    const classSlot = document.getElementById('class-select-slot');
    const studentSlot = document.getElementById('student-select-slot');
    const summarySlot = document.getElementById('project-summary-slot');
    const reviewSlot = document.getElementById('curriculum-review-slot');
    const waterfallSlot = document.getElementById('project-waterfall-slot');
    const formSlot = document.getElementById('student-report-form-slot');
    const brandTrigger = document.getElementById('student-brand-trigger');
    const lockedClassCode = getLockedReportClassCode();

    let classes = [];
    let students = [];
    let selectedClassCode = lockedClassCode || '';
    let selectedStudentId = '';
    let lockedClass = null;
    let lockedClassError = '';
    let rosterError = '';
    let curriculumPreview = null;
    let curriculumLoading = false;
    let curriculumError = '';

    function getSelectedStudent() {
      return students.find((student) => student.studentId === selectedStudentId) || null;
    }

    function getSelectedClassInfo() {
      return (
        classes.find((classItem) => classItem.classCode === selectedClassCode) ||
        lockedClass ||
        (selectedClassCode ? { classCode: selectedClassCode, className: '' } : null)
      );
    }

    function getReportHelperText(selectedStudent) {
      if (!selectedStudent) {
        return '';
      }

      if (selectedStudent.lastReportedAt) {
        return 'Ba ô nội dung sẽ không tự điền lại từ báo cáo trước. Hãy nhập cập nhật mới cho buổi này.';
      }

      return 'Bạn chưa có báo cáo trước đó, hãy nhập mới.';
    }

    function renderSelections() {
      const selectedStudent = getSelectedStudent();
      const selectedClassInfo = getSelectedClassInfo();
      const canShowReportForm = shouldShowProgressForm(curriculumPreview);

      classSlot.innerHTML = lockedClassCode
        ? renderLockedClassField(lockedClass || { classCode: selectedClassCode || lockedClassCode, className: '' })
        : renderClassSelect(classes, selectedClassCode);
      studentSlot.innerHTML = renderStudentSelect(students, selectedStudentId);
      summarySlot.innerHTML = renderProjectSummary(selectedStudent);
      reviewSlot.innerHTML = renderCurriculumSlot(
        curriculumPreview,
        selectedClassInfo,
        curriculumLoading,
        curriculumError,
      );
      waterfallSlot.innerHTML = renderProjectWaterfallGuide(curriculumPreview, selectedStudent);
      formSlot.innerHTML = canShowReportForm
        ? renderReportForm(getFormDefaults(selectedStudent), {
            disabled: !selectedStudent,
            helperText: getReportHelperText(selectedStudent),
          })
        : renderReportAvailabilityNotice(curriculumPreview);
    }

    function renderPageAlertState() {
      if (lockedClassError) {
        pageAlert.innerHTML = renderAlert(lockedClassError, 'danger');
        return;
      }

      if (rosterError) {
        pageAlert.innerHTML = renderAlert(rosterError, 'danger');
        return;
      }

      if (!selectedClassCode) {
        pageAlert.innerHTML = '';
        return;
      }

      if (students.length === 0) {
        pageAlert.innerHTML = renderAlert('Lớp này hiện chưa có học sinh hoạt động để gửi báo cáo.', 'warning');
        return;
      }

      const selectedStudent = getSelectedStudent();

      if (!selectedStudent) {
        pageAlert.innerHTML = renderAlert('Chọn đúng tên của bạn để mở form báo cáo.', 'info');
        return;
      }

      if (selectedStudent.lastReportedAt && isToday(selectedStudent.lastReportedAt)) {
        pageAlert.innerHTML = renderAlert(
          'Hôm nay bạn đã gửi báo cáo. Nếu có cập nhật mới, bạn vẫn có thể gửi thêm.',
          'warning',
        );
        return;
      }

      pageAlert.innerHTML = '';
    }

    async function loadClassContext() {
      if (!selectedClassCode) {
        students = [];
        selectedStudentId = '';
        curriculumPreview = null;
        curriculumLoading = false;
        curriculumError = '';
        rosterError = '';
        renderSelections();
        renderPageAlertState();
        return;
      }

      studentSlot.innerHTML = renderLoadingOverlay('Đang tải danh sách học sinh...');
      reviewSlot.innerHTML = renderStudentLibraryCta(null, { classCode: selectedClassCode }, true);
      curriculumLoading = true;
      curriculumError = '';
      rosterError = '';

      const [rosterResult, curriculumResult] = await Promise.allSettled([
        getClassRoster(selectedClassCode),
        getClassCurriculumView(selectedClassCode),
      ]);

      if (rosterResult.status === 'fulfilled') {
        students = rosterResult.value;

        if (!students.some((student) => student.studentId === selectedStudentId)) {
          selectedStudentId = '';
        }
      } else {
        students = [];
        selectedStudentId = '';

        if (lockedClassCode) {
          lockedClassError = getErrorMessage(
            rosterResult.reason,
            'Link lớp này hiện không thể sử dụng để gửi báo cáo.',
          );
        } else {
          rosterError = getErrorMessage(rosterResult.reason, 'Không tải được danh sách học sinh.');
        }
      }

      if (curriculumResult.status === 'fulfilled') {
        curriculumPreview = curriculumResult.value;
        curriculumError = '';
      } else {
        curriculumPreview = null;
        curriculumError = getErrorMessage(curriculumResult.reason, 'Không tải được phần học liệu của lớp này.');
      }

      curriculumLoading = false;
      renderSelections();
      renderPageAlertState();
    }

    async function loadClasses() {
      try {
        classes = await listActiveClasses();

        if (lockedClassCode) {
          lockedClass = classes.find((item) => item.classCode === lockedClassCode) || null;
          selectedClassCode = lockedClassCode;
          renderSelections();

          if (!lockedClass) {
            lockedClassError = 'Link lớp này không hợp lệ hoặc lớp hiện không mở để gửi báo cáo.';
            renderPageAlertState();
            return;
          }

          await loadClassContext();
          return;
        }

        renderSelections();

        if (classes.length === 0) {
          pageAlert.innerHTML = renderAlert('Hiện chưa có lớp đang mở để học sinh gửi báo cáo.', 'warning');
        }
      } catch (error) {
        const fallback = lockedClassCode
          ? 'Không tải được thông tin lớp từ đường dẫn này.'
          : 'Không tải được danh sách lớp.';
        pageAlert.innerHTML = renderAlert(getErrorMessage(error, fallback), 'danger');
      }
    }

    classSlot.addEventListener('change', async (event) => {
      if (event.target.id !== 'student-class-select') {
        return;
      }

      selectedClassCode = event.target.value;
      selectedStudentId = '';
      lockedClassError = '';
      await loadClassContext();
    });

    studentSlot.addEventListener('change', (event) => {
      if (event.target.id !== 'student-name-select') {
        return;
      }

      selectedStudentId = event.target.value;
      renderSelections();
      renderPageAlertState();
    });

    formSlot.addEventListener('submit', async (event) => {
      const form = event.target;

      if (form.id !== 'student-report-form') {
        return;
      }

      event.preventDefault();

      const formData = new FormData(form);
      const rawDifficulties = String(formData.get('difficulties') ?? '').trim();
      const status = formData.get('status');
      const payload = {
        classCode: selectedClassCode,
        studentId: selectedStudentId,
        doneToday: formData.get('doneToday'),
        nextGoal: formData.get('nextGoal'),
        difficulties: rawDifficulties || (status === 'Cần hỗ trợ' ? '' : 'Không có khó khăn'),
        progressPercent: Number(formData.get('progressPercent')),
        stage: formData.get('stage'),
        status,
      };
      const validation = validateReportForm(payload);
      const alertSlot = document.getElementById('student-report-alert');

      if (!validation.isValid) {
        alertSlot.innerHTML = renderAlert(Object.values(validation.errors).join('<br>'), 'danger');
        return;
      }

      const submitButtons = [...form.querySelectorAll('button[type="submit"]')];
      submitButtons.forEach((button) => {
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang gửi...';
      });

      try {
        await submitStudentReport(payload);
        alertSlot.innerHTML = renderAlert('Báo cáo đã được gửi thành công.', 'success');
        showToast({
          title: 'Đã lưu báo cáo',
          message: 'Cập nhật của bạn đã được ghi nhận.',
          variant: 'success',
        });

        await loadClassContext();
        renderSelections();
        renderPageAlertState();
      } catch (error) {
        alertSlot.innerHTML = renderAlert(getErrorMessage(error, 'Không thể gửi báo cáo lúc này.'), 'danger');
      } finally {
        submitButtons.forEach((button) => {
          button.disabled = false;
          button.innerHTML = '<i class="bi bi-send me-2"></i>Gửi báo cáo';
        });
      }
    });

    const cleanupShortcut = attachHiddenAdminShortcut({
      brandElement: brandTrigger,
      onTrigger: () => {
        window.location.assign('/#/admin/login');
      },
    });

    renderSelections();
    renderPageAlertState();
    await loadClasses();

    return () => {
      cleanupShortcut?.();
    };
  },
};
