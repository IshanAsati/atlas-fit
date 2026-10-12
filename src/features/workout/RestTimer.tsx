import React, { useEffect, useState, useRef } from 'react';

export function playRestTimerBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // Two-tone celebration chime
    playTone(880, now, 0.2); // A5
    playTone(1174.66, now + 0.18, 0.35); // D6
  } catch (err) {
    console.warn('Web Audio API playback prevented or unsupported:', err);
  }
}

export interface RestTimerProps {
  initialSeconds: number;
  isOpen: boolean;
  onDismiss: () => void;
  onTimerComplete?: () => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({
  initialSeconds,
  isOpen,
  onDismiss,
  onTimerComplete,
}) => {
  const [totalSeconds, setTotalSeconds] = useState(initialSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(initialSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Reset timer whenever initialSeconds or isOpen changes to true
  useEffect(() => {
    if (isOpen) {
      const targetSec = Math.max(initialSeconds, 1);
      setTotalSeconds(targetSec);
      setRemainingSeconds(targetSec);
      setIsPaused(false);
      setIsFinished(false);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isOpen, initialSeconds]);

  // Main countdown interval
  useEffect(() => {
    if (!isOpen || isPaused || isFinished) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsFinished(true);
          playRestTimerBeep();
          onTimerComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOpen, isPaused, isFinished, onTimerComplete]);

  if (!isOpen) return null;

  const handleAdd30s = () => {
    setTotalSeconds((prev) => prev + 30);
    setRemainingSeconds((prev) => prev + 30);
    if (isFinished) {
      setIsFinished(false);
    }
  };

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev);
  };

  // Format time MM:SS
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeFormatted = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  // SVG Circular progress
  const strokeWidth = 5;
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div
      role="region"
      aria-label="Rest timer"
      className="rest-timer-dock"
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '460px',
        zIndex: 35,
        background: 'linear-gradient(145deg, #161A23, #1E2430)',
        border: isFinished
          ? '1.5px solid rgba(95, 214, 138, 0.4)'
          : remainingSeconds <= 5 && !isPaused
            ? '1.5px solid rgba(0, 229, 255, 0.45)'
            : '1.5px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isFinished
          ? '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 28px rgba(95, 214, 138, 0.35)'
          : remainingSeconds <= 5 && !isPaused
            ? '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 24px rgba(0, 229, 255, 0.4)'
            : '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.1)',
        animation: remainingSeconds <= 5 && !isPaused && !isFinished
          ? 'urgentPulse 1s infinite ease-in-out'
          : undefined,
        borderRadius: '16px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        backdropFilter: 'blur(16px)',
        transition: 'border-color 300ms ease, box-shadow 300ms ease',
      }}
    >
      {/* Circular progress & time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ position: 'relative', width: '70px', height: '70px', flexShrink: 0 }}>
          <svg width="70" height="70" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="35"
              cy="35"
              r={radius}
              fill="transparent"
              stroke="#202633"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="35"
              cy="35"
              r={radius}
              fill="transparent"
              stroke={isFinished ? '#5fd68a' : '#00E5FF'}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: isFinished ? '#5fd68a' : '#F8FAFC',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.3px',
              }}
            >
              {isFinished ? 'DONE' : timeFormatted}
            </span>
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              color: isFinished ? '#5fd68a' : '#00E5FF',
              fontWeight: 700,
            }}
          >
            {isFinished ? 'Rest Over!' : isPaused ? 'Rest Paused' : 'Resting'}
          </div>
          <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '2px' }}>
            {isFinished ? 'Ready for next set' : `${totalSeconds}s planned rest`}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={handleAdd30s}
          title="Add 30 seconds"
          style={{
            appearance: 'none',
            background: '#1E2430',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#F8FAFC',
            borderRadius: '10px',
            padding: '8px 10px',
            fontSize: '13px',
            fontWeight: 650,
            cursor: 'pointer',
            minHeight: '40px',
            touchAction: 'manipulation',
          }}
        >
          +30s
        </button>

        {!isFinished && (
          <button
            type="button"
            onClick={handleTogglePause}
            title={isPaused ? 'Resume' : 'Pause'}
            style={{
              appearance: 'none',
              background: '#1E2430',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#F8FAFC',
              borderRadius: '10px',
              padding: '8px 10px',
              fontSize: '13px',
              fontWeight: 650,
              cursor: 'pointer',
              minHeight: '40px',
              touchAction: 'manipulation',
            }}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        )}

        <button
          type="button"
          onClick={onDismiss}
          title="Dismiss timer"
          style={{
            appearance: 'none',
            background: isFinished ? '#00E5FF' : 'transparent',
            border: isFinished ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
            color: isFinished ? '#041217' : '#94A3B8',
            borderRadius: '10px',
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: 650,
            cursor: 'pointer',
            minHeight: '40px',
            touchAction: 'manipulation',
          }}
        >
          {isFinished ? 'Done' : 'Skip'}
        </button>
      </div>
    </div>
  );
};
