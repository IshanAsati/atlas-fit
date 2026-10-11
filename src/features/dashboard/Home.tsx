import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../data/store';
import { Credit, EmptyState, SectionHead, Sheet, TopBar } from '../../design/ui';
import { ChevronRight, GearIcon, PlayIcon, PlanIcon } from '../../design/icons';
import { Bodygraph } from '../bodygraph/Bodygraph';
import { buildSession } from '../workout/session';
import { buildBackup, downloadBackup, inspectBackup, restoreBackup } from '../../data/backup';
import type { BackupDoc, MuscleId } from '../../data/types';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Screen 2 — Home / Dashboard (§4.2).
 * Hierarchy: greeting → next workout hero + Start → 7-day strip → recent
 * session → mini Bodygraph → quick actions. No invented streaks or lifts.
 */
export function Home() {
  const { profile, plans, sessions, feedback, catalog } = useStore();
  const navigate = useNavigate();
  const [showBackup, setShowBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = sessions.find((s) => s.state === 'active');
  const doneSessions = sessions.filter((s) => s.state === 'done');
  const latestPlan = plans.length > 0 ? plans[plans.length - 1] : undefined;

  const nextDay = useMemo(() => {
    if (!latestPlan) return undefined;
    const today = (new Date().getDay() + 6) % 7; // Mon = 0
    const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return (
      latestPlan.days.find((_d, i) => profile?.weekdays.includes(names[(today + i) % 7] ?? '')) ??
      latestPlan.days[0]
    );
  }, [latestPlan, profile?.weekdays]);

  /** Last 7 days (including today) with real completed work. */
  const strip = useMemo(() => {
    const days: Array<{ label: string; hit: boolean }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const start = new Date(d).setHours(0, 0, 0, 0);
      const end = start + 24 * 60 * 60 * 1000;
      const hit = sessions.some(
        (s) => s.state === 'done' && (s.endedAt ?? s.startedAt) >= start && (s.endedAt ?? s.startedAt) < end,
      );
      days.push({ label: DAY_LETTERS[(d.getDay() + 6) % 7], hit });
    }
    return days;
  }, [sessions]);

  /** Week activity estimate from real logs only (muscle → working sets). */
  const weekActivity = useMemo(() => {
    const acc: Partial<Record<MuscleId, number>> = {};
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const s of sessions) {
      if ((s.endedAt ?? s.startedAt) < cutoff) continue;
      for (const item of s.items) {
        const sets = item.sets.filter((x) => x.done).length;
        if (sets === 0) continue;
        const ex = catalog.find((e) => e.id === item.exerciseId);
        if (!ex) continue;
        for (const m of ex.primary) acc[m] = (acc[m] ?? 0) + sets;
        for (const m of ex.secondary) acc[m] = (acc[m] ?? 0) + Math.round(sets / 2);
      }
    }
    return acc;
  }, [sessions, catalog]);

  const recent = doneSessions[0];

  const totalSets = useMemo(
    () =>
      doneSessions.reduce(
        (n, s) => n + s.items.reduce((m, it) => m + it.sets.filter((x) => x.done).length, 0),
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions],
  );

  const initial = (profile?.displayName?.trim()?.[0] ?? 'A').toUpperCase();

  const startNext = async () => {
    if (!latestPlan || !nextDay) {
      navigate('/plan');
      return;
    }
    if (active) {
      navigate(`/workout/${active.id}`);
      return;
    }
    const session = buildSession(latestPlan, nextDay);
    const { putSession } = await import('../../data/db');
    await putSession(session);
    navigate(`/workout/${session.id}`);
  };

  const onExport = async () => {
    const doc = await buildBackup();
    downloadBackup(doc);
    setBackupMsg('Backup file downloaded.');
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const doc = JSON.parse(text) as BackupDoc;
      const check = inspectBackup(doc);
      if (!check.ok) {
        setBackupMsg(`Import failed: ${check.error}`);
        return;
      }
      const ok = window.confirm(
        `Restore backup? This overwrites local data. Found: ${check.summary}`,
      );
      if (!ok) return;
      await restoreBackup(doc);
      setBackupMsg('Backup restored.');
      window.location.reload();
    } catch {
      setBackupMsg('Import failed: invalid file.');
    }
  };

  const name = profile?.displayName ? `, ${profile.displayName}` : '';

  return (
    <>
      <TopBar
        title={`Hi${name}`}
        sub={`${profile?.goal === 'strength' ? 'Strength' : profile?.goal === 'fitness' ? 'General fitness' : profile?.goal === 'technique' ? 'Technique' : profile?.goal === 'endurance' ? 'Endurance' : 'Mobility'} · ${profile?.activeLocation ?? 'home'} · ${profile?.daysPerWeek ?? 3} days/week`}
        right={
          <div className="row" style={{ gap: 10 }}>
            <div className="avatar" aria-hidden="true">{initial}</div>
            <button
              type="button"
              className="btn ghost small-btn"
              onClick={() => setShowBackup(true)}
              aria-label="Backup and settings"
            >
              <GearIcon />
            </button>
          </div>
        }
      />

      <main className="view">
        {active ? (
          <section className="hero">
            <p className="eyebrow">Workout in progress</p>
            <span className="title">{active.title}</span>
            <p className="sub">Auto-saved — pick up where you left off.</p>
            <button type="button" className="btn primary block" onClick={() => navigate(`/workout/${active.id}`)}>
              <PlayIcon /> Resume workout
            </button>
          </section>
        ) : (
          <section className="hero">
            <p className="eyebrow">{nextDay ? 'Next workout' : 'No plan yet'}</p>
            <span className="title">
              {nextDay ? `${nextDay.label} · ${nextDay.focus}` : 'Build your first plan'}
            </span>
            <p className="sub">
              {nextDay
                ? `${nextDay.exercises.length} exercises · ${profile?.durationMin ?? 45} min · ${profile?.activeLocation ?? 'home'}`
                : 'Answer a few questions and Atlas Fit will assemble a week you can actually run.'}
            </p>
            <div className="stat-grid" aria-label="Your training totals">
              <div className="stat">
                <b>{doneSessions.length}</b>
                <span>Sessions</span>
              </div>
              <div className="stat">
                <b>{totalSets}</b>
                <span>Sets logged</span>
              </div>
              <div className="stat">
                <b>{strip.filter((d) => d.hit).length}/7</b>
                <span>Days active</span>
              </div>
            </div>
            <button type="button" className="btn primary block" onClick={startNext}>
              <PlayIcon /> {nextDay ? 'Start workout' : 'Create plan'}
            </button>
          </section>
        )}

        <section className="panel">
          <SectionHead
            title="Last 7 days"
            action={
              <span className="small">{strip.filter((d) => d.hit).length} trained</span>
            }
          />
          <div className="strip">
            {strip.map((d, i) => (
              <div key={i} className={`cell${d.hit ? ' hit' : ''}`} aria-label={`${d.label}${d.hit ? ', trained' : ', no workout'}`}>
                {d.label}
              </div>
            ))}
          </div>
        </section>

        <section>
          <div style={{ marginBottom: 10 }}>
            <SectionHead title="Recent session" />
          </div>
          {recent ? (
            <div className="panel">
              <div className="row between">
                <div>
                  <strong>{recent.title}</strong>
                  <div className="small">
                    {new Date(recent.endedAt ?? recent.startedAt).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}{' '}
                    · {recent.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0)} working sets
                  </div>
                </div>
                <ChevronRight />
              </div>
            </div>
          ) : (
            <EmptyState
              title="No workouts logged yet"
              body="Finish your first session and it will appear here — no demo numbers, only your real history."
              action={
                <button type="button" className="btn primary small-btn" onClick={startNext}>
                  Start your first workout
                </button>
              }
            />
          )}
        </section>

        <section className="panel">
          <SectionHead
            title="Your muscle map"
            action={
              <button type="button" className="btn ghost small-btn" onClick={() => navigate('/bodygraph')}>
                Explore <ChevronRight />
              </button>
            }
          />
          <div className="bodywrap">
            <Bodygraph view="front" activity={weekActivity} />
            <p className="small">
              {Object.keys(weekActivity).length > 0
                ? 'Training activity estimate from your logs (last 7 days).'
                : 'Your trained muscles will light up here once you log sessions.'}
            </p>
          </div>
        </section>

        <section className="row">
          <button type="button" className="btn ghost grow" onClick={() => navigate('/plan')}>
            <PlanIcon /> {latestPlan ? 'Regenerate plan' : 'Create plan'}
          </button>
        </section>

        <p className="small" style={{ textAlign: 'center' }}>
          {feedback.length > 0 ? `${feedback.length} exercise note(s) saved` : 'Everything works offline.'}
        </p>

        <Credit />

        <Sheet open={showBackup} onClose={() => setShowBackup(false)} title="Settings & backup">
          <div className="row wrap" style={{ gap: 10 }}>
            <button type="button" className="btn primary grow" onClick={onExport}>
              Export backup (JSON)
            </button>
            <button type="button" className="btn grow" onClick={() => fileRef.current?.click()}>
              Import backup
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImport(f);
              e.target.value = '';
            }}
          />
          {backupMsg ? <div className="banner" style={{ marginTop: 12 }}>{backupMsg}</div> : null}
          <div className="banner preview" style={{ marginTop: 12 }}>
            <strong>Storage note:</strong> iOS can clear website data if storage is tight. Export a
            backup occasionally — your plans and logs live only on this device and are never uploaded.
          </div>
          <p className="small" style={{ marginTop: 12 }}>
            Goals: {profile?.goal} · Experience: {profile?.experience} · Location: {profile?.activeLocation}
            <br />
            Equipment: {(profile?.equipment[profile?.activeLocation ?? 'home'] ?? []).length} item(s) ·
            Avoid-list: {profile?.restrictions.length ?? 0} exercise(s)
          </p>
          <button
            type="button"
            className="btn ghost block"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/onboarding?edit=1')}
          >
            Edit preferences
          </button>
        </Sheet>
      </main>
    </>
  );
}
