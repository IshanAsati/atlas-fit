import { describe, expect, it } from 'vitest';
import { inspectBackup } from '../data/backup';
import type { BackupDoc } from '../data/types';

const valid: BackupDoc = {
  schema: 1,
  exportedAt: Date.now(),
  profile: null,
  plans: [],
  sessions: [],
  feedback: [],
};

describe('backup validation (§9)', () => {
  it('accepts a schema-1 document', () => {
    const check = inspectBackup(valid);
    expect(check.ok).toBe(true);
    expect(check.summary).toContain('0 plan');
  });

  it('rejects non-objects', () => {
    expect(inspectBackup(null).ok).toBe(false);
    expect(inspectBackup('nope').ok).toBe(false);
    expect(inspectBackup(42).ok).toBe(false);
  });

  it('rejects unknown schema versions', () => {
    expect(inspectBackup({ ...valid, schema: 2 }).ok).toBe(false);
  });

  it('counts contents for the overwrite confirmation', () => {
    const doc = { ...valid, plans: [{ id: 'p' }], sessions: [{ id: 's' }] };
    const check = inspectBackup(doc);
    expect(check.ok).toBe(true);
    expect(check.summary).toContain('1 plan');
    expect(check.summary).toContain('1 workout');
  });
});
