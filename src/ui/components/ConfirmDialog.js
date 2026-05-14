import { escapeHtml } from '../../utils/html.js';

const CONFIRM_DIALOG_ID = 'app-confirm-dialog';

export function confirmDialog({
  title = 'Xác nhận thao tác',
  message = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  variant = 'primary',
} = {}) {
  return new Promise((resolve) => {
    const existingDialog = document.getElementById(CONFIRM_DIALOG_ID);
    existingDialog?.remove();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal fade" id="${CONFIRM_DIALOG_ID}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow">
            <div class="modal-header">
              <h2 class="modal-title fs-5">${escapeHtml(title)}</h2>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
            </div>
            <div class="modal-body">
              <p class="mb-0">${escapeHtml(message)}</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-confirm-dialog-cancel>
                ${escapeHtml(cancelText)}
              </button>
              <button type="button" class="btn btn-${escapeHtml(variant)}" data-confirm-dialog-accept>
                ${escapeHtml(confirmText)}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const dialogEl = wrapper.firstElementChild;
    document.body.appendChild(dialogEl);

    const modal = new window.bootstrap.Modal(dialogEl, {
      backdrop: 'static',
      keyboard: true,
    });
    let settled = false;

    function settle(value) {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
      modal.hide();
    }

    dialogEl.querySelector('[data-confirm-dialog-accept]')?.addEventListener('click', () => settle(true));
    dialogEl.querySelector('[data-confirm-dialog-cancel]')?.addEventListener('click', () => settle(false));
    dialogEl.addEventListener('hidden.bs.modal', () => {
      settle(false);
      dialogEl.remove();
    }, { once: true });

    modal.show();
  });
}
