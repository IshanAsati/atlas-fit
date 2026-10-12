export type HighlightValue = 'primary' | 'secondary' | 'neutral' | number;

export function getMuscleFillColor(value: HighlightValue | undefined): string {
  if (value === 'primary') return 'var(--muscle-primary, #E86672)';
  if (value === 'secondary') return 'var(--muscle-secondary, #A88BDA)';
  if (typeof value === 'number' && value > 0) {
    if (value <= 3) return 'var(--muscle-activity-low, #C0CDAA)';
    if (value <= 7) return 'var(--muscle-activity-mid, #8EA976)';
    return 'var(--muscle-activity-high, #54794B)';
  }
  return 'var(--muscle-neutral, #DADFD5)';
}
