import React from 'react';
import type { MuscleId } from '../../data/types';
import { MUSCLE_BY_ID } from '../../data/muscles';

export type HighlightValue = 'primary' | 'secondary' | 'neutral' | number;

export interface BodygraphFigureProps {
  /** 'front' or 'back' view of the cartoon figure. */
  view: 'front' | 'back';
  /** Mapping of muscle ID to highlight state or set count. */
  highlightMap?: Partial<Record<MuscleId, HighlightValue>> | Record<MuscleId, HighlightValue>;
  /** Currently selected muscle in the inspector. */
  selectedMuscle?: MuscleId | null;
  /** Callback when user clicks or presses Enter on a muscle group. */
  onSelectMuscle?: (muscleId: MuscleId) => void;
  /** Render compact version for thumbnail cards / preview strips. */
  compact?: boolean;
  /** Optional custom CSS classes. */
  className?: string;
  /** Optional inline styles. */
  style?: React.CSSProperties;
}

/**
 * Resolves the color for a muscle:
 * - 'primary': #FF4757 (Vivid Crimson Coral)
 * - 'secondary': #00D2FF (Electric Cyber Cyan — Zero purple)
 * - 'neutral': #202633 (Stealth Titanium Slate)
 * - number: 0 = #202633, 1-3 = #123854, 4-7 = #0284c7, 8+ = #00e5ff
 */
export function getMuscleFillColor(val: HighlightValue | undefined): string {
  if (val === 'primary') return '#FF4757';
  if (val === 'secondary') return '#00D2FF';
  if (val === 'neutral' || val === undefined) return '#202633';
  if (typeof val === 'number') {
    if (val <= 0) return '#202633';
    if (val <= 3) return '#123854';
    if (val <= 7) return '#0284c7';
    return '#00e5ff';
  }
  return '#202633';
}

/**
 * 2D Cartoon Bodygraph Vector Figure (§4.6, §5.1, §5.2).
 *
 * An original, simplified faceless cartoon character with smooth rounded anatomy.
 * Every canonical muscle from `src/data/muscles.ts` has its own dedicated clickable
 * SVG `<g>` with id and `className="mg"`.
 */
export const BodygraphFigure: React.FC<BodygraphFigureProps> = ({
  view,
  highlightMap,
  selectedMuscle,
  onSelectMuscle,
  compact = false,
  className = '',
  style,
}) => {
  const handleKeyDown = (id: MuscleId, e: React.KeyboardEvent<SVGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectMuscle?.(id);
    }
  };

  const getAriaLabel = (id: MuscleId): string => {
    const meta = MUSCLE_BY_ID[id];
    const name = meta ? meta.name : id;
    const val = highlightMap?.[id];
    if (val === 'primary') return `${name}, Primary target`;
    if (val === 'secondary') return `${name}, Secondary target`;
    if (typeof val === 'number' && val > 0) return `${name}, ${val} working sets logged`;
    return name;
  };

  const renderMuscleGroup = (id: MuscleId, children: React.ReactNode) => {
    const isSelected = selectedMuscle === id;
    const fill = getMuscleFillColor(highlightMap?.[id]);
    const stroke = isSelected ? '#FFFFFF' : '#141822';
    const strokeWidth = isSelected ? (compact ? 2 : 2.5) : compact ? 1 : 1.5;

    return (
      <g
        id={id}
        key={id}
        className={`mg ${isSelected ? 'selected' : ''}`}
        role="button"
        tabIndex={onSelectMuscle ? 0 : -1}
        aria-label={getAriaLabel(id)}
        aria-pressed={isSelected}
        onClick={() => onSelectMuscle?.(id)}
        onKeyDown={(e) => handleKeyDown(id, e)}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={isSelected ? 'url(#bodygraph-glow)' : undefined}
        style={{
          cursor: onSelectMuscle ? 'pointer' : 'default',
          transition: 'fill 200ms ease, stroke 200ms ease, opacity 180ms ease',
        }}
      >
        {children}
      </g>
    );
  };

  return (
    <svg
      viewBox="0 0 240 380"
      className={`bodyfig ${compact ? 'compact' : ''} ${className}`}
      style={style}
      role="group"
      aria-label={`Cartoon bodygraph figure, ${view} view`}
    >
      <defs>
        <filter id="bodygraph-glow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#00E5FF" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* Non-interactive Cartoon Silhouette Base Layer */}
      <g aria-hidden="true" pointerEvents="none" className="body-silhouette">
        {/* Head (faceless, friendly rounded cartoon proportions) */}
        <ellipse cx="120" cy="34" rx="19" ry="22" fill="#161922" stroke="#252B3A" strokeWidth="2" />
        {/* Neck */}
        <rect x="112" y="52" width="16" height="18" rx="8" fill="#13161F" stroke="#252B3A" strokeWidth="1.5" />

        {/* Torso Silhouette Underlay */}
        <path
          d="M 72 74 C 90 68 150 68 168 74 L 172 100 C 170 134 160 156 156 190 C 156 202 144 212 120 212 C 96 212 84 202 84 190 C 80 156 70 134 68 100 Z"
          fill="#13161F"
          stroke="#252B3A"
          strokeWidth="1.5"
        />

        {/* Arms Underlay */}
        <rect x="46" y="80" width="28" height="124" rx="14" fill="#13161F" stroke="#252B3A" strokeWidth="1.5" />
        <rect x="166" y="80" width="28" height="124" rx="14" fill="#13161F" stroke="#252B3A" strokeWidth="1.5" />

        {/* Rounded Cartoon Hands */}
        <rect x="44" y="206" width="16" height="20" rx="8" fill="#1C212D" stroke="#2B3242" strokeWidth="1.5" />
        <rect x="180" y="206" width="16" height="20" rx="8" fill="#1C212D" stroke="#2B3242" strokeWidth="1.5" />

        {/* Legs Underlay */}
        <rect x="76" y="196" width="36" height="146" rx="18" fill="#13161F" stroke="#252B3A" strokeWidth="1.5" />
        <rect x="128" y="196" width="36" height="146" rx="18" fill="#13161F" stroke="#252B3A" strokeWidth="1.5" />

        {/* Rounded Feet */}
        <rect x="80" y="344" width="26" height="16" rx="7" fill="#1C212D" stroke="#2B3242" strokeWidth="1.5" />
        <rect x="134" y="344" width="26" height="16" rx="7" fill="#1C212D" stroke="#2B3242" strokeWidth="1.5" />

        {/* Spine Hint on Back View */}
        {view === 'back' && (
          <line x1="120" y1="106" x2="120" y2="186" stroke="#252B3A" strokeWidth="2" strokeLinecap="round" />
        )}
      </g>

      {/* Muscle Layers */}
      {view === 'front' ? (
        <g className="muscles-front">
          {/* 1. Chest (Pectorals) */}
          {renderMuscleGroup(
            'chest',
            <>
              {/* Left Pec */}
              <path d="M 82 76 C 98 73 116 75 117 78 C 118 98 116 112 102 116 C 88 116 78 100 82 76 Z" />
              {/* Right Pec */}
              <path d="M 158 76 C 142 73 124 75 123 78 C 122 98 124 112 138 116 C 152 116 162 100 158 76 Z" />
            </>,
          )}

          {/* 2. Front Deltoids */}
          {renderMuscleGroup(
            'front_delts',
            <>
              <ellipse cx="73" cy="80" rx="13" ry="14" />
              <ellipse cx="167" cy="80" rx="13" ry="14" />
            </>,
          )}

          {/* 3. Side Deltoids */}
          {renderMuscleGroup(
            'side_delts',
            <>
              <ellipse cx="57" cy="86" rx="6" ry="13" />
              <ellipse cx="183" cy="86" rx="6" ry="13" />
            </>,
          )}

          {/* 4. Biceps */}
          {renderMuscleGroup(
            'biceps',
            <>
              <rect x="56" y="104" width="17" height="38" rx="8.5" />
              <rect x="167" y="104" width="17" height="38" rx="8.5" />
            </>,
          )}

          {/* 5. Forearms */}
          {renderMuscleGroup(
            'forearms',
            <>
              <rect x="47" y="152" width="16" height="48" rx="8" />
              <rect x="177" y="152" width="16" height="48" rx="8" />
            </>,
          )}

          {/* 6. Abs (Rectus Abdominis 6-pack) */}
          {renderMuscleGroup(
            'abs',
            <>
              {/* Upper segments */}
              <rect x="105" y="122" width="13" height="15" rx="3.5" />
              <rect x="122" y="122" width="13" height="15" rx="3.5" />
              {/* Mid segments */}
              <rect x="105" y="141" width="13" height="15" rx="3.5" />
              <rect x="122" y="141" width="13" height="15" rx="3.5" />
              {/* Lower segments */}
              <rect x="105" y="160" width="13" height="18" rx="3.5" />
              <rect x="122" y="160" width="13" height="18" rx="3.5" />
            </>,
          )}

          {/* 7. Obliques */}
          {renderMuscleGroup(
            'obliques',
            <>
              <path d="M 88 124 C 99 122 102 128 102 178 C 94 178 87 166 86 148 C 86 136 87 126 88 124 Z" />
              <path d="M 152 124 C 141 122 138 128 138 178 C 146 178 153 166 154 148 C 154 136 153 126 152 124 Z" />
            </>,
          )}

          {/* 8. Quadriceps */}
          {renderMuscleGroup(
            'quads',
            <>
              <path d="M 82 196 C 96 193 116 195 117 205 C 118 232 116 264 108 274 C 98 276 86 270 82 254 C 80 236 80 208 82 196 Z" />
              <path d="M 158 196 C 144 193 124 195 123 205 C 122 232 124 264 132 274 C 142 276 154 270 158 254 C 160 236 160 208 158 196 Z" />
            </>,
          )}

          {/* 9. Calves */}
          {renderMuscleGroup(
            'calves',
            <>
              <rect x="85" y="286" width="22" height="52" rx="10" />
              <rect x="133" y="286" width="22" height="52" rx="10" />
            </>,
          )}
        </g>
      ) : (
        <g className="muscles-back">
          {/* 1. Trapezius */}
          {renderMuscleGroup(
            'traps',
            <path d="M 112 54 C 116 52 124 52 128 54 L 146 74 C 150 82 136 102 120 106 C 104 102 90 82 94 74 Z" />,
          )}

          {/* 2. Rear Deltoids */}
          {renderMuscleGroup(
            'rear_delts',
            <>
              <ellipse cx="73" cy="80" rx="13" ry="14" />
              <ellipse cx="167" cy="80" rx="13" ry="14" />
            </>,
          )}

          {/* 3. Side Deltoids */}
          {renderMuscleGroup(
            'side_delts',
            <>
              <ellipse cx="57" cy="86" rx="6" ry="13" />
              <ellipse cx="183" cy="86" rx="6" ry="13" />
            </>,
          )}

          {/* 4. Triceps */}
          {renderMuscleGroup(
            'triceps',
            <>
              <rect x="56" y="104" width="17" height="40" rx="8.5" />
              <rect x="167" y="104" width="17" height="40" rx="8.5" />
            </>,
          )}

          {/* 5. Forearms (also visible from back) */}
          {renderMuscleGroup(
            'forearms',
            <>
              <rect x="47" y="152" width="16" height="48" rx="8" />
              <rect x="177" y="152" width="16" height="48" rx="8" />
            </>,
          )}

          {/* 6. Upper Back (Rhomboids) */}
          {renderMuscleGroup(
            'upper_back',
            <>
              <path d="M 104 102 C 116 102 118 108 118 132 C 106 132 98 122 98 110 C 98 104 100 102 104 102 Z" />
              <path d="M 136 102 C 124 102 122 108 122 132 C 134 132 142 122 142 110 C 142 104 140 102 136 102 Z" />
            </>,
          )}

          {/* 7. Lats (Latissimus Dorsi) */}
          {renderMuscleGroup(
            'lats',
            <>
              <path d="M 84 96 C 96 98 96 114 98 152 C 86 148 76 134 76 114 C 76 104 80 98 84 96 Z" />
              <path d="M 156 96 C 144 98 144 114 142 152 C 154 148 164 134 164 114 C 164 104 160 98 156 96 Z" />
            </>,
          )}

          {/* 8. Spinal Erectors (Lower Back) */}
          {renderMuscleGroup(
            'erectors',
            <>
              <rect x="105" y="136" width="12" height="44" rx="5" />
              <rect x="123" y="136" width="12" height="44" rx="5" />
            </>,
          )}

          {/* 9. Glutes */}
          {renderMuscleGroup(
            'glutes',
            <>
              <path d="M 82 186 C 92 182 118 182 119 188 C 120 216 106 228 88 228 C 78 228 76 210 82 186 Z" />
              <path d="M 158 186 C 148 182 122 182 121 188 C 120 216 134 228 152 228 C 162 228 164 210 158 186 Z" />
            </>,
          )}

          {/* 10. Hamstrings */}
          {renderMuscleGroup(
            'hamstrings',
            <>
              <rect x="80" y="234" width="32" height="46" rx="13" />
              <rect x="128" y="234" width="32" height="46" rx="13" />
            </>,
          )}

          {/* 11. Calves */}
          {renderMuscleGroup(
            'calves',
            <>
              <path d="M 80 286 C 88 284 106 284 107 290 C 108 314 104 336 96 342 C 86 342 80 324 80 286 Z" />
              <path d="M 160 286 C 152 284 134 284 133 290 C 132 314 136 336 144 342 C 154 342 160 324 160 286 Z" />
            </>,
          )}
        </g>
      )}
    </svg>
  );
};
