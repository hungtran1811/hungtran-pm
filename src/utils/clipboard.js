export async function copyTextToClipboard(text) {
  const normalizedText = String(text ?? '');

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(normalizedText);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = normalizedText;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';

  document.body.appendChild(textArea);
  textArea.select();

  const copied = document.execCommand('copy');
  textArea.remove();

  if (!copied) {
    throw new Error('Không thể sao chép nội dung lúc này.');
  }
}
