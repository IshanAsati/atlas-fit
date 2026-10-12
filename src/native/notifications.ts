import { Capacitor } from '@capacitor/core';
import { LocalNotifications, type Weekday } from '@capacitor/local-notifications';
import type { WorkoutReminderSettings } from '../data/types';

// Reserved only for these features. Never use cancelAll: other alerts may exist.
export const REST_ALERT_ID = 41000;
export const WORKOUT_REMINDER_IDS = [41001, 41002, 41003, 41004, 41005, 41006, 41007];
const weekdayNumbers: Record<string, Weekday> = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };

export function nativeNotificationsAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

// Separate serial queues, plus synchronous invalidation, make a late schedule or
// permission result harmless after pause, replacement, or unmount.
let restQueue: Promise<unknown> = Promise.resolve();
let restRevision = 0;
let reminderQueue: Promise<unknown> = Promise.resolve();
let reminderRevision = 0;
function enqueueRest<T>(operation: () => Promise<T>): Promise<T> {
  const result = restQueue.then(operation);
  restQueue = result.catch(() => undefined);
  return result;
}
function enqueueReminders<T>(operation: () => Promise<T>): Promise<T> {
  const result = reminderQueue.then(operation);
  reminderQueue = result.catch(() => undefined);
  return result;
}

/** Call only from an explicit user action. Never used by rest scheduling. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!nativeNotificationsAvailable()) return false;
  if ((await LocalNotifications.checkPermissions()).display === 'granted') return true;
  return (await LocalNotifications.requestPermissions()).display === 'granted';
}

export interface RestAlertStatus { enabled: boolean; precise: boolean; message: string }
export async function getRestAlertStatus(): Promise<RestAlertStatus> {
  if (!nativeNotificationsAvailable()) return {
    enabled: false, precise: false,
    message: 'Background rest alerts are available in the Android app. Keep this screen open for the timer sound.',
  };
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return {
    enabled: false, precise: false, message: 'Enable rest alerts to receive an Android notification when rest ends.',
  };
  let precise = false;
  try { precise = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'; }
  catch { /* An unavailable exact-alarm check must not stop an inexact alert. */ }
  return {
    enabled: true, precise,
    message: precise
      ? 'Android rest alerts are enabled. Battery saving and notification settings may delay or silence alerts.'
      : 'Android rest alerts are enabled without precise alarm access. Android may delay alerts, especially in battery saving.',
  };
}

async function createChannel(rest: boolean): Promise<void> {
  await LocalNotifications.createChannel({
    id: rest ? 'atlas-rest' : 'atlas-workouts',
    name: rest ? 'Rest timer' : 'Workout reminders',
    description: rest ? 'An alert when your rest finishes.' : 'Reminders on your selected training days.',
    importance: rest ? 4 : 3, visibility: 0, vibration: true,
    // Omit a custom sound: Android NotificationChannel retains its default
    // system notification sound. A literal "default" is treated as a raw file.
  });
}

export function cancelRestAlert(): Promise<void> {
  ++restRevision;
  if (!nativeNotificationsAvailable()) return Promise.resolve();
  return enqueueRest(() => LocalNotifications.cancel({ notifications: [{ id: REST_ALERT_ID }] }));
}

export function scheduleRestAlert(deadline: number): Promise<boolean> {
  const revision = ++restRevision;
  if (!nativeNotificationsAvailable()) return Promise.resolve(false);
  return enqueueRest(async () => {
    await LocalNotifications.cancel({ notifications: [{ id: REST_ALERT_ID }] });
    if (revision !== restRevision || !Number.isFinite(deadline) || deadline <= Date.now()) return false;
    const status = await getRestAlertStatus();
    if (!status.enabled || revision !== restRevision) return false;
    await createChannel(true);
    if (revision !== restRevision || deadline <= Date.now()) return false;
    await LocalNotifications.schedule({ notifications: [{
      id: REST_ALERT_ID, title: 'Rest complete', body: 'Ready for your next set.', channelId: 'atlas-rest',
      schedule: { at: new Date(deadline), allowWhileIdle: true },
      isExactNotification: status.precise, autoCancel: true,
    }] });
    // A cancellation/replacement during the native call runs next in this queue.
    return revision === restRevision;
  });
}

export function cancelWorkoutReminders(): Promise<void> {
  ++reminderRevision;
  if (!nativeNotificationsAvailable()) return Promise.resolve();
  return enqueueReminders(() => LocalNotifications.cancel({ notifications: WORKOUT_REMINDER_IDS.map((id) => ({ id })) }));
}

/** Pass false on reload/restore: check existing permission, never show a prompt. */
export function scheduleWorkoutReminders(
  settings: WorkoutReminderSettings, weekdays: string[], requestPermission = true,
): Promise<{ enabled: boolean; message: string }> {
  const revision = ++reminderRevision;
  const draft = { ...settings };
  const days = [...new Set(weekdays)];
  if (!nativeNotificationsAvailable()) return Promise.resolve({
    enabled: false, message: draft.enabled ? 'Workout reminders are available in the Android app, not this browser.' : 'Workout reminders are off.',
  });
  return enqueueReminders(async () => {
    const canceled = { enabled: false, message: 'Reminder changes were superseded.' };
    const cancel = () => LocalNotifications.cancel({ notifications: WORKOUT_REMINDER_IDS.map((id) => ({ id })) });
    try {
      await cancel();
      if (revision !== reminderRevision) return canceled;
      if (!draft.enabled) return { enabled: false, message: 'Workout reminders are off.' };
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) return { enabled: false, message: 'Choose a valid reminder time (HH:mm).' };
      if (!days.length || days.some((day) => !Object.hasOwn(weekdayNumbers, day))) return {
        enabled: false, message: 'Choose valid training weekdays in your profile before enabling reminders.',
      };
      const granted = requestPermission
        ? await requestNotificationPermission()
        : (await LocalNotifications.checkPermissions()).display === 'granted';
      if (revision !== reminderRevision) return canceled;
      if (!granted) return { enabled: false, message: 'Notifications are not allowed. Enable them in Android app settings, then save reminders again.' };
      await createChannel(false);
      if (revision !== reminderRevision) return canceled;
      const [hour, minute] = draft.time.split(':').map(Number);
      await LocalNotifications.schedule({ notifications: days.map((day) => ({
        id: WORKOUT_REMINDER_IDS[weekdayNumbers[day] - 1], title: 'Time for your workout',
        body: 'Open Atlas Fit when you’re ready to train.', channelId: 'atlas-workouts',
        schedule: { on: { weekday: weekdayNumbers[day], hour, minute, second: 0 }, repeats: true },
        // Weekly reminders do not need precise alarm access.
        isExactNotification: false, autoCancel: true,
      })) });
      if (revision !== reminderRevision) return canceled;
      return { enabled: true, message: `Workout reminders scheduled for ${days.join(', ')} at ${draft.time}, local time. Android may delay alerts.` };
    } catch {
      // A partial schedule is not a saved success. Clean up only our IDs.
      try { await cancel(); } catch { /* Surface the failure below. */ }
      return { enabled: false, message: 'Workout reminders could not be updated. Check Android notification settings and try saving again.' };
    }
  });
}
