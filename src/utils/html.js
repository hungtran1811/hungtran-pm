export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function optionList(items, getValue, getLabel, selectedValue = '') {
  return items
    .map((item) => {
      const value = getValue(item);
      const label = getLabel(item);
      const selected = value === selectedValue ? 'selected' : '';
      return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

export function nl2br(value) {
  return escapeHtml(value).replaceAll('\n', '<br>');
}
