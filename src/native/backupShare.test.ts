import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shareNativeBackup } from './backupShare';

const mocks = vi.hoisted(() => ({ native: vi.fn(), write: vi.fn(), share: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile: mocks.write }, Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' } }));
vi.mock('@capacitor/share', () => ({ Share: { share: mocks.share } }));

beforeEach(() => { vi.resetAllMocks(); });

describe('Native backup sharing', () => {
  it('leaves web downloads unchanged', async () => {
    mocks.native.mockReturnValue(false);
    expect(await shareNativeBackup('backup.json', '{}')).toBe(false);
    expect(mocks.write).not.toHaveBeenCalled();
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it('writes UTF-8 JSON to cache and shares the returned file URI', async () => {
    mocks.native.mockReturnValue(true);
    mocks.write.mockResolvedValue({ uri: 'file:///cache/backup.json' });
    expect(await shareNativeBackup('backup.json', '{"profile":"Lifter"}')).toBe(true);
    expect(mocks.write).toHaveBeenCalledWith({ path: 'backup.json', data: '{"profile":"Lifter"}', directory: 'CACHE', encoding: 'utf8' });
    expect(mocks.share).toHaveBeenCalledWith({ title: 'Atlas Fit backup', files: ['file:///cache/backup.json'], dialogTitle: 'Save or share your backup' });
  });

  it('reports failed native writes rather than pretending a backup was saved', async () => {
    mocks.native.mockReturnValue(true);
    mocks.write.mockRejectedValue(new Error('Storage unavailable'));
    await expect(shareNativeBackup('backup.json', '{}')).rejects.toThrow('Storage unavailable');
    expect(mocks.share).not.toHaveBeenCalled();
  });

  it('does not report a successful export when sharing fails', async () => {
    mocks.native.mockReturnValue(true);
    mocks.write.mockResolvedValue({ uri: 'file:///cache/backup.json' });
    mocks.share.mockRejectedValue(new Error('Sharing unavailable'));
    await expect(shareNativeBackup('backup.json', '{}')).rejects.toThrow('Sharing unavailable');
  });
});
