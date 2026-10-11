import type { CSSProperties } from 'react';
import type { MuscleId } from '../../data/types';
import { MUSCLE_BY_ID } from '../../data/muscles';
import { SHAPES_BY_VIEW, Silhouette, type View } from './geometry';

/**
 * Interactive Bodygraph renderer (§4.6).
 *
 * Mode A "targets": primary = red, secondary = purple, not targeted = light
 * neutral — colours represent classification, not measured activation.
 * Mode B "activity": shading from logged working sets ("training activity
 * estimate" — not recovery or hypertrophy measurement).
 */

export type TargetState = 'primary' | 'secondary' | 'none';

export interface BodygraphProps {
  view: View;
  targets?: Partial<Record<MuscleId, TargetState>>;
  activity?: Partial<Record<MuscleId, number>>;
  selected?: MuscleId | null;
  onSelect?: (id: MuscleId) => void;
  /** Screen-reader suffix appended to muscle names, e.g. "primary target". */
  labelSuffix?: string;
}

const PRIMARY = '#f04455';
const SECONDARY = '#a675eb';
const NEUTRAL = '#dad7e8';

/** Activity ramp — an estimate derived from logged sets (§8.3). */
function activityColor(count: number): string {
  if (count <= 0) return NEUTRAL;
  if (count <= 2) return '#f6a9b1';
  if (count <= 5) return '#f47482';
  if (count <= 8) return '#f04455';
  return '#c92c3e';
}

function colorFor(props: BodygraphProps, id: MuscleId): string {
  if (props.activity) return activityColor(props.activity[id] ?? 0);
  if (props.targets) {
    const state = props.targets[id] ?? 'none';
    if (state === 'primary') return PRIMARY;
    if (state === 'secondary') return SECONDARY;
  }
  return NEUTRAL;
}

export function Bodygraph(props: BodygraphProps) {
  const { view, selected, onSelect } = props;
  const shapes = SHAPES_BY_VIEW[view];

  const labelFor = (id: MuscleId, side?: 'left' | 'right'): string => {
    const meta = MUSCLE_BY_ID[id];
    const sideText = side ? ` (${side})` : '';
    const classification = props.activity
      ? `${props.activity[id] ?? 0} estimated working sets`
      : props.targets
        ? `${props.targets[id] === 'primary' ? 'primary target' : props.targets[id] === 'secondary' ? 'secondary target' : 'not targeted'}`
        : '';
    const suffix = [classification, props.labelSuffix].filter(Boolean).join(', ');
    return `${meta.short}${sideText}${suffix ? `, ${suffix}` : ''}`;
  };

  return (
    <svg
      className="bodyfig"
      viewBox="0 0 200 400"
      role="group"
      aria-label={`Cartoon muscle map, ${view} view`}
    >
      <Silhouette view={view} />
      {shapes.map((shape, i) => {
        const isSelected = selected === shape.id;
        const fill = colorFor(props, shape.id);
        const style: CSSProperties = { fill };
        const common = {
          className: `mg${isSelected ? ' pressed' : ''}`,
          style,
          role: onSelect ? 'button' as const : undefined,
          tabIndex: onSelect ? 0 : -1,
          'aria-label': labelFor(shape.id, shape.side),
          'aria-pressed': onSelect ? isSelected : undefined,
          onClick: () => onSelect?.(shape.id),
          onKeyDown: (e: React.KeyboardEvent<SVGElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect?.(shape.id);
            }
          },
        };
        return (
          <g key={`${shape.id}-${shape.side ?? 'c'}-${i}`} {...common}>
            {shape.ellipse ? (
              <ellipse cx={shape.ellipse[0]} cy={shape.ellipse[1]} rx={shape.ellipse[2]} ry={shape.ellipse[3]} />
            ) : (
              <path d={shape.path} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
