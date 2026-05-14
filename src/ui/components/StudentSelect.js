import { optionList } from '../../utils/html.js';

export function renderStudentSelect(students, selectedValue = '') {
  return `
    <div class="student-report-field">
      <label class="form-label">Họ và tên</label>
      <select id="student-name-select" class="form-select" name="studentId" required ${students.length === 0 ? 'disabled' : ''}>
        <option value="">Chọn họ và tên</option>
        ${optionList(students, (item) => item.studentId, (item) => item.fullName, selectedValue)}
      </select>
    </div>
  `;
}
