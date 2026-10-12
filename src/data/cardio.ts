import { db } from './db';
import type { CardioSession } from './types';

const activities = ['walk', 'run', 'cycle', 'row', 'swim', 'other'];
const intensities = ['easy', 'moderate', 'hard'];

export async function getCardioSessions(): Promise<CardioSession[]> {
  return db.cardio.orderBy('completedAt').reverse().toArray();
}

export async function saveCardioSession(session: CardioSession): Promise<void> {
  if (!session || typeof session.id !== 'string' || !session.id.trim()) {
    throw new Error('A cardio session needs an id.');
  }
  if (!activities.includes(session.activity) || !intensities.includes(session.intensity)) {
    throw new Error('Choose a listed activity and effort.');
  }
  if (!Number.isFinite(session.durationMin) || session.durationMin <= 0 || session.durationMin > 1440) {
    throw new Error('Duration must be greater than 0 and no more than 1,440 minutes.');
  }
  if (session.distanceKm !== undefined && (!Number.isFinite(session.distanceKm) || session.distanceKm <= 0 || session.distanceKm > 10000)) {
    throw new Error('Distance must be greater than 0 and no more than 10,000 km.');
  }
  if (!Number.isFinite(session.completedAt) || session.completedAt < 0 || !Number.isFinite(new Date(session.completedAt).getTime()) || session.completedAt > Date.now()) {
    throw new Error('Choose a valid completion date that is not in the future.');
  }
  if (session.notes !== undefined && (typeof session.notes !== 'string' || session.notes.trim().length > 500)) {
    throw new Error('Notes must be no more than 500 characters.');
  }
  // Explicitly persist only cardio fields; never touch strength sessions or counts.
  const clean: CardioSession = {
    id: session.id,
    activity: session.activity,
    durationMin: session.durationMin,
    intensity: session.intensity,
    completedAt: session.completedAt,
  };
  if (session.distanceKm !== undefined) clean.distanceKm = session.distanceKm;
  if (session.notes?.trim()) clean.notes = session.notes.trim();
  await db.cardio.put(clean);
}

export async function deleteCardioSession(id: string): Promise<void> {
  await db.cardio.delete(id);
}
