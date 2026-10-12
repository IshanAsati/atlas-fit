import React from 'react';
import type { MuscleId } from '../../data/types';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { getMuscleFillColor, type HighlightValue } from './muscleColors';
// Preserve the figure module's public colour-helper import; implementation lives in a pure module.
export { getMuscleFillColor } from './muscleColors';
export type { HighlightValue } from './muscleColors';

export interface BodygraphFigureProps {
  view: 'front' | 'back';
  highlightMap?: Partial<Record<MuscleId, HighlightValue>>;
  selectedMuscle?: MuscleId | null;
  onSelectMuscle?: (muscleId: MuscleId) => void;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Original hand-authored, bilaterally composed anatomy. No traced or third-party artwork.
// Front and back share one continuous silhouette; curved regions follow its limb contours.
export const BodygraphFigure: React.FC<BodygraphFigureProps> = ({
  view, highlightMap, selectedMuscle, onSelectMuscle, compact = false, className = '', style,
}) => {
  const muscle = (id: MuscleId, path: string, paired = true) => {
    const value = highlightMap?.[id];
    const description = value === 'primary' ? ', Primary target'
      : value === 'secondary' ? ', Secondary target'
      : typeof value === 'number' ? `, ${value} primary working sets logged` : '';
    return (
      <g key={id} id={id} className={`mg${selectedMuscle === id ? ' selected' : ''}`}
        role="button" tabIndex={onSelectMuscle ? 0 : -1}
        aria-label={`${MUSCLE_BY_ID[id].name}${description}`} aria-pressed={selectedMuscle === id}
        fill={getMuscleFillColor(value)} stroke="var(--bodygraph-seam, #F3F5ED)"
        strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round"
        onClick={() => onSelectMuscle?.(id)} onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectMuscle?.(id);
          }
        }}>
        <path d={path} />
        {paired && <path d={path} transform="translate(240 0) scale(-1 1)" />}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 240 400" className={`bodyfig${compact ? ' compact' : ''} ${className}`}
      style={style} role="group" aria-label={`Cartoon bodygraph figure, ${view} view`}>
      <g className="body-silhouette" aria-hidden="true" pointerEvents="none"
        fill="var(--muscle-neutral, #DADFD5)" stroke="var(--bodygraph-outline, #BAC6B5)" strokeWidth="1.2">
        <path d="M120 10 C108 10 101 19 102 32 C102 45 109 54 120 55 C131 54 138 45 138 32 C139 19 132 10 120 10Z" />
        <path d="M111 53 C112 64 105 69 96 72 C84 75 75 75 68 81 C58 90 56 104 54 117 C52 133 47 145 44 157 C40 171 38 188 35 205 C32 211 28 219 29 226 C30 232 34 235 38 234 C43 234 45 230 47 224 C48 216 47 210 49 204 C55 187 61 174 63 161 C65 147 68 136 71 126 C74 119 77 114 79 108 C79 132 89 146 87 163 C86 177 79 189 80 210 C81 235 85 256 88 276 C89 283 86 292 86 299 C84 319 91 340 92 357 C92 364 88 371 84 375 C78 381 79 387 87 388 C96 389 105 387 108 381 C109 374 104 366 104 358 C105 338 112 320 110 300 C109 291 109 284 111 276 C115 256 118 234 118 216 C118 210 122 210 122 216 C122 234 125 256 129 276 C131 284 131 291 130 300 C128 320 135 338 136 358 C136 366 131 374 132 381 C135 387 144 389 153 388 C161 387 162 381 156 375 C152 371 148 364 148 357 C149 340 156 319 154 299 C154 292 151 283 152 276 C155 256 159 235 160 210 C161 189 154 177 153 163 C151 146 161 132 161 108 C163 114 166 119 169 126 C172 136 175 147 177 161 C179 174 185 187 191 204 C193 210 192 216 193 224 C195 230 197 234 202 234 C206 235 210 232 211 226 C212 219 208 211 205 205 C202 188 200 171 196 157 C193 145 188 133 186 117 C184 104 182 90 172 81 C165 75 156 75 144 72 C135 69 128 64 129 53 C124 57 116 57 111 53Z" />
      </g>
      {view === 'front' ? <g className="muscles-front">
        {muscle('chest', 'M86 85 C94 80 107 82 117 87 C119 97 118 113 111 121 C103 126 89 121 82 110 C79 102 80 91 86 85Z')}
        {muscle('front_delts', 'M81 80 C74 78 67 83 64 92 C62 101 65 111 70 115 C75 111 79 102 79 95 C79 88 83 84 81 80Z')}
        {muscle('side_delts', 'M65 84 C59 90 57 100 57 111 C57 116 59 119 62 117 C64 111 63 102 65 96 C67 90 70 83 65 84Z')}
        {muscle('biceps', 'M65 117 C59 117 55 127 53 137 C51 145 50 153 54 158 C59 158 64 151 66 141 C68 130 70 120 65 117Z')}
        {muscle('forearms', 'M48 161 C43 170 41 184 39 196 C38 201 40 206 43 204 C47 199 50 187 54 178 C57 170 55 162 48 161Z')}
        {muscle('abs', 'M107 129 C109 126 115 126 117 130 C119 145 117 166 117 183 C113 191 107 193 105 185 C101 170 102 149 103 138 C103 133 104 130 107 129Z')}
        {muscle('obliques', 'M88 125 C93 125 98 129 99 136 C99 153 98 173 103 189 C98 190 90 180 90 169 C92 150 85 140 88 125Z')}
        {muscle('quads', 'M88 199 C95 194 108 197 113 204 C115 221 111 247 107 264 C105 271 101 277 97 276 C91 271 90 255 87 239 C85 222 83 207 88 199Z')}
        {muscle('calves', 'M93 294 C98 289 104 292 106 301 C108 317 102 337 100 351 C99 356 95 354 95 349 C93 332 88 310 93 294Z')}
      </g> : <g className="muscles-back">
        {muscle('traps', 'M111 62 C110 70 99 77 86 82 C91 89 100 95 108 105 C113 109 118 112 118 105 C118 88 121 70 119 64 C116 64 114 63 111 62Z')}
        {muscle('rear_delts', 'M81 80 C73 79 67 84 64 93 C62 103 65 111 70 115 C77 111 83 103 86 93 C87 87 84 82 81 80Z')}
        {muscle('side_delts', 'M65 84 C59 90 57 100 57 111 C57 116 59 119 62 117 C64 111 63 102 65 96 C67 90 70 83 65 84Z')}
        {muscle('triceps', 'M65 117 C59 118 56 128 54 140 C52 149 50 155 54 158 C59 160 65 151 67 140 C69 128 71 119 65 117Z')}
        {muscle('forearms', 'M48 161 C43 170 41 184 39 196 C38 201 40 206 43 204 C47 199 50 187 54 178 C57 170 55 162 48 161Z')}
        {muscle('upper_back', 'M94 97 C101 98 108 109 115 113 C118 117 118 131 115 136 C107 135 98 129 94 121 C91 112 90 103 94 97Z')}
        {muscle('lats', 'M82 113 C85 117 88 124 94 130 C99 138 105 138 104 147 C101 159 97 169 94 176 C88 171 90 160 88 150 C85 137 80 122 82 113Z')}
        {muscle('erectors', 'M111 142 C114 139 118 140 118 146 C117 163 119 184 116 194 C112 197 106 194 105 188 C104 175 108 160 108 150 C108 146 109 143 111 142Z')}
        {muscle('glutes', 'M89 184 C95 183 103 196 114 198 C119 202 119 219 113 225 C106 231 91 229 85 221 C81 211 84 189 89 184Z')}
        {muscle('hamstrings', 'M87 231 C95 234 106 233 113 231 C113 245 109 264 105 275 C102 282 97 280 93 272 C90 260 88 244 87 231Z')}
        {muscle('calves', 'M91 294 C95 289 104 290 106 299 C109 315 104 329 101 339 C100 345 99 353 96 352 C94 344 90 329 89 316 C88 306 88 299 91 294Z')}
      </g>}
    </svg>
  );
};
