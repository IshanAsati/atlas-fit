import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../data/store';
import { putSession } from '../../data/db';
import { Sheet, TopBar } from '../../design/ui';
import { ExerciseFigure } from '../../design/ExerciseFigure';
import { CheckIcon, ChevronRight, SwapIcon } from '../../design/icons';
import { Bodygraph } from '../bodygraph/Bodygraph';
import { formatElapsed } from './session';
import { adaptHint, suggestSwap } from '../planner/engine';
import type { MuscleId, PerformedSet, SessionItem, WorkoutSession } from '../../data/types';

/**
 * Screen 4 — Active Workout (§4.4).
 * Elapsed time, progress, set rows with reps/load/effort, rest timer,
 * muscle targets, substitution, skip/undo, pause & finish with confirm.
 * Every change auto-saves to Dexie — refresh or close never loses a set.
 */
export function ActiveWorkout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sessions, plans, profile, catalog, byId } = useStore();

  const session = useMemo(
    () => (id ? sessions.find((s) => s.id === id) : sessions.find((s) => s.state === 'active')),
    [sessions, id],
  );

  const [now, setNow] = useState(Date.now());
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restPausedAt, setRestPausedAt] = useState<number | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  /** Manual focus: which exercise the user is looking at (else first incomplete). */
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [targetView, setTargetView] = useState<'front' | 'back'>('front');
  const saveBusy = useRef(false);

  // Tick clock: elapsed time + rest countdown.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Save-on-exit safety: persist whenever the page is being hidden/closed.
  useEffect(() => {
    const flush = () => {
      if (session && saveBusy.current) {
        void putSession(session);
      }
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [session]);

  const save = async (next: WorkoutSession) => {
    saveBusy.current = true;
    try {
      await putSession(next);
    } finally {
      saveBusy.current = false;
    }
  };

  if (!session) {
    // No active session — offer to start from the current plan.
    const plan = plans.length > 0 ? plans[plans.length - 1] : null;
    return (
      <>
        <TopBar title="Workout" sub="Nothing in progress" />
        <main className="view">
          <div className="empty">
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 6 }}>
              No active workout
            </strong>
            {plan ? 'Your next planned day is ready when you are.' : 'Create a plan first to start a structured session.'}
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn primary small-btn" onClick={() => navigate(plan ? '/plan' : '/home')}>
                {plan ? 'Open plan' : 'Go home'}
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  const firstIncomplete = session.items.findIndex(
    (it) => !it.skipped && it.sets.some((s) => !s.done),
  );
  const currentIndex =
    focusIdx !== null && focusIdx >= 0 && focusIdx < session.items.length ? focusIdx : firstIncomplete;
  const current = currentIndex >= 0 ? session.items[currentIndex] : null;
  const currentEx = current ? byId(current.exerciseId) : undefined;

  const totalSets = session.items.filter((i) => !i.skipped).reduce((n, i) => n + i.sets.length, 0);
  const doneSets = session.items
    .filter((i) => !i.skipped)
    .reduce((n, i) => n + i.sets.filter((s) => s.done).length, 0);

  const elapsed = session.state === 'done' ? (session.endedAt ?? session.startedAt) - session.startedAt : now - session.startedAt;

  const restLeft = restEnd ? Math.max(0, Math.ceil((restEnd - now) / 1000)) : 0;

  const patchItems = async (items: SessionItem[]) => {
    await save({ ...session, items });
  };

  const toggleSet = async (itemIdx: number, setIdx: number) => {
    const items = session.items.map((it, i) =>
      i !== itemIdx
        ? it
        : {
            ...it,
            sets: it.sets.map((s, j) => (j !== setIdx ? s : { ...s, done: !s.done })),
          },
    );
    const becameDone = items[itemIdx].sets[setIdx]?.done;
    await patchItems(items);
    if (becameDone) startRest(items[itemIdx].planned?.restSec ?? 90);
  };

  const updateSet = async (itemIdx: number, setIdx: number, patch: Partial<PerformedSet>) => {
    const items = session.items.map((it, i) =>
      i !== itemIdx
        ? it
        : { ...it, sets: it.sets.map((s, j) => (j !== setIdx ? s : { ...s, ...patch })) },
    );
    await patchItems(items);
  };

  const addSet = async (itemIdx: number) => {
    const items = session.items.map((it, i) =>
      i !== itemIdx ? it : { ...it, sets: [...it.sets, { reps: null, loadKg: null, done: false }] },
    );
    await patchItems(items);
  };

  const removeSet = async (itemIdx: number) => {
    const items = session.items.map((it, i) =>
      i !== itemIdx ? it : { ...it, sets: it.sets.slice(0, -1) },
    );
    await patchItems(items);
  };

  const skipExercise = async (itemIdx: number) => {
    const items = session.items.map((it, i) => (i !== itemIdx ? it : { ...it, skipped: !it.skipped }));
    setFocusIdx(null);
    await patchItems(items);
  };

  const startRest = (sec: number) => {
    setRestPausedAt(null);
    setRestEnd(Date.now() + sec * 1000);
  };
  const pauseRest = () => {
    if (restEnd) {
      setRestPausedAt(restEnd);
      setRestEnd(null);
    }
  };
  const resumeRest = () => {
    if (restPausedAt) {
      setRestEnd(restPausedAt);
      setRestPausedAt(null);
    }
  };
  const resetRest = () => {
    setRestEnd(null);
    setRestPausedAt(null);
  };

  const doSwap = async (newId: string) => {
    if (swapIdx === null) return;
    const items = session.items.map((it, i) =>
      i !== swapIdx ? it : { ...it, exerciseId: newId },
    );
    await patchItems(items);
    setSwapIdx(null);
  };

  const addExercise = async (exId: string) => {
    const items: SessionItem[] = [
      ...session.items,
      { exerciseId: exId, sets: [{ reps: null, loadKg: null, done: false }] },
    ];
    await patchItems(items);
    setAddOpen(false);
  };

  const finish = async () => {
    const finished: WorkoutSession = { ...session, state: 'done', endedAt: Date.now() };
    await save(finished);
    // Conservative adaptation note (§7.3) from real logs only.
    let done = 0;
    let attempts = 0;
    let easy = 0;
    let hard = 0;
    for (const it of finished.items) {
      for (const s of it.sets) {
        if (s.reps || s.loadKg || s.done) attempts += 1;
        if (s.done) done += 1;
        if (s.effort === 1) easy += 1;
        if (s.effort === 3) hard += 1;
      }
    }
    const hint = adaptHint({
      completions: done,
      attempts,
      discomfort: false,
      hardCount: hard,
      easyCount: easy,
    });
    setSummary(`Session saved. ${done} sets logged. ${hint.note}`);
  };

  // Previous-session comparison — only when real records exist (§4.4).
  const previous = useMemo(() => {
    if (!current) return null;
    const past = sessions
      .filter((s) => s.state === 'done' && s.id !== session.id)
      .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
    for (const s of past) {
      const item = s.items.find((i) => i.exerciseId === current.exerciseId && i.sets.some((x) => x.done));
      if (item) {
        const parts = item.sets
          .filter((x) => x.done)
          .map((x) => `${x.reps ?? '–'}${x.loadKg ? `@${x.loadKg}kg` : ''}`);
        if (parts.length > 0) return `${parts.join(', ')}`;
      }
    }
    return null;
  }, [sessions, current, session.id]);

  const swapOptions =
    swapIdx !== null && profile && session.items[swapIdx]
      ? suggestSwap(session.items[swapIdx].exerciseId, profile, catalog, (x) => byId(x))
      : [];

  const muscleState: Partial<Record<MuscleId, 'primary' | 'secondary'>> = {};
  if (currentEx) {
    for (const m of currentEx.primary) muscleState[m] = 'primary';
    for (const m of currentEx.secondary) muscleState[m] = 'secondary';
  }

  if (summary) {
    return (
      <>
        <TopBar title="Workout complete" sub="Saved on this device" />
        <main className="view">
          <div className="panel">
            <h2 className="h-sec">{session.title}</h2>
            <p className="sub">{summary}</p>
            <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
              <button type="button" className="btn primary grow" onClick={() => navigate('/home')}>
                Back to home
              </button>
              <button type="button" className="btn grow" onClick={() => navigate('/bodygraph')}>
                See training activity
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <TopBar
        title={session.title}
        sub={`${formatElapsed(elapsed)} elapsed · ${doneSets}/${totalSets} sets · ${session.location}`}
        right={
          <button
            type="button"
            className="btn ghost small-btn"
            onClick={() => setConfirmFinish(true)}
          >
            Finish
          </button>
        }
      />

      <main className="view">
        <div className="pbar" aria-label={`Workout progress: ${doneSets} of ${totalSets} sets`}>
          <div style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>

        {/* Rest timer */}
        <section className="panel" aria-live="polite">
          <div className="timer">
            {restEnd ? (
              <>
                <div className="small">Resting</div>
                <div className="t">
                  {Math.floor(restLeft / 60)}:{String(restLeft % 60).padStart(2, '0')}
                </div>
              </>
            ) : restPausedAt ? (
              <>
                <div className="small">Rest paused</div>
                <div className="t">–:––</div>
              </>
            ) : (
              <>
                <div className="small">Rest timer</div>
                <div className="t">–:––</div>
              </>
            )}
          </div>
          <div className="row wrap" style={{ gap: 8, justifyContent: 'center' }}>
            <button type="button" className="btn small-btn" onClick={() => startRest(60)}>
              60s
            </button>
            <button type="button" className="btn small-btn" onClick={() => startRest(90)}>
              90s
            </button>
            {restEnd ? (
              <>
                <button type="button" className="btn small-btn" onClick={pauseRest}>
                  Pause
                </button>
                <button type="button" className="btn ghost small-btn" onClick={resetRest}>
                  Reset
                </button>
              </>
            ) : restPausedAt ? (
              <>
                <button type="button" className="btn small-btn" onClick={resumeRest}>
                  Resume
                </button>
                <button type="button" className="btn ghost small-btn" onClick={resetRest}>
                  Reset
                </button>
              </>
            ) : null}
          </div>
        </section>

        {/* Current exercise */}
        {current && currentEx ? (
          <section className="panel">
            <div className="row between">
              <div>
                <div className="small">Exercise {currentIndex + 1} of {session.items.length}</div>
                <h2 className="h-sec">{currentEx.name}</h2>
                <div className="small">
                  {currentEx.primary.join(', ')}
                  {currentEx.secondary.length > 0 ? ` + ${currentEx.secondary.join(', ')}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="btn ghost small-btn"
                onClick={() => setShowTargets(true)}
                aria-label="View muscle targets"
              >
                Body
              </button>
            </div>

            {previous ? (
              <p className="small" style={{ marginTop: 8 }}>
                Last time: <strong style={{ color: 'var(--text)' }}>{previous}</strong>
              </p>
            ) : null}

            <p className="small" style={{ marginTop: 6 }}>
              {current.planned
                ? `Plan: ${current.planned.sets} sets × ${current.planned.reps} reps · ${current.planned.restSec}s rest`
                : 'Added exercise'}
            </p>

            <div className="field" style={{ marginTop: 8 }}>
              <div style={{ maxWidth: 280 }}>
                <ExerciseFigure exercise={currentEx} />
              </div>
              {currentEx.instructions.slice(0, 2).map((ins) => (
                <p key={ins} className="small" style={{ margin: '2px 0' }}>
                  • {ins}
                </p>
              ))}
            </div>

            {/* Set rows */}
            <div style={{ marginTop: 8 }}>
              <div className="setrow" style={{ borderBottom: 0, paddingBottom: 0 }}>
                <span className="n small">Set</span>
                <span className="small" style={{ textAlign: 'center' }}>Reps</span>
                <span className="small" style={{ textAlign: 'center' }}>Load (kg)</span>
                <span className="small" style={{ textAlign: 'center' }}>Done</span>
              </div>
              {current.sets.map((s, j) => (
                <div className="setrow" key={j}>
                  <span className="n">{j + 1}</span>
                  <input
                    inputMode="numeric"
                    aria-label={`Set ${j + 1} reps`}
                    value={s.reps ?? ''}
                    placeholder="–"
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      void updateSet(currentIndex, j, { reps: v === '' ? null : Number(v) });
                    }}
                  />
                  <input
                    inputMode="decimal"
                    aria-label={`Set ${j + 1} load in kg`}
                    value={s.loadKg ?? ''}
                    placeholder="bw"
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, '');
                      void updateSet(currentIndex, j, { loadKg: v === '' ? null : Number(v) });
                    }}
                  />
                  <button
                    type="button"
                    className="donebtn"
                    aria-pressed={s.done}
                    aria-label={`Mark set ${j + 1} ${s.done ? 'not done' : 'done'}`}
                    onClick={() => void toggleSet(currentIndex, j)}
                  >
                    <CheckIcon />
                  </button>
                </div>
              ))}
            </div>

            {/* Effort (optional, applied to the last set) */}
            <div className="row between" style={{ marginTop: 8 }}>
              <span className="small">Last set effort?</span>
              <div className="chips">
                {([1, 2, 3] as const).map((lvl) => {
                  const lastIdx = current.sets.length - 1;
                  const pressed = current.sets[lastIdx]?.effort === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      className="chip"
                      aria-pressed={pressed}
                      disabled={current.sets.length === 0}
                      onClick={() =>
                        void updateSet(currentIndex, lastIdx, {
                          effort: pressed ? undefined : lvl,
                        })
                      }
                    >
                      {lvl === 1 ? 'Easy' : lvl === 2 ? 'Right' : 'Hard'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              <button type="button" className="btn small-btn grow" onClick={() => void addSet(currentIndex)}>
                + Add set
              </button>
              <button type="button" className="btn ghost small-btn grow" onClick={() => void removeSet(currentIndex)}>
                − Remove set
              </button>
              <button type="button" className="btn ghost small-btn grow" onClick={() => setSwapIdx(currentIndex)}>
                <SwapIcon /> Substitute
              </button>
              <button
                type="button"
                className="btn ghost small-btn grow"
                onClick={() => void skipExercise(currentIndex)}
              >
                {current.skipped ? 'Restore' : 'Skip movement'}
              </button>
              <button type="button" className="btn ghost small-btn grow" onClick={() => setAddOpen(true)}>
                + Add exercise
              </button>
            </div>
          </section>
        ) : (
          <section className="panel">
            <h2 className="h-sec">All sets done</h2>
            <p className="sub">Every exercise in this session is complete or skipped.</p>
            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 12 }}
              onClick={() => setConfirmFinish(true)}
            >
              Finish & save session
            </button>
          </section>
        )}

        {/* Remaining exercises */}
        <section>
          <h2 className="h-sec" style={{ marginBottom: 8 }}>In this session</h2>
          {session.items.map((it, i) => {
            const ex = byId(it.exerciseId);
            const done = it.sets.filter((s) => s.done).length;
            return (
              <button
                key={`${it.exerciseId}-${i}`}
                type="button"
                className="exrow"
                onClick={() => setFocusIdx(i)}
                aria-current={i === currentIndex ? 'true' : undefined}
                style={{ opacity: it.skipped ? 0.5 : 1 }}
              >
                <span className="dot" style={{ background: i === currentIndex ? 'var(--action)' : it.skipped ? 'var(--text-2)' : 'var(--hairline)' }} aria-hidden="true" />
                <span className="grow">
                  {ex?.name ?? it.exerciseId}
                  {it.skipped ? <span className="small"> · skipped</span> : null}
                </span>
                <span className="meta">
                  {done}/{it.sets.length}
                </span>
                <ChevronRight />
              </button>
            );
          })}
        </section>

        {/* Muscle targets sheet */}
        <Sheet
          open={showTargets && currentEx !== undefined}
          onClose={() => setShowTargets(false)}
          title={currentEx ? `${currentEx.name} targets` : 'Targets'}
        >
          <div className="bodywrap">
            <div className="seg" style={{ width: 200 }}>
              <button
                type="button"
                aria-pressed={targetView === 'front'}
                onClick={() => setTargetView('front')}
              >
                Front
              </button>
              <button
                type="button"
                aria-pressed={targetView === 'back'}
                onClick={() => setTargetView('back')}
              >
                Back
              </button>
            </div>
            <Bodygraph view={targetView} targets={muscleState} labelSuffix="target" />
            <div className="legend">
              <span>
                <i style={{ background: 'var(--muscle-primary)' }} /> Primary
              </span>
              <span>
                <i style={{ background: 'var(--muscle-secondary)' }} /> Secondary
              </span>
              <span>
                <i style={{ background: 'var(--muscle-neutral)' }} /> Not targeted
              </span>
            </div>
          </div>
        </Sheet>

        {/* Substitute sheet */}
        <Sheet
          open={swapIdx !== null}
          onClose={() => setSwapIdx(null)}
          title="Substitute exercise"
        >
          {swapOptions.length > 0 ? (
            swapOptions.map((opt) => (
              <button key={opt.id} type="button" className="exrow" onClick={() => void doSwap(opt.id)}>
                <SwapIcon />
                <span className="grow">{opt.name}</span>
                <span className="meta">{opt.movement}</span>
              </button>
            ))
          ) : (
            <p className="sub">No alternative fits your current equipment and avoid-list.</p>
          )}
        </Sheet>

        {/* Add exercise sheet */}
        <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add exercise">
          {catalog.slice(0, 30).map((ex) => (
            <button key={ex.id} type="button" className="exrow" onClick={() => void addExercise(ex.id)}>
              <span className="dot" aria-hidden="true" />
              <span className="grow">{ex.name}</span>
              <span className="meta">{ex.movement}</span>
            </button>
          ))}
        </Sheet>

        {/* Finish confirm */}
        <Sheet open={confirmFinish} onClose={() => setConfirmFinish(false)} title="Finish workout?">
          <p className="sub">
            You've logged {doneSets} of {totalSets} sets. Saving keeps everything in history — you
            can't lose it by closing the app.
          </p>
          <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
            <button
              type="button"
              className="btn primary grow"
              onClick={() => {
                setConfirmFinish(false);
                void finish();
              }}
            >
              Finish & save
            </button>
            <button type="button" className="btn grow" onClick={() => setConfirmFinish(false)}>
              Keep training
            </button>
          </div>
          <button
            type="button"
            className="btn danger block"
            style={{ marginTop: 10 }}
            onClick={() => {
              setConfirmFinish(false);
              void save({ ...session, state: 'done', endedAt: Date.now() });
              navigate('/home');
            }}
          >
            Discard empty session
          </button>
        </Sheet>
      </main>
    </>
  );
}
