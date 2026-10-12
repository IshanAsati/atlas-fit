import React, { useEffect, useRef, useState } from 'react';
import { formatDuration } from './workoutHelpers';

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
  const onCompleteRef = useRef(onTimerComplete);
  useEffect(() => { onCompleteRef.current = onTimerComplete; }, [onTimerComplete]);

  useEffect(() => {
    if (paused) return;
    // Deadline-based countdown catches up after the app is backgrounded.
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      remainingRef.current = seconds;
      setRemaining(seconds);
      if (seconds === 0 && !notified.current) {
        notified.current = true;
        playRestTimerBeep();
        onCompleteRef.current?.();
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [paused]);

  const finished = remaining === 0;
  return <div role="region" aria-label="Rest timer" className="rest-timer-dock">
    <div className="workout-rest-time"><strong>{finished ? 'Rest complete' : formatDuration(remaining)}</strong><span>{finished ? 'Ready for the next set' : paused ? 'Rest paused' : `${total}s planned rest`}</span></div>
    <div className="workout-rest-controls">
      <button type="button" onClick={() => {
        const seconds = remainingRef.current + 30;
        remainingRef.current = seconds;
        setRemaining(seconds);
        setTotal((value) => value + 30);
        deadline.current = Date.now() + seconds * 1000;
        notified.current = false;
      }}>+30s</button>
      {!finished && <button type="button" onClick={() => {
        if (paused) deadline.current = Date.now() + remainingRef.current * 1000;
        else remainingRef.current = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
        setPaused((value) => !value);
      }}>{paused ? 'Resume' : 'Pause'}</button>}
      <button type="button" onClick={onDismiss}>{finished ? 'Done' : 'Skip'}</button>
    </div>
  </div>;
};

export const RestTimer: React.FC<RestTimerProps> = ({ isOpen, ...props }) =>
  isOpen ? <RestCountdown key={props.initialSeconds} {...props} /> : null;
