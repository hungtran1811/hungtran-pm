import { GameConfetti } from '../../../pages/admin/games/GameConfetti.jsx';

export function GameResultBurst({ children, intense = false, showConfetti = true, className = '' }) {
  return (
    <div className={`game-feedback-burst relative ${className}`}>
      {showConfetti && <GameConfetti intense={intense} />}
      {children}
    </div>
  );
}
