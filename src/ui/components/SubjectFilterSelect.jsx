import { Select } from './Field.jsx';

export function SubjectFilterSelect({ options = [], value = 'all', onChange, className = '' }) {
  const choices = options.filter((option) => option.id !== 'all');
  if (choices.length < 2) return null;
  return (
    <Select
      aria-label="Nhóm chương trình"
      value={value || 'all'}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full max-w-[14rem] ${className}`}
    >
      <option value="all">Mọi nhóm</option>
      {choices.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
