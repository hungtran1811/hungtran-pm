import { STAGES } from '../../constants/stages.js';
import { STATUSES } from '../../constants/statuses.js';
import { escapeHtml, optionList } from '../../utils/html.js';

export function renderFilterBar({
  id = 'filter-form',
  values = {},
  classes = [],
  students = [],
  showStudent = false,
  showDateRange = false,
}) {
  return `
    <form id="${id}" class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <div class="row g-3 align-items-end">
          <div class="col-12 col-lg-3">
            <label class="form-label">Lớp</label>
            <select class="form-select" name="classId">
              <option value="">Tất cả lớp</option>
              ${optionList(classes, (item) => item.classCode, (item) => `${item.classCode} - ${item.className}`, values.classId)}
            </select>
          </div>
          ${
            showStudent
              ? `
                <div class="col-12 col-lg-3">
                  <label class="form-label">Học sinh</label>
                  <select class="form-select" name="studentId">
                    <option value="">Tất cả học sinh</option>
                    ${optionList(students, (item) => item.id, (item) => item.fullName, values.studentId)}
                  </select>
                </div>
              `
              : ''
          }
          <div class="col-12 col-lg-3">
            <label class="form-label">Trạng thái</label>
            <select class="form-select" name="status">
              <option value="">Tất cả trạng thái</option>
              ${optionList(STATUSES, (item) => item, (item) => item, values.status)}
            </select>
          </div>
          <div class="col-12 col-lg-3">
            <label class="form-label">Giai đoạn</label>
            <select class="form-select" name="stage">
              <option value="">Tất cả giai đoạn</option>
              ${optionList(STAGES, (item) => item, (item) => item, values.stage)}
            </select>
          </div>
          ${
            showDateRange
              ? `
                <div class="col-12 col-lg-2">
                  <label class="form-label">Từ ngày</label>
                  <input type="date" class="form-control" name="dateFrom" value="${escapeHtml(values.dateFrom || '')}" />
                </div>
                <div class="col-12 col-lg-2">
                  <label class="form-label">Đến ngày</label>
                  <input type="date" class="form-control" name="dateTo" value="${escapeHtml(values.dateTo || '')}" />
                </div>
              `
              : ''
          }
          <div class="col-12 col-lg-auto ms-lg-auto">
            <button type="button" class="btn btn-outline-secondary w-100" data-action="reset-filters">
              Đặt lại bộ lọc
            </button>
          </div>
        </div>
      </div>
    </form>
  `;
}
