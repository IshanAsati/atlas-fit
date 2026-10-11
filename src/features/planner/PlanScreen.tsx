import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, buildHistory } from '../../data/store';
import { Credit, Sheet, TopBar } from '../../design/ui';
import { ChevronRight, PlayIcon, SwapIcon } from '../../design/icons';
import { createPlan, suggestSwap } from './engine';
import { putPlan, putSession } from '../../data/db';
import { buildSession } from '../workout/session';
import type { LocationType, Plan, PlanDay } from '../../data/types';

/**
 * Screen 3 — Plan Generator (§4.3).
 * Deterministic decision-tree planning: configuration → day cards →
 * 'Why this plan?' explanation → generate / regenerate / swap / start / save.
 * Regeneration preserves pinned favourites and never touches logged sessions.
 */
export function PlanScreen() {
  const { profile, plans, sessions, catalog, byId, updateProfile } = useStore();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<Plan | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [swapFor, setSwapFor] = useState<{ dayId: string; exerciseId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = current ?? (plans.length > 0 ? plans[0] : null);
  const history = useMemo(() => buildHistory(sessions), [sessions]);

  const draftPlan = useMemo(() => {
    if (!profile) return null;
    return createPlan(profile, history, catalog, plan?.id).plan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    profile?.activeLocation,
    profile?.daysPerWeek,
    profile?.durationMin,
    profile?.equipment,
    profile?.restrictions,
    profile?.goal,
    profile?.experience,
    profile?.pinned,
    profile?.disliked,
    history,
    catalog,
  ]);

  const generate = async () => {
    if (!profile || !draftPlan) return;
    setBusy(true);
    const { plan: fresh, warnings } = createPlan(profile, history, catalog, plan?.id);
    await putPlan(fresh);
    setCurrent(fresh);
    setBusy(false);
    if (warnings.length > 0) window.alert(warnings.join('\n'));
  };

  const swapExercise = async (dayId: string, newId: string) => {
    if (!plan) return;
    const updated: Plan = {
      ...plan,
      days: plan.days.map((d: PlanDay) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              exercises: d.exercises.map((pe) =>
                pe.exerciseId === swapFor?.exerciseId
                  ? {
                      ...pe,
                      exerciseId: newId,
                      reason: `Swapped for a similar ${byId(newId)?.movement ?? 'movement'} using your ${plan.location} equipment.`,
                    }
                  : pe,
              ),
            },
      ),
    };
    await putPlan(updated);
    setCurrent(updated);
    setSwapFor(null);
  };

  const togglePin = async (exerciseId: string) => {
    if (!profile) return;
    const pinned = profile.pinned.includes(exerciseId)
      ? profile.pinned.filter((x) => x !== exerciseId)
      : [...profile.pinned, exerciseId];
    await updateProfile({ pinned });
  };

  const startDay = async (day: PlanDay) => {
    if (!plan) return;
    const session = buildSession(plan, day);
    await putSession(session);
    navigate(`/workout/${session.id}`);
  };

  const setLoc = async (loc: LocationType) => {
    await updateProfile({ activeLocation: loc });
    setCurrent(null);
  };

  const swapOptions =
    swapFor && profile
      ? suggestSwap(swapFor.exerciseId, profile, catalog, (id) => byId(id))
      : [];

  return (
    <>
      <TopBar
        title="Plan generator"
        sub="Local rules engine — no AI service, no account, no cost"
        right={
          <button type="button" className="btn ghost small-btn" onClick={() => setShowWhy(true)}>
            Why?
          </button>
        }
      />

      <main className="view">
        {/* Configuration */}
        <section className="panel">
          <div className="row between" style={{ marginBottom: 8 }}>
            <h2 className="h-sec">Configuration</h2>
            <span className="small">{profile?.equipment[profile.activeLocation].length} items</span>
          </div>
          <div className="chips">
            {(['home', 'gym', 'travel'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                className="chip"
                aria-pressed={profile?.activeLocation === loc}
                onClick={() => void setLoc(loc)}
              >
                {loc[0].toUpperCase() + loc.slice(1)}
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {[2, 3, 4, 5].map((d) => (
              <button
                key={d}
                type="button"
                className="chip"
                aria-pressed={profile?.daysPerWeek === d}
                onClick={() => void updateProfile({ daysPerWeek: d })}
              >
                {d} days
              </button>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {([30, 45, 60] as const).map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={profile?.durationMin === m}
                onClick={() => void updateProfile({ durationMin: m })}
              >
                {m} min
              </button>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="row wrap" style={{ gap: 10 }}>
          <button type="button" className="btn primary grow" disabled={busy || !profile} onClick={() => void generate()}>
            {busy ? 'Building…' : plan ? 'Regenerate plan' : 'Generate plan'}
          </button>
          {plan ? (
            <button type="button" className="btn grow" onClick={() => setShowWhy(true)}>
              Why this plan?
            </button>
          ) : null}
        </section>

        {!plan && (
          <div className="empty">
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 6 }}>
              No plan yet
            </strong>
            Pick a location, days and session length above, then generate. The generator only uses
            equipment you own and respects your avoid-list.
          </div>
        )}

        {/* Results */}
        {plan?.days.map((day) => (
          <section className="daycard" key={day.id}>
            <header className="row between">
              <div>
                <div className="d">{day.label}</div>
                <div className="f">{day.focus}</div>
              </div>
              <button
                type="button"
                className="btn primary small-btn"
                onClick={() => void startDay(day)}
                aria-label={`Start ${day.label}`}
              >
                <PlayIcon size={16} /> Start
              </button>
            </header>
            {day.exercises.map((pe, idx) => {
              const ex = byId(pe.exerciseId);
              return (
                <button
                  key={`${pe.exerciseId}-${idx}`}
                  type="button"
                  className="exrow"
                  onClick={() => setSwapFor({ dayId: day.id, exerciseId: pe.exerciseId })}
                >
                  <span className="dot" aria-hidden="true" />
                  <span className="grow">
                    {ex?.name ?? pe.exerciseId}
                    {profile?.pinned.includes(pe.exerciseId) ? (
                      <span className="small" style={{ marginLeft: 6, color: 'var(--accent)' }}>
                        · Pinned
                      </span>
                    ) : null}
                  </span>
                  <span className="meta">
                    {pe.sets}×{pe.reps} · {pe.restSec}s rest
                  </span>
                </button>
              );
            })}
          </section>
        ))}

        {plan ? (
          <p className="small">
            Tap any exercise to swap it, then Start when you're ready. Swaps and pins survive
            regeneration; your logged history is never modified by planning.
          </p>
        ) : null}

        <Credit />

        {/* Why this plan */}
        <Sheet open={showWhy} onClose={() => setShowWhy(false)} title="Why this plan?">
          {plan ? (
            <>
              <ul style={{ paddingLeft: 18, margin: '0 0 12px', lineHeight: 1.7, fontSize: 14 }}>
                {plan.explanation.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {plan.days.flatMap((d) =>
                d.exercises.slice(0, 1).map((pe) => (
                  <div className="banner" key={`${d.id}-${pe.exerciseId}`} style={{ marginBottom: 8 }}>
                    <strong>{d.label}:</strong> {byId(pe.exerciseId)?.name} — {pe.reason}
                  </div>
                )),
              )}
              <p className="small">
                Selection combines goal fit, movement coverage, your pinned/liked exercises, novelty
                in your recent logs and technique suitability. Tuning values are heuristics, not
                validated fitness science.
              </p>
            </>
          ) : (
            <p className="sub">Generate a plan first.</p>
          )}
        </Sheet>

        {/* Swap sheet */}
        <Sheet
          open={swapFor !== null}
          onClose={() => setSwapFor(null)}
          title={`Swap ${swapFor ? (byId(swapFor.exerciseId)?.name ?? '') : ''}`}
        >
          {swapOptions.length > 0 ? (
            swapOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="exrow"
                onClick={() => swapFor && void swapExercise(swapFor.dayId, opt.id)}
              >
                <SwapIcon />
                <span className="grow">{opt.name}</span>
                <span className="meta">{opt.movement}</span>
                <ChevronRight />
              </button>
            ))
          ) : (
            <p className="sub">
              No same-pattern alternative fits your current equipment. Try another location or add
              equipment in preferences.
            </p>
          )}
          {swapFor ? (
            <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="btn ghost grow"
                onClick={() => {
                  void togglePin(swapFor.exerciseId);
                  setSwapFor(null);
                }}
              >
                {profile?.pinned.includes(swapFor.exerciseId) ? 'Unpin' : 'Pin to plans'}
              </button>
              <button type="button" className="btn grow" onClick={() => setSwapFor(null)}>
                Cancel
              </button>
            </div>
          ) : null}
        </Sheet>
      </main>
    </>
  );
}
