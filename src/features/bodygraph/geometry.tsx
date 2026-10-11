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
  P('front_delts', 'left', 'M56 78 Q58 62 74 60 L86 63 Q82 79 70 85 Q58 88 56 78 Z'),
  // Outer side-delt sliver
  E('side_delts', 'left', [53, 86, 5.5, 11]),
  // Pectoral (rounded)
  P(
    'chest',
    'left',
    'M68 80 Q82 70 99 76 L98 92 Q96 103 85 107 Q73 107 68 96 Q64 87 68 80 Z',
  ),
  // Biceps mass (fills the upper arm)
  P(
    'biceps',
    'left',
    'M54 96 Q50 120 54 144 Q56 151 62 150 Q68 149 68 141 L67 102 Q61 94 54 96 Z',
  ),
  // Forearm (tapered, fills the lower arm)
  P(
    'forearms',
    'left',
    'M49 154 L68 154 L64 206 Q63 212 57 211 Q51 210 50 202 Z',
  ),
  // Oblique strip
  P('obliques', 'left', 'M79 114 Q74 134 77 162 L85 162 Q83 136 86 116 Z'),
  // Quad heads: outer sweep, centre mass, inner teardrop
  P('quads', 'left', 'M74 212 Q69 240 74 266 Q76 272 80 271 Q84 270 84 260 L84 216 Z'),
  P('quads', 'left', 'M85 210 L96 210 L95 264 Q94 272 89 272 Q84 272 84 262 Z'),
  P('quads', 'left', 'M76 252 Q81 244 87 249 Q92 256 87 267 Q81 271 76 267 Z'),
  // Calf heads
  E('calves', 'left', [82, 312, 7, 20]),
  E('calves', 'left', [91, 314, 6, 18]),
];

/** Abs six-pack: 3 rows × 2 rounded columns, shared `abs` id. */
const ABS_SEGMENTS: MuscleShape[] = [116, 131, 146].flatMap((y): MuscleShape[] => [
  { id: 'abs', side: 'left' as Side, path: rrect(87, y, 11, 13, 3.5) },
  { id: 'abs', side: 'right' as Side, path: rrect(102, y, 11, 13, 3.5) },
]);

export const FRONT_SHAPES: MuscleShape[] = [...mirrorLeft(FRONT_LEFT), ...ABS_SEGMENTS];

/* -------------------------------- BACK -------------------------------- */

const BACK_LEFT: MuscleShape[] = [
  // Trapezius half-kite (right twin added below)
  P('traps', undefined, 'M90 56 L100 61 L100 88 L80 76 Q84 62 90 56 Z'),
  // Rear delt cap
  P('rear_delts', 'left', 'M56 80 Q59 64 75 62 L85 66 Q81 81 69 86 Q58 89 56 80 Z'),
  E('side_delts', 'left', [53, 88, 5.5, 10]),
  // Triceps (long + lateral head)
  P(
    'triceps',
    'left',
    'M55 98 Q51 122 55 144 Q57 151 62 150 Q67 149 67 141 L66 104 Q60 96 55 98 Z',
  ),
  P('triceps', 'left', 'M68 106 Q71 124 69 142 Q68 148 65 147 Q62 146 62 140 Z'),
  // Forearm extensors
  P('forearms', 'left', 'M50 156 L68 156 L64 208 Q63 213 57 212 Q52 211 51 203 Z'),
  // Lat wing
  P('lats', 'left', 'M70 94 Q62 122 70 154 L79 162 L88 154 Q81 124 84 98 Z'),
  // Upper back (rhomboid diamond)
  P('upper_back', 'left', 'M85 102 L97 111 L88 134 L79 118 Z'),
  // Erector column
  P('erectors', 'left', 'M89 138 L96 138 L95 178 L88 178 Z'),
  // Glute
  P(
    'glutes',
    'left',
    'M76 192 Q76 180 90 180 L97 183 L96 206 Q88 212 80 207 Q76 201 76 192 Z',
  ),
  // Hamstrings: outer + inner belly
  P('hamstrings', 'left', 'M76 214 Q72 242 77 266 Q79 272 83 271 Q86 270 86 260 L85 218 Z'),
  P('hamstrings', 'left', 'M87 214 L94 214 L93 264 Q92 270 88 270 Q84 270 84 260 Z'),
  // Calf heads
  E('calves', 'left', [82, 314, 7, 20]),
  E('calves', 'left', [91, 316, 6, 18]),
];

export const BACK_SHAPES: MuscleShape[] = [
  ...mirrorLeft(BACK_LEFT),
  // Traps right twin (centre shape mirrored manually)
  P('traps', undefined, 'M110 56 L100 61 L100 88 L120 76 Q116 62 110 56 Z'),
];

export const SHAPES_BY_VIEW: Record<View, MuscleShape[]> = {
  front: FRONT_SHAPES,
  back: BACK_SHAPES,
};

/** Non-interactive base: ivory athletic figure, lavender hair, tapered torso. */
export function Silhouette({ view }: { view: View }) {
  const skin = '#f2f0f7';
  const shade = '#e2dfee';
  const hair = '#b9b4cc';
  const line = '#cfccdd';
  return (
    <g aria-hidden="true">
      {/* Hair */}
      <path
        d="M84 26 Q84 8 100 8 Q116 8 116 26 Q114 20 110 22 Q110 16 104 18 Q102 13 97 17 Q91 14 90 21 Q86 20 84 26 Z"
        fill={hair}
      />
      {/* Head (faceless) */}
      <ellipse cx="100" cy="30" rx="15" ry="18" fill={skin} />
      {/* Neck */}
      <path d="M92 44 L108 44 L106 60 L94 60 Z" fill={shade} />
      {/* Torso: broad shoulders tapering to the waist */}
      <path
        d="M62 66 Q100 54 138 66 L136 104 Q132 140 124 162 L122 198 Q100 206 78 198 L76 162 Q68 140 64 104 Z"
        fill={skin}
      />
      {/* Pelvis */}
      <path d="M78 198 L122 198 L118 216 L82 216 Z" fill={skin} />
      {/* Upper arms (tapered, angled slightly out) */}
      <path d="M50 72 L78 70 L71 152 L47 152 Z" fill={shade} />
      <path d="M150 72 L122 70 L129 152 L153 152 Z" fill={shade} />
      {/* Forearms */}
      <path d="M45 150 L72 150 L67 210 L43 210 Z" fill={skin} />
      <path d="M155 150 L128 150 L133 210 L157 210 Z" fill={skin} />
      {/* Hands with finger hints */}
      <ellipse cx="55" cy="222" rx="10" ry="13" fill={skin} />
      <ellipse cx="145" cy="222" rx="10" ry="13" fill={skin} />
      <line x1="51" y1="224" x2="51" y2="232" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="56" y1="225" x2="56" y2="234" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="149" y1="224" x2="149" y2="232" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="144" y1="225" x2="144" y2="234" stroke={line} strokeWidth="1.6" strokeLinecap="round" />
      {/* Thighs */}
      <path d="M70 212 L98 212 L95 276 L73 276 Z" fill={shade} />
      <path d="M130 212 L102 212 L105 276 L127 276 Z" fill={shade} />
      {/* Knees */}
      <circle cx="85" cy="283" r="8.5" fill={skin} />
      <circle cx="115" cy="283" r="8.5" fill={skin} />
      {/* Lower legs */}
      <path d="M74 290 L96 290 L93 358 L77 358 Z" fill={skin} />
      <path d="M126 290 L104 290 L107 358 L123 358 Z" fill={skin} />
      {/* Feet */}
      <rect x="69" y="356" width="28" height="16" rx="7" fill={skin} />
      <rect x="103" y="356" width="28" height="16" rx="7" fill={skin} />
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
