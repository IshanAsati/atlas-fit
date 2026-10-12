import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseExerciseDbEntry, searchExerciseDb } from './exerciseDb';
const entry = { exerciseId: 'example123', name: 'barbell bench press', gifUrl: 'https://static.exercisedb.dev/media/example123.gif', bodyParts: ['chest'], equipments: ['barbell'], targetMuscles: ['pectorals'], secondaryMuscles: ['triceps'], instructions: ['Step:1 Lie on a bench.'] };
afterEach(() => { vi.unstubAllGlobals(); });
describe('ExerciseDB OSS adapter', () => {
  it('parses the documented response without inventing difficulty or planning eligibility', () => {
    const result = parseExerciseDbEntry(entry);
    expect(result?.instructions).toEqual(['Lie on a bench.']);
    expect(result?.gifUrl).toBe(entry.gifUrl);
    expect(result).not.toHaveProperty('difficulty');
  });
  it('rejects malformed records and blocks untrusted media hosts', () => {
    expect(parseExerciseDbEntry(null)).toBeNull();
    expect(parseExerciseDbEntry({ ...entry, exerciseId: '../bad' })).toBeNull();
    expect(parseExerciseDbEntry({ ...entry, gifUrl: 'https://untrusted.example/test.gif' })?.gifUrl).toBeNull();
  });
  it('uses documented name and cursor parameters and never sends profile data', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, meta: { total: 20, hasNextPage: true, nextCursor: 'next123' }, data: [entry] }),{ headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch',fetcher);
    const page = await searchExerciseDb('barbell bench press','previous123');
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.hostname).toBe('oss.exercisedb.dev'); expect(url.searchParams.get('name')).toBe('barbell bench press');
    expect(url.searchParams.get('after')).toBe('previous123'); expect(url.searchParams.get('limit')).toBe('12');
    expect(page.nextCursor).toBe('next123'); expect(page.entries).toHaveLength(1);
  });
  it('handles rate limits and unexpected response shapes', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{ status: 429 })));
    await expect(searchExerciseDb('press')).rejects.toThrow('rate-limiting');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))));
    await expect(searchExerciseDb('press')).rejects.toThrow('unexpected response');
  });
});
