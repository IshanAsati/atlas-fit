import { useEffect, useMemo, useRef } from 'react';
import type { Exercise, MuscleId, WorkoutSession } from '../../data/types';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { CATALOG } from '../../data/catalog';
import { calculateMuscleActivity } from './activity';

export interface MuscleDrawerProps {
  muscleId: MuscleId | null;
  isOpen: boolean;
  onClose: () => void;
  sessions?: WorkoutSession[];
  catalog?: Exercise[];
  onSelectExercise?: (exerciseId: string) => void;
}

export function MuscleDrawer({ muscleId, isOpen, onClose, sessions = [], catalog = CATALOG, onSelectExercise }: MuscleDrawerProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const meta = muscleId ? MUSCLE_BY_ID[muscleId] : null;
  const activity = useMemo(() => ({
    week: calculateMuscleActivity(sessions, catalog, 'week'),
    month: calculateMuscleActivity(sessions, catalog, 'month'),
  }), [sessions, catalog]);
  const exercises = useMemo(() => catalog.filter((exercise) => muscleId && (
    exercise.primary.includes(muscleId) || exercise.secondary.includes(muscleId)
  )).sort((a, b) => Number(b.primary.includes(muscleId!)) - Number(a.primary.includes(muscleId!))), [catalog, muscleId]);

  useEffect(() => {
    if (!isOpen || !muscleId) return;
    const previouslyFocused = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sheetRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const buttons = sheetRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled), [tabindex="0"]');
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener('keydown', handleKey);
      if (previouslyFocused instanceof HTMLElement || previouslyFocused instanceof SVGElement) previouslyFocused.focus();
    };
  }, [isOpen, muscleId, onClose]);

  if (!isOpen || !meta || !muscleId) return null;
  return <>
    <div className="scrim" onClick={onClose} aria-hidden="true" />
    <section ref={sheetRef} className="sheet muscle-drawer" role="dialog" aria-modal="true" aria-labelledby="muscle-drawer-title">
      <div className="muscle-drawer-header">
        <h2 id="muscle-drawer-title">{meta.name}</h2>
        <button className="muscle-drawer-close" type="button" onClick={onClose} aria-label="Close muscle details">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <p>{meta.blurb}</p>
      <div className="muscle-drawer-stats">
        <div><strong>{activity.week.primary[muscleId] ?? 0}</strong><span>Primary working sets · last 7 days</span></div>
        <div><strong>{activity.month.primary[muscleId] ?? 0}</strong><span>Primary working sets · last 30 days</span></div>
      </div>
      <p>Supporting contribution estimate: {activity.week.secondaryEstimate[muscleId] ?? 0} in 7 days · {activity.month.secondaryEstimate[muscleId] ?? 0} in 30 days (0.5 × secondary-target sets). Not additional actual sets.</p>
      <p>Completed working sets only. Warm-ups and skipped exercises are excluded. Activity is not a recovery measurement.</p>
      <h3>Targeting exercises</h3>
      <ul className="muscle-drawer-exercises">
        {exercises.map((exercise) => <li key={exercise.id}>
          <button type="button" onClick={() => { onClose(); onSelectExercise?.(exercise.id); }} disabled={!onSelectExercise}>
            <span><strong>{exercise.name}</strong><small>{exercise.primary.includes(muscleId) ? 'Primary target' : 'Supporting target'}</small></span>
            {onSelectExercise && <span>View</span>}
          </button>
        </li>)}
      </ul>
      {!exercises.length && <p>No exercises in the catalogue target this muscle yet.</p>}
    </section>
  </>;
}
