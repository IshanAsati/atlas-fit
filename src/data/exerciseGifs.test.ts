// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findMirrorGif, getMirrorGifByLegacyId, normalizeExerciseName } from './exerciseGifs';

const doc = (overrides = {}) => ({
  $id: '0001', exId: '0001', name: '3/4 sit-up',
  gifUrl: 'https://cdn.jsdelivr.net/gh/omercotkd/exercises-gifs@main/assets/0001.gif',
  ...overrides,
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('Mirror GIF index client', () => {
  it('normalizes catalogue names for index matching', () => {
    expect(normalizeExerciseName('  Dumbbell   Lunge! ')).toBe('dumbbell lunge');
    expect(normalizeExerciseName('3/4 Sit-Up')).toBe('3 4 sit up');
    expect(normalizeExerciseName('')).toBe('');
  });

  it('fetches a mirror GIF by legacy id without sending a key', async () => {
    const json = vi.fn().mockResolvedValue(doc());
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal('fetch', fetcher);
    const result = await getMirrorGifByLegacyId('0001');
    expect(result?.gifUrl).toContain('0001.gif');
    const [, options] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toEqual({ 'X-Appwrite-Project': expect.any(String) });
    expect(JSON.stringify(options.headers)).not.toContain('standard_');
  });

  it('rejects malformed legacy ids without a request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await getMirrorGifByLegacyId('../etc')).toBeNull();
    expect(await getMirrorGifByLegacyId('')).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns the first valid fulltext hit for a name search', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ documents: [{ ...doc(), gifUrl: 'http://insecure.example/x.gif' }, doc()] }) });
    vi.stubGlobal('fetch', fetcher);
    const result = await findMirrorGif('3/4 Sit-Up');
    expect(result?.exId).toBe('0001');
    expect(fetcher.mock.calls[0][0]).toContain('/documents?queries=');
  });

  it('returns null offline, on HTTP errors, or invalid payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await findMirrorGif('Squat')).toBeNull();
    expect(await getMirrorGifByLegacyId('0001')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await findMirrorGif('Squat')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [{ exId: 'x' }] }) }));
    expect(await findMirrorGif('Squat')).toBeNull();
    expect(await findMirrorGif('   ')).toBeNull();
  });
});
