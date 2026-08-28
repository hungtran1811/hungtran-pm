import { useEffect, useMemo, useRef, useState } from 'react';
import {
  findRevealTargets,
  findRevealTrigger,
  toggleLessonReveal,
} from '../../lib/lessonDocumentInteract.js';
import {
  applyWheelScroll,
  findInnerScrollTarget,
  getOuterScrollParent,
  iframeNeedsWheelForward,
  measureLessonDocumentHeight,
  normalizeWheelDelta,
} from '../../lib/lessonFrameScroll.js';
import { LESSON_PRESENTATION_PRESET_LEGACY, sanitizeLessonDocument } from '../../lib/lessonHtml.js';
import { ImageLightbox, useImageLightbox } from './ImageLightbox.jsx';
import { Markdown } from './Markdown.jsx';

function HtmlDocumentContent({ content = '', className = '' }) {
  const frameRef = useRef(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const [frameHeight, setFrameHeight] = useState(null);
  const { open, images, index, openLightbox, closeLightbox } = useImageLightbox();
  const documentHtml = useMemo(() => sanitizeLessonDocument(content), [content]);

  useEffect(() => {
    setFrameHeight(null);
  }, [documentHtml]);

  useEffect(() => {
    const frame = frameRef.current;
    const document = frame?.contentDocument;
    if (!document?.body) return undefined;

    const lessonImages = () => [...document.querySelectorAll('img[src]')];
    const findImage = (target) => target?.closest?.('img[src]') || null;
    let measuring = false;
    let measureRaf = 0;
    const syncHeight = () => {
      if (measuring) return;
      measuring = true;
      const nextHeight = measureLessonDocumentHeight(frame);
      measuring = false;
      if (nextHeight) setFrameHeight((current) => (current === nextHeight ? current : nextHeight));
    };
    const scheduleSyncHeight = () => {
      if (measureRaf) return;
      measureRaf = requestAnimationFrame(() => {
        measureRaf = 0;
        syncHeight();
      });
    };
    const showImage = (image) => {
      const nodes = lessonImages();
      const imageIndex = nodes.indexOf(image);
      openLightbox(
        nodes.map((node) => ({
          alt: node.alt || '',
          src: node.currentSrc || node.src,
        })),
        imageIndex >= 0 ? imageIndex : 0,
      );
    };
    const onClick = (event) => {
      if (event.target?.closest?.('summary, input, label')) {
        queueMicrotask(syncHeight);
        return;
      }
      const trigger = findRevealTrigger(event.target, document);
      if (trigger) {
        const targets = findRevealTargets(trigger, document);
        if (targets.length) {
          event.preventDefault();
          event.stopPropagation();
          toggleLessonReveal(trigger, targets);
          syncHeight();
          return;
        }
      }
      const image = findImage(event.target);
      if (!image) return;
      event.preventDefault();
      showImage(image);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const image = findImage(event.target);
      if (!image) return;
      event.preventDefault();
      showImage(image);
    };

    for (const image of lessonImages()) {
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      if (!image.getAttribute('aria-label')) {
        image.setAttribute('aria-label', image.alt ? `Xem ảnh: ${image.alt}` : 'Xem ảnh lớn');
      }
      image.addEventListener('load', syncHeight);
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    const onWheel = iframeNeedsWheelForward()
      ? (event) => {
          if (event.ctrlKey || event.metaKey) return;
          const { deltaX, deltaY } = normalizeWheelDelta(event);
          if (!deltaX && !deltaY) return;
          const inner = findInnerScrollTarget(event.target, {
            deltaX,
            deltaY,
            root: document.documentElement,
          });
          if (inner) return;
          event.preventDefault();
          applyWheelScroll(getOuterScrollParent(frame) || window, deltaX, deltaY);
        }
      : null;
    if (onWheel) document.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', scheduleSyncHeight);
    syncHeight();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleSyncHeight) : null;
    observer?.observe(document.documentElement);
    if (document.body) observer?.observe(document.body);

    return () => {
      if (measureRaf) cancelAnimationFrame(measureRaf);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
      if (onWheel) document.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', scheduleSyncHeight);
      observer?.disconnect();
      for (const image of lessonImages()) {
        image.removeEventListener('load', syncHeight);
      }
    };
  }, [documentHtml, loadVersion, openLightbox]);

  if (!content) return null;

  return (
    <>
      <div className="lesson-content">
        <iframe
          ref={frameRef}
          className={`lesson-document-frame ${className}`}
          title="Nội dung bài giảng HTML"
          sandbox="allow-same-origin"
          scrolling="no"
          referrerPolicy="no-referrer"
          srcDoc={documentHtml}
          style={frameHeight ? { height: `${frameHeight}px` } : undefined}
          onLoad={() => setLoadVersion((version) => version + 1)}
          data-presentation-preset={LESSON_PRESENTATION_PRESET_LEGACY}
        />
      </div>
      <ImageLightbox
        open={open}
        images={images}
        index={index}
        onClose={closeLightbox}
        onIndexChange={(nextIndex) => openLightbox(images, nextIndex)}
      />
    </>
  );
}

/**
 * Renders safe static lessons. HTML is shown in a scriptless iframe so the
 * imported file keeps its own CSS, classes, and layout. Markdown still uses
 * the in-app reader.
 */
export function LessonContent({ format = 'markdown', content = '', className = '' }) {
  if (format !== 'html') return <Markdown content={content} className={className} />;
  return <HtmlDocumentContent content={content} className={className} />;
}
