import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PROFILE, useStore } from '../../data/store';
import { EQUIPMENT, DEFAULT_EQUIPMENT } from '../../data/equipment';
import { CATALOG } from '../../data/catalog';
import { createPlan, EMPTY_HISTORY } from '../planner/engine';
import { putPlan } from '../../data/db';
import { Credit } from '../../design/ui';
import type { Experience, Goal, LocationType, UserProfile } from '../../data/types';

/**
 * Screen 1 — Onboarding / Preferences (§4.1).
 * One progressive flow, 10 essential questions + optional final preview.
 * No height/weight/BMI/calorie questions, no email capture, no paywalls.
 */

const GOALS: Array<{ id: Goal; t: string; d: string }> = [
  { id: 'strength', t: 'Strength', d: 'Get stronger with heavier, lower-rep work.' },
  { id: 'fitness', t: 'General fitness', d: 'Balanced training, feel good overall.' },
  { id: 'technique', t: 'Technique / learning', d: 'Practise movement quality first.' },
  { id: 'endurance', t: 'Muscular endurance', d: 'Higher reps, lighter work.' },
  { id: 'mobility', t: 'Mobility / functional', d: 'Move well, control, stability.' },
];

const EXPERIENCE: Array<{ id: Experience; t: string; d: string }> = [
  { id: 'new', t: 'New', d: 'Little or no structured training yet.' },
  { id: 'some', t: 'Some experience', d: 'Trained a few months on and off.' },
  { id: 'experienced', t: 'Experienced', d: 'Consistent training for a year or more.' },
];

const LOCATIONS: Array<{ id: LocationType; t: string; d: string }> = [
  { id: 'home', t: 'Home', d: 'Train at home with my own gear.' },
  { id: 'gym', t: 'Gym', d: 'Train at a gym or facility.' },
  { id: 'travel', t: 'Both / travel', d: 'I switch between places.' },
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TOTAL_STEPS = 11;

export function Onboarding() {
  const { profile, updateProfile } = useStore();
  const editing = profile?.onboarded === true;
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<UserProfile>(() => structuredClone(profile ?? DEFAULT_PROFILE));
  const [equipQuery, setEquipQuery] = useState('');
  const [exQuery, setExQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const set = (patch: Partial<UserProfile>) => setDraft((d) => ({ ...d, ...patch }));

  const preview = useMemo(
    () => createPlan(draft, EMPTY_HISTORY, CATALOG),
    // Recompute only when key inputs change to keep typing cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      draft.goal,
      draft.experience,
      draft.activeLocation,
      draft.daysPerWeek,
      draft.durationMin,
      draft.equipment,
      draft.restrictions,
      draft.pinned,
      draft.disliked,
    ],
  );

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await putPlan(preview.plan);
      await updateProfile({ ...draft, onboarded: true });
      navigate('/home', { replace: true });
    } catch {
      setSaveError('Could not save your plan. Check device storage and try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEquip = (id: string) => {
    const loc = draft.activeLocation;
    const current = draft.equipment[loc];
    const nextList = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    set({ equipment: { ...draft.equipment, [loc]: nextList } });
  };

  const toggleRestriction = (id: string) => {
    const nextList = draft.restrictions.includes(id)
      ? draft.restrictions.filter((x) => x !== id)
      : [...draft.restrictions, id];
    set({ restrictions: nextList });
  };

  const stepProgress = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <>
      <header className="topbar">
        <div className="row between">
          <div>
            <h1>{editing ? 'Edit preferences' : 'Set up Atlas Fit'}</h1>
            <p>Step {step + 1} of {TOTAL_STEPS} · saved only on this device</p>
          </div>
          {step > 0 ? (
            <button type="button" className="btn ghost small-btn" onClick={back}>
              Back
            </button>
          ) : editing ? (
            <button type="button" className="btn ghost small-btn" onClick={() => navigate('/home')}>Cancel</button>
          ) : null}
        </div>
        <div className="pbar" role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stepProgress} style={{ marginTop: 10 }}>
          <div style={{ width: `${stepProgress}%` }} />
        </div>
      </header>

      <main className="view">
        {step === 0 && (
          <section>
            <h2 className="h-hero">What should we call you?</h2>
            <p className="sub">Optional — a display name for your greeting.</p>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="name">Display name</label>
              <input
                id="name"
                className="input"
                value={draft.displayName}
                placeholder="e.g. Ishan"
                autoComplete="given-name"
                onChange={(e) => set({ displayName: e.target.value })}
              />
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              {draft.displayName ? 'Continue' : 'Skip for now'}
            </button>
          </section>
        )}

        {step === 1 && (
          <section>
            <h2 className="h-hero">Main objective</h2>
            <p className="sub">This shapes exercise selection and rep guidance.</p>
            <div className="tiles" style={{ marginTop: 14 }}>
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="tile"
                  aria-pressed={draft.goal === g.id}
                  onClick={() => set({ goal: g.id })}
                >
                  <span className="t">{g.t}</span>
                  <span className="d">{g.d}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              Continue
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 className="h-hero">Training experience</h2>
            <p className="sub">Determines volume, complexity and rest defaults.</p>
            <div className="tiles" style={{ marginTop: 14 }}>
              {EXPERIENCE.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="tile"
                  aria-pressed={draft.experience === g.id}
                  onClick={() => set({ experience: g.id })}
                >
                  <span className="t">{g.t}</span>
                  <span className="d">{g.d}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              Continue
            </button>
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 className="h-hero">Where do you train?</h2>
            <p className="sub">You can edit each location's exact inventory next.</p>
            <div className="tiles" style={{ marginTop: 14 }}>
              {LOCATIONS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="tile"
                  aria-pressed={draft.activeLocation === g.id}
                  onClick={() => set({ activeLocation: g.id })}
                >
                  <span className="t">{g.t}</span>
                  <span className="d">{g.d}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              Continue
            </button>
          </section>
        )}

        {step === 4 && (
          <section>
            <h2 className="h-hero">Your {draft.activeLocation} equipment</h2>
            <p className="sub">
              Only these will ever be planned. Defaults are editable — never assume a gym has
              every machine.
            </p>
            <div className="field" style={{ margin: '14px 0 10px' }}>
              <label htmlFor="equip-search">Search equipment</label>
              <input
                id="equip-search"
                className="input"
                placeholder="Type to filter…"
                value={equipQuery}
                onChange={(e) => setEquipQuery(e.target.value)}
              />
            </div>
            <div className="chips">
              {EQUIPMENT.filter((e) =>
                (e.label + e.category).toLowerCase().includes(equipQuery.toLowerCase()),
              ).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="chip"
                  aria-pressed={draft.equipment[draft.activeLocation].includes(e.id)}
                  onClick={() => toggleEquip(e.id)}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <p className="small" style={{ marginTop: 10 }}>
              {draft.equipment[draft.activeLocation].length} selected ·{' '}
              <button
                type="button"
                className="btn ghost small-btn"
                onClick={() =>
                  set({ equipment: { ...draft.equipment, [draft.activeLocation]: [] } })
                }
              >
                Clear
              </button>{' '}
              <button
                type="button"
                className="btn ghost small-btn"
                onClick={() =>
                  set({
                    equipment: { ...draft.equipment, [draft.activeLocation]: DEFAULT_EQUIPMENT[draft.activeLocation] },
                  })
                }
              >
                Reset defaults
              </button>
            </p>
            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 16 }}
              disabled={draft.equipment[draft.activeLocation].length === 0}
              onClick={next}
            >
              Continue
            </button>
          </section>
        )}

        {step === 5 && (
          <section>
            <h2 className="h-hero">Days per week</h2>
            <p className="sub">Choose 2–5 available training days.</p>
            <div className="tiles cols2" style={{ marginTop: 14 }}>
              {[2, 3, 4, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="tile"
                  aria-pressed={draft.daysPerWeek === d}
                  onClick={() => set({ daysPerWeek: d })}
                >
                  <span className="t">{d} days</span>
                  <span className="d">
                    {d <= 3 ? 'Full-body sessions' : d === 4 ? 'Upper / lower split' : 'Flexible split'}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              Continue
            </button>
          </section>
        )}

        {step === 6 && (
          <section>
            <h2 className="h-hero">Session length</h2>
            <p className="sub">Plans are sized to fit inside your window.</p>
            <div className="tiles cols2" style={{ marginTop: 14 }}>
              {([30, 45, 60] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="tile"
                  aria-pressed={draft.durationMin === m}
                  onClick={() => set({ durationMin: m })}
                >
                  <span className="t">{m} minutes</span>
                  <span className="d">{m === 30 ? 'Quick and focused' : m <= 45 ? 'Focused, efficient' : 'Full session'}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              Continue
            </button>
          </section>
        )}

        {step === 7 && (
          <section>
            <h2 className="h-hero">Preferred days</h2>
            <p className="sub">Optional — skip if you're flexible.</p>
            <div className="chips" style={{ marginTop: 14 }}>
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className="chip"
                  aria-pressed={draft.weekdays.includes(d)}
                  onClick={() =>
                    set({
                      weekdays: draft.weekdays.includes(d)
                        ? draft.weekdays.filter((x) => x !== d)
                        : [...draft.weekdays, d],
                    })
                  }
                >
                  {d}
                </button>
              ))}
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              {draft.weekdays.length > 0 ? 'Continue' : 'Skip for now'}
            </button>
          </section>
        )}

        {step === 8 && (
          <section>
            <h2 className="h-hero">Movements to avoid</h2>
            <p className="sub">
              Anything causing discomfort or a professional advised skipping? We never diagnose —
              we just exclude them from plans. Skip is fine.
            </p>
            <div className="field" style={{ margin: '14px 0 10px' }}>
              <label htmlFor="ex-search">Find exercises</label>
              <input
                id="ex-search"
                className="input"
                placeholder="Type to filter…"
                value={exQuery}
                onChange={(e) => setExQuery(e.target.value)}
              />
            </div>
            <div className="chips">
              {CATALOG.filter((e) => e.name.toLowerCase().includes(exQuery.toLowerCase()))
                .slice(0, 24)
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="chip"
                    aria-pressed={draft.restrictions.includes(e.id)}
                    onClick={() => toggleRestriction(e.id)}
                  >
                    {e.name}
                  </button>
                ))}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="notes">Anything else? (notes, no diagnosis)</label>
              <textarea
                id="notes"
                className="input"
                value={draft.discomfortNotes}
                placeholder="e.g. left shoulder feels cranky on overhead work"
                onChange={(e) => set({ discomfortNotes: e.target.value })}
              />
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              {draft.restrictions.length > 0 || draft.discomfortNotes ? 'Continue' : 'Skip for now'}
            </button>
          </section>
        )}

        {step === 9 && (
          <section>
            <h2 className="h-hero">Other physical activity?</h2>
            <p className="sub">Optional — helps the plan avoid overloading you.</p>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="sports">Sports or other training</label>
              <textarea
                id="sports"
                className="input"
                value={draft.otherSports}
                placeholder="e.g. football on weekends, cycle to school"
                onChange={(e) => set({ otherSports: e.target.value })}
              />
            </div>
            <button type="button" className="btn primary block" style={{ marginTop: 16 }} onClick={next}>
              {draft.otherSports ? 'Continue' : 'Skip for now'}
            </button>
          </section>
        )}

        {step === 10 && (
          <section>
            <h2 className="h-hero">Your proposed week</h2>
            <p className="sub">
              Built by Atlas Fit's local rules engine — explainable, no AI service involved.
            </p>
            <div className="panel" style={{ marginTop: 14 }}>
              <strong>{preview.plan.split} · {preview.plan.days.length} days · {draft.durationMin} min</strong>
              <ul className="small" style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {preview.plan.explanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            {preview.plan.days.map((d) => (
              <div className="daycard" key={d.id}>
                <header>
                  <div className="d">{d.label}</div>
                  <div className="f">{d.focus}</div>
                </header>
                {d.exercises.slice(0, 5).map((pe) => (
                  <div className="exrow" key={pe.exerciseId}>
                    <span className="dot" aria-hidden="true" />
                    {CATALOG.find((e) => e.id === pe.exerciseId)?.name ?? pe.exerciseId}
                    <span className="meta">
                      {pe.sets}×{pe.reps}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {preview.warnings.length > 0 ? (
              <div className="banner preview">{preview.warnings.join(' ')}</div>
            ) : null}
            {saveError ? <p className="banner" role="alert">{saveError}</p> : null}
            <button type="button" className="btn primary block" style={{ marginTop: 6 }} disabled={saving} onClick={finish}>
              {saving ? 'Saving…' : editing ? 'Save preferences & plan' : 'Start training'}
            </button>
            <Credit />
          </section>
        )}
      </main>
    </>
  );
}
