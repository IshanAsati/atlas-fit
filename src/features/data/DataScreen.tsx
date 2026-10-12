import { useEffect, useState, type FormEvent } from 'react';
import type { UserProfile, LocationType } from '../../data/types';
import { getUserProfile, saveUserProfile } from '../../data/db';
import { DEFAULT_EQUIPMENT } from '../../data/equipment';
import { EquipmentInventory } from './EquipmentInventory';
import { TrainingPreferences } from '../planner/TrainingPreferences';
import { downloadBackupFile, importBackupFile } from '../../data/backup';
import { OFFLINE_MEDIA_CACHE } from '../../data/media';
import { Modal } from '../../design/Modal';
import { Icon } from '../../design/Icon';
import type { ThemePreference } from '../../design/theme';
import { PlateCalculator } from '../workout/PlateCalculator.tsx';
import { WorkoutReminders } from './WorkoutReminders';
import { isWorkoutReminderSettings } from '../../data/trainingSettings';

export interface DataScreenProps {
  onProfileUpdated?: (profile: UserProfile) => void;
  onDataRestored?: () => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
}
export function DataScreen({ onProfileUpdated, onDataRestored, themePreference, onThemePreferenceChange }: DataScreenProps) {
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
    <p className="sub">Make training fit you. Everything is saved on this device.</p>
    {error && <p className="error-message" role="alert">{error}</p>}
    {status && <p className="banner" role="status">{status}</p>}
    {profile && <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section><h2 className="h-sec" style={{ marginBottom: 16 }}>Training preferences</h2>
        <div className="field"><label htmlFor="settings-name">Display name</label><input id="settings-name" className="input" value={profile.displayName} maxLength={32} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} /></div>
        <div className="row settings-basic-row" style={{ marginTop: 20 }}>
          <div className="field grow"><label htmlFor="settings-goal">Goal</label><select id="settings-goal" className="input" value={profile.goal} onChange={(event) => setProfile({ ...profile, goal: event.target.value as UserProfile['goal'] })}><option value="strength">Strength</option><option value="fitness">General fitness</option><option value="technique">Technique</option><option value="endurance">Endurance</option><option value="mobility">Mobility</option></select></div>
          <div className="field grow"><label htmlFor="settings-experience">Experience</label><select id="settings-experience" className="input" value={profile.experience} onChange={(event) => setProfile({ ...profile, experience: event.target.value as UserProfile['experience'] })}><option value="new">New</option><option value="some">Some experience</option><option value="experienced">Experienced</option></select></div>
        </div>
        <div className="field" style={{ marginTop: 14 }}><label htmlFor="settings-unit">Weight unit</label><select id="settings-unit" className="input" value={profile.weightUnit ?? 'kg'} onChange={(event) => setProfile({ ...profile, weightUnit: event.target.value as 'kg' | 'lb' })}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select><p className="small">Switch anytime. Your recorded weights stay the same.</p></div>
      </section>
      <details className="settings-disclosure"><summary>Your equipment<span className="small">{profile.equipment[inventoryLocation].length} selected at {inventoryLocation} · expand to edit</span></summary><section><p className="sub" style={{ marginBottom: 16 }}>Choose a location, then select what’s available there.</p>
        <EquipmentInventory location={inventoryLocation} onLocationChange={setInventoryLocation} equipment={profile.equipment} onToggle={(place, id, checked) => setProfile({ ...profile, equipment: { ...profile.equipment, [place]: checked ? [...profile.equipment[place], id] : profile.equipment[place].filter((item) => item !== id) } })} onResetLocation={(place) => setProfile({ ...profile, equipment: { ...profile.equipment, [place]: [...DEFAULT_EQUIPMENT[place]] } })} />
      </section></details>
      <details className="settings-disclosure"><summary>Training boundaries<span className="small">{profile.restrictions.length} restrictions · {profile.avoidEquipment?.length ?? 0} equipment exclusions · {profile.targetMuscles?.length ?? 0} muscle priorities</span></summary><section><div className="field"><label htmlFor="settings-discomfort">Discomfort or professional advice</label><textarea id="settings-discomfort" className="input" value={profile.discomfortNotes} onChange={(event) => setProfile({ ...profile, discomfortNotes: event.target.value })} /></div><p className="small">Notes are for your reference—not a diagnosis. Avoid individual movements from their exercise details. Stop if you feel pain.</p>
        <div style={{ marginTop: 20 }}><TrainingPreferences value={{ targetMuscles: profile.targetMuscles ?? [], avoidEquipment: profile.avoidEquipment ?? [], restrictions: profile.restrictions }} onChange={(next) => setProfile({ ...profile, targetMuscles: next.targetMuscles, avoidEquipment: next.avoidEquipment, restrictions: next.restrictions })} /></div></section></details>
      <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
    </form>}
    {profile && <WorkoutReminders value={profile.reminders} weekdays={profile.weekdays} onSave={async (reminders) => {
      if (!isWorkoutReminderSettings(reminders)) throw new Error('Choose a valid reminder time.');
      const updated = { ...await getUserProfile(), reminders };
      await saveUserProfile(updated);
      setProfile((current) => current ? { ...current, reminders } : updated);
      onProfileUpdated?.(updated);
    }} />}
    <section><h2 className="h-sec">Training tools</h2><PlateCalculator unit={profile?.weightUnit ?? 'kg'} /></section>
    <section><h2 className="h-sec">Appearance</h2><div className="field" style={{ marginTop: 12 }}><label htmlFor="settings-theme">Theme</label><select id="settings-theme" className="input" value={themePreference} onChange={(event) => onThemePreferenceChange(event.target.value as ThemePreference)}><option value="system">Use device setting</option><option value="dark">Dark</option><option value="light">Light</option></select><p className="small">Applies to this device only. It does not change your workout data.</p></div></section>
    <section style={{ borderTop: '1px solid var(--hairline)', paddingTop: 24 }}><h2 className="h-sec">Backup and restore</h2><p className="sub">Save your settings, diet preferences, cardio, routines, and workout history, including unfinished workouts. Health Connect data stays with your health app and is not included. Keep a copy before switching devices or clearing data.</p>
      <div className="row wrap" style={{ marginTop: 14 }}><button className="btn ghost grow" disabled={busy} onClick={async () => { try { await downloadBackupFile(); setStatus('Backup downloaded. Keep it outside this browser.'); } catch { setError('Backup export failed. Try again.'); } }}><Icon name="download" />Export backup</button><label className="btn ghost grow" style={{ cursor: 'pointer' }}>Choose backup<input type="file" accept=".json,application/json" aria-label="Choose backup file" onChange={(event) => { setRestoreFile(event.target.files?.[0] ?? null); event.target.value = ''; }} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }} /></label></div>
    </section>
    <section><h2 className="h-sec">Offline images</h2><p className="sub">{mediaCount === null ? 'Couldn’t check your saved images.' : `${mediaCount} ${mediaCount === 1 ? 'image' : 'images'} saved on this device.`} Save workout images from Today or Plan. Your browser may remove them to free space, so check before travelling.</p><button className="btn ghost small-btn" style={{ marginTop: 12 }} disabled={!mediaCount} onClick={() => setClearMedia(true)}>Remove downloaded images</button><p className="small">Removing images never deletes your workout records.</p></section>
    <Modal open={Boolean(restoreFile)} title="Replace local records?" onClose={() => { if (!busy) setRestoreFile(null); }}><p className="sub">Restoring {restoreFile?.name} replaces your current profile, plans, routines, and sessions. Export a backup first if you want to keep them.</p><div className="row wrap" style={{ marginTop: 20 }}><button className="btn ghost grow" disabled={busy} onClick={() => setRestoreFile(null)}>Cancel</button><button className="btn danger grow" disabled={busy} onClick={() => void restore()}>{busy ? 'Restoring…' : 'Replace and restore'}</button></div>{error && <p role="alert" className="error-message">{error}</p>}</Modal>
    <Modal open={clearMedia} title="Remove downloaded images?" onClose={() => setClearMedia(false)}><p className="sub">You’ll need a connection to download them again. Your profile and training records are untouched.</p><div className="row" style={{ marginTop: 20 }}><button className="btn ghost grow" onClick={() => setClearMedia(false)}>Cancel</button><button className="btn danger grow" onClick={async () => { try { await caches.delete(OFFLINE_MEDIA_CACHE); await refreshMedia(); setClearMedia(false); setStatus('Downloaded images removed.'); } catch { setError('Images could not be removed.'); } }}>Remove images</button></div></Modal>
    <footer className="credit">Exercise data by <a href="https://repdb.co" target="_blank" rel="noopener noreferrer">RepDB</a>. Local-first. Back up regularly.</footer>
  </main>;
}
