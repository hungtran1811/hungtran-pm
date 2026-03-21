import { optionList } from '../../utils/html.js';

export function renderClassSelect(classes, selectedValue = '') {
  return `
    <label class="form-label">Mã lớp</label>
    <select id="student-class-select" class="form-select" name="classCode" required>
      <option value="">Chọn mã lớp</option>
      ${optionList(classes, (item) => item.classCode, (item) => `${item.classCode} - ${item.className}`, selectedValue)}
    </select>
  `;
}
