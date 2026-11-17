export function MaskedPin({ status = '', hasCredential = false }) {
  const label = status || (hasCredential ? 'Đang dùng' : 'Chưa tạo');
  return <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>;
}
