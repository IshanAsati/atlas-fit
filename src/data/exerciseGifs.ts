/** Public, keyless REST client for the Atlas Fit exercise-GIF index on Appwrite.
 *
 * Reads are permissioned `read("any")` server-side, so no API key, login, or
 * account is needed — the endpoint, project, database and collection IDs are
 * public identifiers, not secrets. Writes stay key-gated (see
 * scripts/provision-appwrite.mjs and scripts/seed-exercise-catalog.mjs, which
 * read APPWRITE_API_KEY from the environment and must never be committed).
 *
 * The index mirrors third-party GIFs (see ATTRIBUTION.md): redistribution
 * rights are unverified, so GIFs are an explicit online enhancement only.
 * Bundled RepDB illustrations remain the offline default and are never replaced.
 */
export const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
export const APPWRITE_PROJECT_ID = '6acd1fed003d66ca7fb5';
export const GIF_DATABASE_ID = 'atlas-fit';
export const GIF_COLLECTION_ID = 'exercises';

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
 * Best-effort match of a catalogue exercise name to the mirror index.
 * Returns the first fulltext hit or null — callers must label it as an
 * unverified third-party match, never as reviewed Atlas Fit media.
 */
export async function findMirrorGif(name: string, signal?: AbortSignal): Promise<MirrorGif | null> {
  const query = normalizeExerciseName(name);
  if (!query) return null;
  try {
    const queries = encodeURIComponent(JSON.stringify([`search("name", ${JSON.stringify(query)})`, 'limit(3)']));
    const page = await getJson(`${baseUrl()}?queries=${queries}`, signal);
    const docs = (page as { documents?: unknown[] } | null)?.documents;
    if (!Array.isArray(docs)) return null;
    for (const doc of docs) {
      if (validGif(doc)) return { exId: doc.exId, name: doc.name, gifUrl: doc.gifUrl };
    }
    return null;
  } catch { return null; }
}
