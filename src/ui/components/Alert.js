export function renderAlert(message, variant = 'danger') {
  if (!message) {
    return '';
  }

  return `<div class="alert alert-${variant}" role="alert">${message}</div>`;
}
