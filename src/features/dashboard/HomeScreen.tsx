import { useEffect, useMemo, useState } from 'react';
import type { Plan, WorkoutSession, UserProfile, MuscleId } from '../../data/types';
import { getUserProfile, getLatestPlan, getWorkoutSessions, getActiveWorkout } from '../../data/db';
import { CATALOG_BY_ID } from '../../data/catalog';
import { completedWorkingSets } from '../../data/training';
import { downloadExerciseMedia } from '../../data/media';
import { BodygraphFigure } from '../bodygraph/BodygraphFigure';
import { ExercisePicture } from '../../design/ExercisePicture';
import { Icon } from '../../design/Icon';
import './HomeScreen.css';

export interface HomeScreenProps {
  onStartWorkout?: (session: WorkoutSession) => void;
  onNavigateTab?: (tab: 'home' | 'plan' | 'workout' | 'exercises' | 'bodygraph' | 'data') => void;
  onNavigate?: (tab: string) => void;
  onSelectExercise?: (exerciseId: string) => void;
  className?: string;
}
const goalLabels = { strength: 'Strength', fitness: 'General fitness', technique: 'Technique & form', endurance: 'Endurance', mobility: 'Mobility' };
const locationLabels = { home: 'Home', gym: 'Gym', travel: 'Travel' };
export function HomeScreen({ onStartWorkout, onNavigateTab, onNavigate, onSelectExercise, className = '' }: HomeScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<Plan | undefined>();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [active, setActive] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaStatus, setMediaStatus] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [reload, setReload] = useState(0);
  const go = (tab: Parameters<NonNullable<HomeScreenProps['onNavigateTab']>>[0]) => onNavigateTab ? onNavigateTab(tab) : onNavigate?.(tab);
  useEffect(() => {
    let alive = true;
    Promise.all([getUserProfile(), getLatestPlan(), getWorkoutSessions(), getActiveWorkout()]).then(([p, nextPlan, history, current]) => {
      if (!alive) return;
      setProfile(p); setPlan(nextPlan); setSessions(history); setActive(current?.state === 'active' ? current : null);
    }).catch(() => { if (alive) setError('Couldn’t open your workouts. Try again. Your saved records haven’t changed.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);
  const done = useMemo(() => sessions.filter((session) => session.state === 'done').sort((a,b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt)), [sessions]);
  const monday = new Date();
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7); monday.setHours(0,0,0,0);
  const weekStart = monday.getTime();
  const thisWeek = done.filter((session) => (session.endedAt ?? session.startedAt) >= weekStart);
  const completedDays = new Set(thisWeek.filter((session) => session.planId === plan?.id).map((session) => session.dayId));
  const nextDay = plan?.days.find((day) => !completedDays.has(day.id));
  const previewItems = active?.items.map((item) => item.exerciseId) ?? nextDay?.exercises.map((item) => item.exerciseId) ?? [];
  const location = active?.location ?? plan?.location ?? profile?.activeLocation;
  const weeklySets = thisWeek.reduce((total, session) => total + completedWorkingSets(session), 0);
  const muscleActivity: Partial<Record<MuscleId,number>> = {};
  for (const session of thisWeek) for (const item of session.items) {
    if (item.skipped) continue;
    const exercise = CATALOG_BY_ID[item.exerciseId];
    const workingSets = item.sets.filter((set) => set.done && set.kind !== 'warmup').length;
    for (const id of exercise?.primary ?? []) muscleActivity[id] = (muscleActivity[id] ?? 0) + workingSets;
  }
  const strip = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label,index) => {
    const start = new Date(weekStart); start.setDate(start.getDate() + index);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    return { label, day: start.getDate(), today: new Date().toDateString() === start.toDateString(),
      hit: thisWeek.some((session) => (session.endedAt ?? session.startedAt) >= start.getTime() && (session.endedAt ?? session.startedAt) < end.getTime()) };
  });
  const start = () => {
    if (active) { onStartWorkout?.(active); return; }
    if (!nextDay || !plan) { go('plan'); return; }
    onStartWorkout?.({ id: crypto.randomUUID(), title: nextDay.label, planId: plan.id, dayId: nextDay.id,
      location: plan.location, startedAt: Date.now(), state: 'active', items: nextDay.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId, planned: { ...exercise }, sets: Array.from({ length: exercise.sets }, () => ({ reps: null, loadKg: null, done: false, kind: 'working' })) })) });
  };
  const download = async () => {
    setDownloading(true); setMediaStatus('Preparing images…');
    try {
      const result = await downloadExerciseMedia(previewItems, (current,total) => setMediaStatus(`Saving images: ${current} of ${total}…`));
      setMediaStatus(result.failed ? `${result.downloaded} images saved; ${result.failed} unavailable. You can still read the instructions offline.` : `${result.downloaded} images saved for offline use.`);
    } catch (cause) { setMediaStatus(cause instanceof Error ? cause.message : 'Download failed. Check your connection and retry.'); }
    finally { setDownloading(false); }
  };
  if (loading) return <main className="view" aria-busy="true"><div className="skeleton" style={{ height: 250 }} /><p className="small">Opening your next workout…</p></main>;
  if (error) return <main className="view"><h1 className="h-hero">Today</h1><p className="error-message" role="alert">{error}</p><button className="btn primary" onClick={() => { setError(null); setLoading(true); setReload((value) => value + 1); }}>Try again</button></main>;
  return <div className={`dashboard-screen ${className}`}>
    <header className="topbar today-header"><div><h1>Today</h1><p>{profile ? goalLabels[profile.goal] : 'Your training'} · {profile?.daysPerWeek ?? 3} days/week</p></div><button type="button" className="icon-btn" aria-label="Open settings" onClick={() => go('data')}><Icon name="settings" /></button></header>
    <main className="view">
       <section className="today-workout" aria-label="Next scheduled workout">
        <div className="row between"><span className="small">{location ? locationLabels[location] : 'Your training'}</span>{(active || !nextDay) && <span className="small">{active ? 'Workout in progress' : plan ? 'Week complete' : 'Your first workout'}</span>}</div>
        <h2 className="today-title">{active?.title ?? nextDay?.label ?? (plan ? 'Your week is complete' : 'Ready for your first workout?')}</h2>
        <p className="sub">{active ? 'Pick up where you left off. Your sets are saved.' : nextDay?.focus ?? (plan ? 'Take a rest day, or open your plan to repeat a workout.' : 'Open your plan to choose a workout for your time and equipment.')}</p>
        {previewItems.length > 0 && <>
          <p className="small">{previewItems.length} {previewItems.length === 1 ? 'exercise' : 'exercises'}{!active && ` · About ${profile?.durationMin ?? 45} min`}</p>
          <div className="today-preview">{previewItems.slice(0,3).map((id,index) => {
            const exercise = CATALOG_BY_ID[id];
            return exercise ? <button key={`${id}-${index}`} className="preview-exercise" onClick={() => onSelectExercise?.(id)} aria-label={`View ${exercise.name}`}><ExercisePicture exercise={exercise} /><span>{exercise.name}</span></button> : null;
          })}</div>
        </>}
        <button className="btn primary block" onClick={start}><Icon name="play" />{active ? 'Resume workout' : nextDay ? 'Start workout' : 'Open training plan'}</button>
        {previewItems.length > 0 && <button className="btn ghost block small-btn" disabled={downloading} onClick={() => void download()}><Icon name="download" size={17} />{downloading ? 'Saving images…' : 'Save offline images'}</button>}
        {mediaStatus && <p className="small" role="status">{mediaStatus}</p>}
        {previewItems.length > 0 && <button className="today-adjust" onClick={() => go('plan')}>Adjust workout <Icon name="arrow" size={16} /></button>}
      </section>
      <section aria-label="Weekly activity strip"><div className="section-heading"><h2 className="h-sec">This week</h2><span className="small">{thisWeek.length} of {profile?.daysPerWeek ?? 3} workouts</span></div>
        <div className="strip" role="list">{strip.map((day) => <div key={day.label} role="listitem" className={`cell ${day.hit ? 'hit' : ''} ${day.today ? 'today' : ''}`} aria-label={`${day.label} ${day.day}, ${day.hit ? 'workout completed' : 'no workout'}`}><span>{day.label}</span><strong>{day.day}</strong>{day.hit && <Icon name="check" size={14} />}</div>)}</div>
      </section>
      <section><div className="section-heading"><h2 className="h-sec">Last workout</h2><button className="today-link" onClick={() => go('bodygraph')}>View history <Icon name="arrow" size={16} /></button></div>
        {done[0] ? <button className="recent-session" onClick={() => go('bodygraph')}><div><strong>{done[0].title}</strong><p className="small">{new Date(done[0].endedAt ?? done[0].startedAt).toLocaleDateString(undefined,{ month: 'short', day: 'numeric' })} · {completedWorkingSets(done[0])} working {completedWorkingSets(done[0]) === 1 ? 'set' : 'sets'}</p></div><Icon name="arrow" /></button> : <div className="first-session-note"><strong>No completed workouts yet</strong><p className="sub">Finish a workout to see your sets and progress here.</p></div>}
      </section>
      {thisWeek.length > 0 && <section className="today-activity"><BodygraphFigure view="front" highlightMap={muscleActivity} compact /><div><h2 className="h-sec">Muscles trained</h2><p className="sub">{weeklySets} working {weeklySets === 1 ? 'set' : 'sets'} logged this week.</p><p className="small">Based on your logged sets, not a recovery estimate.</p><button className="btn ghost small-btn" onClick={() => go('bodygraph')}>Explore muscles <Icon name="arrow" size={16} /></button></div></section>}
      <footer className="credit">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB (repdb.co)</a>. Your training log stays on this device.</footer>
    </main>
  </div>;
}
