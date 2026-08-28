// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  findRevealTargets,
  findRevealTrigger,
  rewriteLessonInteractiveMarkup,
  rewriteOnclickToDataAttrs,
  toggleLessonReveal,
} from './lessonDocumentInteract.js';

describe('lesson document interactions', () => {
  it('rewrites common answer onclick handlers to data attributes', () => {
    expect(rewriteOnclickToDataAttrs("document.getElementById('ans').style.display='block'")).toBe(
      ' data-lesson-reveal="ans"',
    );
    expect(rewriteOnclickToDataAttrs('this.nextElementSibling.classList.toggle("show")')).toBe(
      ' data-lesson-toggle-class="show" data-lesson-reveal-next="1"',
    );

    const html = rewriteLessonInteractiveMarkup(
      '<button onclick="document.getElementById(&quot;ans&quot;).hidden=false">Xem</button>',
    );
    expect(html).toContain('data-lesson-reveal="ans"');
    expect(html).not.toContain('onclick');
  });

  it('toggles a hidden answer panel from a named trigger', () => {
    document.body.innerHTML = `
      <button type="button" data-lesson-reveal="ans">Xem đáp án</button>
      <div id="ans" hidden>42</div>
    `;
    const trigger = findRevealTrigger(document.querySelector('button'), document);
    const targets = findRevealTargets(trigger, document);

    expect(targets).toHaveLength(1);
    toggleLessonReveal(trigger, targets);
    expect(document.querySelector('#ans')?.hasAttribute('hidden')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('uses the next sibling when the button text asks to show the answer', () => {
    document.body.innerHTML = `
      <button type="button">Xem đáp án</button>
      <div class="answer">42</div>
    `;
    const trigger = findRevealTrigger(document.querySelector('button'), document);
    const targets = findRevealTargets(trigger, document);

    expect(targets[0]?.classList.contains('answer')).toBe(true);
    toggleLessonReveal(trigger, targets);
    expect(targets[0]?.classList.contains('show')).toBe(true);
  });
});
