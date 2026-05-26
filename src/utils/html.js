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

function renderInlineCodeText(value = '') {
  return String(value ?? '')
    .split(/`([^`\n]+)`/g)
    .map((part, index) => (
      index % 2 === 1
        ? `<code class="quiz-inline-code">${escapeHtml(part)}</code>`
        : escapeHtml(part)
    ))
    .join('');
}

function renderPlainTextSegment(value = '') {
  return renderInlineCodeText(value).replaceAll('\n', '<br>');
}

function normalizeCodeLanguage(value = '') {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9#+._-]/gi, '')
    .slice(0, 24);
}

export function renderInlineRichText(value) {
  return renderPlainTextSegment(String(value ?? '').trim());
}

export function renderTextWithCodeBlocks(value) {
  const source = String(value ?? '').replace(/\r\n/g, '\n').trim();

  if (!source) {
    return '';
  }

  const segments = [];
  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match = fenceRe.exec(source);

  while (match) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: source.slice(lastIndex, match.index),
      });
    }

    segments.push({
      type: 'code',
      language: normalizeCodeLanguage(match[1]),
      value: match[2].replace(/^\n+|\n+$/g, ''),
    });

    lastIndex = fenceRe.lastIndex;
    match = fenceRe.exec(source);
  }

  if (lastIndex < source.length) {
    segments.push({
      type: 'text',
      value: source.slice(lastIndex),
    });
  }

  return segments
    .map((segment) => {
      if (segment.type === 'code') {
        const language = segment.language || 'code';

        return `
          <figure class="quiz-code-block">
            <figcaption class="quiz-code-block__caption">
              <i class="bi bi-code-slash"></i>
              <span>${escapeHtml(language)}</span>
            </figcaption>
            <pre class="quiz-code-block__pre"><code>${escapeHtml(segment.value)}</code></pre>
          </figure>
        `;
      }

      return renderPlainTextSegment(segment.value.trim());
    })
    .filter(Boolean)
    .join('');
}
