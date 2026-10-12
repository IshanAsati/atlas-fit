import { useMemo, useState } from 'react';
import type { LocationType } from '../../data/types';
import { EQUIPMENT } from '../../data/equipment';

interface EquipmentInventoryProps {
  /** Currently edited location; retained across search/category edits. */
  location: LocationType;
  onLocationChange: (location: LocationType) => void;
  /** Full inventory record so location counts stay visible per toggle. */
  equipment: Record<LocationType, string[]>;
  onToggle: (location: LocationType, id: string, checked: boolean) => void;
  onResetLocation: (location: LocationType) => void;
}

const LOCATIONS: LocationType[] = ['home', 'gym', 'travel'];

const CATEGORY_FILTERS = [
  'All',
  'Home',
  'Free weights',
  'Cables',
  'Push',
  'Lower',
  'Abs',
  'Other',
  'Cardio',
  'Custom',
];

const locationName = (place: LocationType) =>
  place[0].toUpperCase() + place.slice(1);

export function EquipmentInventory({
  location,
  onLocationChange,
  equipment,
  onToggle,
  onResetLocation,
}: EquipmentInventoryProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(
    () =>
      EQUIPMENT.filter((eq) => {
        const matchesSearch =
          search.trim() === '' ||
          eq.label.toLowerCase().includes(search.toLowerCase()) ||
          eq.id.toLowerCase().includes(search.toLowerCase()) ||
          eq.category.toLowerCase().includes(search.toLowerCase());
        const matchesCategory =
          category === 'All' ||
          eq.category.toLowerCase().includes(category.toLowerCase());
        return matchesSearch && matchesCategory;
      }),
    [search, category],
  );

  const selected = equipment[location] ?? [];

  return (
    <div>
      <div className="seg" role="group" aria-label="Equipment location">
        {LOCATIONS.map((place) => (
          <button
            key={place}
            type="button"
            aria-pressed={location === place}
            onClick={() => onLocationChange(place)}
          >
            {locationName(place)} ({(equipment[place] ?? []).length})
          </button>
        ))}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="settings-equipment-search">Search available equipment</label>
        <input
          id="settings-equipment-search"
          type="text"
          className="input"
          placeholder="e.g. dumbbells, cable…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div
        role="group"
        aria-label="Equipment categories"
        className="chips"
        style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4, marginTop: 10 }}
      >
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat}
            type="button"
            className="chip"
            aria-pressed={category === cat}
            style={{ whiteSpace: 'nowrap', minHeight: 44, padding: '6px 12px', fontSize: 14 }}
            onClick={() => setCategory(cat)}
          >
            {cat === 'Home' ? 'Home-use' : cat}
          </button>
        ))}
      </div>

      <div className="row between wrap" style={{ alignItems: 'center', marginTop: 10 }}>
        <span className="small">
          {selected.length} items available for {locationName(location)}
        </span>
        <button
          type="button"
          className="btn small-btn ghost"
          style={{ padding: '4px 10px', fontSize: 14, minHeight: 44 }}
          onClick={() => onResetLocation(location)}
          aria-label={`Reset ${locationName(location)} equipment to defaults`}
        >
          ↺ Reset defaults
        </button>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            padding: 16,
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          <p className="small" style={{ margin: '0 0 10px' }}>
            No matching equipment. Try clearing your search or category.
          </p>
          <button
            type="button"
            className="btn small-btn ghost"
            style={{ minHeight: 44 }}
            onClick={() => {
              setSearch('');
              setCategory('All');
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
            gap: 8,
            marginTop: 8,
          }}
        >
          {filtered.map((eq) => (
            <label
              key={eq.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                minHeight: 48,
                padding: 8,
                background: 'var(--surface)',
                borderRadius: 10,
              }}
            >
              <input
                type="checkbox"
                style={{ width: 18, height: 18, accentColor: 'var(--action)', flexShrink: 0 }}
                checked={eq.id === 'bodyweight' || selected.includes(eq.id)}
                disabled={eq.id === 'bodyweight'}
                onChange={(event) => onToggle(location, eq.id, event.target.checked)}
              />
              {eq.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
