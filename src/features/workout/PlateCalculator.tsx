import { useId, useMemo, useState } from 'react';
import { calculatePlates, DEFAULT_BAR_WEIGHT, DEFAULT_PLATES } from './plateCalculator.ts';
import { canonicalLoad, displayLoad, type WeightUnit } from './workoutHelpers';
import './PlateCalculator.css';

export interface PlateCalculatorProps {
  unit?: WeightUnit;
  /** Canonical kilograms, captured only on mount; calculator edits never log a load. */
  initialLoadKg?: number | null;
}

function convertInput(value: string, from: WeightUnit, to: WeightUnit): string {
  if (value.trim() === '' || !Number.isFinite(Number(value))) return value;
  return String(displayLoad(canonicalLoad(Number(value), from), to));
}

const formatWeight = (weight: number) => Number(weight.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 });

export function PlateCalculator({ unit = 'kg', initialLoadKg }: PlateCalculatorProps) {
  const id = useId();
  const [config, setConfig] = useState(() => ({
    unit, target: initialLoadKg != null ? String(displayLoad(initialLoadKg, unit)) : String(DEFAULT_BAR_WEIGHT[unit]),
    bar: String(DEFAULT_BAR_WEIGHT[unit]), plates: [...DEFAULT_PLATES[unit]],
  }));
  const [parentUnit, setParentUnit] = useState(unit);

  function changeUnit(next: WeightUnit) {
    setConfig((current) => current.unit === next ? current : {
      unit: next, target: convertInput(current.target, current.unit, next),
      bar: convertInput(current.bar, current.unit, next), plates: [...DEFAULT_PLATES[next]],
    });
  }

  // An external preference change converts the user's current inputs; it does not
  // reload the workout's initial snapshot or alter saved performance.
  if (parentUnit !== unit) {
    setParentUnit(unit);
    changeUnit(unit);
  }

  const result = useMemo(() => calculatePlates(
    config.target.trim() === '' ? NaN : Number(config.target),
    config.bar.trim() === '' ? NaN : Number(config.bar), config.plates, config.unit,
  ), [config]);
  const errorId = `${id}-error`;

  return <details className="plate-calculator">
    <summary>Plate calculator</summary>
    <div className="plate-calculator-content">
      <p className="plate-calculator-note">Plan both sides of the bar. This does not change your logged load.</p>
      <fieldset className="plate-calculator-units">
        <legend>Weight unit</legend>
        <div className="plate-calculator-unit-options">
          {(['kg', 'lb'] as const).map((option) => <button key={option} type="button"
            aria-pressed={config.unit === option} onClick={() => changeUnit(option)}>{option}</button>)}
        </div>
      </fieldset>
      <div className="plate-calculator-fields">
        <label htmlFor={`${id}-target`}>Target load ({config.unit})
          <input id={`${id}-target`} type="number" inputMode="decimal" min="0.001" max="10000" step="any"
            value={config.target} aria-describedby={result.error ? errorId : undefined}
            onChange={(event) => setConfig((current) => ({ ...current, target: event.target.value }))} />
        </label>
        <label htmlFor={`${id}-bar`}>Bar weight ({config.unit})
          <input id={`${id}-bar`} type="number" inputMode="decimal" min="0" max="10000" step="any"
            value={config.bar} aria-describedby={result.error ? errorId : undefined}
            onChange={(event) => setConfig((current) => ({ ...current, bar: event.target.value }))} />
        </label>
      </div>
      <fieldset className="plate-calculator-availability" aria-describedby={`${id}-assumption`}>
        <legend>Available plate sizes</legend>
        <p id={`${id}-assumption`} className="plate-calculator-note">Assumes unlimited matching pairs of each selected size.</p>
        <div className="plate-calculator-chips">
          {DEFAULT_PLATES[config.unit].map((weight) => <label key={weight} className="plate-calculator-chip">
            <input type="checkbox" checked={config.plates.includes(weight)} onChange={(event) => {
              const checked = event.target.checked;
              setConfig((current) => ({ ...current, plates: checked
                ? [...current.plates, weight] : current.plates.filter((plate) => plate !== weight) }));
            }} />
            <span>{weight} {config.unit}</span>
          </label>)}
        </div>
      </fieldset>
      {result.error ? <p id={errorId} className="plate-calculator-error" role="alert">{result.error}</p>
        : <div className="plate-calculator-result" role="status" aria-live="polite" aria-atomic="true">
          <h3>{result.exact ? 'Exact load' : result.approximate ? 'Lower-load estimate' : 'Closest lower load'}</h3>
          <p><strong>Each side, from the bar outward</strong></p>
          <p className="plate-calculator-sequence">{result.perSide.length
            ? result.perSide.map(({ weight, count }) => `${formatWeight(weight)} ${config.unit} × ${count}`).join(' + ')
            : 'No plates — bar only'}</p>
          <dl>
            <div><dt>Total loaded</dt><dd>{formatWeight(result.achievedTotal)} {config.unit}</dd></div>
            <div><dt>Remaining to target</dt><dd>{formatWeight(result.remaining)} {config.unit}</dd></div>
          </dl>
          {!result.exact && <p className="plate-calculator-note">{config.plates.length
            ? result.approximate ? 'This estimate stays below your target.' : 'Your selected pairs cannot reach this target exactly without going over.'
            : 'No sizes selected. Select a plate size to add matching pairs.'}</p>}
          {result.approximate && <p className="plate-calculator-note">Large search: this is a quick estimate. The closest load and fewest plates are not guaranteed.</p>}
        </div>}
    </div>
  </details>;
}
