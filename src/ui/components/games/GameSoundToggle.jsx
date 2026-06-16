import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '../Button.jsx';

export function GameSoundToggle({ muted, onToggle, onUnlock, onTestSound, presenting = false }) {
  const handleClick = async () => {
    const wasMuted = muted;
    if (wasMuted) await onUnlock?.();
    onToggle();
    if (wasMuted) {
      requestAnimationFrame(() => {
        onTestSound?.();
      });
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      title={muted ? 'Bật tiếng' : 'Tắt tiếng'}
      className={
        presenting
          ? 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          : ''
      }
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {!presenting && <span className="ml-1.5">{muted ? 'Tắt tiếng' : 'Tiếng'}</span>}
    </Button>
  );
}
