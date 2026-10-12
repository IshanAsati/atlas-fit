import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Exercise, LocationType, Movement, MuscleId, UserProfile } from '../../data/types';
import { MUSCLES, MUSCLE_BY_ID } from '../../data/muscles';
import { equipmentLabel, DEFAULT_EQUIPMENT } from '../../data/equipment';
import { CATALOG, CATALOG_BY_ID, getExerciseImageUrl } from '../../data/catalog';
import { getUserProfile, toggleFavourite } from '../../data/db';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import './ExerciseLibrary.css';

export interface ExerciseLibraryScreenProps {
  onSelectExercise?: (exerciseId: string) => void;
  /** Workout mode integration (§4.5, §9) */
  workoutMode?: boolean;
  onAddToWorkout?: (exercise: Exercise) => void;
  onSubstitute?: (exercise: Exercise) => void;
  initialExerciseId?: string | null;
}

// Major muscle group definitions (§4.5)
interface MuscleGroupItem {
  id: string;
  label: string;
  muscleIds: MuscleId[];
}

const MUSCLE_GROUPS: MuscleGroupItem[] = [
  { id: 'chest', label: 'Chest', muscleIds: ['chest'] },
  { id: 'back', label: 'Back', muscleIds: ['lats', 'upper_back', 'traps', 'erectors'] },
  { id: 'shoulders', label: 'Shoulders', muscleIds: ['front_delts', 'side_delts', 'rear_delts'] },
  { id: 'arms', label: 'Arms', muscleIds: ['biceps', 'triceps', 'forearms'] },
  { id: 'legs', label: 'Legs', muscleIds: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { id: 'core', label: 'Core', muscleIds: ['abs', 'obliques'] },
];

// Movement pattern definitions (§4.5)
interface MovementPatternItem {
  id: string;
  label: string;
  matches: Movement[];
}

const MOVEMENT_PATTERNS: MovementPatternItem[] = [
  { id: 'all', label: 'All Patterns', matches: [] },
  { id: 'squat', label: 'Squat', matches: ['squat'] },
  { id: 'hinge', label: 'Hinge', matches: ['hinge'] },
  { id: 'hpush', label: 'Horizontal Push', matches: ['hpush'] },
  { id: 'vpush', label: 'Vertical Push', matches: ['vpush'] },
  { id: 'pull', label: 'Pull', matches: ['hpull', 'vpull'] },
  { id: 'core', label: 'Core', matches: ['core'] },
  { id: 'accessory', label: 'Accessory', matches: ['accessory'] },
];

const PAGE_SIZE = 40;

export const ExerciseLibraryScreen: React.FC<ExerciseLibraryScreenProps> = ({
  onSelectExercise: externalOnSelectExercise,
  workoutMode = false,
  onAddToWorkout,
  onSubstitute,
  initialExerciseId = null,
}) => {
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Filters state
  const [locationFilter, setLocationFilter] = useState<LocationType | 'all'>('all');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all');
  const [specificMuscle, setSpecificMuscle] = useState<MuscleId | 'all'>('all');
  const [movementFilter, setMovementFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<number | 'all'>('all');
  const [favouritesOnly, setFavouritesOnly] = useState<boolean>(false);

  // Pagination limit
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Selected exercise for detail sheet
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // User profile for favourites and equipment
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favouritesSet, setFavouritesSet] = useState<Set<string>>(new Set());

  // Load user profile
  const refreshProfile = useCallback(async () => {
    try {
      const p = await getUserProfile();
      setProfile(p);
      setFavouritesSet(new Set(p.favourites ?? []));
    } catch (err) {
      console.warn('Failed to load profile in ExerciseLibraryScreen', err);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  // Initial exercise handling
  useEffect(() => {
    if (initialExerciseId && CATALOG_BY_ID[initialExerciseId]) {
      setSelectedExercise(CATALOG_BY_ID[initialExerciseId]);
    }
  }, [initialExerciseId]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [
    searchQuery,
    locationFilter,
    selectedMuscleGroup,
    specificMuscle,
    movementFilter,
    difficultyFilter,
    favouritesOnly,
  ]);

  // Available equipment by location
  const locationEquipmentSet = useMemo<Set<string> | null>(() => {
    if (locationFilter === 'all') return null;
    const eqList = profile?.equipment?.[locationFilter] ?? DEFAULT_EQUIPMENT[locationFilter];
    const set = new Set(eqList);
    set.add('bodyweight');
    if (set.has('adj-dumbbells')) set.add('dumbbells');
    if (set.has('bench')) set.add('chair');
    return set;
  }, [locationFilter, profile]);

  // Targeted muscle IDs set
  const activeMuscleIds = useMemo<Set<MuscleId> | null>(() => {
    if (specificMuscle !== 'all') {
      return new Set([specificMuscle]);
    }
    if (selectedMuscleGroup !== 'all') {
      const group = MUSCLE_GROUPS.find((g) => g.id === selectedMuscleGroup);
      if (group) return new Set(group.muscleIds);
    }
    return null;
  }, [selectedMuscleGroup, specificMuscle]);

  // Movement filter target movements
  const activeMovementPatterns = useMemo<Set<Movement> | null>(() => {
    if (movementFilter === 'all') return null;
    const pat = MOVEMENT_PATTERNS.find((p) => p.id === movementFilter);
    if (pat && pat.matches.length > 0) {
      return new Set(pat.matches);
    }
    return null;
  }, [movementFilter]);

  // Filter & Search Engine
  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return CATALOG.filter((ex) => {
      // 1. Favourites filter
      if (favouritesOnly && !favouritesSet.has(ex.id)) {
        return false;
      }

      // 2. Difficulty filter
      if (difficultyFilter !== 'all' && ex.difficulty !== difficultyFilter) {
        return false;
      }

      // 3. Movement pattern filter
      if (activeMovementPatterns && !activeMovementPatterns.has(ex.movement)) {
        return false;
      }

      // 4. Muscle filter (primary or secondary)
      if (activeMuscleIds) {
        const matchesMuscle =
          ex.primary.some((m) => activeMuscleIds.has(m)) ||
          ex.secondary.some((m) => activeMuscleIds.has(m));
        if (!matchesMuscle) return false;
      }

      // 5. Location equipment filter
      if (locationEquipmentSet && ex.equipmentIds.length > 0) {
        const canDo = ex.equipmentIds.every((req) => locationEquipmentSet.has(req));
        if (!canDo) return false;
      }

      // 6. Fast instant search query matching
      if (q) {
        // Name check
        if (ex.name.toLowerCase().includes(q)) return true;

        // Aliases check
        if (ex.aliases && ex.aliases.some((a) => a.toLowerCase().includes(q))) return true;

        // Muscles check (id and readable name)
        const matchesMuscleName =
          ex.primary.some((m) => {
            const meta = MUSCLE_BY_ID[m];
            return m.toLowerCase().includes(q) || (meta && meta.name.toLowerCase().includes(q));
          }) ||
          ex.secondary.some((m) => {
            const meta = MUSCLE_BY_ID[m];
            return m.toLowerCase().includes(q) || (meta && meta.name.toLowerCase().includes(q));
          });
        if (matchesMuscleName) return true;

        // Equipment check (id and readable label)
        const matchesEquipment = ex.equipmentIds.some((eq) => {
          return eq.toLowerCase().includes(q) || equipmentLabel(eq).toLowerCase().includes(q);
        });
        if (matchesEquipment) return true;

        return false;
      }

      return true;
    });
  }, [
    searchQuery,
    favouritesOnly,
    favouritesSet,
    difficultyFilter,
    activeMovementPatterns,
    activeMuscleIds,
    locationEquipmentSet,
  ]);

  // Active filters count
  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    locationFilter !== 'all' ||
    selectedMuscleGroup !== 'all' ||
    specificMuscle !== 'all' ||
    movementFilter !== 'all' ||
    difficultyFilter !== 'all' ||
    favouritesOnly;

  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationFilter('all');
    setSelectedMuscleGroup('all');
    setSpecificMuscle('all');
    setMovementFilter('all');
    setDifficultyFilter('all');
    setFavouritesOnly(false);
  };

  // Toggle favorite on card
  const handleCardToggleFavourite = async (e: React.MouseEvent, exerciseId: string) => {
    e.stopPropagation();
    try {
      const isFav = await toggleFavourite(exerciseId);
      setFavouritesSet((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(exerciseId);
        else next.delete(exerciseId);
        return next;
      });
      const updatedProfile = await getUserProfile();
      setProfile(updatedProfile);
    } catch (err) {
      console.error('Failed to toggle favourite on card', err);
    }
  };

  // Open Exercise Detail
  const handleOpenExercise = (ex: Exercise) => {
    setSelectedExercise(ex);
    externalOnSelectExercise?.(ex.id);
  };

  const visibleExercises = filteredExercises.slice(0, visibleCount);
  const remainingCount = filteredExercises.length - visibleCount;

  return (
    <div className="view" style={{ paddingBottom: 'calc(var(--tab-h, 72px) + 30px)' }}>
      {/* Screen Header */}
      <div style={{ marginBottom: 4 }}>
        <h1 className="h-hero">Exercise Library</h1>
        <p className="sub">Explore and filter all 644 exercises with biomechanics and cues.</p>
      </div>

      {/* Fast Instant Search Bar (§4.5) */}
      <div className="ex-search-wrap">
        <span className="ex-search-icon" aria-hidden="true">
          🔍
        </span>
        <input
          type="search"
          className="ex-search-input"
          placeholder="Search name, aliases, muscles, equipment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search exercises"
        />
        {searchQuery && (
          <button
            type="button"
            className="ex-search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Controls & Chips (§4.5) */}
      <div className="ex-filters">
        {/* 1. Location Filter: All, Home, Gym, Travel */}
        <div className="ex-filter-group">
          <div className="ex-filter-label">
            <span>Location</span>
            {locationFilter !== 'all' && (
              <span style={{ color: 'var(--action, #57B9FA)' }}>
                {locationFilter.toUpperCase()}
              </span>
            )}
          </div>
          <div className="ex-chips-scroll" role="radiogroup" aria-label="Location filter">
            {(['all', 'home', 'gym', 'travel'] as const).map((loc) => {
              const label = loc === 'all' ? 'All Locations' : loc.charAt(0).toUpperCase() + loc.slice(1);
              const isActive = locationFilter === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  className={`ex-filter-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setLocationFilter(loc)}
                  role="radio"
                  aria-checked={isActive}
                >
                  {loc === 'home' ? '🏠 ' : loc === 'gym' ? '🏋️ ' : loc === 'travel' ? '✈️ ' : ''}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Muscle Filter: All, Chest, Back, Shoulders, Arms, Legs, Core... */}
        <div className="ex-filter-group">
          <div className="ex-filter-label">
            <span>Muscle Group</span>
            {selectedMuscleGroup !== 'all' && (
              <span style={{ color: 'var(--accent, #BA83F7)' }}>
                {MUSCLE_GROUPS.find((g) => g.id === selectedMuscleGroup)?.label}
              </span>
            )}
          </div>
          <div className="ex-chips-scroll" role="radiogroup" aria-label="Muscle group filter">
            <button
              type="button"
              className={`ex-filter-chip ${selectedMuscleGroup === 'all' && specificMuscle === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMuscleGroup('all');
                setSpecificMuscle('all');
              }}
              role="radio"
              aria-checked={selectedMuscleGroup === 'all' && specificMuscle === 'all'}
            >
              All Muscles
            </button>
            {MUSCLE_GROUPS.map((group) => {
              const isActive = selectedMuscleGroup === group.id && specificMuscle === 'all';
              return (
                <button
                  key={group.id}
                  type="button"
                  className={`ex-filter-chip ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedMuscleGroup(group.id);
                    setSpecificMuscle('all');
                  }}
                  role="radio"
                  aria-checked={isActive}
                >
                  {group.label}
                </button>
              );
            })}
          </div>

          {/* Sub-muscle specific filter picker for fine-grained selection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <label htmlFor="specific-muscle-select" style={{ fontSize: 12, color: 'var(--text-2, #A9A2B2)' }}>
              Specific muscle:
            </label>
            <select
              id="specific-muscle-select"
              className="input"
              style={{ minHeight: 36, padding: '4px 8px', fontSize: 13, flex: 1 }}
              value={specificMuscle}
              onChange={(e) => {
                const val = e.target.value as MuscleId | 'all';
                setSpecificMuscle(val);
                if (val !== 'all') {
                  const parentGroup = MUSCLE_GROUPS.find((g) => g.muscleIds.includes(val as MuscleId));
                  if (parentGroup) setSelectedMuscleGroup(parentGroup.id);
                }
              }}
            >
              <option value="all">Any specific muscle...</option>
              {MUSCLES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Movement Pattern Filter: Squat, Hinge, Push, Pull, Core, Accessory */}
        <div className="ex-filter-group">
          <div className="ex-filter-label">
            <span>Movement Pattern</span>
            {movementFilter !== 'all' && (
              <span style={{ color: 'var(--action, #57B9FA)' }}>
                {MOVEMENT_PATTERNS.find((m) => m.id === movementFilter)?.label}
              </span>
            )}
          </div>
          <div className="ex-chips-scroll" role="radiogroup" aria-label="Movement pattern filter">
            {MOVEMENT_PATTERNS.map((pattern) => {
              const isActive = movementFilter === pattern.id;
              return (
                <button
                  key={pattern.id}
                  type="button"
                  className={`ex-filter-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setMovementFilter(pattern.id)}
                  role="radio"
                  aria-checked={isActive}
                >
                  {pattern.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Difficulty Filter & Favourites Toggle */}
        <div className="ex-filter-group">
          <div className="ex-filter-label">
            <span>Difficulty & Status</span>
          </div>
          <div className="ex-chips-scroll">
            {/* Favourites Only Toggle */}
            <button
              type="button"
              className={`ex-filter-chip fav-chip ${favouritesOnly ? 'active' : ''}`}
              onClick={() => setFavouritesOnly(!favouritesOnly)}
              aria-pressed={favouritesOnly}
            >
              ★ Favourites Only
            </button>

            {/* Difficulty Chips */}
            <button
              type="button"
              className={`ex-filter-chip ${difficultyFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDifficultyFilter('all')}
            >
              All Levels
            </button>
            <button
              type="button"
              className={`ex-filter-chip ${difficultyFilter === 1 ? 'active' : ''}`}
              onClick={() => setDifficultyFilter(1)}
            >
              Beginner (1)
            </button>
            <button
              type="button"
              className={`ex-filter-chip ${difficultyFilter === 2 ? 'active' : ''}`}
              onClick={() => setDifficultyFilter(2)}
            >
              Intermediate (2)
            </button>
            <button
              type="button"
              className={`ex-filter-chip ${difficultyFilter === 3 ? 'active' : ''}`}
              onClick={() => setDifficultyFilter(3)}
            >
              Advanced (3)
            </button>
          </div>
        </div>
      </div>

      {/* Matching Count Header & Reset Filters Bar */}
      <div className="ex-count-bar">
        <span>
          Showing <strong>{filteredExercises.length}</strong> of <strong>{CATALOG.length}</strong> exercises
        </span>
        {hasActiveFilters && (
          <button type="button" className="ex-reset-btn" onClick={handleResetFilters}>
            Reset Filters
          </button>
        )}
      </div>

      {/* Exercise Cards List (§4.5) */}
      {filteredExercises.length > 0 ? (
        <div className="ex-list" role="list">
          {visibleExercises.map((ex) => {
            const isFav = favouritesSet.has(ex.id);
            const thumbUrl = getExerciseImageUrl(ex, 'start') ?? `/repdb-images/flat/${ex.id}-start.webp`;
            const primaryMuscleName =
              ex.primary.length > 0
                ? MUSCLE_BY_ID[ex.primary[0]]?.short || ex.primary[0]
                : 'General';

            const diffClass = `diff-${ex.difficulty}`;
            const diffLabel =
              ex.difficulty === 1 ? 'Beginner' : ex.difficulty === 2 ? 'Intermediate' : 'Advanced';

            return (
              <div
                key={ex.id}
                role="listitem"
                className="ex-card"
                onClick={() => handleOpenExercise(ex)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpenExercise(ex);
                  }
                }}
              >
                {/* Illustration Thumbnail */}
                <div className="ex-thumb-wrap">
                  <img
                    src={thumbUrl}
                    alt=""
                    className="ex-thumb-img"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<span class="ex-thumb-placeholder">🏋️</span>';
                      }
                    }}
                  />
                </div>

                {/* Exercise Info */}
                <div className="ex-card-content">
                  <h3 className="ex-card-title">{ex.name}</h3>

                  <div className="ex-badges-row">
                    {/* Primary Muscle Badge (Red Accent #F04455) */}
                    <span className="ex-badge ex-badge-primary-muscle">
                      {primaryMuscleName}
                    </span>

                    {/* Difficulty Badge */}
                    <span className={`ex-badge ex-badge-difficulty ${diffClass}`}>
                      {diffLabel}
                    </span>

                    {/* Required Equipment Chips */}
                    {ex.equipmentIds.length > 0 ? (
                      <span className="ex-badge ex-badge-equipment">
                        {equipmentLabel(ex.equipmentIds[0])}
                        {ex.equipmentIds.length > 1 ? ` +${ex.equipmentIds.length - 1}` : ''}
                      </span>
                    ) : (
                      <span className="ex-badge ex-badge-equipment">Bodyweight</span>
                    )}
                  </div>
                </div>

                {/* Favorite Star Toggle Button */}
                <button
                  type="button"
                  className={`ex-fav-btn ${isFav ? 'is-fav' : ''}`}
                  onClick={(e) => handleCardToggleFavourite(e, ex.id)}
                  aria-label={isFav ? `Remove ${ex.name} from favourites` : `Add ${ex.name} to favourites`}
                  title={isFav ? 'Remove favourite' : 'Add favourite'}
                >
                  {isFav ? '★' : '☆'}
                </button>
              </div>
            );
          })}

          {/* Load More Button if remaining */}
          {remainingCount > 0 && (
            <button
              type="button"
              className="ex-load-more-btn"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              Show More ({remainingCount} remaining)
            </button>
          )}
        </div>
      ) : (
        <div className="empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <strong>No matching exercises found</strong>
          <p style={{ margin: '6px 0 14px' }}>
            Try adjusting your search keywords, location equipment, or muscle group filters.
          </p>
          {hasActiveFilters && (
            <button type="button" className="btn small-btn primary" onClick={handleResetFilters}>
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* Visible Attribution (§4.5, §6.1) */}
      <footer className="credit" style={{ textAlign: 'center', marginTop: 24 }}>
        Exercise data by{' '}
        <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">
          RepDB (repdb.co)
        </a>
      </footer>

      {/* Exercise Detail Sheet Modal Dialog */}
      <ExerciseDetailSheet
        exercise={selectedExercise}
        isOpen={!!selectedExercise}
        onClose={() => setSelectedExercise(null)}
        onSelectExercise={(id) => {
          if (CATALOG_BY_ID[id]) {
            setSelectedExercise(CATALOG_BY_ID[id]);
            externalOnSelectExercise?.(id);
          }
        }}
        userProfile={profile}
        onProfileUpdated={(updated) => {
          setProfile(updated);
          setFavouritesSet(new Set(updated.favourites ?? []));
        }}
        workoutMode={workoutMode}
        onAddToWorkout={onAddToWorkout}
        onSubstitute={onSubstitute}
      />
    </div>
  );
};
