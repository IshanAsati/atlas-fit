import type { TrainingBlockSettings, WorkoutSession } from '../../data/types';

export interface TrainingBlockPhase {
  week: number;
  totalWeeks: number;
  phase: 'build' | 'deload' | 'complete' | 'not-started' | 'off';
  title: string;
  volumeFactor: number;
  loadFactor: number;
  repBonus: number;
  note: string;
}

const DAY_MS = 86_400_000;
const DELOAD_REASON = 'Training block deload:';

// Encode local calendar components as UTC days, never subtract local timestamps.
function calendarDay(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() / DAY_MS;
}

function parseStartDate(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const encoded = calendarDay(year, month, day);
  const date = new Date(encoded * DAY_MS);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? encoded : undefined;
}

export function isValidTrainingBlockStartDate(value: string): boolean {
  return parseStartDate(value) !== undefined;
}

export function getTrainingBlockPhase(
  settings?: TrainingBlockSettings,
  now: Date = new Date(),
): TrainingBlockPhase {
  const totalWeeks = settings && [4, 6, 8].includes(settings.lengthWeeks) ? settings.lengthWeeks : 0;
  const baseline: TrainingBlockPhase = {
    week: 0, totalWeeks, phase: 'off', title: 'Training block off',
    volumeFactor: 1, loadFactor: 1, repBonus: 0,
    note: 'Your usual workout targets apply. Enable a block to follow a multi-week training plan.',
  };
  if (!settings?.enabled) return baseline;
  const start = parseStartDate(settings.startDate);
  if (start === undefined || !totalWeeks || !Number.isFinite(now.getTime())) {
    return { ...baseline, note: 'Choose a valid start date and a 4, 6, or 8-week length before enabling this block.' };
  }
  const elapsedDays = calendarDay(now.getFullYear(), now.getMonth() + 1, now.getDate()) - start;
  if (elapsedDays < 0) {
    return { ...baseline, phase: 'not-started', title: 'Training block not started',
      note: `Your ${totalWeeks}-week block starts on ${settings.startDate}. Until then, usual workout targets apply.` };
  }
  if (elapsedDays >= totalWeeks * 7) {
    return { ...baseline, week: totalWeeks, phase: 'complete', title: 'Training block complete',
      note: `Your ${totalWeeks}-week block is complete. Review your logged progress, then explicitly restart and save a new block when ready. Blocks do not repeat automatically.` };
  }
  const week = Math.floor(elapsedDays / 7) + 1;
  if (settings.deloadLastWeek && week === totalWeeks) {
    return { ...baseline, week, phase: 'deload', title: `Week ${week} of ${totalWeeks} · Deload`,
      volumeFactor: 0.5, loadFactor: 0.85,
      note: 'Finish the block with about half the working sets (rounded up, at least one) and a suggested 15% lighter load. Reps and rest stay the same. This applies only to new workouts; logged performance stays unchanged.' };
  }
  const buildWeeks = totalWeeks - (settings.deloadLastWeek ? 1 : 0);
  let note: string;
  if (week === 1) {
    note = 'Establish your baseline this week: keep usual sets, choose manageable loads, and log reps and effort. Later weeks use this history, not automatic weight increases.';
  } else if (week === buildWeeks) {
    note = `Consolidate the progress from weeks 1–${week - 1} and compare your logs with your baseline. Progress targets only when previous reps and effort support it; keep the same targets otherwise.${settings.deloadLastWeek ? ' Next week is a lighter deload.' : ' Review the block after this week; restarting is your choice.'}`;
  } else {
    note = `Build on week ${week - 1}: use logged reps and effort to consolidate your targets. Progress only when your previous performance supports it; otherwise repeat the targets. Usual set counts stay unchanged.`;
  }
  return { ...baseline, week, phase: 'build', title: `Week ${week} of ${totalWeeks} · Build`, note };
}

/**
 * Call once, before persisting a NEW session. Never call on a resumed session.
 * Existing recorded performance is refused as a second guard against history edits.
 * Load suggestions consume getTrainingBlockPhase().loadFactor separately; no load
 * or reps are invented here, and the stored plan/routine remains unchanged.
 */
export function applyTrainingBlockToSession(
  session: WorkoutSession,
  settings?: TrainingBlockSettings,
  now?: Date,
): WorkoutSession {
  const block = getTrainingBlockPhase(settings, now);
  if (block.phase !== 'deload' || session.state !== 'active' || session.endedAt !== undefined
    || session.pausedAt !== undefined || (session.pausedMs ?? 0) > 0
    || session.items.some((item) => item.skipped || item.discomfort
      || item.planned?.reason.includes(DELOAD_REASON)
      || item.sets.some((set) => set.done || set.reps != null || set.loadKg != null || set.effort !== undefined))) {
    return session;
  }
  return {
    ...session,
    items: session.items.map((item) => {
      const workingCount = item.sets.filter((set) => set.kind !== 'warmup').length;
      const baselineCount = item.planned?.sets ?? workingCount;
      const target = Math.max(1, Math.ceil(baselineCount * block.volumeFactor));
      let retained = 0;
      return {
        ...item,
        planned: item.planned ? { ...item.planned, sets: target,
          reason: `${item.planned.reason}${item.planned.reason ? ' ' : ''}${DELOAD_REASON} fewer working sets in week ${block.week} of ${block.totalWeeks}; reps and rest unchanged.` } : undefined,
        sets: item.sets.filter((set) => set.kind === 'warmup' || retained++ < target).map((set) => ({ ...set })),
      };
    }),
  };
}
