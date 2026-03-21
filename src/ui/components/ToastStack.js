export function renderToastStack() {
  return '<div id="toast-stack" class="toast-container position-fixed top-0 end-0 p-3"></div>';
}

export function showToast({ title = 'Thông báo', message, variant = 'primary' }) {
  const stack = document.getElementById('toast-stack');

  if (!stack) {
    return;
  }

  const toastEl = document.createElement('div');
  toastEl.className = 'toast border-0';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="toast-header text-bg-${variant}">
      <strong class="me-auto">${title}</strong>
      <button type="button" class="btn-close btn-close-white ms-2 mb-1" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body bg-white">${message}</div>
  `;

  stack.appendChild(toastEl);
  const toast = new window.bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove(), { once: true });
}
