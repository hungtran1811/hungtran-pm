import { describe, expect, it } from 'vitest';
import {
  AMBIGUOUS_CLASS_MESSAGE,
  findActiveAliasConflicts,
  normalizeClassLookupInput,
  resolveClassLookup,
  suggestStudentAccessCode,
} from './classAccessCode.js';

const open = (classCode, studentAccessCode, extra = {}) => ({
  classCode,
  className: classCode,
  status: 'active',
  hidden: false,
  studentAccessCode,
  ...extra,
});

describe('class access codes', () => {
  it('suggests the single batch token', () => {
    expect(suggestStudentAccessCode('PVĐ-C4K-GB25-HB')).toEqual({
      code: 'GB25',
      needsChoice: false,
      options: ['GB25'],
    });
    expect(suggestStudentAccessCode('PVĐ-JSB05').code).toBe('JSB05');
  });

  it('asks the teacher to choose when two tokens match', () => {
    const suggestion = suggestStudentAccessCode('PVĐ-C4K-GB25-TEST12');
    expect(suggestion.needsChoice).toBe(true);
    expect(suggestion.options).toEqual(['GB25', 'TEST12']);
    expect(suggestion.code).toBe('');
  });

  it('resolves a unique short code and the full code', () => {
    const classes = [open('PVĐ-C4K-GB25-HB', 'GB25'), open('PVĐ-JSB05', 'JSB05')];
    expect(resolveClassLookup('GB25', classes).canonicalClassCode).toBe('PVĐ-C4K-GB25-HB');
    expect(resolveClassLookup(' gb25 ', classes).canonicalClassCode).toBe('PVĐ-C4K-GB25-HB');
    expect(resolveClassLookup('jsb05', classes).canonicalClassCode).toBe('PVĐ-JSB05');
    expect(resolveClassLookup('PVĐ-C4K-GB25-HB', classes).canonicalClassCode).toBe('PVĐ-C4K-GB25-HB');
  });

  it('resolves a short code from the class code when no alias is saved', () => {
    const classes = [open('PVĐ-C4K-GB25-HB', ''), open('PVĐ-JSB06', '')];
    expect(resolveClassLookup('GB25', classes).canonicalClassCode).toBe('PVĐ-C4K-GB25-HB');
    expect(resolveClassLookup('JSB06', classes).canonicalClassCode).toBe('PVĐ-JSB06');
  });

  it('asks for the full code when two unsaved class codes share a short token', () => {
    const result = resolveClassLookup('GB25', [
      open('PVĐ-C4K-GB25-HB', ''),
      open('HN-C4K-GB25', ''),
    ]);
    expect(result).toEqual({ status: 'ambiguous', message: AMBIGUOUS_CLASS_MESSAGE });
  });

  it('does not substring-match or pad numbers', () => {
    const classes = [open('PVĐ-C4K-GB25-HB', 'GB25')];
    expect(resolveClassLookup('GB2', classes).status).toBe('not_found');
    expect(resolveClassLookup('B25', classes).status).toBe('not_found');
    expect(resolveClassLookup('GB025', classes).status).toBe('not_found');
    expect(normalizeClassLookupInput(' GB-25 ')).toBe('GB-25');
  });

  it('asks for the full code when two active classes share an alias and returns no roster', () => {
    const result = resolveClassLookup('GB25', [
      open('PVĐ-C4K-GB25-HB', 'GB25'),
      open('HN-C4K-GB25', 'GB25'),
    ]);
    expect(result).toEqual({ status: 'ambiguous', message: AMBIGUOUS_CLASS_MESSAGE });
    expect(JSON.stringify(result)).not.toContain('PVĐ');
    expect(resolveClassLookup('HN-C4K-GB25', [
      open('PVĐ-C4K-GB25-HB', 'GB25'),
      open('HN-C4K-GB25', 'GB25'),
    ]).canonicalClassCode).toBe('HN-C4K-GB25');
  });

  it('warns about another active class using the same alias', () => {
    const conflicts = findActiveAliasConflicts('GB25', [
      open('PVĐ-C4K-GB25-HB', 'GB25'),
      open('HN-C4K-GB25', 'GB25'),
    ], 'PVĐ-C4K-GB25-HB');
    expect(conflicts.map((item) => item.classCode)).toEqual(['HN-C4K-GB25']);
  });

  it('resolves the open class when an archived class shares the alias', () => {
    const classes = [
      open('PVĐ-C4K-GB25-HB', 'GB25', { status: 'archived', className: 'Lớp cũ' }),
      open('HN-C4K-GB25', 'GB25', { className: 'Lớp đang học' }),
    ];
    expect(resolveClassLookup('GB25', classes)).toEqual({
      status: 'resolved',
      canonicalClassCode: 'HN-C4K-GB25',
      classLabel: 'Lớp đang học',
    });
    const archived = resolveClassLookup('PVĐ-C4K-GB25-HB', classes);
    expect(archived).toEqual({ status: 'unavailable' });
    expect(JSON.stringify(archived)).not.toMatch(/PVĐ|Lớp cũ|roster/i);
  });

  it('does not expose a hidden class by alias or full code', () => {
    const classes = [open('PVĐ-JSA14', 'JSA14', { hidden: true, className: 'Lớp chưa mở' })];
    const byAlias = resolveClassLookup('JSA14', classes);
    const byFullCode = resolveClassLookup('PVĐ-JSA14', classes);
    expect(byAlias).toEqual({ status: 'unavailable' });
    expect(byFullCode).toEqual({ status: 'unavailable' });
    expect(JSON.stringify({ byAlias, byFullCode })).not.toMatch(/JSA14|Lớp chưa mở|roster/i);
  });

  it('warns when another open class code already contains the short token', () => {
    const conflicts = findActiveAliasConflicts('JSB06', [
      open('PVĐ-JSB06', ''),
      open('HN-JSB06-HB', ''),
    ], 'PVĐ-JSB06');
    expect(conflicts.map((item) => item.classCode)).toEqual(['HN-JSB06-HB']);
  });
});
