export function renderEmptyState({
  icon = 'inboxes',
  title = 'Chưa có dữ liệu',
  description = 'Dữ liệu sẽ hiển thị khi có bản ghi phù hợp.',
}) {
  return `
    <div class="admin-empty-state">
      <div class="admin-empty-state__icon">
        <i class="bi bi-${icon}"></i>
      </div>
      <h2>${title}</h2>
      <p>${description}</p>
    </div>
  `;
}
