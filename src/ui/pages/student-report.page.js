import { getClassRoster, listActiveClasses, submitStudentReport } from '../../services/public-api.service.js';
import { isToday } from '../../utils/date.js';
import { attachHiddenAdminShortcut } from '../../utils/admin-shortcut.js';
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
                        Chọn đúng lớp, đúng tên của mình và điền thật rõ để giáo viên nắm tiến độ và hỗ trợ bạn nhanh hơn.
                      </p>
                    </div>
                    <div class="col-12 col-lg-7 p-4 p-lg-5 bg-white">
                      <div id="student-page-alert"></div>
                      <div class="row g-3 mb-3">
                        <div class="col-12 col-md-6">
                          <div id="class-select-slot">${renderLoadingOverlay('Đang tải danh sách lớp...')}</div>
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

    let classes = [];
    let students = [];
    let selectedClassCode = '';
    let selectedStudentId = '';

    function getSelectedStudent() {
      return students.find((student) => student.studentId === selectedStudentId) || null;
    }

    function renderSelections() {
      classSlot.innerHTML = renderClassSelect(classes, selectedClassCode);
      studentSlot.innerHTML = renderStudentSelect(students, selectedStudentId);
      summarySlot.innerHTML = renderProjectSummary(getSelectedStudent());
      formSlot.innerHTML = renderReportForm(getFormDefaults(getSelectedStudent()), {
        disabled: !getSelectedStudent(),
      });
    }

    function renderPageAlertState() {
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

    async function loadClasses() {
      try {
        classes = await listActiveClasses();
        classSlot.innerHTML = renderClassSelect(classes, selectedClassCode);

        if (classes.length === 0) {
          pageAlert.innerHTML = renderAlert('Hiện chưa có lớp đang mở để học sinh gửi báo cáo.', 'warning');
        }
      } catch (error) {
        pageAlert.innerHTML = renderAlert(getErrorMessage(error, 'Không tải được danh sách lớp.'), 'danger');
      }
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
        studentSlot.innerHTML = renderStudentSelect([]);
        formSlot.innerHTML = renderReportForm({}, { disabled: true });
        summarySlot.innerHTML = renderProjectSummary(null);
        pageAlert.innerHTML = renderAlert(getErrorMessage(error, 'Không tải được danh sách học sinh.'), 'danger');
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
      const payload = {
        classCode: selectedClassCode,
        studentId: selectedStudentId,
        doneToday: formData.get('doneToday'),
        nextGoal: formData.get('nextGoal'),
        difficulties: formData.get('difficulties'),
        progressPercent: Number(formData.get('progressPercent')),
        stage: formData.get('stage'),
        status: formData.get('status'),
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

    await loadClasses();
    renderSelections();
    renderPageAlertState();

    return () => {
      cleanupShortcut?.();
    };
  },
};
