import type { CSSProperties } from 'react';
export type IconName = 'home' | 'plan' | 'library' | 'progress' | 'settings' | 'play' | 'back' | 'close' | 'search' | 'star' | 'filter' | 'download' | 'check' | 'circle' | 'exercise' | 'arrow' | 'shield';
const paths: Record<IconName,string> = {
  home: 'm3 10 9-7 9 7v10H3Zm6 10v-7h6v7',
  plan: 'M5 5h14v16H5ZM8 3v4m8-4v4M8 11h8m-8 4h5',
  library: 'M4 4h6v16H4Zm10 2h6v14h-6M7 8v8m10-6v6',
  progress: 'M4 20V4m0 16h16M8 16l4-5 4 2 4-7',
  settings: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  play: 'm8 5 11 7-11 7Z', back: 'm14 5-7 7 7 7M7 12h14', close: 'm6 6 12 12M6 18 18 6',
  search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16m6 14 4 4',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  filter: 'M4 6h16M7 12h10m-7 6h4', download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
  check: 'm5 12 4 4L19 6', circle: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18', exercise: 'M5 7v10m3-12v14m8-14v14m3-12v10M8 12h8',
  arrow: 'M4 12h16m-6-6 6 6-6 6', shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z',
};
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
