import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadExerciseMedia } from './media';
afterEach(() => { vi.unstubAllGlobals(); });
describe('explicit offline media packs', () => {
  it('verifies image responses, stores selected poses, and reuses the cache', async () => {
    const entries = new Map<string,Response>();
    const cache = { match: vi.fn(async (url: string) => entries.get(url)), put: vi.fn(async (url: string, response: Response) => { entries.set(url,response); }) };
    const fetcher = vi.fn(async () => new Response('image',{ headers: { 'content-type': 'image/webp' } }));
    vi.stubGlobal('caches',{ open: vi.fn(async () => cache) }); vi.stubGlobal('fetch',fetcher);
    const progress = vi.fn();
    const result = await downloadExerciseMedia(['push-up','push-up'],progress);
    expect(result.downloaded).toBe(result.total); expect(result.failed).toBe(0); expect(cache.put).toHaveBeenCalled();
    const fetches = fetcher.mock.calls.length;
    await downloadExerciseMedia(['push-up']); expect(fetcher).toHaveBeenCalledTimes(fetches);
    expect(progress).toHaveBeenLastCalledWith(result.total,result.total);
  });
  it('does not call an HTML fallback or an HTTP error a successful download', async () => {
    const cache = { match: vi.fn(async () => undefined), put: vi.fn() };
    vi.stubGlobal('caches',{ open: vi.fn(async () => cache) });
    vi.stubGlobal('fetch',vi.fn(async () => new Response('<html/>',{ headers: { 'content-type': 'text/html' } })));
    const result = await downloadExerciseMedia(['push-up']);
    expect(result.downloaded).toBe(0); expect(result.failed).toBe(result.total); expect(cache.put).not.toHaveBeenCalled();
  });
  it('reports missing media and unsupported storage honestly', async () => {
    vi.stubGlobal('caches',undefined);
    // Property exists in this stub; opening it fails rather than falsely confirming a pack.
    await expect(downloadExerciseMedia(['push-up'])).rejects.toThrow();
  });
});
