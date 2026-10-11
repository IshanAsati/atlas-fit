import type { Exercise, Movement, MuscleId } from './types';

/**
 * RepDB Free import + normalisation layer (§6.1, §8.2).
 *
 * The `@repdb/exercises` package ships 609 local entries (no runtime API)
 * with snake_case anatomy (`primary_muscles`), a single `equipment` string,
 * word difficulties and `instructions_en`. Dataset vocabularies disagree with
 * our canonical muscle/equipment taxonomy, so every imported entry passes
 * through `normaliseRepdbEntry` and is flagged `needsReview` when the mapping
 * is uncertain. Only confident entries are eligible for planning; the rest
 * are browse-only in the library.
 *
 * Licensing: Free in-app personal/commercial use requires visible attribution
 * ("Exercise data by RepDB (repdb.co)" + link). Raw dataset redistribution is
 * prohibited, and RepDB images must NOT be used to condition generative-AI
 * restyles. See LICENSE-DATA in the package before shipping.
 */

export const REPDB_CREDIT = 'Exercise data by RepDB (repdb.co)';
export const REPDB_URL = 'https://repdb.co/npm-exercise-dataset/';

/** Raw RepDB entry shape (fields we consume; tolerant to schema drift). */
export interface RawRepdb {
  id: string;
  name_en?: string;
  category?: string;
  force_type?: string;
  mechanic?: string;
  difficulty?: string;
  equipment?: string;
  body_part?: string;
  primary_muscles?: string[];
  secondary_muscles?: string[];
  tags?: string[];
  instructions_en?: string[];
  tips_en?: string[];
  images?: { flat?: { start?: string; peak?: string; main?: string } };
}

export interface NormalisedRepdb {
  exercise: Exercise;
  /** True when muscle/equipment mapping was guessed and wants human review. */
  needsReview: boolean;
  notes: string[];
}

/** RepDB muscle vocabulary → canonical MuscleId. */
const MUSCLE_MAP: Record<string, MuscleId> = {
  pectoralis_major: 'chest',
  pectoralis_minor: 'chest',
  anterior_deltoid: 'front_delts',
  lateral_deltoid: 'side_delts',
  posterior_deltoid: 'rear_delts',
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  triceps_brachii: 'triceps',
  forearm_flexors: 'forearms',
  forearm_extensors: 'forearms',
  forearms: 'forearms',
  brachioradialis: 'forearms',
  rectus_abdominis: 'abs',
  transverse_abdominis: 'abs',
  obliques: 'obliques',
  trapezius: 'traps',
  rhomboids: 'upper_back',
  latissimus_dorsi: 'lats',
  erector_spinae: 'erectors',
  gluteus_maximus: 'glutes',
  gluteus_medius: 'glutes',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  gastrocnemius: 'calves',
  soleus: 'calves',
  hip_flexors: 'quads',
  adductors: 'quads',
  abductors: 'glutes',
  // Teaching approximations for deep stabilisers (documented, reviewable):
  serratus_anterior: 'chest', // pushing/protraction stabiliser
  quadratus_lumborum: 'obliques', // lateral trunk stabiliser
  // supraspinatus intentionally unmapped → human review (rotator cuff ≠ delt)
};

/** RepDB equipment string → exact equipment ids. Unknown → null (review). */
const EQUIPMENT_MAP: Record<string, string[]> = {
  bodyweight: ['bodyweight'],
  dumbbell: ['dumbbells'],
  barbell: ['barbell'],
  ez_bar: ['barbell'],
  kettlebell: ['kettlebell'],
  resistance_band: ['bands'],
  loop_band: ['bands'],
  cable: ['cable'],
  pull_up_bar: ['pullup-bar'],
  flat_bench: ['bench'],
  decline_bench: ['bench'],
  ab_wheel: ['ab-wheel'],
  suspension_trainer: ['suspension'],
  lat_pulldown_machine: ['lat-pulldown'],
  seated_row_machine: ['seated-row'],
  chest_press_machine: ['chest-press'],
  shoulder_press_machine: ['shoulder-press'],
  pec_deck: ['pec-deck'],
  dip_bars: ['dip-station'],
  dip_machine: ['dip-station'],
  dip_station: ['dip-station'],
  assisted_pullup_machine: ['assisted-pullup'],
  leg_press: ['leg-press'],
  leg_extension: ['leg-extension'],
  leg_curl: ['leg-curl'],
  calf_raise_machine: ['calf-raise'],
  standing_calf_raise_machine: ['calf-raise'],
  seated_calf_raise_machine: ['calf-raise'],
  donkey_calf_raise_machine: ['calf-raise'],
  hip_thrust_machine: ['hip-thrust'],
  hip_abduction_machine: ['adductor'],
  hip_adduction_machine: ['adductor'],
  chest_fly_machine: ['pec-deck'],
  preacher_bench: ['preacher', 'dumbbells'],
  preacher_curl_machine: ['preacher', 'dumbbells'],
  back_extension_bench: ['back-extension'],
  back_extension_machine: ['back-extension'],
  smith_machine: ['smith-machine'],
  hack_squat: ['hack-squat'],
  stability_ball: ['stability-ball'],
  plyo_box: ['chair'],
  rings: ['suspension'],
  trap_bar: ['barbell'],
  plates: ['dumbbells'],
  treadmill: ['treadmill'],
  rower: ['rower'],
  stationary_bike: ['cycle'],
  air_bike: ['cycle'],
  step_platform: ['chair'],
  yoga_mat: ['mat'],
  medicine_ball: ['bodyweight'],
  swiss_ball: ['mat'],
};

function movementFor(raw: RawRepdb): { movement: Movement; confident: boolean } {
  const tags = raw.tags ?? [];
  const haystack = `${raw.id} ${raw.name_en ?? ''} ${raw.body_part ?? ''} ${tags.join(' ')}`.toLowerCase();
  if (raw.category === 'stretching' || /stretch|mobility|yoga|pose|warrior|pilates|-dog\b|downward-dog|upward-dog/.test(haystack)) {
    return { movement: 'mobility', confident: true };
  }
  if (/clean|snatch/.test(haystack)) return { movement: 'hinge', confident: true };
  if (/jerk/.test(haystack)) return { movement: 'vpush', confident: true };
  if (/thruster|tabletop/.test(haystack)) return { movement: raw.id.includes('tabletop') ? 'hinge' : 'squat', confident: true };
  if (raw.category === 'plyometrics' || /wall-sit|lateral-walk|monster-walk/.test(haystack)) {
    return { movement: 'squat', confident: true };
  }
  if (/l-sit|bear-crawl/.test(haystack)) return { movement: 'core', confident: true };
  if (raw.category === 'cardio') {
    // Conditioning work prescribes badly as sets×reps strength work —
    // browse-only until a conditioning prescription exists.
    return { movement: 'carry', confident: false };
  }
  if (/farmer|carry| loaded /.test(haystack) || /^(treadmill|rower|.*bike|walk)/.test(raw.equipment ?? '')) {
    return { movement: 'carry', confident: true };
  }
  if (raw.body_part === 'core' || /plank|crunch|sit-up|rollout|rotation|dead-bug|mountain/.test(haystack)) {
    return { movement: 'core', confident: true };
  }
  if (/deadlift|hinge|good-morning|hip-thrust|glute-bridge|leg-curl|back-extension|swing|hyperextension/.test(haystack)) {
    return { movement: 'hinge', confident: true };
  }
  if (/squat|lunge|leg-press|step-up|leg-extension|split-squat|bulgarian/.test(haystack)) {
    return { movement: 'squat', confident: true };
  }
  if (
    /pull-up|chin-up|pulldown|pullover|shrug|face-pull/.test(haystack) ||
    (/pull/.test(haystack) && /overhead|vertical/.test(haystack))
  ) {
    return { movement: 'vpull', confident: true };
  }
  if (/row|curl|pull|shrug/.test(haystack) || raw.force_type === 'pull') {
    return { movement: 'hpull', confident: raw.mechanic !== undefined };
  }
  if (/overhead|shoulder-press|pike|handstand|dip|push-up.*pike/.test(haystack)) {
    return { movement: 'vpush', confident: true };
  }
  if (/press|push|dip|fly|pushdown|extension|raise/.test(haystack) || raw.force_type === 'push') {
    return { movement: /raise|lateral|front-raise/.test(haystack) ? 'accessory' : 'hpush', confident: true };
  }
  if (raw.mechanic === 'isolation') return { movement: 'accessory', confident: true };
  return { movement: 'accessory', confident: false };
}

function difficultyFor(raw: RawRepdb): 1 | 2 | 3 {
  if (raw.difficulty === 'advanced') return 3;
  if (raw.difficulty === 'intermediate') return 2;
  return 1;
}

export function normaliseRepdbEntry(raw: RawRepdb, cdnBase: string): NormalisedRepdb {
  const notes: string[] = [];
  const id = `repdb-${raw.id}`;
  const name = raw.name_en?.trim() || raw.id;

  const primary: MuscleId[] = [];
  for (const m of raw.primary_muscles ?? []) {
    const mapped = MUSCLE_MAP[m];
    if (mapped && !primary.includes(mapped)) primary.push(mapped);
    else if (!mapped) notes.push(`Unmapped primary muscle "${m}"`);
  }
  const secondary: MuscleId[] = [];
  for (const m of raw.secondary_muscles ?? []) {
    const mapped = MUSCLE_MAP[m];
    if (mapped && !primary.includes(mapped) && !secondary.includes(mapped)) secondary.push(mapped);
    else if (!mapped) notes.push(`Unmapped secondary muscle "${m}"`);
  }
  if (primary.length === 0) {
    primary.push('abs');
    notes.push('No confident primary muscle — defaulted, review required');
  }

  let equipmentIds: string[] = [];
  const equipKey = (raw.equipment ?? '').trim().toLowerCase();
  if (equipKey === '' || equipKey === 'none') {
    equipmentIds = ['bodyweight'];
  } else {
    const mapped = EQUIPMENT_MAP[equipKey];
    if (!mapped) {
      notes.push(`Unmapped equipment "${raw.equipment}" — excluded from planning until reviewed`);
    } else {
      equipmentIds = mapped;
    }
  }

  const { movement, confident } = movementFor(raw);
  if (!confident) notes.push('Movement pattern uncertain — review required');

  const flat = raw.images?.flat;
  const media =
    flat?.start || flat?.peak
      ? {
          ...(flat.start ? { start: `${cdnBase}${flat.start}` } : {}),
          ...(flat.peak ? { peak: `${cdnBase}${flat.peak}` } : {}),
        }
      : undefined;

  const exercise: Exercise = {
    id,
    name,
    aliases: [],
    source: 'repdb',
    equipmentIds,
    movement,
    difficulty: difficultyFor(raw),
    primary,
    secondary,
    instructions: (raw.instructions_en ?? []).slice(0, 8),
    cues: (raw.tips_en ?? []).slice(0, 3),
    mistakes: [],
    substitutes: [],
    ...(media ? { media } : {}),
  };
  const needsReview = notes.length > 0 || equipmentIds.length === 0;
  return { exercise, needsReview, notes };
}

/** Cached load result for the session (avoids re-parsing). */
let cache: NormalisedRepdb[] | null = null;

/**
 * Load + normalise the RepDB Free dataset if the package is installed.
 * Never throws: returns an empty list when unavailable (offline-safe).
 */
export async function loadRepdbCatalog(): Promise<NormalisedRepdb[]> {
  if (cache) return cache;
  try {
    const mod = (await import('@repdb/exercises')) as unknown as {
      exercises?: RawRepdb[];
      packageVersion?: string;
    };
    const list = Array.isArray(mod.exercises) ? mod.exercises : [];
    const cdnBase = `https://cdn.jsdelivr.net/npm/@repdb/exercises@${mod.packageVersion ?? 'latest'}/`;
    cache = list.map((raw) => normaliseRepdbEntry(raw, cdnBase));
    return cache;
  } catch {
    cache = [];
    return cache;
  }
}

/** RepDB entries confident enough to be eligible for plan generation. */
export function planningEligible(entries: NormalisedRepdb[]): Exercise[] {
  return entries
    .filter((e) => !e.needsReview && e.exercise.equipmentIds.length > 0)
    .map((e) => e.exercise);
}
