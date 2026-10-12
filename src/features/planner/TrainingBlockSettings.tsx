import { useId, useRef, useState } from 'react';
import type { TrainingBlockSettings as BlockSettings } from '../../data/types';
import { getTrainingBlockPhase, isValidTrainingBlockStartDate } from './trainingBlocks';
import './TrainingBlockSettings.css';

export interface TrainingBlockControlsProps {
  value?: BlockSettings;
  onSave: (settings: BlockSettings) => Promise<void>;
  disabled?: boolean;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function initialSettings(value?: BlockSettings): BlockSettings {
  return value ? { ...value } : { enabled: false, lengthWeeks: 4, startDate: today(), deloadLastWeek: true };
}

export function TrainingBlockControls({ value, onSave, disabled = false }: TrainingBlockControlsProps) {
  const id = useId();
  const [draft, setDraft] = useState<BlockSettings>(() => initialSettings(value));
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [sourceValue, setSourceValue] = useState(value);
  if (value !== sourceValue) {
    setSourceValue(value);
    setDraft(initialSettings(value));
    setError('');
    setStatus('');
  }

  const phase = getTrainingBlockPhase(draft);
  const validDate = isValidTrainingBlockStartDate(draft.startDate);
  const locked = disabled || busy;
  function update(next: Partial<BlockSettings>) {
    setDraft((previous) => ({ ...previous, ...next }));
    setError('');
    setStatus('Unsaved changes. Save to apply this block to new workouts.');
  }
  async function save() {
    if (disabled || saving.current) return;
    if (!validDate) {
      setError('Choose a valid start date before saving your training block.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await onSave({ ...draft });
      setStatus('Training block saved. Existing workouts and history are unchanged.');
    } catch {
      setError('Your training block could not be saved. Your draft is still here; try saving again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="training-block-settings" aria-labelledby={`${id}-heading`} aria-busy={busy}>
      <div>
        <h3 id={`${id}-heading`} className="h-sec">Training block</h3>
        <p className="small">Follow 4, 6, or 8 weeks from a baseline to history-led progress, with an optional lighter final week.</p>
      </div>
      <label className="training-block-toggle">
        <input type="checkbox" checked={draft.enabled} disabled={locked}
          onChange={(event) => update({ enabled: event.target.checked })} />
        Enable training block
      </label>
      <div className="field">
        <label htmlFor={`${id}-start`}>Start date</label>
        <input id={`${id}-start`} type="date" className="input" value={draft.startDate} disabled={locked}
          aria-invalid={!validDate} aria-describedby={!validDate ? `${id}-date-error` : undefined}
          onChange={(event) => update({ startDate: event.target.value })} />
        {!validDate && <p id={`${id}-date-error`} className="small training-block-error" role="alert">Choose a valid calendar date.</p>}
      </div>
      <div className="field">
        <label htmlFor={`${id}-length`}>Block length</label>
        <select id={`${id}-length`} className="input" value={draft.lengthWeeks} disabled={locked}
          onChange={(event) => update({ lengthWeeks: Number(event.target.value) as BlockSettings['lengthWeeks'] })}>
          <option value={4}>4 weeks</option><option value={6}>6 weeks</option><option value={8}>8 weeks</option>
        </select>
      </div>
      <label className="training-block-toggle">
        <input type="checkbox" checked={draft.deloadLastWeek} disabled={locked}
          onChange={(event) => update({ deloadLastWeek: event.target.checked })} />
        Deload in the last week
      </label>
      <div className="training-block-phase">
        <strong>{phase.title}</strong>
        <p className="small">{phase.note}</p>
      </div>
      <p className="small">Changes apply only when starting a new workout. Restarting does not replace history. Stop or swap an exercise if it causes pain.</p>
      <div className="training-block-actions">
        <button type="button" className="btn ghost" disabled={locked} onClick={() => {
          update({ startDate: today(), enabled: true });
          setStatus('Restart drafted for today. Save training block to apply it; history stays unchanged.');
        }}>Restart from today</button>
        <button type="button" className="btn primary" disabled={locked} onClick={() => void save()}>
          {busy ? 'Saving training block…' : 'Save training block'}
        </button>
      </div>
      {error && <p className="small training-block-error" role="alert">{error}</p>}
      <p className="small" role="status">{status}</p>
    </section>
  );
}

export default TrainingBlockControls;
