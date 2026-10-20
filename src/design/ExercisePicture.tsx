import { useEffect, useState } from 'react';
import type { Exercise } from '../data/types';
import { getExerciseImageUrl } from '../data/catalog';
import { findMirrorGif } from '../data/exerciseGifs';
import { Icon } from './Icon';

export type MirrorPictureStatus = 'loading' | 'available' | 'missing' | 'reduced-motion';

export function ExercisePicture({ exercise, pose = 'start', large = false, onMirrorStatus }: {
  exercise: Exercise;
  pose?: 'start' | 'peak';
  large?: boolean;
  onMirrorStatus?: (status: MirrorPictureStatus) => void;
}) {
  const staticUrl = getExerciseImageUrl(exercise, pose);
  const [mirrorUrl, setMirrorUrl] = useState<string | null>(null);
  const [mirrorFailed, setMirrorFailed] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    setMirrorUrl(null);
    setMirrorFailed(false);
    setFailedUrl(null);
    if (reducedMotion) {
      onMirrorStatus?.('reduced-motion');
      return;
    }
    onMirrorStatus?.('loading');
    let active = true;
    void findMirrorGif(exercise.name).then((mirror) => {
      if (active) {
        setMirrorUrl(mirror?.gifUrl ?? null);
        onMirrorStatus?.(mirror ? 'available' : 'missing');
      }
    });
    return () => { active = false; };
  }, [exercise.id, exercise.name, reducedMotion]);

  const url = mirrorUrl && !mirrorFailed ? mirrorUrl : staticUrl;
  const usingMirror = Boolean(mirrorUrl && !mirrorFailed);
  return <div className={`exercise-picture ${large ? 'large' : 'small'}`}>
    {url && failedUrl !== url ? <img src={url} alt={large ? (usingMirror ? `${exercise.name} animated exercise demonstration` : `${exercise.name}, ${pose === 'start' ? 'start' : 'end'} position`) : ''} loading={large ? 'eager' : 'lazy'} onError={() => usingMirror ? setMirrorFailed(true) : setFailedUrl(url)} /> :
      <div className="media-unavailable"><Icon name="exercise" size={large ? 36 : 26} /><strong>Illustration unavailable</strong><span>Follow the written instructions below.</span></div>}
  </div>;
}
