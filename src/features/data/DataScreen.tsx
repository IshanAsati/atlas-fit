import React, { useState, useEffect } from 'react';
import type { UserProfile, WorkoutSession, LocationType, Goal, Experience } from '../../data/types';
import {
  getUserProfile,
  saveUserProfile,
  getWorkoutSessions,
  getAllPlans,
  getAllFeedback,
  DEFAULT_PROFILE,
} from '../../data/db';
import { downloadBackupFile, importBackupFile } from '../../data/backup';

export interface DataScreenProps {
  onProfileUpdated?: (profile: UserProfile) => void;
  onDataRestored?: () => void;
}

export const DataScreen: React.FC<DataScreenProps> = ({
  onProfileUpdated,
  onDataRestored,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [planCount, setPlanCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Form states for profile editing
  const [displayName, setDisplayName] = useState('');
  const [goal, setGoal] = useState<Goal>('strength');
  const [experience, setExperience] = useState<Experience>('some');
  const [durationMin, setDurationMin] = useState<30 | 45 | 60>(45);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [activeLocation, setActiveLocation] = useState<LocationType>('home');

  const loadData = async () => {
    try {
      const prof = await getUserProfile();
      setProfile(prof);
      setDisplayName(prof.displayName);
      setGoal(prof.goal);
      setExperience(prof.experience);
      setDurationMin(prof.durationMin);
      setDaysPerWeek(prof.daysPerWeek);
      setActiveLocation(prof.activeLocation);

      const [sessions, plans, fb] = await Promise.all([
        getWorkoutSessions(),
        getAllPlans(),
        getAllFeedback(),
      ]);
      setHistory(sessions);
      setPlanCount(plans.length);
      setFeedbackCount(fb.length);
    } catch (err) {
      console.error('Failed to load data in DataScreen:', err);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const updated: UserProfile = {
      ...profile,
      displayName: displayName.trim() || 'Lifter',
      goal,
      experience,
      durationMin,
      daysPerWeek,
      activeLocation,
    };
    await saveUserProfile(updated);
    setProfile(updated);
    if (onProfileUpdated) onProfileUpdated(updated);
    setSaveStatus('Profile updated successfully!');
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleDownloadBackup = async () => {
    try {
      await downloadBackupFile();
      setBackupStatus({ type: 'success', message: 'Backup JSON downloaded successfully.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBackupStatus({ type: 'error', message: `Export error: ${msg}` });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await importBackupFile(file);
      if (res.success) {
        setBackupStatus({ type: 'success', message: 'Database restored successfully!' });
        await loadData();
        if (onDataRestored) onDataRestored();
      } else {
        setBackupStatus({ type: 'error', message: res.error ?? 'Import failed' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBackupStatus({ type: 'error', message: `Restore error: ${msg}` });
    } finally {
      e.target.value = '';
    }
  };

  const handleResetToDefaults = async () => {
    await saveUserProfile(DEFAULT_PROFILE);
    await loadData();
    setIsResetConfirmOpen(false);
    setBackupStatus({ type: 'success', message: 'Profile reset to default values.' });
  };

  return (
    <div className="data-screen">
      {/* Top Header */}
      <header className="topbar">
        <h1>Settings & Data</h1>
        <p>100% offline-first · Local IndexedDB</p>
      </header>

      <main className="view">
        {/* Profile Settings Card */}
        <section className="panel">
          <h2 className="h-sec">Lifter Profile</h2>
          <p className="sub" style={{ marginBottom: 14 }}>
            Tailor your weekly split generation, target difficulty, and default rest periods.
          </p>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="field">
              <label htmlFor="display-name">Display Name</label>
              <input
                id="display-name"
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label htmlFor="profile-goal">Primary Goal</label>
                <select
                  id="profile-goal"
                  className="input"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as Goal)}
                >
                  <option value="strength">Strength Focus</option>
                  <option value="fitness">General Fitness</option>
                  <option value="technique">Technique & Form</option>
                  <option value="endurance">Muscular Endurance</option>
                  <option value="mobility">Mobility & Range</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="profile-experience">Experience</label>
                <select
                  id="profile-experience"
                  className="input"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value as Experience)}
                >
                  <option value="new">Beginner</option>
                  <option value="some">Some Experience</option>
                  <option value="experienced">Experienced</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label htmlFor="profile-duration">Session Duration</label>
                <select
                  id="profile-duration"
                  className="input"
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value) as 30 | 45 | 60)}
                >
                  <option value={30}>30 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="profile-days">Days / Week</label>
                <select
                  id="profile-days"
                  className="input"
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                >
                  <option value={2}>2 Days</option>
                  <option value={3}>3 Days (Recommended)</option>
                  <option value={4}>4 Days</option>
                  <option value={5}>5 Days</option>
                  <option value={6}>6 Days</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="profile-location">Default Location</label>
              <div className="seg" id="profile-location" role="group">
                {(['home', 'gym', 'travel'] as LocationType[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    aria-pressed={activeLocation === loc}
                    onClick={() => setActiveLocation(loc)}
                  >
                    {loc.charAt(0).toUpperCase() + loc.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {saveStatus && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(95, 214, 138, 0.12)',
                  color: 'var(--good)',
                  borderRadius: 'var(--radius-s)',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {saveStatus}
              </div>
            )}

            <button type="submit" className="btn primary block">
              Save Profile Changes
            </button>
          </form>
        </section>

        {/* Cloudless Backup & Restore Card */}
        <section className="panel">
          <h2 className="h-sec">Cloudless Backup & Export</h2>
          <p className="sub" style={{ marginBottom: 14 }}>
            Atlas Fit never transmits your personal fitness data to the cloud. You own your data. Download a clean JSON snapshot to migrate to a new browser or phone.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn primary"
              onClick={handleDownloadBackup}
              style={{ flex: 1, minWidth: 160 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Backup
            </button>

            <label
              className="btn ghost"
              style={{
                flex: 1,
                minWidth: 160,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import Backup
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {backupStatus && (
            <div
              style={{
                marginTop: 10,
                padding: '10px 12px',
                background: backupStatus.type === 'error' ? 'rgba(240, 68, 85, 0.12)' : 'rgba(95, 214, 138, 0.12)',
                color: backupStatus.type === 'error' ? 'var(--danger)' : 'var(--good)',
                borderRadius: 'var(--radius-s)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {backupStatus.message}
            </div>
          )}
        </section>

        {/* Database Overview & Statistics */}
        <section className="panel">
          <h2 className="h-sec">Database Statistics</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius-s)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--action)' }}>{history.length}</div>
              <div className="small">Logged Sessions</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius-s)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{planCount}</div>
              <div className="small">Generated Plans</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius-s)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--good)' }}>{feedbackCount}</div>
              <div className="small">Exercise Feedbacks</div>
            </div>
            <div style={{ background: 'var(--surface-2)', padding: 12, borderRadius: 'var(--radius-s)' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                {profile?.favourites?.length ?? 0}
              </div>
              <div className="small">Favourites Saved</div>
            </div>
          </div>

          <button
            type="button"
            className="btn danger ghost block"
            onClick={() => setIsResetConfirmOpen(true)}
            style={{ marginTop: 14 }}
          >
            Reset Profile to Defaults
          </button>
        </section>

        {/* Confirmation Modal */}
        {isResetConfirmOpen && (
          <div className="scrim" onClick={() => setIsResetConfirmOpen(false)}>
            <div
              className="sheet"
              onClick={(e) => e.stopPropagation()}
              style={{ textAlign: 'center' }}
            >
              <div className="grab" />
              <h2 className="h-sec" style={{ marginTop: 8 }}>Reset Profile?</h2>
              <p className="sub" style={{ marginBottom: 16 }}>
                This will reset your goals, location, and equipment preferences to default settings. Logged workout sessions will not be deleted.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setIsResetConfirmOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={handleResetToDefaults}
                  style={{ flex: 1 }}
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
