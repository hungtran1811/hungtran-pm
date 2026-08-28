import { useMemo } from 'react';
import { Button } from '../../../ui/components/Button.jsx';
import { Field, Input, Select } from '../../../ui/components/Field.jsx';
import {
  getCategoryPairs,
  SPY_WORD_CATEGORIES,
} from '../../../data/spyWordBank.js';

export function SpyWordPicker({
  wordMode,
  setWordMode,
  categoryId,
  setCategoryId,
  pairIndex,
  setPairIndex,
  civilianWord,
  setCivilianWord,
  spyWord,
  setSpyWord,
  onRandomPair,
  compact = false,
}) {
  const categoryPairs = useMemo(() => getCategoryPairs(categoryId), [categoryId]);

  return (
    <div className={`space-y-3 ${compact ? '' : 'card p-4'}`}>
      {!compact && (
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Cặp từ (chỉ giáo viên thấy)
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={wordMode === 'bank' ? 'primary' : 'secondary'} size="sm" onClick={() => setWordMode('bank')}>
          Bộ từ sẵn
        </Button>
        <Button type="button" variant={wordMode === 'custom' ? 'primary' : 'secondary'} size="sm" onClick={() => setWordMode('custom')}>
          Tuỳ chỉnh
        </Button>
      </div>

      {wordMode === 'bank' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Chủ đề">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {SPY_WORD_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cặp từ">
            <Select value={pairIndex} onChange={(e) => setPairIndex(Number(e.target.value))}>
              {categoryPairs.map((pair, index) => (
                <option key={`${pair.civilian}-${pair.spy}`} value={index}>
                  {pair.civilian} / {pair.spy}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="button" variant="secondary" size="sm" onClick={onRandomPair}>
              Random cặp từ
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Từ dân thường">
            <Input value={civilianWord} onChange={(e) => setCivilianWord(e.target.value)} />
          </Field>
          <Field label="Từ gián điệp">
            <Input value={spyWord} onChange={(e) => setSpyWord(e.target.value)} />
          </Field>
        </div>
      )}

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        GV xem: <strong>{civilianWord || '—'}</strong> · <strong>{spyWord || '—'}</strong>
      </p>
    </div>
  );
}
