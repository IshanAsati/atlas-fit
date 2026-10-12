import { useMemo, useState } from 'react';
import type { MuscleId } from '../../data/types';
import { MUSCLES, MUSCLE_BY_ID } from '../../data/muscles';
import { EQUIPMENT, EQUIPMENT_BY_ID } from '../../data/equipment';
import { CATALOG, CATALOG_BY_ID } from '../../data/catalog';

/** Preference slice shared by onboarding and Settings. No defaults invented. */
export interface TrainingPreferenceValue {
  targetMuscles: MuscleId[];
  avoidEquipment: string[];
  /** Exercise ids the user avoids (stored on UserProfile.restrictions). */
  restrictions: string[];
}

interface TrainingPreferencesProps {
  value: TrainingPreferenceValue;
  onChange: (next: TrainingPreferenceValue) => void;
}

const PRESETS: Array<{ label: string; muscles: MuscleId[] }> = [
  { label: 'Abs / core', muscles: ['abs', 'obliques'] },
  { label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
];

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function exerciseMatches(ex: { id: string; name: string; aliases: string[] }, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return (
    ex.name.toLowerCase().includes(needle) ||
    ex.id.toLowerCase().includes(needle) ||
    ex.aliases.some((a) => a.toLowerCase().includes(needle))
  );
}

export function TrainingPreferences({ value, onChange }: TrainingPreferencesProps) {
  const [equipmentSearch, setEquipmentSearch] = useState('');
  const [exerciseSearch, setExerciseSearch] = useState('');

  const filteredEquipment = useMemo(() => {
    const q = equipmentSearch.trim().toLowerCase();
    if (!q) return EQUIPMENT;
    return EQUIPMENT.filter(
      (eq) =>
        eq.label.toLowerCase().includes(q) ||
        eq.id.toLowerCase().includes(q) ||
        eq.category.toLowerCase().includes(q),
    );
  }, [equipmentSearch]);

  const exerciseResults = useMemo(() => {
    if (exerciseSearch.trim() === '') return [];
    return CATALOG.filter(
      (ex) => !value.restrictions.includes(ex.id) && exerciseMatches(ex, exerciseSearch),
    ).slice(0, 12);
  }, [exerciseSearch, value.restrictions]);

  const selectedExercises = useMemo(
    () =>
      value.restrictions
        .map((id) => CATALOG_BY_ID[id])
        .filter((ex) => ex !== undefined),
    [value.restrictions],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Target muscles: emphasis, not exclusion */}
      <section aria-labelledby="tp-muscles-heading">
        <h3 id="tp-muscles-heading" className="h-sec" style={{ fontSize: 14 }}>
          Target muscles
        </h3>
        <p className="small" style={{ margin: '4px 0 10px' }}>
          Targets mean emphasis, not exclusion: plans still train the rest of the
          body and give these muscles extra focus.
        </p>
        <div className="row wrap" style={{ gap: 8, marginBottom: 10 }}>
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn small-btn ghost"
              style={{ minHeight: 44 }}
              onClick={() =>
                onChange({
                  ...value,
                  targetMuscles: Array.from(
                    new Set([...value.targetMuscles, ...preset.muscles]),
                  ),
                })
              }
            >
              {preset.label}
            </button>
          ))}
          {value.targetMuscles.length > 0 && (
            <button
              type="button"
              className="btn small-btn ghost"
              style={{ minHeight: 44 }}
              onClick={() => onChange({ ...value, targetMuscles: [] })}
            >
              Clear targets
            </button>
          )}
        </div>
        <div className="chips">
          {MUSCLES.map((muscle) => {
            const selected = value.targetMuscles.includes(muscle.id);
            return (
              <button
                key={muscle.id}
                type="button"
                className="chip"
                aria-pressed={selected}
                style={{ minHeight: 44, fontSize: 14 }}
                onClick={() =>
                  onChange({
                    ...value,
                    targetMuscles: toggleId(value.targetMuscles, muscle.id) as MuscleId[],
                  })
                }
              >
                {selected ? '✓ ' : '+ '}{muscle.short}
              </button>
            );
          })}
        </div>
        {value.targetMuscles.length > 0 && (
          <p className="small" style={{ marginTop: 8 }}>
            Emphasising:{' '}
            {value.targetMuscles.map((id) => MUSCLE_BY_ID[id]?.short ?? id).join(', ')}
          </p>
        )}
      </section>

      {/* Equipment avoidance: distinct from inventory availability */}
      <section aria-labelledby="tp-avoid-equip-heading">
        <h3 id="tp-avoid-equip-heading" className="h-sec" style={{ fontSize: 14 }}>
          Equipment to avoid
        </h3>
        <p className="small" style={{ margin: '4px 0 10px' }}>
          Avoided gear stays in your inventory — the planner just avoids scheduling
          it. This is different from availability, which controls what you own.
        </p>
        <div className="field">
          <label htmlFor="tp-avoid-equip-search">Search equipment to avoid</label>
          <input
            id="tp-avoid-equip-search"
            type="text"
            className="input"
            placeholder="e.g. barbell, smith…"
            value={equipmentSearch}
            onChange={(e) => setEquipmentSearch(e.target.value)}
          />
        </div>
        <div
          className="chips"
          style={{
            marginTop: 10,
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            padding: 12,
            maxHeight: '30dvh',
            overflowY: 'auto',
          }}
        >
          {filteredEquipment.length === 0 ? (
            <p className="small" style={{ margin: '8px 0', textAlign: 'center', width: '100%' }}>
              No matching equipment. Try clearing your search.
            </p>
          ) : (
            filteredEquipment.map((eq) => {
              const avoided = value.avoidEquipment.includes(eq.id);
              return (
                <button
                  key={eq.id}
                  type="button"
                  className="chip"
                  aria-pressed={avoided}
                  style={{ minHeight: 44, fontSize: 14 }}
                  onClick={() =>
                    onChange({ ...value, avoidEquipment: toggleId(value.avoidEquipment, eq.id) })
                  }
                >
                  {avoided ? '✓ ' : '+ '}{eq.label}
                </button>
              );
            })
          )}
        </div>
        {value.avoidEquipment.length > 0 && (
          <p className="small" style={{ marginTop: 8 }}>
            Avoiding:{' '}
            {value.avoidEquipment.map((id) => EQUIPMENT_BY_ID[id]?.label ?? id).join(', ')}
          </p>
        )}
      </section>

      {/* Specific exercise avoidance */}
      <section aria-labelledby="tp-avoid-ex-heading">
        <h3 id="tp-avoid-ex-heading" className="h-sec" style={{ fontSize: 14 }}>
          Specific exercises to avoid
        </h3>
        <p className="small" style={{ margin: '4px 0 10px' }}>
          Search and add individual movements you want excluded from plans.
        </p>
        <div className="field">
          <label htmlFor="tp-avoid-ex-search">Search exercises to avoid</label>
          <input
            id="tp-avoid-ex-search"
            type="text"
            className="input"
            placeholder="e.g. bench press, squat…"
            value={exerciseSearch}
            onChange={(e) => setExerciseSearch(e.target.value)}
          />
        </div>
        {exerciseSearch.trim() !== '' && (
          <div className="chips" style={{ marginTop: 10 }}>
            {exerciseResults.length === 0 ? (
              <p className="small" style={{ width: '100%' }}>
                No matching exercises. Try a different search.
              </p>
            ) : (
              exerciseResults.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className="chip"
                  aria-pressed={false}
                  style={{ minHeight: 44, fontSize: 14 }}
                  onClick={() => {
                    onChange({ ...value, restrictions: [...value.restrictions, ex.id] });
                    setExerciseSearch('');
                  }}
                >
                  + {ex.name}
                </button>
              ))
            )}
          </div>
        )}
        {selectedExercises.length > 0 && (
          <div className="chips" style={{ marginTop: 10 }}>
            {selectedExercises.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="chip"
                aria-pressed={true}
                aria-label={`Remove ${ex.name} from avoided exercises`}
                style={{ minHeight: 44, fontSize: 14 }}
                onClick={() =>
                  onChange({
                    ...value,
                    restrictions: value.restrictions.filter((id) => id !== ex.id),
                  })
                }
              >
                ✓ {ex.name} ✕
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
