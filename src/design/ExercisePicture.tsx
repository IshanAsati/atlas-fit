import { useState } from 'react';
import type { Exercise } from '../data/types';
import { getExerciseImageUrl } from '../data/catalog';
import { Icon } from './Icon';

export function ExercisePicture({ exercise, pose = 'start', large = false }: { exercise: Exercise; pose?: 'start' | 'peak'; large?: boolean }) {
  const url = getExerciseImageUrl(exercise, pose);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={`exercise-picture ${large ? 'large' : 'small'}`}>
    {url && failedUrl !== url ? <img src={url} alt={large ? `${exercise.name}, ${pose === 'start' ? 'start' : 'end'} position` : ''} loading={large ? 'eager' : 'lazy'} onError={() => setFailedUrl(url)} /> :
      <div className="media-unavailable"><Icon name="exercise" size={large ? 36 : 26} /><span>Illustration unavailable. Follow the written instructions below.</span></div>}
  </div>;
}
