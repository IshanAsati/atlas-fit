import type { MuscleId } from '../../data/types';

/**
 * Original hand-authored cartoon Bodygraph geometry (§5.2, §4.6).
 *
 * Faceless, rounded, segmented anatomical cartoon on a white base — styled
 * after the approved visual study (red primaries, purple secondaries, light
 * neutral base), drawn from scratch in code. Not traced from any existing app.
 *
 * Every muscle group has a stable ID and independent shapes. Groups spanning
 * several segments (abs six-pack, quad heads, calf heads) use one entry per
 * segment sharing a single ID and colour, which also gives the segmented look
 * from the study. Canvas: 0 0 200 400.
 *
 * Construction notes: limb bases are narrow and each muscle shape fills ~80%
 * of its limb (thin base outline only). Arms tuck under the torso (painted
 * after the arms) so there is no floating gap at the armpit. Limbs taper and
 * drift slightly outward going down; the torso pinches at the waist.
 */

export type View = 'front' | 'back';

export interface MuscleShape {
  /** Canonical muscle ID (shared across segments/sides). */
  id: MuscleId;
  /** Side suffix for accessible labels; both sides share colour/selection. */
  side?: 'left' | 'right';
  ellipse?: [cx: number, cy: number, rx: number, ry: number];
  path?: string;
}

const E = (
  id: MuscleId,
  side: 'left' | 'right' | undefined,
  c: [number, number, number, number],
): MuscleShape => ({ id, side, ellipse: c });

const P = (id: MuscleId, side: 'left' | 'right' | undefined, d: string): MuscleShape => ({
  id,
  side,
  path: d,
});

type Side = 'left' | 'right';

/** Mirror an X coordinate across the body's vertical centre (x = 100). */
const mx = (x: number): number => 200 - x;

/**
 * Mirror a path with absolute M/L/Q/Z segments across x = 100.
 * All hand-authored shapes below use only these commands.
 */
function mirrorPath(d: string): string {
  return d
    .split(/(?=[MLQZ])/g)
    .map((seg) => {
      const cmd = seg[0];
      const nums = seg.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const out: number[] = [];
      for (let i = 0; i < nums.length; i += 2) {
        out.push(mx(nums[i]), nums[i + 1]);
      }
      return `${cmd}${out.join(' ')}`;
    })
    .join(' ');
}

/** Rounded-rectangle path (abs segments). */
function rrect(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} ` +
    `L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} ` +
    `L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} ` +
    `L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`
  );
}

/** Mirror a left-side list into full left+right shape lists. */
function mirrorLeft(list: MuscleShape[]): MuscleShape[] {
  const right = list
    .filter((s) => s.side === 'left')
    .map((s): MuscleShape =>
      s.path
        ? { id: s.id, side: 'right' as Side, path: mirrorPath(s.path) }
        : {
            id: s.id,
            side: 'right' as Side,
            ellipse: [mx(s.ellipse![0]), s.ellipse![1], s.ellipse![2], s.ellipse![3]],
          },
    );
  return [...list.filter((s) => s.side !== 'right'), ...right];
}

/* ------------------------------- FRONT ------------------------------- */

const FRONT_LEFT: MuscleShape[] = [
  // Front deltoid cap (shoulder)
  P('front_delts', 'left', 'M52 70 Q54 56 71 54 L85 57 Q81 76 67 81 Q54 84 52 70 Z'),
  // Outer side-delt sliver
  E('side_delts', 'left', [48, 80, 5, 10]),
  // Pectoral slab (centre sternum gap preserved by mirroring)
  P(
    'chest',
    'left',
    'M65 77 Q81 68 97 74 L96 94 Q94 105 82 108 Q69 107 64 95 Q60 85 65 77 Z',
  ),
  // Biceps mass (fills the upper arm)
  P(
    'biceps',
    'left',
    'M50 94 Q45 120 49 144 Q51 151 57 150 Q63 149 63 140 L62 100 Q58 92 50 94 Z',
  ),
  // Forearm (tapered, fills the lower arm)
  P(
    'forearms',
    'left',
    'M49 152 L66 152 L61 200 Q60 206 55 205 Q50 204 49 196 Z',
  ),
  // Oblique strip
  P('obliques', 'left', 'M75 111 Q70 133 73 162 L81 162 Q79 136 82 113 Z'),
  // Quad heads: outer sweep, centre mass, inner teardrop
  P('quads', 'left', 'M72 210 Q68 238 72 263 Q74 269 78 268 Q81 267 81 257 L81 214 Z'),
  P('quads', 'left', 'M82 208 L94 208 L93 261 Q92 269 87 269 Q82 269 82 259 Z'),
  P('quads', 'left', 'M73 249 Q78 241 84 246 Q89 253 84 264 Q78 268 73 264 Z'),
  // Calf heads
  E('calves', 'left', [79, 312, 6, 18]),
  E('calves', 'left', [86, 314, 5, 16]),
];

/** Abs six-pack: 3 rows × 2 rounded columns, shared `abs` id. */
const ABS_SEGMENTS: MuscleShape[] = [114, 129, 144].flatMap((y): MuscleShape[] => [
  { id: 'abs', side: 'left' as Side, path: rrect(85, y, 13, 13, 4.5) },
  { id: 'abs', side: 'right' as Side, path: rrect(102, y, 13, 13, 4.5) },
]);

export const FRONT_SHAPES: MuscleShape[] = [...mirrorLeft(FRONT_LEFT), ...ABS_SEGMENTS];

/* -------------------------------- BACK -------------------------------- */

const BACK_LEFT: MuscleShape[] = [
  // Trapezius half-kite (right twin added below)
  P('traps', undefined, 'M87 52 L100 58 L100 106 L90 104 L76 70 Q80 56 87 52 Z'),
  // Rear delt cap
  P('rear_delts', 'left', 'M52 72 Q55 58 72 56 L84 60 Q80 78 66 82 Q54 85 52 72 Z'),
  E('side_delts', 'left', [48, 82, 5, 10]),
  // Triceps (long + lateral head)
  P(
    'triceps',
    'left',
    'M51 96 Q47 122 51 143 Q53 150 58 149 Q63 148 63 140 L62 102 Q58 94 51 96 Z',
  ),
  P('triceps', 'left', 'M64 104 Q67 122 65 139 Q64 145 61 144 Q58 143 58 137 Z'),
  // Forearm extensors
  P('forearms', 'left', 'M49 154 L66 154 L61 202 Q60 207 54 206 Q49 205 48 197 Z'),
  // Lat wing
  P('lats', 'left', 'M66 90 Q58 121 66 153 L76 162 L86 154 Q79 123 82 94 Z'),
  // Upper back (rhomboid diamond)
  P('upper_back', 'left', 'M83 99 L95 108 L86 131 L77 115 Z'),
  // Erector column
  P('erectors', 'left', 'M87 135 L94 135 L93 177 L86 177 Z'),
  // Glute
  P(
    'glutes',
    'left',
    'M72 189 Q72 177 87 177 L96 180 L95 205 Q86 212 77 207 Q72 200 72 189 Z',
  ),
  // Hamstrings: outer + inner belly
  P('hamstrings', 'left', 'M72 210 Q68 238 73 263 Q75 269 79 268 Q82 267 82 257 L81 214 Z'),
  P('hamstrings', 'left', 'M83 212 L92 212 L91 261 Q90 267 86 267 Q82 267 82 257 Z'),
  // Calf heads
  E('calves', 'left', [79, 314, 6, 18]),
  E('calves', 'left', [86, 316, 5, 16]),
];

export const BACK_SHAPES: MuscleShape[] = [
  ...mirrorLeft(BACK_LEFT),
  // Traps right twin (centre shape mirrored manually)
  P('traps', undefined, 'M113 52 L100 58 L100 106 L110 104 L124 70 Q120 56 113 52 Z'),
];

export const SHAPES_BY_VIEW: Record<View, MuscleShape[]> = {
  front: FRONT_SHAPES,
  back: BACK_SHAPES,
};

/**
 * Non-interactive base. Paint order matters: arms and legs first, torso over
 * the arms (hides the armpit seam), then head, hands and feet.
 */
export function Silhouette({ view }: { view: View }) {
  const skin = '#f2f0f7';
  const shade = '#e0dcee';
  const hair = '#b9b4cc';
  const line = '#cfccdd';

  // Left-side limb bases; right sides are mirrored in code.
  const upperArmL = 'M52 68 L72 66 L69 150 L49 150 Z';
  const forearmL = 'M49 148 L69 148 L65 204 L47 204 Z';
  const thighL = 'M71 206 L97 206 L94 276 L74 276 Z';
  const shinL = 'M75 289 L93 289 L90 354 L78 354 Z';

  return (
    <g aria-hidden="true">
      {/* Arms (torso will cover their inner edge) */}
      <path d={upperArmL} fill={shade} />
      <path d={mirrorPath(upperArmL)} fill={shade} />
      <path d={forearmL} fill={skin} />
      <path d={mirrorPath(forearmL)} fill={skin} />
      {/* Legs */}
      <path d={thighL} fill={shade} />
      <path d={mirrorPath(thighL)} fill={shade} />
      {/* Knees */}
      <circle cx="85" cy="283" r="7.5" fill={skin} />
      <circle cx="115" cy="283" r="7.5" fill={skin} />
      <path d={shinL} fill={skin} />
      <path d={mirrorPath(shinL)} fill={skin} />
      {/* Torso: broad shoulders tapering to the waist */}
      <path
        d="M59 64 Q100 54 141 64 L138 104 Q134 136 127 158 L125 197 Q100 204 75 197 L73 158 Q66 136 62 104 Z"
        fill={skin}
      />
      {/* Pelvis */}
      <path d="M75 197 L125 197 L120 214 L80 214 Z" fill={skin} />
      {/* Neck + head (faceless) */}
      <path d="M92 40 L108 40 L106 58 L94 58 Z" fill={shade} />
      <ellipse cx="100" cy="26" rx="12.5" ry="15.5" fill={skin} />
      {/* Hair cap */}
      <path
        d="M87 23 Q87 9 100 9 Q113 9 113 23 Q111 17 107 19 Q107 14 102 16 Q100 12 96 16 Q91 13 90 19 Q86 18 87 23 Z"
        fill={hair}
      />
      {/* Hands with finger grooves */}
      <ellipse cx="53" cy="220" rx="9.5" ry="12" fill={skin} />
      <ellipse cx="147" cy="220" rx="9.5" ry="12" fill={skin} />
      <line x1="49" y1="222" x2="49" y2="230" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="54" y1="223" x2="54" y2="232" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="151" y1="222" x2="151" y2="230" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="146" y1="223" x2="146" y2="232" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      {/* Feet */}
      <rect x="68" y="354" width="26" height="16" rx="7" fill={skin} />
      <rect x="106" y="354" width="26" height="16" rx="7" fill={skin} />
      {view === 'back' && (
        <line
          x1="100"
          y1="92"
          x2="100"
          y2="180"
          stroke={line}
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}
