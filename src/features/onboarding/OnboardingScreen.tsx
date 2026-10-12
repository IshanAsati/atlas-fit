import React, { useState, useMemo, useCallback } from 'react';
import type {
  UserProfile,
  Goal,
  Experience,
  LocationType,
  Plan,
} from '../../data/types';
import { EQUIPMENT, DEFAULT_EQUIPMENT } from '../../data/equipment';
import { CATALOG, CATALOG_BY_ID } from '../../data/catalog';
import { ExercisePicture } from '../../design/ExercisePicture';
import { Icon } from '../../design/Icon';
import { generatePlan } from '../planner/engine';
import * as db from '../../data/db';

export interface OnboardingScreenProps {
  onComplete: () => void;
  initialProfile?: UserProfile;
}

const GOAL_OPTIONS: Array<{
  id: Goal;
  title: string;
  description: string;
}> = [
  {
    id: 'strength',
    title: 'Strength',
    description: 'Build raw strength and heavy compound capacity',
  },
  {
    id: 'fitness',
    title: 'General Fitness',
    description: 'Balanced health, functional energy and conditioning',
  },
  {
    id: 'technique',
    title: 'Technique / Learning',
    description: 'Safe form, movement control and foundational mechanics',
  },
  {
    id: 'endurance',
    title: 'Muscular Endurance',
    description: 'Higher reps, stamina and muscular resilience',
  },
  {
    id: 'mobility',
    title: 'Mobility & Functional',
    description: 'Joint range of motion, flexibility and posture',
  },
];

const EXPERIENCE_OPTIONS: Array<{
  id: Experience;
  title: string;
  description: string;
}> = [
  {
    id: 'new',
    title: 'New to Lifting',
    description: 'Less than 6 months of structured lifting',
  },
  {
    id: 'some',
    title: 'Some Experience',
    description: '6 months to 2 years of regular training',
  },
  {
    id: 'experienced',
    title: 'Experienced',
    description: '2+ years of consistent progression',
  },
];

const LOCATION_OPTIONS: Array<{
  id: 'home' | 'gym' | 'both';
  title: string;
  description: string;
  activeLoc: LocationType;
}> = [
  {
    id: 'home',
    title: 'Home',
    description: 'Bodyweight, dumbbells, bands or home gym setup',
    activeLoc: 'home',
  },
  {
    id: 'gym',
    title: 'Gym',
    description: 'Commercial gym with racks, cables, and machines',
    activeLoc: 'gym',
  },
  {
    id: 'both',
    title: 'Both (Home & Gym)',
    description: 'Train at both locations with dedicated inventories',
    activeLoc: 'home',
  },
];

const DAYS_OPTIONS: Array<{
  days: number;
  title: string;
  description: string;
  defaultSchedule: string[];
}> = [
  {
    days: 2,
    title: '2 Days per week',
    description: 'Full-body frequency twice a week with generous recovery',
    defaultSchedule: ['Tue', 'Fri'],
  },
  {
    days: 3,
    title: '3 Days per week',
    description: 'Balanced split (Full-Body or Push/Pull/Legs) — recommended',
    defaultSchedule: ['Mon', 'Wed', 'Fri'],
  },
  {
    days: 4,
    title: '4 Days per week',
    description: 'Upper / Lower split with focused volume and stimulus',
    defaultSchedule: ['Mon', 'Tue', 'Thu', 'Fri'],
  },
  {
    days: 5,
    title: '5 Days per week',
    description: 'Flexible split with targeted movement coverage',
    defaultSchedule: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat'],
  },
];

const DURATION_OPTIONS: Array<{
  min: 30 | 45 | 60;
  title: string;
  description: string;
}> = [
  {
    min: 30,
    title: '30 Minutes',
    description: '3–4 exercises, high density, shorter rest intervals',
  },
  {
    min: 45,
    title: '45 Minutes',
    description: '4–5 exercises, standard compound work and balanced rest',
  },
  {
    min: 60,
    title: '60 Minutes',
    description: '5–6 exercises, full volume capacity and thorough recovery',
  },
];

const ALL_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const COMMON_DISCOMFORT_AREAS = [
  { id: 'Overhead pressing', label: 'Overhead pressing', note: 'overhead press' },
  { id: 'Deep squats', label: 'Deep squats', note: 'squat' },
  { id: 'Lower back heavy loading', label: 'Lower back heavy loading', note: 'lower back deadlift' },
  { id: 'Bench pressing / shoulders', label: 'Bench pressing / shoulders', note: 'bench press shoulder' },
  { id: 'Pull-ups / hanging', label: 'Pull-ups / hanging', note: 'pull up' },
  { id: 'Spinal compression', label: 'Spinal compression', note: 'barbell squat compression' },
  { id: 'High-impact jumping', label: 'High-impact jumping', note: 'jump impact' },
  { id: 'Wrist strain', label: 'Wrist strain', note: 'wrist' },
];

const OTHER_ACTIVITIES = [
  { id: 'none', label: 'None (Lifting only)' },
  { id: 'Running', label: 'Running / Jogging' },
  { id: 'Cycling', label: 'Cycling' },
  { id: 'Swimming', label: 'Swimming' },
  { id: 'Martial Arts', label: 'Martial Arts' },
  { id: 'Team Sports', label: 'Team Sports' },
  { id: 'HIIT / Cross-training', label: 'HIIT / Cross-training' },
  { id: 'Yoga / Mobility', label: 'Yoga / Mobility' },
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
  initialProfile,
}) => {
  const [step, setStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(true);

  // Profile Form State
  const [displayName, setDisplayName] = useState<string>(
    initialProfile?.displayName || 'Lifter',
  );
  const [goal, setGoal] = useState<Goal>(initialProfile?.goal || 'strength');
  const [experience, setExperience] = useState<Experience>(
    initialProfile?.experience || 'some',
  );
  const [trainPlace, setTrainPlace] = useState<'home' | 'gym' | 'both'>('both');
  const [activeLocation, setActiveLocation] = useState<LocationType>(
    initialProfile?.activeLocation || 'home',
  );

  // Equipment inventories for Home and Gym
  const [equipment, setEquipment] = useState<Record<LocationType, string[]>>({
    home: initialProfile?.equipment?.home
      ? [...initialProfile.equipment.home]
      : [...DEFAULT_EQUIPMENT.home],
    gym: initialProfile?.equipment?.gym
      ? [...initialProfile.equipment.gym]
      : [...DEFAULT_EQUIPMENT.gym],
    travel: initialProfile?.equipment?.travel
      ? [...initialProfile.equipment.travel]
      : [...DEFAULT_EQUIPMENT.travel],
  });

  // Equipment screen helper state
  const [equipmentTab, setEquipmentTab] = useState<'home' | 'gym'>('home');
  const [equipmentSearch, setEquipmentSearch] = useState<string>('');
  const [equipmentCategory, setEquipmentCategory] = useState<string>('All');

  // Days & Duration
  const [daysPerWeek, setDaysPerWeek] = useState<number>(
    initialProfile?.daysPerWeek || 3,
  );
  const [durationMin, setDurationMin] = useState<30 | 45 | 60>(
    initialProfile?.durationMin || 45,
  );
  const [weekdays, setWeekdays] = useState<string[]>(
    initialProfile?.weekdays && initialProfile.weekdays.length > 0
      ? [...initialProfile.weekdays]
      : ['Mon', 'Wed', 'Fri'],
  );

  // Discomfort & Restrictions
  const [selectedDiscomfort, setSelectedDiscomfort] = useState<string[]>([]);
  const [discomfortNotes, setDiscomfortNotes] = useState<string>(
    initialProfile?.discomfortNotes || '',
  );

  // Other Sports
  const [selectedActivities, setSelectedActivities] = useState<string[]>(() => {
    if (!initialProfile?.otherSports) return ['none'];
    const parts = initialProfile.otherSports.split(',').map((s) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : ['none'];
  });

  // Constructed profile object for plan generation and saving
  const currentProfile: UserProfile = useMemo(() => {
    // Combine selected discomfort chips + custom notes
    const combinedDiscomfort = [
      ...selectedDiscomfort,
      discomfortNotes.trim(),
    ].filter(Boolean).join('; ');

    const sports = selectedActivities.filter((a) => a !== 'none').join(', ');

    return {
      displayName: displayName.trim() || 'Lifter',
      goal,
      experience,
      activeLocation,
      equipment,
      daysPerWeek,
      durationMin,
      weekdays,
      restrictions: initialProfile?.restrictions || [],
      discomfortNotes: combinedDiscomfort,
      otherSports: sports,
      liked: initialProfile?.liked || [],
      disliked: initialProfile?.disliked || [],
      pinned: initialProfile?.pinned || [],
      favourites: initialProfile?.favourites || [],
      weightUnit: initialProfile?.weightUnit ?? 'kg',
      onboarded: false,
    };
  }, [
    displayName,
    goal,
    experience,
    activeLocation,
    equipment,
    daysPerWeek,
    durationMin,
    weekdays,
    selectedDiscomfort,
    discomfortNotes,
    selectedActivities,
    initialProfile,
  ]);

  // Generate proposed plan preview deterministically via rules engine
  const generatedPlan: Plan = useMemo(() => {
    try {
      return generatePlan(currentProfile, CATALOG, []);
    } catch (err) {
      console.warn('Plan generation fallback:', err);
      // Fallback with safe baseline equipment if user cleared all gear
      const fallbackProf: UserProfile = {
        ...currentProfile,
        equipment: {
          ...currentProfile.equipment,
          [currentProfile.activeLocation]: [
            ...DEFAULT_EQUIPMENT[currentProfile.activeLocation],
          ],
        },
      };
      return generatePlan(fallbackProf, CATALOG, []);
    }
  }, [currentProfile]);

  // Back button handler
  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  // Step 4 handler: Where do you train?
  const handleSelectTrainPlace = (choice: 'home' | 'gym' | 'both') => {
    setTrainPlace(choice);
    const targetLoc = choice === 'gym' ? 'gym' : 'home';
    setActiveLocation(targetLoc);
    setEquipmentTab(targetLoc);
  };

  // Step 5 Equipment handlers
  const handleToggleEquipment = (loc: LocationType, id: string) => {
    setEquipment((prev) => {
      const currentList = prev[loc] || [];
      const exists = currentList.includes(id);
      const nextList = exists
        ? currentList.filter((item) => item !== id)
        : [...currentList, id];
      return {
        ...prev,
        [loc]: nextList,
      };
    });
  };

  const handleResetEquipment = (loc: LocationType) => {
    setEquipment((prev) => ({
      ...prev,
      [loc]: [...DEFAULT_EQUIPMENT[loc]],
    }));
  };

  // Filtered equipment list for Step 5
  const filteredEquipment = useMemo(() => {
    return EQUIPMENT.filter((eq) => {
      const matchesSearch =
        equipmentSearch.trim() === '' ||
        eq.label.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
        eq.category.toLowerCase().includes(equipmentSearch.toLowerCase());

      const matchesCat =
        equipmentCategory === 'All' ||
        eq.category.toLowerCase().includes(equipmentCategory.toLowerCase());

      return matchesSearch && matchesCat;
    });
  }, [equipmentSearch, equipmentCategory]);

  // Step 6 Days handler
  const handleSelectDays = (num: number, defaultSched: string[]) => {
    setDaysPerWeek(num);
    setWeekdays(defaultSched);
  };

  // Step 8 Weekdays toggle
  const handleToggleWeekday = (day: string) => {
    setWeekdays((prev) => {
      if (prev.includes(day)) {
        // Keep at least 1 day selected
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  // Step 9 Discomfort toggle
  const handleToggleDiscomfortArea = (id: string) => {
    setSelectedDiscomfort((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSkipDiscomfort = () => {
    setSelectedDiscomfort([]);
    setDiscomfortNotes('');
    setStep(10);
  };

  // Step 10 Other sports toggle
  const handleToggleActivity = (actId: string) => {
    if (actId === 'none') {
      setSelectedActivities(['none']);
      return;
    }
    setSelectedActivities((prev) => {
      const withoutNone = prev.filter((a) => a !== 'none');
      if (withoutNone.includes(actId)) {
        const next = withoutNone.filter((a) => a !== actId);
        return next.length === 0 ? ['none'] : next;
      }
      return [...withoutNone, actId];
    });
  };

  // Step 11: Final Save and Launch Training
  const handleStartTraining = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const finalProfile: UserProfile = {
        ...currentProfile,
        onboarded: true,
      };
      await db.db.transaction('rw', db.db.profiles, db.db.plans, async () => {
        await db.saveUserProfile(finalProfile);
        await db.savePlan(generatedPlan);
      });
      onComplete();
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setSaveError('Your preferences and plan could not be saved. Keep this screen open and try again.');
      setIsSaving(false);
    }
  }, [currentProfile, generatedPlan, isSaving, onComplete]);

  return (
    <div className="shell" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Sticky Progress Topbar */}
      <header className="topbar">
        <div className="row between" style={{ minHeight: 40, alignItems: 'center' }}>
          {step > 1 ? (
            <button
              type="button"
              className="btn small-btn ghost"
              onClick={handleBack}
              style={{ minHeight: 44, padding: '6px 12px' }}
              aria-label="Back to previous step"
            >
              ← Back
            </button>
          ) : (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 0.8,
                color: 'var(--action)',
                textTransform: 'uppercase',
              }}
            >
              Atlas Fit
            </span>
          )}
          <span className="small" style={{ fontWeight: 650, color: 'var(--text-2)' }}>
            Step {step} of 11
          </span>
        </div>
        <div
          className="pbar"
          style={{ marginTop: 8 }}
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={11}
          aria-label={`Step ${step} of 11`}
        >
          <div style={{ width: `${(step / 11) * 100}%` }} />
        </div>
      </header>

      {/* Main Step Content */}
      <main className="view" style={{ flex: 1, paddingBottom: 40 }}>
        {/* ================= STEP 1: DISPLAY NAME ================= */}
        {step === 1 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Welcome to Atlas Fit</h1>
              <p className="sub">
                What should we call you? Keep it as Lifter or enter your preferred name.
              </p>
            </div>

            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="display-name-input">Display Name (optional)</label>
              <input
                id="display-name-input"
                type="text"
                className="input"
                placeholder="Lifter"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={32}
                autoFocus
              />
              <span className="small" style={{ display: 'block', marginTop: 6 }}>
                You can change this anytime. Your profile is stored strictly on this device.
              </span>
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 24, minHeight: 50 }}
              onClick={() => {
                if (!displayName.trim()) setDisplayName('Lifter');
                setStep(2);
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ================= STEP 2: MAIN OBJECTIVE ================= */}
        {step === 2 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Main Objective</h1>
              <p className="sub">
                What is your primary training focus right now? We tune rep ranges, volume, and rest accordingly.
              </p>
            </div>

            <div className="tiles">
              {GOAL_OPTIONS.map((item) => {
                const isSelected = goal === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="tile"
                    aria-pressed={isSelected}
                    onClick={() => setGoal(item.id)}
                  >
                    <span className="t" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {item.title}
                      {isSelected && <span style={{ color: 'var(--action)', fontSize: 16 }}>✓</span>}
                    </span>
                    <span className="d">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 12, minHeight: 50 }}
              onClick={() => setStep(3)}
            >
              Continue
            </button>
          </div>
        )}

        {/* ================= STEP 3: TRAINING EXPERIENCE ================= */}
        {step === 3 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Training Experience</h1>
              <p className="sub">
                How much structured lifting experience do you have? This guides movement complexity and weekly set volume.
              </p>
            </div>

            <div className="tiles">
              {EXPERIENCE_OPTIONS.map((item) => {
                const isSelected = experience === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="tile"
                    aria-pressed={isSelected}
                    onClick={() => setExperience(item.id)}
                  >
                    <span className="t" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {item.title}
                      {isSelected && <span style={{ color: 'var(--action)', fontSize: 16 }}>✓</span>}
                    </span>
                    <span className="d">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 12, minHeight: 50 }}
              onClick={() => setStep(4)}
            >
              Continue
            </button>
          </div>
        )}

        {/* ================= STEP 4: WHERE DO YOU TRAIN? ================= */}
        {step === 4 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Where do you train?</h1>
              <p className="sub">
                Choose your environment. You can manage distinct inventories for Home and Gym and switch anytime.
              </p>
            </div>

            <div className="tiles">
              {LOCATION_OPTIONS.map((item) => {
                const isSelected = trainPlace === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="tile"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectTrainPlace(item.id)}
                  >
                    <span className="t" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {item.title}
                      {isSelected && <span style={{ color: 'var(--action)', fontSize: 16 }}>✓</span>}
                    </span>
                    <span className="d">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 12, minHeight: 50 }}
              onClick={() => setStep(5)}
            >
              Continue to Equipment
            </button>
          </div>
        )}

        {/* ================= STEP 5: EQUIPMENT INVENTORY ================= */}
        {step === 5 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Equipment Inventory</h1>
              <p className="sub">
                Atlas Fit only programs exercises for gear you actually have available.
              </p>
            </div>

            {/* Location Tabs (Home vs Gym) */}
            <div className="seg" role="tablist" aria-label="Inventory Location">
              <button
                type="button"
                role="tab"
                aria-selected={equipmentTab === 'home'}
                aria-pressed={equipmentTab === 'home'}
                onClick={() => setEquipmentTab('home')}
              >
                Home Gear ({equipment.home.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={equipmentTab === 'gym'}
                aria-pressed={equipmentTab === 'gym'}
                onClick={() => setEquipmentTab('gym')}
              >
                Gym Gear ({equipment.gym.length})
              </button>
            </div>

            {/* Search and Quick Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                className="input"
                placeholder="Search equipment (e.g. barbell, bands)..."
                value={equipmentSearch}
                onChange={(e) => setEquipmentSearch(e.target.value)}
              />

              <div className="chips" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
                {['All', 'Home', 'Free weights', 'Cables', 'Push', 'Lower', 'Other', 'Cardio'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className="chip"
                    aria-pressed={equipmentCategory === cat}
                    style={{ whiteSpace: 'nowrap', minHeight: 44, padding: '6px 12px', fontSize: 13 }}
                    onClick={() => setEquipmentCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="row between" style={{ alignItems: 'center' }}>
              <span className="small">
                {equipment[equipmentTab].length} items selected for {equipmentTab === 'home' ? 'Home' : 'Gym'}
              </span>
              <button
                type="button"
                className="btn small-btn ghost"
                style={{ padding: '4px 10px', fontSize: 12 }}
                onClick={() => handleResetEquipment(equipmentTab)}
              >
                ↺ Reset Default
              </button>
            </div>

            {/* Equipment Chips Grid */}
            <div
              className="chips"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 'var(--radius)',
                padding: 12,
                maxHeight: '38dvh',
                overflowY: 'auto',
              }}
            >
              {filteredEquipment.length === 0 ? (
                <p className="small" style={{ margin: '8px 0', textAlign: 'center', width: '100%' }}>
                  No matching equipment found. Try clearing your search.
                </p>
              ) : (
                filteredEquipment.map((eq) => {
                  const isSelected = equipment[equipmentTab].includes(eq.id);
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      className="chip"
                      aria-pressed={isSelected}
                      style={{
                        minHeight: 44,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13.5,
                      }}
                      onClick={() => handleToggleEquipment(equipmentTab, eq.id)}
                    >
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{isSelected ? '✓' : '+'}</span>
                      <span>{eq.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Current Active Location Indicator */}
            <div className="banner" style={{ fontSize: 12 }}>
              Active training location: <strong>{activeLocation === 'home' ? 'Home' : 'Gym'}</strong>
              {trainPlace === 'both' && ' (You can toggle between Home & Gym anytime)'}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 6, minHeight: 50 }}
              onClick={() => {
                // Ensure at least bodyweight is present so planner functions cleanly
                if (!equipment[activeLocation] || equipment[activeLocation].length === 0) {
                  setEquipment((prev) => ({
                    ...prev,
                    [activeLocation]: ['bodyweight'],
                  }));
                }
                setStep(6);
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ================= STEP 6: TRAINING DAYS PER WEEK ================= */}
        {step === 6 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Training Days</h1>
              <p className="sub">
                How many days per week can you consistently commit to lifting?
              </p>
            </div>

            <div className="tiles">
              {DAYS_OPTIONS.map((item) => {
                const isSelected = daysPerWeek === item.days;
                return (
                  <button
                    key={item.days}
                    type="button"
                    className="tile"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectDays(item.days, item.defaultSchedule)}
                  >
                    <span className="t" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {item.title}
                      {isSelected && <span style={{ color: 'var(--action)', fontSize: 16 }}>✓</span>}
                    </span>
                    <span className="d">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 12, minHeight: 50 }}
              onClick={() => setStep(7)}
            >
              Continue
            </button>
          </div>
        )}

        {/* ================= STEP 7: SESSION LENGTH ================= */}
        {step === 7 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Session Length</h1>
              <p className="sub">
                How much time do you want to spend per workout session?
              </p>
            </div>

            <div className="tiles">
              {DURATION_OPTIONS.map((item) => {
                const isSelected = durationMin === item.min;
                return (
                  <button
                    key={item.min}
                    type="button"
                    className="tile"
                    aria-pressed={isSelected}
                    onClick={() => setDurationMin(item.min)}
                  >
                    <span className="t" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {item.title}
                      {isSelected && <span style={{ color: 'var(--action)', fontSize: 16 }}>✓</span>}
                    </span>
                    <span className="d">{item.description}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 12, minHeight: 50 }}
              onClick={() => setStep(8)}
            >
              Continue
            </button>
          </div>
        )}

        {/* ================= STEP 8: PREFERRED WEEKDAYS ================= */}
        {step === 8 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Preferred Weekdays</h1>
              <p className="sub">
                Select your {daysPerWeek} preferred workout days (tap to toggle):
              </p>
            </div>

            <div className="chips" style={{ gap: 10, justifyContent: 'center' }}>
              {ALL_WEEKDAYS.map((day) => {
                const isSelected = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    className="chip"
                    aria-pressed={isSelected}
                    style={{
                      minHeight: 48,
                      minWidth: 70,
                      padding: '12px 16px',
                      fontSize: 16,
                      fontWeight: 650,
                      textAlign: 'center',
                    }}
                    onClick={() => handleToggleWeekday(day)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="panel" style={{ textAlign: 'center' }}>
              <span className="small">
                Selected: <strong>{weekdays.length}</strong> of <strong>{daysPerWeek}</strong> target days ({weekdays.join(', ')})
              </span>
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 12, minHeight: 50 }}
              onClick={() => setStep(9)}
            >
              Continue
            </button>
          </div>
        )}

        {/* ================= STEP 9: MOVEMENT COMFORT & RESTRICTIONS ================= */}
        {step === 9 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Movement Comfort</h1>
              <p className="sub">
                Any movements causing discomfort, or joints advised to protect? We will safely exclude or substitute them.
              </p>
            </div>

            <div>
              <label className="small" style={{ fontWeight: 650, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>
                Common Sensitive Movement Patterns (tap to avoid):
              </label>
              <div className="chips">
                {COMMON_DISCOMFORT_AREAS.map((area) => {
                  const isSelected = selectedDiscomfort.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      className="chip"
                      aria-pressed={isSelected}
                      style={{ minHeight: 44, fontSize: 13.5 }}
                      onClick={() => handleToggleDiscomfortArea(area.id)}
                    >
                      {isSelected ? '🛡 ' : '+ '}{area.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <label htmlFor="discomfort-notes">Additional Discomfort Notes (optional):</label>
              <textarea
                id="discomfort-notes"
                className="input"
                placeholder="e.g. Right shoulder pain on overhead press; avoid heavy back squats."
                value={discomfortNotes}
                onChange={(e) => setDiscomfortNotes(e.target.value)}
                rows={3}
              />
              <span className="small" style={{ display: 'block', marginTop: 4 }}>
                Atlas Fit filters out exercises matching your notes without making medical claims.
              </span>
            </div>

            <div className="row" style={{ marginTop: 8, gap: 10 }}>
              <button
                type="button"
                className="btn ghost grow"
                style={{ minHeight: 48 }}
                onClick={handleSkipDiscomfort}
              >
                Skip (No Restrictions)
              </button>
              <button
                type="button"
                className="btn primary grow"
                style={{ minHeight: 48 }}
                onClick={() => setStep(10)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 10: OTHER PHYSICAL ACTIVITIES ================= */}
        {step === 10 && (
          <div className="step-container">
            <div>
              <h1 className="h-hero">Other Activities</h1>
              <p className="sub">
                Do you engage in other demanding sports? We account for this to balance weekly recovery.
              </p>
            </div>

            <div className="chips" style={{ gap: 10 }}>
              {OTHER_ACTIVITIES.map((act) => {
                const isSelected = selectedActivities.includes(act.id);
                return (
                  <button
                    key={act.id}
                    type="button"
                    className="chip"
                    aria-pressed={isSelected}
                    style={{ minHeight: 46, padding: '10px 16px', fontSize: 14 }}
                    onClick={() => handleToggleActivity(act.id)}
                  >
                    {isSelected ? '✓ ' : '+ '}{act.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn primary block"
              style={{ marginTop: 16, minHeight: 50 }}
              onClick={() => setStep(11)}
            >
              Generate Plan Preview →
            </button>
          </div>
        )}

        {/* ================= STEP 11: PROPOSED PLAN PREVIEW ================= */}
        {step === 11 && (
          <div className="step-container">
            <div className="banner" style={{ borderLeftColor: 'var(--action)' }}>
              <strong>Adaptive Plan Generated</strong> · Engineered deterministically to your schedule & equipment.
            </div>

            <div>
              <h1 className="h-hero">{generatedPlan.split}</h1>
              <p className="sub">
                {generatedPlan.days.length} Days/wk · {durationMin} min sessions · {activeLocation.toUpperCase()} gear
              </p>
            </div>

            {/* "Why this plan?" plain-English card */}
            <div className="panel" style={{ borderLeft: '3.5px solid var(--action)' }}>
              <div
                className="row between"
                style={{ cursor: 'pointer' }}
                onClick={() => setShowExplanation((prev) => !prev)}
              >
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ color: 'var(--action)', fontWeight: 700, fontSize: 13.5 }}>
                    WHY THIS PLAN?
                  </span>
                  <span className="small">({generatedPlan.explanation.length} rules decisions)</span>
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  {showExplanation ? '▲ Hide' : '▼ Details'}
                </span>
              </div>
              {showExplanation && (
                <ul
                  style={{
                    margin: '10px 0 0',
                    paddingLeft: 18,
                    color: 'var(--text-2)',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  {generatedPlan.explanation.map((item, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Weekly Plan Day Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {generatedPlan.days.map((day) => (
                <div key={day.id} className="daycard">
                  <header
                    className="row between"
                    style={{
                      background: 'var(--surface-2)',
                      padding: '12px 14px',
                    }}
                  >
                    <div>
                      <div className="d" style={{ fontWeight: 700, fontSize: '15.5px' }}>
                        {day.label}
                      </div>
                      <div className="f" style={{ fontSize: '12.5px', color: 'var(--text-2)', marginTop: 2 }}>
                        {day.focus} · {day.exercises.length} movements
                      </div>
                    </div>
                  </header>

                  <div style={{ padding: '4px 0' }}>
                    {day.exercises.map((plannedEx, exIdx) => {
                      const ex = CATALOG_BY_ID[plannedEx.exerciseId];

                      return (
                        <div
                          key={`${plannedEx.exerciseId}-${exIdx}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderBottom:
                              exIdx < day.exercises.length - 1
                                ? '1px solid var(--hairline)'
                                : 'none',
                          }}
                        >
                          {ex ? <ExercisePicture exercise={ex} /> : <span className="exercise-picture small"><Icon name="exercise" /></span>}

                          {/* Exercise meta */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--text)' }}>
                              {ex?.name ?? plannedEx.exerciseId}
                            </div>
                            <div className="small" style={{ color: 'var(--action)', marginTop: 2 }}>
                              {plannedEx.sets} sets × {plannedEx.reps} · {plannedEx.restSec}s rest
                            </div>
                            {plannedEx.reason && (
                              <div
                                className="small"
                                style={{
                                  color: 'var(--text-2)',
                                  marginTop: 3,
                                  fontStyle: 'italic',
                                }}
                              >
                                "{plannedEx.reason}"
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Large "Start Training" Button */}
            <div style={{ marginTop: 20, marginBottom: 40 }}>
              {saveError && <p className="error-message" role="alert">{saveError}</p>}
              <button
                type="button"
                className="btn primary block"
                style={{ minHeight: 54, fontSize: 18, fontWeight: 700 }}
                onClick={handleStartTraining}
                disabled={isSaving}
              >
                {isSaving ? 'Saving Your Plan...' : 'Start Training →'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
