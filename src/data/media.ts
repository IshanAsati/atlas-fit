import { CATALOG_BY_ID, getExerciseImageUrl } from './catalog';

export const OFFLINE_MEDIA_CACHE = 'atlas-workout-media-v1';

/** Explicit user-requested pack. No claim of success until every response is verified and cached. */
export async function downloadExerciseMedia(ids: string[], onProgress?: (done: number, total: number) => void):
  Promise<{ downloaded: number; total: number; failed: number }> {
  if (!globalThis.caches?.open) throw new Error('Offline image storage is unavailable in this browser.');
  const urls = new Set<string>();
  let missing = 0;
  for (const id of new Set(ids)) {
    const exercise = CATALOG_BY_ID[id];
    if (!exercise) { missing++; continue; }
    for (const pose of ['start', 'peak'] as const) {
      const url = getExerciseImageUrl(exercise, pose);
      if (url) urls.add(url); else missing++;
    }
  }
  const cache = await caches.open(OFFLINE_MEDIA_CACHE);
  const total = urls.size + missing;
  let downloaded = 0;
  let failed = missing;
  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      const response = existing ?? await fetch(url);
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Image unavailable');
      if (!existing) await cache.put(url, response.clone());
      downloaded++;
    } catch { failed++; }
    onProgress?.(downloaded + failed, total);
  }
  return { downloaded, total, failed };
}
