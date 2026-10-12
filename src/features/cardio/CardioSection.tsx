import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { liveQuery } from 'dexie';
import { deleteCardioSession, getCardioSessions, saveCardioSession } from '../../data/cardio';
import { isLocalCalendarDate } from '../../data/trainingSettings';
import type { CardioSession } from '../../data/types';
import './CardioSection.css';

const activities: CardioSession['activity'][] = ['walk', 'run', 'cycle', 'row', 'swim', 'other'];
const efforts: CardioSession['intensity'][] = ['easy', 'moderate', 'hard'];
const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const MILES_TO_KM = 1.609344;
const numberLabel = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
const dateLabel = (timestamp: number) => new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
function localDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function completedDate(value: string): number {
  if (!isLocalCalendarDate(value)) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function CardioSection({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const [sessions, setSessions] = useState<CardioSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [activity, setActivity] = useState<CardioSession['activity']>('walk');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<'km' | 'mi'>('km');
  const [date, setDate] = useState(() => localDate(new Date()));
  const [effort, setEffort] = useState<CardioSession['intensity']>('moderate');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    const subscription = liveQuery(getCardioSessions).subscribe({
      next: (records) => { setSessions(records); setLoading(false); setLoadError(false); },
      error: () => { setLoading(false); setLoadError(true); },
    });
    return () => subscription.unsubscribe();
  }, [reload]);

  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const thisWeek = sessions.filter((session) => session.completedAt >= weekStart.getTime() && session.completedAt <= now.getTime());
  const minutes = thisWeek.reduce((total, session) => total + session.durationMin, 0);
  const distanceKm = thisWeek.reduce((total, session) => total + (session.distanceKm ?? 0), 0);
  const displayedDistance = (km: number) => numberLabel(unit === 'mi' ? km / MILES_TO_KM : km);
  const limit = compact ? 3 : 5;
  const visible = showAll ? sessions : sessions.slice(0, limit);
  const fieldProps = (field: string) => ({
    'aria-invalid': error?.field === field || undefined,
    'aria-describedby': error?.field === field ? `${id}-error` : undefined,
  });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    setStatus('');
    setError(null);
    const durationMin = Number(duration);
    const canonicalDistance = distance.trim() ? Number(distance) * (unit === 'mi' ? MILES_TO_KM : 1) : undefined;
    const completedAt = completedDate(date);
    if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 1440) {
      setError({ field: 'duration', message: 'Enter a duration greater than 0 and up to 1,440 minutes.' }); return;
    }
    if (canonicalDistance !== undefined && (!Number.isFinite(canonicalDistance) || canonicalDistance <= 0 || canonicalDistance > 10000)) {
      setError({ field: 'distance', message: 'Enter a distance greater than 0 and up to 10,000 km (6,213.71 mi), or leave it blank.' }); return;
    }
    if (!Number.isFinite(completedAt) || completedAt < 0 || completedAt > Date.now()) {
      setError({ field: 'date', message: 'Choose today or a valid past date.' }); return;
    }
    if (notes.trim().length > 500) {
      setError({ field: 'notes', message: 'Keep notes to 500 characters or fewer.' }); return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const session: CardioSession = { id: crypto.randomUUID(), activity, durationMin, intensity: effort, completedAt };
      if (canonicalDistance !== undefined) session.distanceKm = canonicalDistance;
      if (notes.trim()) session.notes = notes.trim();
      await saveCardioSession(session);
      setSessions((previous) => [session, ...previous.filter((record) => record.id !== session.id)].sort((a, b) => b.completedAt - a.completedAt));
      setDuration(''); setDistance(''); setNotes('');
      setStatus('Cardio session saved on this device.');
    } catch {
      setError({ message: 'Cardio was not saved. Your entries are kept; try saving again.' });
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  async function remove(sessionId: string) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null); setStatus('');
    try {
      await deleteCardioSession(sessionId);
      setSessions((previous) => previous.filter((session) => session.id !== sessionId));
      setDeleting(null); setStatus('Cardio session deleted.');
    } catch {
      setError({ message: 'Cardio was not deleted. Your record is kept; try deleting again.' });
    } finally {
      busyRef.current = false; setBusy(false);
    }
  }

  return <section className={`cardio-section${compact ? ' cardio-section--compact' : ''}`} aria-labelledby={`${id}-heading`} aria-busy={busy}>
    <header><h2 className="h-sec" id={`${id}-heading`}>Cardio</h2><p className="sub">Separate from strength sets</p></header>
    {!loading && !loadError && <p className="cardio-summary">This week (Mon–Sun): {numberLabel(minutes)} logged minutes · {displayedDistance(distanceKm)} {unit} logged distance</p>}
    <details className="cardio-log">
      <summary>Log cardio</summary>
      <form className="cardio-form" onSubmit={save} noValidate>
        <fieldset disabled={busy}>
          <div className="field"><label htmlFor={`${id}-activity`}>Activity</label><select className="input" id={`${id}-activity`} value={activity} onChange={(event) => setActivity(event.target.value as CardioSession['activity'])}>{activities.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div>
          <div className="field"><label htmlFor={`${id}-duration`}>Duration (minutes)</label><input className="input" id={`${id}-duration`} type="number" inputMode="decimal" min="0.1" max="1440" step="any" required value={duration} onChange={(event) => setDuration(event.target.value)} {...fieldProps('duration')} /></div>
          <div className="cardio-distance">
            <div className="field"><label htmlFor={`${id}-distance`}>Distance ({unit}, optional)</label><input className="input" id={`${id}-distance`} type="number" inputMode="decimal" min="0.001" max={unit === 'mi' ? 10000 / MILES_TO_KM : 10000} step="any" value={distance} onChange={(event) => setDistance(event.target.value)} {...fieldProps('distance')} /></div>
            <div className="field"><label htmlFor={`${id}-unit`}>Distance unit</label><select className="input" id={`${id}-unit`} value={unit} onChange={(event) => {
              const nextUnit = event.target.value as 'km' | 'mi';
              if (distance.trim() && Number.isFinite(Number(distance))) setDistance(String(Number(distance) * (nextUnit === 'mi' ? 1 / MILES_TO_KM : MILES_TO_KM)));
              setUnit(nextUnit);
            }}><option value="km">km</option><option value="mi">mi</option></select></div>
          </div>
          <div className="field"><label htmlFor={`${id}-date`}>Completed date</label><input className="input" id={`${id}-date`} type="date" min="1970-01-01" max={localDate(now)} required value={date} onChange={(event) => setDate(event.target.value)} {...fieldProps('date')} /></div>
          <div className="field"><label htmlFor={`${id}-effort`}>Effort</label><select className="input" id={`${id}-effort`} value={effort} onChange={(event) => setEffort(event.target.value as CardioSession['intensity'])}>{efforts.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div>
          <div className="field"><label htmlFor={`${id}-notes`}>Notes (optional)</label><textarea className="input" id={`${id}-notes`} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} {...fieldProps('notes')} /></div>
          <button className="btn primary" type="submit">{busy ? 'Saving…' : 'Save cardio session'}</button>
        </fieldset>
      </form>
    </details>
    {error && <p className="cardio-error" id={`${id}-error`} role="alert">{error.message}</p>}
    {status && <p className="cardio-status" role="status">{status}</p>}
    {loading ? <p className="small" role="status">Loading cardio…</p> : loadError ? <div><p className="cardio-error" role="alert">Could not load cardio records. Retry to see your history.</p><button type="button" className="btn ghost" onClick={() => { setLoading(true); setLoadError(false); setReload((value) => value + 1); }}>Retry cardio history</button></div> : sessions.length === 0 ? <p className="small">No cardio logged yet. Open “Log cardio” to save a walk, run, ride, or another activity.</p> : <>
      <h3 className="cardio-list-heading">Recent cardio</h3>
      <ul className="cardio-records" aria-label="Recent cardio sessions">
        {visible.map((session) => <li key={session.id}>
          <div className="cardio-record-content"><strong>{titleCase(session.activity)} · {numberLabel(session.durationMin)} min</strong><p>{dateLabel(session.completedAt)} · {titleCase(session.intensity)}{session.distanceKm !== undefined ? ` · ${displayedDistance(session.distanceKm)} ${unit}` : ''}</p>{session.notes && <p>{session.notes}</p>}</div>
          {deleting === session.id ? <div className="cardio-confirm"><p>Delete this {session.activity} record? This cannot be undone.</p><div className="cardio-actions"><button type="button" className="btn danger small-btn" disabled={busy} onClick={() => void remove(session.id)}>Confirm delete</button><button type="button" className="btn ghost small-btn" disabled={busy} onClick={() => setDeleting(null)}>Keep record</button></div></div> : <button type="button" className="btn ghost small-btn" disabled={busy} aria-label={`Delete ${session.activity} on ${dateLabel(session.completedAt)}`} onClick={() => { setDeleting(session.id); setStatus(''); }}>Delete</button>}
        </li>)}
      </ul>
      {sessions.length > limit && <button type="button" className="btn ghost small-btn" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show fewer cardio sessions' : `Show all ${sessions.length} cardio sessions`}</button>}
    </>}
  </section>;
}
