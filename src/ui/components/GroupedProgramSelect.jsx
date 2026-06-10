import { useMemo } from 'react';
import { groupProgramsBySubject } from '../../lib/subjectGroups.js';
import { Select } from './Field.jsx';

export function GroupedProgramSelect({
  programs,
  value,
  onChange,
  includeEmpty = false,
  emptyLabel = '— Chưa gán —',
  className = '',
}) {
  const groups = useMemo(() => groupProgramsBySubject(programs), [programs]);

  return (
    <Select value={value} onChange={onChange} className={className}>
      {includeEmpty && <option value="">{emptyLabel}</option>}
      {groups.map((group) => (
        <optgroup key={group.id} label={group.label}>
          {group.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.active === false ? ' · ẩn' : ''}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
