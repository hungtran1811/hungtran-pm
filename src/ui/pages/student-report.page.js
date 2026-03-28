import { getClassRoster, listActiveClasses, submitStudentReport } from '../../services/public-api.service.js';
import { isToday } from '../../utils/date.js';
import { attachHiddenAdminShortcut } from '../../utils/admin-shortcut.js';
import { getLockedReportClassCode } from '../../utils/route.js';
import { validateReportForm } from '../../utils/validators.js';
import { renderAlert } from '../components/Alert.js';
import { renderBrandLogo } from '../components/BrandLogo.js';
import { renderClassSelect } from '../components/ClassSelect.js';
import { renderLoadingOverlay } from '../components/LoadingOverlay.js';
import { renderProjectSummary } from '../components/ProjectSummary.js';
import { renderReportForm } from '../components/ReportForm.js';
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
    <label class="form-label">Mã lớp</label>
    <div class="form-control locked-class-field bg-body-tertiary">
      <div class="locked-class-field__header">
        <div class="locked-class-field__code" title="${classCode}">${classCode}</div>
        <span class="badge text-bg-light text-dark border locked-class-field__badge">Đã khóa theo đường dẫn</span>
      </div>
      <div class="locked-class-field__name">${className}</div>
    </div>
  `;
}

export const studentReportPage = {
  title: 'Gửi báo cáo tiến độ',
  async render() {
    return `
      <div class="student-layout">
        <section class="student-hero">
          <div class="container py-5">
            <div class="row justify-content-center">
              <div class="col-12 col-xl-10">
                <div class="student-hero-card shadow-lg border-0">
                  <div class="row g-0">
                    <div class="col-12 col-lg-5 student-hero-panel">
                      ${renderBrandLogo({
                        id: 'student-brand-trigger',
                        className: 'student-brand-lockup mb-4',
                        tone: 'light',
                        compact: false,
                      })}
                      <h1 class="display-6 fw-semibold mb-3">Báo cáo tiến độ sản phẩm học sinh</h1>
                      <p class="mb-0 text-white-50">
                        Chọn đúng tên của mình và điền thật rõ để giáo viên nắm tiến độ và hỗ trợ bạn nhanh hơn.
                      </p>
                    </div>
                    <div class="col-12 col-lg-7 p-4 p-lg-5 bg-white">
                      <div id="student-page-alert"></div>
                      <div class="row g-3 mb-3">
                        <div class="col-12 col-md-6">
                          <div id="class-select-slot">${renderLoadingOverlay('Đang tải thông tin lớp...')}</div>
                        </div>
                        <div class="col-12 col-md-6">
                          <div id="student-select-slot">${renderStudentSelect([])}</div>
                        </div>
                      </div>
                      <div id="project-summary-slot" class="mb-3">${renderProjectSummary(null)}</div>
                      <div id="student-report-form-slot">${renderReportForm({}, { disabled: true })}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        ${renderToastStack()}
      </div>
    `;
  },
  async mount({ navigate }) {
    const pageAlert = document.getElementById('student-page-alert');
    const classSlot = document.getElementById('class-select-slot');
    const studentSlot = document.getElementById('student-select-slot');
    const summarySlot = document.getElementById('project-summary-slot');
    const formSlot = document.getElementById('student-report-form-slot');
    const brandTrigger = document.getElementById('student-brand-trigger');
    const lockedClassCode = getLockedReportClassCode();

    let classes = [];
    let students = [];
    let selectedClassCode = lockedClassCode || '';
    let selectedStudentId = '';
    let lockedClass = null;
    let lockedClassError = '';

    function getSelectedStudent() {
      return students.find((student) => student.studentId === selectedStudentId) || null;
    }

    function renderSelections() {
      classSlot.innerHTML = lockedClassCode
        ? renderLockedClassField(lockedClass || { classCode: selectedClassCode || lockedClassCode, className: '' })
        : renderClassSelect(classes, selectedClassCode);
      studentSlot.innerHTML = renderStudentSelect(students, selectedStudentId);
      summarySlot.innerHTML = renderProjectSummary(getSelectedStudent());
      formSlot.innerHTML = renderReportForm(getFormDefaults(getSelectedStudent()), {
        disabled: !getSelectedStudent(),
      });
    }

    function renderPageAlertState() {
      if (lockedClassError) {
        pageAlert.innerHTML = renderAlert(lockedClassError, 'danger');
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
        pageAlert.innerHTML = renderAlert('Hãy chọn đúng tên của mình để xem dự án và bắt đầu gửi báo cáo.', 'info');
        return;
      }

      if (selectedStudent.lastReportedAt && isToday(selectedStudent.lastReportedAt)) {
        pageAlert.innerHTML = renderAlert(
          'Hôm nay bạn đã gửi báo cáo. Nếu có cập nhật mới, bạn vẫn có thể gửi thêm để giáo viên nắm được.',
          'warning',
        );
        return;
      }

      pageAlert.innerHTML = '';
    }

    async function loadRoster() {
      if (!selectedClassCode) {
        students = [];
        selectedStudentId = '';
        renderSelections();
        renderPageAlertState();
        return;
      }

      try {
        lockedClassError = '';
        studentSlot.innerHTML = renderLoadingOverlay('Đang tải danh sách học sinh...');
        students = await getClassRoster(selectedClassCode);

        if (!students.some((student) => student.studentId === selectedStudentId)) {
          selectedStudentId = '';
        }

        renderSelections();
        renderPageAlertState();
      } catch (error) {
        students = [];
        selectedStudentId = '';
        renderSelections();

        if (lockedClassCode) {
          lockedClassError = getErrorMessage(error, 'Link lớp này hiện không thể sử dụng để gửi báo cáo.');
          renderPageAlertState();
          return;
        }

        pageAlert.innerHTML = renderAlert(getErrorMessage(error, 'Không tải được danh sách học sinh.'), 'danger');
      }
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

          await loadRoster();
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
      await loadRoster();
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

      const submitButton = form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Đang gửi...';

      try {
        await submitStudentReport(payload);
        alertSlot.innerHTML = renderAlert('Báo cáo đã được gửi thành công.', 'success');
        showToast({
          title: 'Đã lưu báo cáo',
          message: 'Cập nhật của bạn đã được ghi nhận.',
          variant: 'success',
        });

        await loadRoster();
        renderSelections();
        renderPageAlertState();
      } catch (error) {
        alertSlot.innerHTML = renderAlert(getErrorMessage(error, 'Không thể gửi báo cáo lúc này.'), 'danger');
      } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="bi bi-send me-2"></i>Gửi báo cáo';
      }
    });

    const cleanupShortcut = attachHiddenAdminShortcut({
      brandElement: brandTrigger,
      onTrigger: () => navigate('/admin/login'),
    });

    renderSelections();
    renderPageAlertState();
    await loadClasses();

    return () => {
      cleanupShortcut?.();
    };
  },
};
