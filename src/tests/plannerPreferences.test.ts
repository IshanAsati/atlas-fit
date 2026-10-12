import { describe, expect, it } from 'vitest';
import { CATALOG } from '../data/catalog';
import { DEFAULT_EQUIPMENT } from '../data/equipment';
import type { Exercise, MuscleId, UserProfile } from '../data/types';
import { generatePlan } from '../features/planner/engine';
import { isExerciseEligible, validatePlan } from '../features/planner/validator';
import { createWeekState } from '../features/planner/weekSelection';

const profile: UserProfile = {
  displayName: 'Test', goal: 'strength', experience: 'some', activeLocation: 'gym',
  equipment: DEFAULT_EQUIPMENT, daysPerWeek: 3, durationMin: 30,
  weekdays: ['Mon', 'Wed', 'Fri'], restrictions: [], discomfortNotes: '',
  otherSports: '', liked: [], disliked: [], pinned: [], favourites: [], onboarded: true,
};
const byId = new Map(CATALOG.map((ex) => [ex.id, ex]));
const selected = (input: UserProfile, catalog = CATALOG) =>
  generatePlan(input, catalog).days.flatMap((day) => day.exercises.map((item) => item.exerciseId));

describe('Planner focus and hard boundaries', () => {
  it('keeps both barbell and Smith machine out even when available and pinned', () => {
    const input: UserProfile = {
      ...profile,
      equipment: { ...profile.equipment, gym: [...profile.equipment.gym, 'smith-machine'] },
      avoidEquipment: ['barbell', 'smith-machine'],
      pinned: ['barbell-back-squat', 'smith-machine-squat'],
    };
    const plan = generatePlan(input, CATALOG);
    for (const id of plan.days.flatMap((day) => day.exercises.map((item) => item.exerciseId))) {
      expect(byId.get(id)?.equipmentIds).not.toContain('barbell');
      expect(byId.get(id)?.equipmentIds).not.toContain('smith-machine');
    }
    expect(validatePlan(plan, input, CATALOG).issues).toEqual([]);
    expect(plan.explanation.join(' ')).toContain('Equipment excluded:');
  });

  it('does not reintroduce an avoided exercise to fill an otherwise empty plan', () => {
    const exercise = CATALOG.find((ex) => ex.id === 'push-up')!;
    const input = { ...profile, restrictions: [exercise.id], pinned: [exercise.id] };
    expect(selected(input, [exercise])).toEqual([]);
    expect(generatePlan(input, [exercise]).explanation.join(' ')).toContain('fewer exercises');
  });

  it('excludes imported Smith variations, not just the curated squat', () => {
    const smithExercises = CATALOG.filter((ex) => /\bsmith\b/i.test(ex.name));
    expect(smithExercises.length).toBeGreaterThan(1);
    const input: UserProfile = {
      ...profile, experience: 'experienced', avoidEquipment: ['smith-machine'],
      equipment: { ...profile.equipment, gym: [...profile.equipment.gym, 'smith-machine'] },
    };
    for (const ex of smithExercises) expect(isExerciseEligible(ex, input), ex.name).toBe(false);
  });

  it('never relaxes equipment avoidance when the pool is empty', () => {
    const exercise = CATALOG.find((ex) => ex.id === 'db-goblet-squat')!;
    expect(selected({ ...profile, avoidEquipment: ['dumbbells'] }, [exercise])).toEqual([]);
    const adjustable: Exercise = { ...exercise, equipmentIds: ['adj-dumbbells'] };
    expect(isExerciseEligible(adjustable, { ...profile, avoidEquipment: ['dumbbells'] })).toBe(false);
  });

  it('treats a landmine anchor and its bar as separate equipment requirements', () => {
    const exercise = byId.get('landmine-rotation')!;
    expect(isExerciseEligible(exercise, { ...profile, equipment: { ...profile.equipment, gym: ['landmine'] } })).toBe(false);
    expect(isExerciseEligible(exercise, { ...profile, equipment: { ...profile.equipment, gym: ['landmine', 'barbell'] }, avoidEquipment: ['barbell'] })).toBe(false);
    expect(isExerciseEligible(exercise, { ...profile, equipment: { ...profile.equipment, gym: ['landmine', 'barbell'] } })).toBe(true);
  });

  it.each<MuscleId[]>([['abs'], ['calves'], ['abs', 'obliques'], ['quads', 'hamstrings', 'glutes', 'calves']])(
    'covers requested %j focus in short sessions when options exist', (...targetMuscles) => {
      const plan = generatePlan({ ...profile, targetMuscles }, CATALOG);
      const primaries = plan.days.flatMap((day) => day.exercises.flatMap((item) => byId.get(item.exerciseId)?.primary ?? []));
      for (const muscle of targetMuscles) expect(primaries).toContain(muscle);
      expect(validatePlan(plan, { ...profile, targetMuscles }, CATALOG).issues).toEqual([]);
    },
  );

  it('explains unavailable focus without violating boundaries', () => {
    const input: UserProfile = { ...profile, targetMuscles: ['calves'] };
    const limited = CATALOG.filter((ex) => ex.id === 'push-up');
    const plan = generatePlan(input, limited);
    expect(plan.explanation.join(' ')).toContain('Could not fit Calves focus');
    expect(plan.days.every((day) => day.exercises.every((item) => item.exerciseId === 'push-up'))).toBe(true);
  });

  it('prescribes seconds for static holds instead of imaginary repetitions', () => {
    const holds = CATALOG.filter((ex) => ['wall-sit', 'plank', 'side-plank'].includes(ex.id));
    const plan = generatePlan({ ...profile, activeLocation: 'home' }, holds);
    for (const day of plan.days) for (const item of day.exercises) {
      expect(item.reps).toMatch(/s hold$/);
    }
    expect(plan.days[0].exercises.length).toBeGreaterThan(0);
  });

  it('prefers controlled strength lifts to ballistic drills in a broad pool', () => {
    const plan = generatePlan({ ...profile, activeLocation: 'home', durationMin: 45 }, CATALOG);
    const names = plan.days.flatMap((day) => day.exercises.map((item) => byId.get(item.exerciseId)?.name ?? ''));
    expect(names.some((name) => /\b(jumps?|jumping|burpees?)\b/i.test(name))).toBe(false);
  });

  it('programs range-of-motion work for a mobility goal instead of strength lifts', () => {
    const plan = generatePlan({ ...profile, goal: 'mobility', activeLocation: 'home', durationMin: 45 }, CATALOG);
    const exercises = plan.days.flatMap((day) => day.exercises);
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.every((item) => byId.get(item.exerciseId)?.movement === 'mobility')).toBe(true);
    expect(plan.explanation.join(' ')).toContain('Mobility sessions prioritise');
  });

  it('is independent of catalogue ordering and does not mutate input preferences', () => {
    const input: UserProfile = { ...profile, targetMuscles: ['abs'], avoidEquipment: ['barbell'] };
    const original = structuredClone(input);
    expect(generatePlan(input, CATALOG)).toEqual(generatePlan(input, [...CATALOG].reverse()));
    expect(input).toEqual(original);
  });

  it('counts history rotation once per completed session and ignores skipped items', () => {
    const history = [{
      id: 'done', title: 'Done', location: 'gym' as const, startedAt: 1, state: 'done' as const,
      items: [{ exerciseId: 'push-up', sets: [] }, { exerciseId: 'push-up', sets: [] }, { exerciseId: 'plank', sets: [], skipped: true }],
    }, {
      id: 'active', title: 'Active', location: 'gym' as const, startedAt: 2, state: 'active' as const,
      items: [{ exerciseId: 'push-up', sets: [] }],
    }];
    expect([...createWeekState(history).recentUse]).toEqual([['push-up', 1]]);
  });
});
