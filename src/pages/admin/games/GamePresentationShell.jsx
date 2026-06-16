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
      className={`relative flex flex-col transition-all duration-500 ${
        presenting
          ? 'game-presenting min-h-screen overflow-hidden rounded-none border-0 bg-black'
          : `overflow-visible rounded-3xl border-2 bg-slate-950 ${stageBorder}`
      }`}
    >
      {presenting && (
        <div className="absolute left-0 right-0 top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-md">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-auto">
            {toolbar}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
            onClick={onTogglePresentation}
            title="Thoát trình chiếu"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div
        className={`relative flex flex-1 flex-col ${
          presenting
            ? 'min-h-0 flex-1 overflow-hidden pt-[4.25rem]'
            : `items-center justify-center px-4 py-6 sm:px-8 sm:py-10 ${stageMinHeight}`
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
          className={`relative z-10 flex w-full flex-1 flex-col ${
            presenting ? 'min-h-0 overflow-hidden px-4 pb-4 sm:px-8' : ''
          }`}
        >
          {children}
        </div>
      </div>

      {!presenting && (
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-800 bg-slate-900/95 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-auto">
            {toolbar}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 self-end sm:self-auto"
            onClick={onTogglePresentation}
            title="Trình chiếu"
          >
            <Maximize2 className="h-4 w-4" />
            <span className="ml-1.5">Trình chiếu</span>
          </Button>
        </div>
      )}

      {footer && !presenting ? (
        <div className="shrink-0 overflow-auto border-t border-slate-800 bg-slate-900/80">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
