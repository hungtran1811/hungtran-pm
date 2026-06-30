// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderSafeMarkdown } from './markdown.js';

describe('renderSafeMarkdown', () => {
  it('renders basic markdown with GFM line breaks', () => {
    const html = renderSafeMarkdown('**Hello**\nworld');

    expect(html).toContain('<strong>Hello</strong>');
    expect(html).toContain('<br>');
    expect(html).toContain('world');
  });

  it('removes script tags and inline event handlers', () => {
    const html = renderSafeMarkdown('<script>alert(1)</script><img src="x" onerror="alert(2)">');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).toContain('<img');
  });

  it('removes javascript urls from links', () => {
    const html = renderSafeMarkdown('[bad](javascript:alert(1)) [ok](https://example.com)');

    expect(html).not.toContain('javascript:');
    expect(html).toContain('https://example.com');
  });
});
