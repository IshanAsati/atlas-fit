/** Public, keyless REST client for the Atlas Fit exercise-GIF index on Appwrite.
 *
 * Reads are permissioned `read("any")` server-side, so no API key, login, or
 * account is needed — the endpoint, project, database and collection IDs are
 * public identifiers, not secrets. Writes stay key-gated (see
 * scripts/provision-appwrite.mjs and scripts/seed-exercise-catalog.mjs, which
 * read APPWRITE_API_KEY from the environment and must never be committed).
 *
 * The index mirrors third-party GIFs (see ATTRIBUTION.md): redistribution
 * rights are unverified, so GIFs are an explicit online visual enhancement.
 * RepDB remains authoritative for exercise data, instructions, and taxonomy.
 */
export const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = '6acd1fed003d66ca7fb5';
export const GIF_DATABASE_ID = 'atlas-fit';
export const GIF_COLLECTION_ID = 'exercises';

const lookupCache = new Map<string, Promise<MirrorGif | null>>();

export interface MirrorGif {
  /** Legacy ExerciseDB numeric id, e.g. "0001". */
  exId: string;
  name: string;
  gifUrl: string;
}

function baseUrl(): string {
  return `${APPWRITE_ENDPOINT}/databases/${GIF_DATABASE_ID}/collections/${GIF_COLLECTION_ID}/documents`;
}

function headers(): HeadersInit {
  return { 'X-Appwrite-Project': APPWRITE_PROJECT_ID };
}

function validGif(value: unknown): value is MirrorGif {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Record<string, unknown>;
  try {
    const url = new URL(String(doc.gifUrl ?? ''));
    return typeof doc.exId === 'string' && /^[0-9]{1,8}$/.test(doc.exId) &&
      typeof doc.name === 'string' && (url.protocol === 'https:');
  } catch { return false; }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { headers: headers(), signal });
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

/** Direct lookup by legacy numeric id. Null when offline, missing, or invalid. */
export async function getMirrorGifByLegacyId(exId: string, signal?: AbortSignal): Promise<MirrorGif | null> {
  if (!/^[0-9]{1,8}$/.test(exId)) return null;
  try {
    const doc = await getJson(`${baseUrl()}/${exId}`, signal);
    return validGif(doc) ? { exId: doc.exId, name: doc.name, gifUrl: doc.gifUrl } : null;
  } catch { return null; }
}

/** Collapse case, punctuation and spacing so catalogue names match index names. */
export function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

/**
 * Exact-name match of a RepDB exercise to the mirror index.
 * Full-text search is only used as a compatibility fallback for punctuation
 * differences; a similarly named movement is rejected so the app never
 * displays the wrong demonstration.
 */
export async function findMirrorGif(name: string, signal?: AbortSignal): Promise<MirrorGif | null> {
  const query = normalizeExerciseName(name);
  if (!query) return null;
  const cached = lookupCache.get(query);
  if (cached) return cached;
  const lookup = (async () => {
    try {
      const exactQueries = new URLSearchParams();
      exactQueries.append('queries[]', JSON.stringify({ method: 'equal', attribute: 'name', values: [name.trim().toLowerCase()] }));
      exactQueries.append('queries[]', JSON.stringify({ method: 'limit', values: [1] }));
      const exactPage = await getJson(`${baseUrl()}?${exactQueries}`, signal);
      const exactDocs = (exactPage as { documents?: unknown[] } | null)?.documents;
      if (Array.isArray(exactDocs)) {
        for (const doc of exactDocs) {
          if (validGif(doc) && normalizeExerciseName(doc.name) === query) {
            return { exId: doc.exId, name: doc.name, gifUrl: doc.gifUrl };
          }
        }
      }

      // A few source names differ only by punctuation (for example, slash vs
      // space). Search more than the first fuzzy hits, then keep exact
      // normalized matches only.
      const searchQueries = new URLSearchParams();
      searchQueries.append('queries[]', JSON.stringify({ method: 'search', attribute: 'name', values: [query] }));
      searchQueries.append('queries[]', JSON.stringify({ method: 'limit', values: [100] }));
      const searchPage = await getJson(`${baseUrl()}?${searchQueries}`, signal);
      const searchDocs = (searchPage as { documents?: unknown[] } | null)?.documents;
      if (!Array.isArray(searchDocs)) return null;
      for (const doc of searchDocs) {
        if (validGif(doc) && normalizeExerciseName(doc.name) === query) {
          return { exId: doc.exId, name: doc.name, gifUrl: doc.gifUrl };
        }
      }
      return null;
    } catch { return null; }
  })();
  const stableLookup = lookup.then((result) => {
    if (!result) lookupCache.delete(query);
    return result;
  });
  lookupCache.set(query, stableLookup);
  return stableLookup;
}
