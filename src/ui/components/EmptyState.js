export function renderEmptyState({
  icon = 'inboxes',
  title = 'Chưa có dữ liệu',
  description = 'Dữ liệu sẽ hiển thị tại đây khi có bản ghi phù hợp.',
}) {
  return `
    <div class="card border-0 shadow-sm">
      <div class="card-body py-5 text-center">
        <i class="bi bi-${icon} fs-1 text-secondary"></i>
        <h2 class="h5 mt-3">${title}</h2>
        <p class="text-secondary mb-0">${description}</p>
      </div>
    </div>
  `;
}
