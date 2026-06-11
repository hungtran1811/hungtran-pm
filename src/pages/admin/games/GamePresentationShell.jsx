import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';

export function useGamePresentation() {
  const shellRef = useRef(null);
  const [presenting, setPresenting] = useState(false);

  const togglePresentation = async () => {
    if (!shellRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await shellRef.current.requestFullscreen();
        setPresenting(true);
      } else {
        await document.exitFullscreen();
        setPresenting(false);
      }
    } catch {
      setPresenting((prev) => !prev);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setPresenting(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return { shellRef, presenting, togglePresentation };
}

export function GamePresentationShell({
  shellRef,
  presenting,
  onTogglePresentation,
  stageBorder = '',
  stageMinHeight = 'min-h-[340px] sm:min-h-[400px]',
  toolbar,
  footer,
  children,
}) {
  return (
    <div
      ref={shellRef}
      className={`flex flex-col overflow-hidden transition-all duration-500 ${
        presenting
          ? 'game-presenting relative min-h-screen rounded-none border-0 bg-black'
          : `rounded-3xl border-2 bg-slate-950 ${stageBorder}`
      }`}
    >
      <div
        className={`relative flex flex-1 flex-col items-center justify-center ${
          presenting ? 'min-h-0 flex-1 px-6 py-10 sm:px-12' : `px-4 py-6 sm:px-8 sm:py-10 ${stageMinHeight}`
        }`}
      >
        <div
          className={`pointer-events-none absolute inset-0 ${
            presenting
              ? 'game-stage-aurora'
              : 'bg-[radial-gradient(ellipse_at_center,_rgba(27,80,242,0.25)_0%,_transparent_70%)]'
          }`}
        />
        {presenting && <div className="game-stage-vignette pointer-events-none absolute inset-0" />}
        <div
          className={`relative z-10 w-full ${
            presenting ? 'flex min-h-0 flex-1 flex-col' : ''
          }`}
        >
          {children}
        </div>
      </div>

      <div
        className={`shrink-0 ${
          presenting
            ? 'absolute bottom-0 left-0 right-0 z-20 border-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-5 pt-10'
            : 'flex flex-col gap-3 border-t border-slate-800 bg-slate-900/95 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4'
        }`}
      >
        <div
          className={`flex min-w-0 flex-1 flex-wrap items-center gap-2 ${
            presenting ? 'justify-center' : ''
          }`}
        >
          {toolbar}
        </div>
        <Button
          variant={presenting ? 'ghost' : 'ghost'}
          size="sm"
          className={`shrink-0 ${
            presenting
              ? 'absolute right-4 top-2 border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              : 'self-end sm:self-auto'
          }`}
          onClick={onTogglePresentation}
          title={presenting ? 'Thoát trình chiếu' : 'Trình chiếu'}
        >
          {presenting ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {!presenting && <span className="ml-1.5">Trình chiếu</span>}
        </Button>
      </div>

      {footer && !presenting ? (
        <div className="shrink-0 overflow-auto border-t border-slate-800 bg-slate-900/80">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
