export function renderLoadingOverlay(message = 'Đang tải dữ liệu...') {
  return `
    <div class="d-flex align-items-center justify-content-center py-5 text-secondary">
      <div class="spinner-border spinner-border-sm me-3" role="status" aria-hidden="true"></div>
      <span>${message}</span>
    </div>
  `;
}
