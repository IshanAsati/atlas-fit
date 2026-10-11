import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipmentLabel } from '../../data/equipment';
import { MUSCLES } from '../../data/muscles';
import { useStore } from '../../data/store';
import { ChevronRight } from '../../design/icons';
import { Credit, EmptyState, TopBar } from '../../design/ui';
import type { LocationType, Movement, MuscleId } from '../../data/types';

/**
 * Screen 5a — Exercise Library (§4.5).
 * Offline browse of `catalog` with search + filters (location coverage of the
 * profile's equipment, movement, primary muscle, difficulty, favourites).
 * No network, no fabricated rows — every result is a real catalog entry.
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

const LOCATIONS: Array<{ id: LocationType | 'all'; label: string }> = [
  { id: 'all', label: 'Anywhere' },
  { id: 'home', label: 'Home' },
  { id: 'gym', label: 'Gym' },
  { id: 'travel', label: 'Travel' },
];

const MOVEMENTS: Array<{ id: Movement | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'squat', label: 'Squat' },
  { id: 'hinge', label: 'Hinge' },
  { id: 'hpush', label: 'Horizontal push' },
  { id: 'vpush', label: 'Vertical push' },
  { id: 'hpull', label: 'Horizontal pull' },
  { id: 'vpull', label: 'Vertical pull' },
  { id: 'core', label: 'Core' },
  { id: 'carry', label: 'Carry' },
  { id: 'accessory', label: 'Accessory' },
];

const DIFFICULTIES: Array<{ id: 'all' | 1 | 2 | 3; label: string }> = [
  { id: 'all', label: 'All levels' },
  { id: 1, label: 'Beginner' },
  { id: 2, label: 'Some experience' },
  { id: 3, label: 'Experienced' },
];

/** Chips are 40px by default — bump every control to the 44px touch minimum. */
const CHIP: CSSProperties = { minHeight: 44 };

const BADGE: CSSProperties = {
  display: 'inline-block',
  marginTop: 6,
  fontSize: 11,
  lineHeight: 1.5,
  color: 'var(--warn)',
  border: '1px solid var(--warn)',
  borderRadius: 999,
  padding: '1px 9px',
};

function starStyle(on: boolean): CSSProperties {
  return {
    appearance: 'none',
    border: 0,
    background: 'none',
    padding: 0,
    margin: 0,
    width: 44,
    height: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    lineHeight: 1,
    cursor: 'pointer',
    borderRadius: 10,
    color: on ? 'var(--warn)' : 'var(--text-2)',
  };
}

export function Library() {
  const navigate = useNavigate();
  const { catalog, profile, updateProfile } = useStore();

  const [query, setQuery] = useState('');
  const [loc, setLoc] = useState<LocationType | 'all'>('all');
  const [movement, setMovement] = useState<Movement | 'all'>('all');
  const [muscle, setMuscle] = useState<MuscleId | 'all'>('all');
  const [difficulty, setDifficulty] = useState<'all' | 1 | 2 | 3>('all');
  const [favouritesOnly, setFavouritesOnly] = useState(false);

  const favourites = profile?.favourites ?? [];
  const restrictions = profile?.restrictions ?? [];

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const owned = loc === 'all' ? null : (profile?.equipment[loc] ?? null);
    const favs = profile?.favourites ?? [];

    const matched = catalog.filter((ex) => {
      if (needle) {
        const haystack = `${ex.name} ${ex.aliases.join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (movement !== 'all' && ex.movement !== movement) return false;
      if (muscle !== 'all' && !ex.primary.includes(muscle)) return false;
      if (difficulty !== 'all' && ex.difficulty !== difficulty) return false;
      if (favouritesOnly && !favs.includes(ex.id)) return false;
      // Location = "can I actually do this here?" (profile equipment covers the entry).
      if (owned && !ex.equipmentIds.every((id) => owned.includes(id))) return false;
      return true;
    });
    return matched.sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, profile, query, loc, movement, muscle, difficulty, favouritesOnly]);

  const hasFilters =
    query.trim() !== '' ||
    loc !== 'all' ||
    movement !== 'all' ||
    muscle !== 'all' ||
    difficulty !== 'all' ||
    favouritesOnly;

  const clearFilters = () => {
    setQuery('');
    setLoc('all');
    setMovement('all');
    setMuscle('all');
    setDifficulty('all');
    setFavouritesOnly(false);
  };

  const toggleFavourite = (id: string) => {
    const next = favourites.includes(id)
      ? favourites.filter((x) => x !== id)
      : [...favourites, id];
    void updateProfile({ favourites: next });
  };

  return (
    <>
      <TopBar
        title="Exercise library"
        sub={`${results.length} of ${catalog.length} exercises`}
      />

      <main className="view">
        <div className="field">
          <label htmlFor="lib-search">Search</label>
          <input
            id="lib-search"
            className="input"
            type="search"
            autoComplete="off"
            placeholder="Search name or alias"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <section className="panel" aria-label="Filters">
          <div className="row between">
            <h2 className="h-sec">Filters</h2>
            {hasFilters ? (
              <button type="button" className="btn ghost small-btn" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>

          <p className="small" style={{ margin: '12px 0 6px' }}>
            Where you'll train
          </p>
          <div className="chips" role="group" aria-label="Location filter">
            {LOCATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                style={CHIP}
                aria-pressed={loc === item.id}
                onClick={() => setLoc(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <p className="small" style={{ margin: '12px 0 6px' }}>
            Movement pattern
          </p>
          <div className="chips" role="group" aria-label="Movement pattern filter">
            {MOVEMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                style={CHIP}
                aria-pressed={movement === item.id}
                onClick={() => setMovement(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="lib-muscle">Primary muscle</label>
            <select
              id="lib-muscle"
              className="input"
              value={muscle}
              onChange={(e) => setMuscle(e.target.value as MuscleId | 'all')}
            >
              <option value="all">All muscles</option>
              {MUSCLES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <p className="small" style={{ margin: '12px 0 6px' }}>
            Difficulty
          </p>
          <div className="chips" role="group" aria-label="Difficulty filter">
            {DIFFICULTIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                style={CHIP}
                aria-pressed={difficulty === item.id}
                onClick={() => setDifficulty(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="chips" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="chip"
              style={CHIP}
              aria-pressed={favouritesOnly}
              onClick={() => setFavouritesOnly((v) => !v)}
            >
              ★ Favourites only
            </button>
          </div>
        </section>

        <section aria-label="Results">
          <div className="row between" style={{ marginBottom: 6 }}>
            <h2 className="h-sec">Results</h2>
            <span className="small">
              {results.length} shown{favouritesOnly ? ' · favourites' : ''}
            </span>
          </div>

          {results.length === 0 ? (
            <EmptyState
              title="No exercises match"
              body="Try a shorter search, or clear the filters to see the whole offline library again."
              action={
                <button type="button" className="btn primary small-btn" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            />
          ) : (
            results.map((ex, i) => {
              const isFav = favourites.includes(ex.id);
              const isAvoided = restrictions.includes(ex.id);
              const equipment =
                ex.equipmentIds.length > 0
                  ? ex.equipmentIds.map(equipmentLabel).join(', ')
                  : 'No equipment listed';
              return (
                <div
                  key={ex.id}
                  className="row"
                  style={{
                    gap: 4,
                    paddingRight: 4,
                    borderBottom:
                      i === results.length - 1 ? undefined : '1px solid var(--hairline)',
                  }}
                >
                  <button
                    type="button"
                    className="exrow grow"
                    style={{ borderBottom: 0 }}
                    onClick={() => navigate(`/exercises/${ex.id}`)}
                  >
                    <span className="dot" aria-hidden="true" />
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 650, display: 'block' }}>{ex.name}</span>
                      <span
                        className="small"
                        style={{ display: 'block', overflowWrap: 'anywhere' }}
                      >
                        {MOVEMENT_LABELS[ex.movement]} · {equipment}
                      </span>
                      {isAvoided ? <span style={BADGE}>Avoided</span> : null}
                    </span>
                    <ChevronRight />
                  </button>
                  <button
                    type="button"
                    style={starStyle(isFav)}
                    aria-pressed={isFav}
                    aria-label={
                      isFav
                        ? `Remove ${ex.name} from favourites`
                        : `Add ${ex.name} to favourites`
                    }
                    onClick={() => toggleFavourite(ex.id)}
                  >
                    <span aria-hidden="true">{isFav ? '★' : '☆'}</span>
                  </button>
                </div>
              );
            })
          )}
        </section>

        <Credit />
      </main>
    </>
  );
}
