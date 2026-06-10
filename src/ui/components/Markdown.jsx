import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ImageLightbox, useImageLightbox } from './ImageLightbox.jsx';

marked.setOptions({ breaks: true, gfm: true });

export function Markdown({ content = '', className = '' }) {
  const containerRef = useRef(null);
  const { open, images, index, openLightbox, closeLightbox } = useImageLightbox();

  const html = useMemo(() => {
    if (!content) return '';
    const raw = marked.parse(content);
    return DOMPurify.sanitize(raw);
  }, [content]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const onClick = (e) => {
      const img = e.target.closest('img');
      if (!img || !el.contains(img)) return;
      const allImgs = [...el.querySelectorAll('img')];
      const urls = allImgs.map((node) => node.src);
      const idx = allImgs.indexOf(img);
      openLightbox(urls, idx >= 0 ? idx : 0);
    };

    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [html, openLightbox]);

  if (!content) return null;

  return (
    <>
      <div
        ref={containerRef}
        className={`prose-content max-w-none text-slate-700 dark:text-slate-200 ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <ImageLightbox
        open={open}
        images={images}
        index={index}
        onClose={closeLightbox}
        onIndexChange={(i) => openLightbox(images, i)}
      />
    </>
  );
}
