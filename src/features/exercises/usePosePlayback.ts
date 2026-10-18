import { useEffect, useState } from 'react';

export type ExercisePose = 'start' | 'peak';

/**
 * Play a two-frame reference preview using the exercise's bundled pose images.
 * This is not a movement video: stop on manual selection, tab backgrounding,
 * exercise changes, and whenever the user requests reduced motion.
 */
export function usePosePlayback(enabled: boolean, exerciseId?: string) {
  const [pose, setPose] = useState<ExercisePose>('start');
  const [isPlaying, setIsPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const onChange = () => {
      setReducedMotion(media.matches);
      if (media.matches) setIsPlaying(false);
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    setPose('start');
    setIsPlaying(false);
  }, [exerciseId]);

  useEffect(() => {
    if (!enabled || !isPlaying || reducedMotion) return;
    const stopWhenHidden = () => {
      if (document.hidden) setIsPlaying(false);
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    const timer = window.setInterval(() => {
      if (!document.hidden) setPose((current) => current === 'start' ? 'peak' : 'start');
    }, 1400);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, [enabled, isPlaying, reducedMotion]);

  const selectPose = (next: ExercisePose) => {
    setIsPlaying(false);
    setPose(next);
  };
  const togglePlayback = () => {
    if (enabled && !reducedMotion) setIsPlaying((current) => !current);
  };

  return { pose, selectPose, isPlaying, togglePlayback, reducedMotion };
}
