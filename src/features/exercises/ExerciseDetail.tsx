import { useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { equipmentLabel } from '../../data/equipment';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { useStore } from '../../data/store';
import { ChevronRight } from '../../design/icons';
import { EmptyState, Sheet, TARGET_LEGEND, TopBar } from '../../design/ui';
import { Bodygraph } from '../bodygraph/Bodygraph';
import type { Exercise, ExerciseFeedback, Movement, MuscleId } from '../../data/types';

/**
 * Screen 5b — Exercise Detail (§4.5).
 * Everything renders from the offline `catalog`: targets, instructions/cues/
 * mistakes (omitted when an imported RepDB entry has none), linked mini
 * bodygraph with a muscle sheet, substitutes and local feedback.
 */

const MOVEMENT_LABELS: Record<Movement, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  hpush: 'Horizontal push',
  vpush: 'Vertical push',
  hpull: 'Horizontal pull',
  vpull: 'Vertical pull',
  core: 'Core',
  carry: 'Carry',
  accessory: 'Accessory',
  mobility: 'Mobility',
};

const DIFFICULTY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Beginner',
  2: 'Some experience',
  3: 'Experienced',
};

/** Static (non-control) chips — no pointer cursor, 44px rhythm. */
const STATIC_CHIP: CSSProperties = { minHeight: 44, cursor: 'default' };

const LIST: CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 20,
  fontSize: 14.5,
  lineHeight: 1.6,
};

const LIST_ITEM: CSSProperties = { marginBottom: 6 };

function pressedStyle(on: boolean, color: string): CSSProperties {
  return on ? { borderColor: color, color, background: 'var(--surface-2)' } : {};
}

export function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, updateProfile, catalog, byId, feedback, setFeedback } = useStore();

  const [view, setView] = useState<'front' | 'back'>('front');
  const [selected, setSelected] = useState<MuscleId | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const exercise = id === undefined ? undefined : byId(id);

  if (!exercise) {
    return (
      <>
        <TopBar
          title="Exercise"
          sub="Not in your library"
          right={
            <button
              type="button"
              className="btn ghost small-btn"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              ← Back
            </button>
          }
        />
        <main className="view">
          <EmptyState
            title="Exercise not found"
            body="This entry isn't in your offline library — it may have been renamed or removed."
            action={
              <button
                type="button"
                className="btn primary small-btn"
                onClick={() => navigate('/exercises')}
              >
                Back to library
              </button>
            }
          />
        </main>
      </>
    );
  }

  const ex: Exercise = exercise;

  const fb = (feedback as ExerciseFeedback[]).find((f) => f.exerciseId === ex.id);
  const liked = fb?.liked === true;
  const disliked = fb?.liked === false;
  const discomfort = fb?.discomfort === true;
  const isFav = (profile?.favourites ?? []).includes(ex.id);
  const isPinned = (profile?.pinned ?? []).includes(ex.id);
  const isAvoided = (profile?.restrictions ?? []).includes(ex.id);

  const writeFeedback = (patch: Partial<ExerciseFeedback>) => {
    void setFeedback({
      ...(fb ?? {}),
      ...patch,
      exerciseId: ex.id,
      updatedAt: Date.now(),
    });
  };

  const toggleFavourite = () => {
    const current = profile?.favourites ?? [];
    void updateProfile({
      favourites: current.includes(ex.id)
        ? current.filter((x) => x !== ex.id)
        : [...current, ex.id],
    });
  };

  const togglePin = () => {
    const current = profile?.pinned ?? [];
    void updateProfile({
      pinned: current.includes(ex.id)
        ? current.filter((x) => x !== ex.id)
        : [...current, ex.id],
    });
  };

  const targets: Partial<Record<MuscleId, 'primary' | 'secondary'>> = {};
  for (const m of ex.secondary) targets[m] = 'secondary';
  for (const m of ex.primary) targets[m] = 'primary';

  const owned = profile === null ? null : profile.equipment[profile.activeLocation];
  const available = (e: Exercise) =>
    owned === null || e.equipmentIds.every((gear) => owned.includes(gear));

  const subs: Exercise[] = [];
  for (const sid of ex.substitutes) {
    const s = byId(sid);
    if (s) subs.push(s);
  }
  const suggestions =
    subs.length > 0
      ? []
      : catalog
          .filter(
            (e) => e.id !== ex.id && e.movement === ex.movement && available(e),
          )
          .slice(0, 3);

  const sheetMeta = selected === null ? null : MUSCLE_BY_ID[selected];
  const muscleExercises: Exercise[] = [];
  const sheetMuscle = selected;
  if (sheetMuscle !== null) {
    const target: MuscleId = sheetMuscle;
    for (const e of catalog) {
      if (e.id === ex.id) continue;
      if (e.primary.includes(target) || e.secondary.includes(target)) {
        muscleExercises.push(e);
      }
    }
    muscleExercises.sort(
      (a, b) =>
        (b.primary.includes(target) ? 1 : 0) - (a.primary.includes(target) ? 1 : 0) ||
        a.name.localeCompare(b.name),
    );
  }

  const muscleChip = (m: MuscleId, kind: 'primary' | 'secondary') => {
    const color = kind === 'primary' ? 'var(--muscle-primary)' : 'var(--muscle-secondary)';
    return (
      <span
        key={`${kind}-${m}`}
        className="chip"
        style={{ ...STATIC_CHIP, borderColor: color, color }}
      >
        <i
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: 99,
            marginRight: 6,
            verticalAlign: '-1px',
            background: color,
          }}
        />
        {MUSCLE_BY_ID[m].short} ({kind})
      </span>
    );
  };

  const linkRow = (e: Exercise) => (
    <button
      key={e.id}
      type="button"
      className="exrow"
      onClick={() => navigate(`/exercises/${e.id}`)}
    >
      <span className="dot" aria-hidden="true" />
      <span className="grow" style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 650, display: 'block' }}>{e.name}</span>
        <span className="small" style={{ display: 'block', overflowWrap: 'anywhere' }}>
          {MOVEMENT_LABELS[e.movement]} ·{' '}
          {e.equipmentIds.length > 0
            ? e.equipmentIds.map(equipmentLabel).join(', ')
            : 'No equipment listed'}
        </span>
      </span>
      <ChevronRight />
    </button>
  );

  const backBtn = (
    <button
      type="button"
      className="btn ghost small-btn"
      onClick={() => navigate(-1)}
      aria-label="Go back"
    >
      ← Back
    </button>
  );

  return (
    <>
      <TopBar
        title={ex.name}
        sub={`${MOVEMENT_LABELS[ex.movement]} · ${DIFFICULTY_LABELS[ex.difficulty]}`}
        right={backBtn}
      />

      <main className="view">
        {/* Overview: movement, difficulty, equipment, muscle targets */}
        <section className="panel" aria-label="Overview">
          <div className="chips">
            <span className="chip" style={STATIC_CHIP}>
              {MOVEMENT_LABELS[ex.movement]}
            </span>
            <span className="chip" style={STATIC_CHIP}>
              {DIFFICULTY_LABELS[ex.difficulty]}
            </span>
            {isAvoided ? (
              <span
                className="chip"
                style={{
                  ...STATIC_CHIP,
                  borderColor: 'var(--warn)',
                  color: 'var(--warn)',
                }}
              >
                Avoided
              </span>
            ) : null}
          </div>

          <p className="small" style={{ margin: '14px 0 6px' }}>
            Equipment
          </p>
          <div className="chips">
            {ex.equipmentIds.length === 0 ? (
              <span className="small">No equipment listed.</span>
            ) : (
              ex.equipmentIds.map((eq) => (
                <span key={eq} className="chip" style={STATIC_CHIP}>
                  {equipmentLabel(eq)}
                </span>
              ))
            )}
          </div>

          <p className="small" style={{ margin: '14px 0 6px' }}>
            Muscles
          </p>
          {ex.primary.length === 0 && ex.secondary.length === 0 ? (
            <p className="small">No muscle targets recorded for this entry.</p>
          ) : (
            <div className="chips">
              {ex.primary.map((m) => muscleChip(m, 'primary'))}
              {ex.secondary.map((m) => muscleChip(m, 'secondary'))}
            </div>
          )}
        </section>

        {/* Favourite + pin */}
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn grow"
            aria-pressed={isFav}
            style={pressedStyle(isFav, 'var(--warn)')}
            onClick={toggleFavourite}
          >
            {isFav ? '★ Favourited' : '☆ Favourite'}
          </button>
          <button
            type="button"
            className="btn grow"
            aria-pressed={isPinned}
            style={pressedStyle(isPinned, 'var(--accent)')}
            onClick={togglePin}
          >
            {isPinned ? '📌 Pinned to plans' : '📌 Pin to plans'}
          </button>
        </div>

        {/* Coaching copy — omitted entirely when an imported entry has none */}
        {ex.instructions.length > 0 ? (
          <section className="panel">
            <h2 className="h-sec">Instructions</h2>
            <ol style={LIST}>
              {ex.instructions.map((line, i) => (
                <li key={`step-${i}`} style={LIST_ITEM}>
                  {line}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {ex.cues.length > 0 ? (
          <section className="panel">
            <h2 className="h-sec">Setup cues</h2>
            <ul style={LIST}>
              {ex.cues.map((line, i) => (
                <li key={`cue-${i}`} style={LIST_ITEM}>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {ex.mistakes.length > 0 ? (
          <section className="panel">
            <h2 className="h-sec">Common mistakes</h2>
            <ul style={LIST}>
              {ex.mistakes.map((line, i) => (
                <li key={`mistake-${i}`} style={LIST_ITEM}>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Linked mini bodygraph */}
        <section className="panel">
          <h2 className="h-sec" style={{ marginBottom: 10 }}>
            Muscle map
          </h2>
          <div className="bodywrap">
            <div className="seg" style={{ width: 200 }}>
              <button
                type="button"
                style={{ minHeight: 44 }}
                aria-pressed={view === 'front'}
                onClick={() => setView('front')}
              >
                Front
              </button>
              <button
                type="button"
                style={{ minHeight: 44 }}
                aria-pressed={view === 'back'}
                onClick={() => setView('back')}
              >
                Back
              </button>
            </div>
            <Bodygraph
              view={view}
              targets={targets}
              selected={selected}
              onSelect={(m) => {
                setSelected(m);
                setSheetOpen(true);
              }}
              labelSuffix="target"
            />
            {TARGET_LEGEND}
          </div>
        </section>

        {/* Substitutes (or honest same-movement suggestions) */}
        <section aria-label="Alternatives">
          <h2 className="h-sec" style={{ marginBottom: 6 }}>
            {subs.length > 0 ? 'Substitutes' : 'More like this'}
          </h2>
          {subs.length > 0 ? (
            <div>{subs.map((s) => linkRow(s))}</div>
          ) : suggestions.length > 0 ? (
            <>
              <p className="small" style={{ marginBottom: 6 }}>
                No substitutes are recorded for this entry — here are other{' '}
                {MOVEMENT_LABELS[ex.movement].toLowerCase()} movements your{' '}
                {profile?.activeLocation ?? 'home'} setup supports.
              </p>
              <div>{suggestions.map((s) => linkRow(s))}</div>
            </>
          ) : (
            <p className="small">
              No matching alternatives in your library for this movement and equipment.
            </p>
          )}
        </section>

        {/* Feedback */}
        <section className="panel">
          <h2 className="h-sec">Your feedback</h2>
          <p className="sub">Saved on this device only — it shapes future suggestions.</p>
          <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn grow"
              aria-pressed={liked}
              style={pressedStyle(liked, 'var(--good)')}
              onClick={() => writeFeedback({ liked: liked ? undefined : true })}
            >
              👍 Liked
            </button>
            <button
              type="button"
              className="btn grow"
              aria-pressed={disliked}
              style={pressedStyle(disliked, 'var(--danger)')}
              onClick={() => writeFeedback({ liked: disliked ? undefined : false })}
            >
              👎 Dislike
            </button>
            <button
              type="button"
              className="btn grow"
              aria-pressed={discomfort}
              style={pressedStyle(discomfort, 'var(--warn)')}
              onClick={() => writeFeedback({ discomfort: !discomfort })}
            >
              ⚠ Discomfort
            </button>
          </div>
          {discomfort ? (
            <div className="banner preview" style={{ marginTop: 10 }} role="status">
              Flagged — Atlas Fit will avoid this in plans. Pain isn't something to push through; consider qualified in-person guidance if it persists.
            </div>
          ) : null}
        </section>
      </main>

      {/* Muscle sheet: what else trains the tapped muscle */}
      <Sheet
        open={sheetOpen && sheetMeta !== null}
        onClose={() => setSheetOpen(false)}
        title={sheetMeta ? sheetMeta.name : 'Muscle'}
      >
        {sheetMeta ? (
          <>
            <p className="sub">{sheetMeta.blurb}</p>
            <h3 className="h-sec" style={{ margin: '14px 0 6px' }}>
              Other exercises that train it
            </h3>
            {muscleExercises.length === 0 ? (
              <p className="small">No other entry in your library targets this muscle.</p>
            ) : (
              <div>
                {muscleExercises.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className="exrow"
                    onClick={() => {
                      setSheetOpen(false);
                      setSelected(null);
                      navigate(`/exercises/${e.id}`);
                    }}
                  >
                    <span
                      className="dot"
                      aria-hidden="true"
                      style={{
                        background: e.primary.includes(sheetMeta.id)
                          ? 'var(--muscle-primary)'
                          : 'var(--muscle-secondary)',
                      }}
                    />
                    <span className="grow" style={{ minWidth: 0 }}>
                      {e.name}
                    </span>
                    <ChevronRight />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : null}
      </Sheet>
    </>
  );
}
