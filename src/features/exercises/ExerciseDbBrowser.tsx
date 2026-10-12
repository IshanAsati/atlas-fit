import { useEffect, useRef, useState, type FormEvent } from 'react';
import { db } from '../../data/db';
import { searchExerciseDb, type ExerciseDbEntry, type ExerciseDbPage } from '../../data/exerciseDb';
import { OFFLINE_MEDIA_CACHE } from '../../data/media';
import { Modal } from '../../design/Modal';
import { Icon } from '../../design/Icon';

export function ExerciseDbBrowser() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<ExerciseDbPage | null>(null);
  const [saved, setSaved] = useState<ExerciseDbEntry[]>([]);
  const [selected, setSelected] = useState<ExerciseDbEntry | null>(null);
  const [playing, setPlaying] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    db.externalExercises.orderBy('savedAt').reverse().toArray().then(setSaved).catch(() => setError('Saved ExerciseDB entries could not be opened.'));
    return () => controller.current?.abort();
  }, []);
  const search = async (event?: FormEvent, after?: string) => {
    event?.preventDefault(); if (!query.trim() || busy) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    const version = ++requestVersion.current;
    setBusy(true); setError(null); setStatus(null);
    try {
      const result = await searchExerciseDb(query,after,request.signal);
      if (!request.signal.aborted && version === requestVersion.current) setPage((previous) => after && previous ? { ...result, entries: [...previous.entries,...result.entries.filter((entry) => !previous.entries.some((old) => old.exerciseId === entry.exerciseId))] } : result);
    } catch (cause) { if (!request.signal.aborted && version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'Search failed. Check your connection.'); }
    finally { if (version === requestVersion.current) setBusy(false); }
  };
  const inspect = (entry: ExerciseDbEntry) => { setSelected(entry); setPlaying(false); setImageFailed(false); setStatus(null); };
  const save = async () => {
    if (!selected || saving) return;
    setSaving(true); setError(null);
    let detailsSaved = false;
    try {
      const entry = { ...selected, savedAt: Date.now() };
      await db.externalExercises.put(entry);
      detailsSaved = true;
      setSaved(await db.externalExercises.orderBy('savedAt').reverse().toArray());
      setStatus('Exercise details saved for offline browsing.');
      // Opaque GIF responses may be cached only after the browser actually decoded the image.
      if (entry.gifUrl && playing && !imageFailed && typeof globalThis.caches !== 'undefined') {
        const image = new Image(); image.src = entry.gifUrl; await image.decode();
        const response = await fetch(entry.gifUrl,{ mode: 'no-cors' });
        if (!response.ok && response.type !== 'opaque') throw new Error('Demo unavailable');
        await (await caches.open(OFFLINE_MEDIA_CACHE)).put(entry.gifUrl,response);
        setStatus('Exercise details and demonstration saved for offline use.');
      } else if (entry.gifUrl) setStatus('Details saved. Play the demonstration successfully, then save again to cache its media.');
    } catch { setStatus(detailsSaved ? 'Details saved, but the demonstration could not be cached. Retry online.' : 'Exercise details were not saved. Try again before going offline.'); }
    finally { setSaving(false); }
  };
  const entries = page?.entries ?? saved;
  return <>
    <div className="banner"><strong>Explore more exercises online</strong><p className="sub">ExerciseDB entries are for browsing only; they aren’t added to your training plan.</p><details className="ex-source-info"><summary>Privacy and usage</summary><p>For personal, non-commercial use. Search sends your query to ExerciseDB, not your workout log. These exercises haven’t been reviewed for equipment, difficulty, or muscle targets.</p></details></div>
    <form className="row" onSubmit={(event) => void search(event)}><div className="field grow"><label htmlFor="exercisedb-query">ExerciseDB search</label><input id="exercisedb-query" type="search" className="input" value={query} placeholder="e.g. barbell bench press" onChange={(event) => { controller.current?.abort(); ++requestVersion.current; setBusy(false); setQuery(event.target.value); setPage(null); setError(null); }} /></div><button className="btn primary" disabled={busy || !query.trim()} style={{ alignSelf: 'flex-end' }}><Icon name="search" size={18} />{busy ? 'Searching…' : 'Search'}</button></form>
    <div className="row between"><h2 className="h-sec">{page ? `${page.total} matches` : 'Saved for offline'}</h2>{page && <button className="btn ghost small-btn" onClick={() => { setPage(null); setError(null); }}>Saved library</button>}</div>
    {error && <p className="error-message" role="alert">{error}</p>}
    {busy && <p role="status" className="small">Searching ExerciseDB…</p>}
    {entries.length ? <ul className="ex-list">{entries.map((entry) => <li key={entry.exerciseId} className="ex-card"><button className="ex-card-main" onClick={() => inspect(entry)}><span className="exercise-picture small"><Icon name="exercise" size={28} /></span><span className="ex-card-content"><strong className="ex-card-title" style={{ display: 'block', textTransform: 'capitalize' }}>{entry.name}</strong><span className="small">{entry.equipments.join(', ')} · {entry.targetMuscles.join(', ')}</span></span><Icon name="arrow" size={18} /></button></li>)}</ul> : <div className="empty"><strong>{page ? 'No exercises found' : 'Your saved ExerciseDB library is empty'}</strong><p>Search online and save selected exercise details to browse them later without a connection.</p></div>}
    {page?.nextCursor && <button className="btn ghost block" disabled={busy} onClick={() => void search(undefined,page.nextCursor ?? undefined)}>Load next 12 results</button>}
    <footer className="credit">ExerciseDB data and media by <a href="https://ascendapi.com" target="_blank" rel="noopener noreferrer">AscendAPI</a>. <a href="https://oss.exercisedb.dev/docs" target="_blank" rel="noopener noreferrer">Free API terms and documentation</a>. Some upstream demonstrations may be unavailable. Saved ExerciseDB entries stay in this browser and are not included in training backups.</footer>
    <Modal open={Boolean(selected)} title={selected?.name ?? 'ExerciseDB exercise'} onClose={() => { if (!saving) { setSelected(null); setPlaying(false); } }}>{selected && <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <p className="small">ExerciseDB · not reviewed by Atlas Fit · personal use only</p>
      {selected.gifUrl && <><button className="btn ghost block" disabled={saving} onClick={() => setPlaying(!playing)}><Icon name="play" />{playing ? 'Stop demonstration' : 'Play 180p demonstration'}</button>{playing && <div className="exercise-picture large">{imageFailed ? <span className="media-unavailable">Demonstration unavailable. Use the written steps below.</span> : <img src={selected.gifUrl} alt={`${selected.name} exercise demonstration`} onError={() => setImageFailed(true)} />}</div>}</>}
      <button className="btn primary block" disabled={saving} onClick={() => void save()}><Icon name="download" />{saving ? 'Saving…' : 'Save for offline browsing'}</button>
      {status && <p className="banner" role="status">{status}</p>}
      <section><h3 className="h-sec">Equipment reported by source</h3><p className="sub">{selected.equipments.join(', ') || 'Not specified'}. Setup may require additional equipment.</p></section>
      <section><h3 className="h-sec">Muscle targets</h3><p className="sub">Primary: {selected.targetMuscles.join(', ') || 'Not specified'}</p><p className="sub">Secondary: {selected.secondaryMuscles.join(', ') || 'Not specified'}</p></section>
      <section><h3 className="h-sec">Instructions from ExerciseDB</h3>{selected.instructions.length ? <ol style={{ paddingLeft: 20, fontSize: 15 }}>{selected.instructions.map((step,index) => <li key={index} style={{ marginTop: 12 }}>{step}</li>)}</ol> : <p className="sub">No instructions supplied.</p>}</section>
      <p className="small">Stop if you feel pain. This source does not provide verified difficulty or safe progression advice.</p>
      {saved.some((entry) => entry.exerciseId === selected.exerciseId) && <button className="btn ghost" disabled={saving} onClick={async () => { try { await db.externalExercises.delete(selected.exerciseId); setSaved(await db.externalExercises.orderBy('savedAt').reverse().toArray()); setStatus('Removed from your saved ExerciseDB library. Cached media may remain until cleared in Settings.'); } catch { setStatus('Could not remove this saved entry. Try again.'); } }}>Remove saved details</button>}
      <footer className="credit">Data and media by <a href="https://ascendapi.com" target="_blank" rel="noopener noreferrer">AscendAPI</a>.</footer>
    </div>}</Modal>
  </>;
}
