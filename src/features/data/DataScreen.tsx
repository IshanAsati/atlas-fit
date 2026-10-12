import { useEffect, useState, type FormEvent } from 'react';
import type { UserProfile, LocationType } from '../../data/types';
import { getUserProfile, saveUserProfile } from '../../data/db';
import { EQUIPMENT } from '../../data/equipment';
import { downloadBackupFile, importBackupFile } from '../../data/backup';
import { OFFLINE_MEDIA_CACHE } from '../../data/media';
import { Modal } from '../../design/Modal';
import { Icon } from '../../design/Icon';

export interface DataScreenProps { onProfileUpdated?: (profile: UserProfile) => void; onDataRestored?: () => void }
export function DataScreen({ onProfileUpdated, onDataRestored }: DataScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [inventoryLocation, setInventoryLocation] = useState<LocationType>('home');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [mediaCount, setMediaCount] = useState<number | null>(null);
  const [clearMedia, setClearMedia] = useState(false);
  const refreshMedia = async () => {
    try { if ('caches' in globalThis) setMediaCount((await (await caches.open(OFFLINE_MEDIA_CACHE)).keys()).length); } catch { setMediaCount(null); }
  };
  useEffect(() => {
    getUserProfile().then(setProfile).catch(() => setError('Preferences could not be opened. Return to Settings to retry.'));
    void refreshMedia();
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!profile) return;
    setBusy(true); setError(null); setStatus(null);
    try { await saveUserProfile(profile); onProfileUpdated?.(profile); setStatus('Preferences saved. Adjust your training plan to apply planning changes.'); }
    catch { setError('Preferences were not saved. Try again.'); }
    finally { setBusy(false); }
  };
  const restore = async () => {
    if (!restoreFile) return;
    setBusy(true); setError(null);
    try {
      const result = await importBackupFile(restoreFile);
      if (!result.success) throw new Error(result.error ?? 'Invalid backup.');
      setProfile(await getUserProfile()); setRestoreFile(null); setStatus('Backup restored, including saved routines.'); onDataRestored?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Restore failed. Your existing records were not replaced.'); }
    finally { setBusy(false); }
  };
  return <main className="view">
    <p className="sub">Your preferences, your equipment, your data. No account needed.</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    {status && <p className="banner" role="status">{status}</p>}
    {profile && <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section><h2 className="h-sec" style={{ marginBottom: 16 }}>Training preferences</h2>
        <div className="field"><label htmlFor="settings-name">Display name</label><input id="settings-name" className="input" value={profile.displayName} maxLength={32} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></div>
        <div className="row" style={{ marginTop: 14 }}>
          <div className="field grow"><label htmlFor="settings-goal">Goal</label><select id="settings-goal" className="input" value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value as UserProfile['goal'] })}><option value="strength">Strength</option><option value="fitness">General fitness</option><option value="technique">Technique</option><option value="endurance">Endurance</option><option value="mobility">Mobility</option></select></div>
          <div className="field grow"><label htmlFor="settings-experience">Experience</label><select id="settings-experience" className="input" value={profile.experience} onChange={(event) => setProfile({ ...profile, experience: event.target.value as UserProfile['experience'] })}><option value="new">New</option><option value="some">Some experience</option><option value="experienced">Experienced</option></select></div>
        </div>
        <div className="field" style={{ marginTop: 14 }}><label htmlFor="settings-unit">Weight display</label><select id="settings-unit" className="input" value={profile.weightUnit ?? 'kg'} onChange={(event) => setProfile({ ...profile, weightUnit: event.target.value as 'kg' | 'lb' })}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select><p className="small">Changing units converts the display, not your stored history.</p></div>
      </section>
      <section><h2 className="h-sec">Equipment inventory</h2><p className="sub" style={{ marginBottom: 14 }}>Select only what you have. Each location keeps its own inventory.</p>
        <div className="seg" role="group" aria-label="Equipment location">{(['home','gym','travel'] as const).map((place) => <button key={place} type="button" aria-pressed={inventoryLocation === place} onClick={() => setInventoryLocation(place)}>{place[0].toUpperCase() + place.slice(1)}</button>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 12 }}>{EQUIPMENT.map((equipment) => <label key={equipment.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minHeight: 48, padding: 8, background: 'var(--surface)', borderRadius: 10 }}><input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--action)', flexShrink: 0 }} checked={equipment.id === 'bodyweight' || profile.equipment[inventoryLocation].includes(equipment.id)} disabled={equipment.id === 'bodyweight'} onChange={(event) => setProfile({ ...profile, equipment: { ...profile.equipment, [inventoryLocation]: event.target.checked ? [...profile.equipment[inventoryLocation], equipment.id] : profile.equipment[inventoryLocation].filter((id) => id !== equipment.id) } })} />{equipment.label}</label>)}</div>
      </section>
      <section><h2 className="h-sec">Training boundaries</h2><div className="field" style={{ marginTop: 12 }}><label htmlFor="settings-discomfort">Discomfort or professional advice</label><textarea id="settings-discomfort" className="input" value={profile.discomfortNotes} onChange={(event) => setProfile({ ...profile, discomfortNotes: event.target.value })} /></div><p className="small">Notes are for your reference—not a diagnosis. Avoid individual movements from their exercise details. Stop if you feel pain.</p></section>
      <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
    </form>}
    <section style={{ borderTop: '1px solid var(--hairline)', paddingTop: 24 }}><h2 className="h-sec">Backup and restore</h2><p className="sub">Export your profile, plans, routines, and sessions—including an unfinished workout. Keep a copy somewhere safe.</p>
      <div className="row wrap" style={{ marginTop: 14 }}><button className="btn ghost grow" disabled={busy} onClick={async () => { try { await downloadBackupFile(); setStatus('Backup downloaded. Keep it outside this browser.'); } catch { setError('Backup export failed. Try again.'); } }}><Icon name="download" />Export backup</button><label className="btn ghost grow" style={{ cursor: 'pointer' }}>Choose backup<input type="file" accept=".json,application/json" aria-label="Choose backup file" onChange={(event) => { setRestoreFile(event.target.files?.[0] ?? null); event.target.value = ''; }} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }} /></label></div>
    </section>
    <section><h2 className="h-sec">Offline illustrations</h2><p className="sub">{mediaCount === null ? 'Image cache status is unavailable.' : `${mediaCount} images cached on this device.`} Download workout images from Today or Plan. Browsers may reclaim storage, so check before travelling.</p><button className="btn ghost small-btn" style={{ marginTop: 12 }} disabled={!mediaCount} onClick={() => setClearMedia(true)}>Remove downloaded images</button><p className="small">Removing images never deletes your workout records.</p></section>
    <Modal open={Boolean(restoreFile)} title="Replace local records?" onClose={() => { if (!busy) setRestoreFile(null); }}><p className="sub">Restoring {restoreFile?.name} replaces your current profile, plans, routines, and sessions. Export a backup first if you want to keep them.</p><div className="row wrap" style={{ marginTop: 20 }}><button className="btn ghost grow" disabled={busy} onClick={() => setRestoreFile(null)}>Cancel</button><button className="btn danger grow" disabled={busy} onClick={() => void restore()}>{busy ? 'Restoring…' : 'Replace and restore'}</button></div>{error && <p role="alert" className="error-message">{error}</p>}</Modal>
    <Modal open={clearMedia} title="Remove downloaded images?" onClose={() => setClearMedia(false)}><p className="sub">You’ll need a connection to download them again. Your profile and training records are untouched.</p><div className="row" style={{ marginTop: 20 }}><button className="btn ghost grow" onClick={() => setClearMedia(false)}>Cancel</button><button className="btn danger grow" onClick={async () => { try { await caches.delete(OFFLINE_MEDIA_CACHE); await refreshMedia(); setClearMedia(false); setStatus('Downloaded images removed.'); } catch { setError('Images could not be removed.'); } }}>Remove images</button></div></Modal>
    <footer className="credit">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB</a>. Local-first. Back up regularly.</footer>
  </main>;
}
