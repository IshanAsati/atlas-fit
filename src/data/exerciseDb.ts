/** ExerciseDB OSS Free V1. Personal/non-commercial browsing only; never an automatic planner input.
 * Docs: https://oss.exercisedb.dev/docs (OpenAPI: /swagger). Attribution: AscendAPI.
 * No bulk catalogue mirroring and no workout/profile data sent to the service. */
export interface ExerciseDbEntry {
  exerciseId: string;
  name: string;
  gifUrl: string | null;
  bodyParts: string[];
  equipments: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  savedAt?: number;
}
export interface ExerciseDbPage { entries: ExerciseDbEntry[]; nextCursor: string | null; total: number }
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0,100) : [];
}
export function parseExerciseDbEntry(value: unknown): ExerciseDbEntry | null {
  if (!value || typeof value !== 'object') return null;
  const entry = value as Record<string,unknown>;
  if (typeof entry.exerciseId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(entry.exerciseId) || typeof entry.name !== 'string' || !entry.name.trim()) return null;
  let gifUrl: string | null = null;
  if (typeof entry.gifUrl === 'string') {
    try { const url = new URL(entry.gifUrl); if (url.protocol === 'https:' && url.hostname === 'static.exercisedb.dev' && url.pathname.startsWith('/media/')) gifUrl = url.href; } catch { /* Untrusted or malformed media never renders. */ }
  }
  return { exerciseId: entry.exerciseId, name: entry.name.trim(), gifUrl, bodyParts: strings(entry.bodyParts), equipments: strings(entry.equipments),
    targetMuscles: strings(entry.targetMuscles), secondaryMuscles: strings(entry.secondaryMuscles), instructions: strings(entry.instructions).map((step) => step.replace(/^Step\s*:\s*\d+\s*/i,'')) };
}
export async function searchExerciseDb(name: string, after?: string, signal?: AbortSignal): Promise<ExerciseDbPage> {
  const params = new URLSearchParams({ name: name.trim(), limit: '12' });
  if (after) params.set('after',after);
  const response = await fetch(`https://oss.exercisedb.dev/api/v1/exercises?${params}`, { signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000) });
  if (response.status === 429) throw new Error('ExerciseDB is rate-limiting requests. Wait a little, then search again. Your saved library still works.');
  if (!response.ok) throw new Error('ExerciseDB is unavailable. Try again later or browse your saved exercises.');
  const payload = await response.json() as Record<string,unknown>;
  if (payload.success !== true || !Array.isArray(payload.data)) throw new Error('ExerciseDB returned an unexpected response.');
  const meta = payload.meta as Record<string,unknown> | undefined;
  return { entries: payload.data.map(parseExerciseDbEntry).filter((entry): entry is ExerciseDbEntry => entry !== null),
    total: typeof meta?.total === 'number' ? meta.total : payload.data.length,
    nextCursor: meta?.hasNextPage === true && typeof meta.nextCursor === 'string' ? meta.nextCursor : null };
}
