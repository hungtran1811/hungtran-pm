import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function useImageLightbox() {
  const [state, setState] = useState({ open: false, images: [], index: 0 });

  const open = useCallback((images, index = 0) => {
    const list = Array.isArray(images) ? images.filter(Boolean) : images ? [images] : [];
    if (!list.length) return;
    setState({ open: true, images: list, index: Math.min(index, list.length - 1) });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return { ...state, openLightbox: open, closeLightbox: close };
}

export function ImageLightbox({ open, images = [], index = 0, onClose, onIndexChange }) {
  const current = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft' && hasPrev) onIndexChange?.(index - 1);
      if (e.key === 'ArrowRight' && hasNext) onIndexChange?.(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, hasPrev, hasNext, onClose, onIndexChange]);

  if (!open || !current) return null;

  const src = typeof current === 'string' ? current : current.secureUrl || current.url || current.src;
  const alt = typeof current === 'string' ? '' : current.alt || '';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Xem ảnh"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Đóng"
      >
        <X className="h-6 w-6" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            disabled={!hasPrev}
            onClick={(e) => {
              e.stopPropagation();
              if (hasPrev) onIndexChange?.(index - 1);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30 sm:left-4"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button
            type="button"
            disabled={!hasNext}
            onClick={(e) => {
              e.stopPropagation();
              if (hasNext) onIndexChange?.(index + 1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 disabled:opacity-30 sm:right-4"
            aria-label="Ảnh sau"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80">
            {index + 1} / {images.length}
          </p>
        </>
      )}

      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[95vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
