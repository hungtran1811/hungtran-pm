import { Volume2 } from 'lucide-react';
import { Button } from '../Button.jsx';

export function GameSoundGate({ visible, onEnable }) {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="mx-4 max-w-md rounded-2xl border border-brand-400/40 bg-slate-950 px-6 py-8 text-center shadow-2xl shadow-brand-500/20">
        <Volume2 className="mx-auto h-12 w-12 text-brand-300" />
        <h3 className="mt-4 text-xl font-bold text-white">Bật âm thanh trò chơi</h3>
        <p className="mt-2 text-sm text-white/70">
          Trình duyệt cần bạn bấm một lần để phát hiệu ứng âm thanh.
        </p>
        <Button size="lg" className="mt-6 w-full" onClick={onEnable}>
          <Volume2 className="h-5 w-5" />
          Bật âm thanh
        </Button>
      </div>
    </div>
  );
}
