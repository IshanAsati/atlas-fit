import React, { useEffect, useRef, useState } from 'react';
import { Haptics } from '@capacitor/haptics';
import { formatDuration } from './workoutHelpers';
import { cancelRestAlert, getRestAlertStatus, nativeNotificationsAvailable, requestNotificationPermission, scheduleRestAlert } from '../../native/notifications';

export function playRestTimerBeep(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    gain.gain.setValueAtTime(.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .3);
    oscillator.onended = () => { void context.close(); };
  } catch { /* Silent mode or unsupported audio never blocks logging. */ }
}

export interface RestTimerProps {
  initialSeconds: number;
  isOpen: boolean;
  onDismiss: () => void;
  onTimerComplete?: () => void;
}

const RestCountdown: React.FC<Omit<RestTimerProps, 'isOpen'>> = ({ initialSeconds, onDismiss, onTimerComplete }) => {
  const initial = Math.max(1, initialSeconds);
  const [total, setTotal] = useState(initial);
  const [remaining, setRemaining] = useState(initial);
  const remainingRef = useRef(initial);
  const [paused, setPaused] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const deadline = useRef(startedAt + initial * 1000);
  const notified = useRef(false);
  const mounted = useRef(false);
  const active = useRef(true);
  const pausedRef = useRef(false);
  const alertRevision = useRef(0);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [alertMessage, setAlertMessage] = useState(nativeNotificationsAvailable()
    ? 'Checking Android rest alerts…'
    : 'Background rest alerts are Android-only. Keep this screen open for the timer sound.');
  const onCompleteRef = useRef(onTimerComplete);
  useEffect(() => { onCompleteRef.current = onTimerComplete; }, [onTimerComplete]);

  const cancelAlert = () => {
    const revision = ++alertRevision.current;
    void cancelRestAlert().catch(() => {
      if (mounted.current && revision === alertRevision.current) setAlertMessage('Android could not cancel the rest alert. It may still appear; your workout can continue.');
    });
  };
  const updateAlert = async () => {
    if (!nativeNotificationsAvailable() || !active.current || pausedRef.current || notified.current) return;
    const revision = ++alertRevision.current;
    try {
      const scheduled = await scheduleRestAlert(deadline.current);
      if (!mounted.current || !active.current || revision !== alertRevision.current) return;
      const status = await getRestAlertStatus();
      if (!mounted.current || !active.current || revision !== alertRevision.current) return;
      setAlertsEnabled(status.enabled);
      setAlertMessage(scheduled || !status.enabled ? status.message : 'The rest alert was not scheduled. Keep the app open and try +30s or Resume.');
    } catch {
      if (mounted.current && active.current && revision === alertRevision.current) setAlertMessage('Android rest alert unavailable. Keep the app open; your workout can continue.');
    }
  };

  useEffect(() => {
    mounted.current = true;
    active.current = true;
    void updateAlert();
    return () => { mounted.current = false; active.current = false; cancelAlert(); };
    // The deadline belongs to this countdown, not to permission/status renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused) return;
    // Deadline-based countdown catches up after the app is backgrounded.
    const tick = () => {
      if (!active.current) return;
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      remainingRef.current = seconds;
      setRemaining(seconds);
      if (seconds === 0 && !notified.current) {
        notified.current = true;
        const native = nativeNotificationsAvailable();
        const foreground = document.visibilityState === 'visible';
        // Do not race a background OS alarm with a throttled JavaScript tick.
        // Foreground feedback replaces the pending alert; background delivery
        // belongs to Android, even if this tick happens to run while hidden.
        if (!native || foreground) { cancelAlert(); playRestTimerBeep(); }
        if (native && foreground) {
          void Haptics.vibrate({ duration: 300 }).catch(() => { /* Never block set logging. */ });
        }
        onCompleteRef.current?.();
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', tick); };
  }, [paused]);

  const finished = remaining === 0;
  return <div role="region" aria-label="Rest timer" className="rest-timer-dock" style={{ flexWrap: 'wrap' }}>
    <div className="workout-rest-time"><strong>{finished ? 'Rest complete' : formatDuration(remaining)}</strong><span>{finished ? 'Ready for the next set' : paused ? 'Rest paused' : `${total}s planned rest`}</span></div>
    <div className="workout-rest-controls">
      <button type="button" onClick={() => {
        const seconds = (pausedRef.current ? remainingRef.current : Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))) + 30;
        remainingRef.current = seconds;
        setRemaining(seconds);
        setTotal((value) => value + 30);
        deadline.current = Date.now() + seconds * 1000;
        notified.current = false;
        void updateAlert();
      }}>+30s</button>
      {!finished && <button type="button" onClick={() => {
        if (paused) deadline.current = Date.now() + remainingRef.current * 1000;
        else {
          remainingRef.current = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
          setRemaining(remainingRef.current);
        }
        pausedRef.current = !paused;
        if (pausedRef.current) cancelAlert();
        else void updateAlert();
        setPaused((value) => !value);
      }}>{paused ? 'Resume' : 'Pause'}</button>}
      <button type="button" onClick={() => { active.current = false; cancelAlert(); onDismiss(); }}>{finished ? 'Done' : 'Skip'}</button>
    </div>
    <div style={{ flexBasis: '100%', fontSize: 14, color: 'var(--workout-muted)' }}>
      <p role="status" style={{ margin: 0 }}>{alertMessage}</p>
      {nativeNotificationsAvailable() && !alertsEnabled && <button type="button" className="btn ghost" style={{ marginTop: 8, minHeight: 44 }} disabled={permissionBusy} onClick={async () => {
        setPermissionBusy(true);
        try {
          const granted = await requestNotificationPermission();
          if (!mounted.current || !active.current) return;
          setAlertsEnabled(granted);
          if (!granted) setAlertMessage('Rest alerts are not allowed. Enable notifications in Android app settings, then try again.');
          else {
            const status = await getRestAlertStatus();
            if (!mounted.current || !active.current) return;
            setAlertMessage(status.message);
            await updateAlert();
          }
        } catch {
          if (mounted.current && active.current) setAlertMessage('Could not enable Android rest alerts. Check notification settings and try again.');
        } finally { if (mounted.current) setPermissionBusy(false); }
      }}>{permissionBusy ? 'Checking permission…' : 'Enable rest alerts'}</button>}
    </div>
  </div>;
};

export const RestTimer: React.FC<RestTimerProps> = ({ isOpen, ...props }) =>
  isOpen ? <RestCountdown key={props.initialSeconds} {...props} /> : null;
