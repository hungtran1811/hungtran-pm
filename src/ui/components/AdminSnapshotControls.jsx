import { RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';

export function AdminSnapshotControls({ lastLoadedAt, refreshing, onRefresh, className = '' }) {
  const time = lastLoadedAt
    ? new Date(lastLoadedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {time && (
        <p className="text-xs text-slate-500">
          Tải lúc {time} · Bấm «Làm mới» để cập nhật.
        </p>
      )}
      <Button variant="subtle" size="sm" onClick={onRefresh} loading={refreshing} className="ml-auto">
        <RefreshCw className="h-4 w-4" />
        Làm mới
      </Button>
    </div>
  );
}
