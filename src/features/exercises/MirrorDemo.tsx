import { useRef, useState } from 'react';
import { findMirrorGif } from '../../data/exerciseGifs';
import { OFFLINE_MEDIA_CACHE } from '../../data/media';
import { Icon } from '../../design/Icon';

/**
 * Explicit online enhancement: looks up a third-party mirror GIF for an
 * exercise and can cache it into the app's offline media store (works in the
 * Android WebView) on a second explicit tap. Never automatic, never a
 * replacement for bundled RepDB illustrations. Mirror rights are unverified —
 * the UI says so next to the control.
 */
export function MirrorDemo({ name }: { name: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'missing' | 'error' | 'saved'>('idle');
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef(0);

  const lookup = async () => {
    if (busy) return;
    const version = ++request.current;
    setBusy(true);
    setImageFailed(false);
    setStatus('loading');
    try {
      const hit = await findMirrorGif(name);
      if (version !== request.current) return;
      if (hit) { setGifUrl(hit.gifUrl); setStatus('ready'); }
      else setStatus('missing');
    } catch {
      if (version === request.current) setStatus('error');
    } finally {
      if (version === request.current) setBusy(false);
    }
  };

  const saveOffline = async () => {
    if (!gifUrl || busy) return;
    setBusy(true);
    try {
      if (typeof globalThis.caches === 'undefined') throw new Error('no cache');
      const cache = await caches.open(OFFLINE_MEDIA_CACHE);
      if (!(await cache.match(gifUrl))) {
        const response = await fetch(gifUrl);
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
          throw new Error('Demo unavailable');
        }
        await cache.put(gifUrl, response.clone());
      }
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  return <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
    {(status === 'idle' || status === 'missing' || status === 'error') && <>
      <button type="button" className="btn ghost block" disabled={busy} onClick={() => void lookup()}>
        <Icon name="play" />{status === 'idle' ? 'Try animated demo (online)' : 'Retry animated demo (online)'}
      </button>
      <p className="small">Third-party mirror demo; rights unverified. Needs a connection; bundled illustrations stay the offline default.</p>
      {status === 'missing' && <p className="small" role="status">No mirror demo found for this exercise.</p>}
      {status === 'error' && <p className="small" role="alert">Demo lookup failed. Check your connection and retry.</p>}
    </>}
    {status === 'loading' && <p className="small" role="status">Looking up animated demo…</p>}
    {(status === 'ready' || status === 'saved') && gifUrl && <>
      <div className="exercise-picture large">
        {imageFailed
          ? <span className="media-unavailable">Mirror demo could not play. Use the written cues.</span>
          : <img src={gifUrl} alt={`${name} mirror demonstration`} onError={() => setImageFailed(true)} />}
      </div>
      <p className="small">Mirror match for “{name}” — confirm the movement before trusting it.</p>
      {status === 'ready'
        ? <button type="button" className="btn ghost block" disabled={busy || imageFailed} onClick={() => void saveOffline()}>
            <Icon name="download" />{busy ? 'Saving demo…' : 'Save demo offline'}
          </button>
        : <p className="small" role="status">Demo saved on this device for offline use.</p>}
    </>}
  </div>;
}
