import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getHealthConnectStatus, getTodayHealthSummary, nativeHealthAvailable, openHealthConnect,
  requestHealthAccess, type HealthConnectStatus, type TodayHealthSummary,
} from '../../native/healthConnect';
import './HealthSummary.css';

export function HealthSummary() {
  const native = nativeHealthAvailable();
  const [status, setStatus] = useState<HealthConnectStatus | null>(null);
  const [summary, setSummary] = useState<TodayHealthSummary | null>(null);
  const [busy, setBusy] = useState(native);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const revision = useRef(0);
  const actionPending = useRef(false);
  const invalidate = useCallback(() => { ++revision.current; }, []);

  const refresh = useCallback(async () => {
    if (!native || actionPending.current) return;
    const current = ++revision.current;
    setBusy(true);
    setError('');
    setSummary(null); // Do not retain readings after revocation or across local midnight.
    try {
      const next = await getHealthConnectStatus();
      const data = next.status === 'available' && next.permissionsGranted ? await getTodayHealthSummary() : null;
      if (current !== revision.current) return;
      setStatus(next);
      setSummary(data);
      setMessage('');
    } catch {
      if (current === revision.current) setError('Health data could not be read. Check Health Connect access, then try again.');
    } finally {
      if (current === revision.current) setBusy(false);
    }
  }, [native]);

  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => { if (!disposed) void refresh(); });
    const foreground = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', foreground);
    return () => { disposed = true; invalidate(); document.removeEventListener('visibilitychange', foreground); };
  }, [refresh, invalidate]);

  async function connect() {
    if (actionPending.current) return;
    actionPending.current = true;
    const current = ++revision.current;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const granted = await requestHealthAccess();
      actionPending.current = false;
      if (current !== revision.current) return;
      await refresh();
      if (!granted) setMessage('Steps access was not granted. You can connect again when you’re ready.');
    } catch {
      if (current === revision.current) {
        setError('Health access could not be opened. Check Health Connect and try again.');
        setBusy(false);
      }
    } finally { actionPending.current = false; }
  }

  async function openSettings() {
    setError('');
    try { await openHealthConnect(); }
    catch { setError('Health Connect could not be opened. Find it in Android Settings or Google Play.'); }
  }

  return <section className="health-summary" aria-labelledby="today-health-title" aria-busy={busy}>
    <header className="health-summary-header">
      <h2 id="today-health-title">Today’s health</h2>
      {native && <button type="button" className="health-text-button" disabled={busy} onClick={() => void refresh()}>{busy ? 'Refreshing…' : 'Refresh'}</button>}
    </header>
    {!native ? <p>Health Connect is available in the Android app, not this browser.</p> : <>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {!status && !error && <p role="status">Checking Health Connect…</p>}
      {status?.status === 'unavailable' && <p>Health Connect is unavailable on this device. It requires Android 9 or later and a supported device.</p>}
      {status?.status === 'install-required' && <>
        <p>Install or update Health Connect to read activity from your health app. Android 14 and later include Health Connect in Settings.</p>
        <button type="button" className="btn primary" onClick={() => void openSettings()}>Install or update Health Connect</button>
      </>}
      {status?.status === 'available' && <>
        {status.permissionsGranted ? <>
          {summary && <>
            <dl className="health-summary-readings">
              <div><dt>Steps</dt><dd>{summary.steps === null ? 'No data yet' : summary.steps.toLocaleString()}</dd></div>
              <div><dt>Distance</dt><dd>{summary.distanceKm === null ? 'Not available' : `${summary.distanceKm.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`}</dd></div>
              <div><dt>Active energy</dt><dd>{summary.activeCalories === null ? 'Not available' : `${summary.activeCalories.toLocaleString(undefined, { maximumFractionDigits: 0 })} kcal`}</dd></div>
            </dl>
            {summary.steps === null && <p>Your connected health app has not recorded steps yet. Check that it syncs to Health Connect, then refresh.</p>}
            {(summary.distanceKm === null || summary.activeCalories === null) && <p>Distance and active energy need their own read access and recorded data. Both are optional.</p>}
            <p>Today, from local midnight. Active energy is reported by your health app, not measured by Atlas Fit.</p>
          </>}
          <div className="health-summary-actions">
            <button type="button" className="health-text-button" disabled={busy} onClick={() => void connect()}>Manage access</button>
            <button type="button" className="health-text-button" disabled={busy} onClick={() => void openSettings()}>Open Health Connect</button>
          </div>
        </> : <>
          <p>Connect your health app through Health Connect to see today’s activity. Steps access is needed; distance and active energy are optional.</p>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void connect()}>Connect Health Connect</button>
        </>}
      </>}
      <p className="health-summary-privacy">Read only, on this device. These readings are not saved to Atlas Fit, included in backups, or uploaded. You control access in Health Connect.</p>
    </>}
  </section>;
}
