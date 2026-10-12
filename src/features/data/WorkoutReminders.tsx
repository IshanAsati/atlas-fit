import { useId, useState } from 'react';
import type { WorkoutReminderSettings } from '../../data/types';
import { nativeNotificationsAvailable, scheduleWorkoutReminders } from '../../native/notifications';

export interface WorkoutRemindersProps {
  value?: WorkoutReminderSettings;
  weekdays: string[];
  onSave: (settings: WorkoutReminderSettings) => Promise<void>;
}

export function WorkoutReminders({ value, weekdays, onSave }: WorkoutRemindersProps) {
  const savedEnabled = value?.enabled ?? false;
  const savedTime = value?.time ?? '18:00';
  const [previousSaved, setPreviousSaved] = useState({ enabled: savedEnabled, time: savedTime });
  const [draft, setDraft] = useState<WorkoutReminderSettings>(value ?? { enabled: false, time: '18:00' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const native = nativeNotificationsAvailable();
  // Refresh an externally restored/saved value, without resetting the draft on
  // unrelated profile renders or a new object with the same settings.
  if (previousSaved.enabled !== savedEnabled || previousSaved.time !== savedTime) {
    const next = { enabled: savedEnabled, time: savedTime };
    setPreviousSaved(next); setDraft(next);
  }
  const save = async () => {
    setBusy(true); setStatus(null); setError(null);
    try {
      const result = await scheduleWorkoutReminders(draft, weekdays);
      const saved = { ...draft, enabled: result.enabled };
      setDraft(saved);
      await onSave(saved);
      if (draft.enabled && !result.enabled) setError(result.message);
      else setStatus(result.message);
    } catch {
      setError('Reminder settings were not saved. Android alerts may have changed; try saving again.');
    } finally { setBusy(false); }
  };

  return <section aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`} className="h-sec">Workout reminders</h2>
    <p className="sub">A local reminder on your preferred training days. No account or internet connection needed.</p>
    {!native && <p className="small" style={{ fontSize: 14 }}>Scheduled alerts are available in the Android app, not this browser.</p>}
    <div className="field" style={{ marginTop: 14 }}>
      <label htmlFor={`${id}-enabled`} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}>
        <input id={`${id}-enabled`} type="checkbox" checked={draft.enabled} disabled={busy || !native} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
        Remind me to train
      </label>
    </div>
    <div className="field" style={{ marginTop: 12 }}>
      <label htmlFor={`${id}-time`}>Reminder time</label>
      <input id={`${id}-time`} type="time" className="input" style={{ fontSize: 16, minHeight: 44 }} value={draft.time} disabled={busy || !native} onChange={(event) => setDraft({ ...draft, time: event.target.value })} aria-describedby={`${id}-days`} />
      <p id={`${id}-days`} className="small" style={{ fontSize: 14 }}>Training days: {weekdays.length ? weekdays.join(', ') : 'None selected. Choose days in your training profile.'} Times use your device’s local clock.</p>
    </div>
    <button type="button" className="btn primary block" style={{ marginTop: 14, minHeight: 44 }} disabled={busy || (!native && !draft.enabled)} onClick={() => void save()}>{busy ? 'Saving reminders…' : 'Save reminders'}</button>
    {status && <p className="banner" role="status" style={{ marginTop: 12, fontSize: 14 }}>{status}</p>}
    {error && <p className="error-message" role="alert" style={{ marginTop: 12, fontSize: 14 }}>{error}</p>}
  </section>;
}
