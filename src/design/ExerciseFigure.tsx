import { useState } from 'react';
import type { Exercise } from '../data/types';

/**
 * Licensed exercise illustration with an honest fallback (§4.5, §6.3).
 *
 * RepDB entries carry CDN illustration URLs (start/peak poses), cached on
 * demand by the service worker for offline use. Atlas-curated entries have no
 * bundled photos — they render an original placeholder glyph and say so.
 * A broken remote image degrades to the same placeholder, never a broken icon.
 */

function PlaceholderGlyph() {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true">
      <rect x="6" y="26" width="8" height="12" rx="2" fill="#3d3549" />
      <rect x="50" y="26" width="8" height="12" rx="2" fill="#3d3549" />
      <rect x="12" y="29" width="40" height="6" rx="3" fill="#57b9fa" />
      <rect x="20" y="20" width="5" height="24" rx="2" fill="#a9a2b2" />
      <rect x="39" y="20" width="5" height="24" rx="2" fill="#a9a2b2" />
    </svg>
  );
}

export function ExerciseFigure({
  exercise,
  size = 'large',
}: {
  exercise: Exercise;
  size?: 'thumb' | 'large';
}) {
  const [failed, setFailed] = useState(false);
  const [pose, setPose] = useState<'start' | 'peak'>('start');
  const src =
    pose === 'start'
      ? (exercise.media?.start ?? exercise.media?.peak)
      : (exercise.media?.peak ?? exercise.media?.start);

  if (!src || failed) {
    return (
      <div
        className={size === 'thumb' ? 'thumb placeholder' : 'figure placeholder'}
        role="img"
        aria-label={`No illustration for ${exercise.name} — follow the written cues`}
      >
        <PlaceholderGlyph />
        {size === 'large' ? (
          <span className="small">No illustration yet — follow the written cues below.</span>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div className={size === 'thumb' ? 'thumb' : 'figure'}>
        <img
          src={src}
          alt={`${exercise.name} demonstration (${pose} position)`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      </div>
      {size === 'large' && exercise.media?.start && exercise.media?.peak ? (
        <div className="seg" style={{ width: 220, margin: '8px auto 0' }}>
          <button
            type="button"
            aria-pressed={pose === 'start'}
            onClick={() => setPose('start')}
          >
            Start
          </button>
          <button type="button" aria-pressed={pose === 'peak'} onClick={() => setPose('peak')}>
            Peak
          </button>
        </div>
      ) : null}
      {size === 'large' && exercise.source === 'repdb' ? (
        <p className="small" style={{ textAlign: 'center', marginTop: 6 }}>
          Illustration: RepDB (repdb.co) — cached for offline use.
        </p>
      ) : null}
    </div>
  );
}
