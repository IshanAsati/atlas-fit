import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelRestAlert, cancelWorkoutReminders, getRestAlertStatus, requestNotificationPermission, scheduleRestAlert, scheduleWorkoutReminders, REST_ALERT_ID, WORKOUT_REMINDER_IDS } from './notifications';

const mocks = vi.hoisted(() => ({
  native: vi.fn(), platform: vi.fn(), check: vi.fn(), request: vi.fn(), exact: vi.fn(),
  changeExact: vi.fn(), channel: vi.fn(), schedule: vi.fn(), cancel: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native, getPlatform: mocks.platform } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: {
  checkPermissions: mocks.check, requestPermissions: mocks.request, checkExactNotificationSetting: mocks.exact,
  changeExactNotificationSetting: mocks.changeExact, createChannel: mocks.channel, schedule: mocks.schedule, cancel: mocks.cancel,
} }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.native.mockReturnValue(true); mocks.platform.mockReturnValue('android');
  mocks.check.mockResolvedValue({ display: 'granted' }); mocks.request.mockResolvedValue({ display: 'granted' });
  mocks.exact.mockResolvedValue({ exact_alarm: 'granted' });
  mocks.channel.mockResolvedValue(undefined); mocks.schedule.mockResolvedValue({ notifications: [] }); mocks.cancel.mockResolvedValue(undefined);
});

describe('Local workout reminders', () => {
  it('maps local weekdays, deduplicates selections, and uses stable reserved IDs', async () => {
    const settings = { enabled: true, time: '07:35' };
    expect((await scheduleWorkoutReminders(settings, ['Mon', 'Sun', 'Sat', 'Mon'])).enabled).toBe(true);
    expect(mocks.cancel).toHaveBeenCalledWith({ notifications: WORKOUT_REMINDER_IDS.map((id) => ({ id })) });
    expect(mocks.channel).toHaveBeenCalledWith(expect.objectContaining({ id: 'atlas-workouts', vibration: true, importance: 3 }));
    const notifications = mocks.schedule.mock.calls[0][0].notifications;
    expect(notifications.map((notification: { id: number; schedule: unknown; isExactNotification: boolean }) => [notification.id, notification.schedule, notification.isExactNotification])).toEqual([
      [41002, { on: { weekday: 2, hour: 7, minute: 35, second: 0 }, repeats: true }, false],
      [41001, { on: { weekday: 1, hour: 7, minute: 35, second: 0 }, repeats: true }, false],
      [41007, { on: { weekday: 7, hour: 7, minute: 35, second: 0 }, repeats: true }, false],
    ]);
    await scheduleWorkoutReminders(settings, ['Mon']);
    expect(mocks.schedule.mock.calls[1][0].notifications[0].id).toBe(41002);
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
    expect(mocks.exact).not.toHaveBeenCalled(); expect(mocks.changeExact).not.toHaveBeenCalled();
  });

  it('cancels only reminder IDs when disabled and never requests permission', async () => {
    expect((await scheduleWorkoutReminders({ enabled: false, time: 'bad' }, [])).enabled).toBe(false);
    await cancelWorkoutReminders();
    expect(mocks.cancel).toHaveBeenLastCalledWith({ notifications: WORKOUT_REMINDER_IDS.map((id) => ({ id })) });
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it.each(['24:00', '12:60', '9:00', '', '12:30:00'])('rejects invalid HH:mm %s after canceling old reminders', async (time) => {
    const result = await scheduleWorkoutReminders({ enabled: true, time }, ['Mon']);
    expect(result.enabled).toBe(false); expect(result.message).toMatch(/valid reminder time/);
    expect(mocks.cancel).toHaveBeenCalledOnce(); expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it.each([{ days: [] }, { days: ['Monday'] }, { days: ['Mon', 'oops'] }, { days: ['constructor'] }])('rejects invalid weekdays $days', async ({ days }) => {
    expect((await scheduleWorkoutReminders({ enabled: true, time: '12:00' }, days)).enabled).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('returns disabled on denial rather than claiming alerts were saved', async () => {
    mocks.check.mockResolvedValue({ display: 'prompt' }); mocks.request.mockResolvedValue({ display: 'denied' });
    const result = await scheduleWorkoutReminders({ enabled: true, time: '12:00' }, ['Wed']);
    expect(result.enabled).toBe(false); expect(result.message).toMatch(/not allowed/);
    expect(mocks.request).toHaveBeenCalledOnce(); expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('checks without prompting when restoring saved settings', async () => {
    mocks.check.mockResolvedValue({ display: 'prompt' });
    expect((await scheduleWorkoutReminders({ enabled: true, time: '12:00' }, ['Wed'], false)).enabled).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
    mocks.check.mockResolvedValue({ display: 'granted' });
    expect((await scheduleWorkoutReminders({ enabled: true, time: '12:00' }, ['Wed'], false)).enabled).toBe(true);
  });

  it('never calls native APIs or promises alerts on web', async () => {
    mocks.native.mockReturnValue(false);
    const result = await scheduleWorkoutReminders({ enabled: true, time: '12:00' }, ['Wed']);
    expect(result.enabled).toBe(false); expect(result.message).toMatch(/browser/);
    expect(await requestNotificationPermission()).toBe(false);
    await cancelWorkoutReminders(); expect(await scheduleRestAlert(Date.now() + 60000)).toBe(false); await cancelRestAlert();
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.cancel).not.toHaveBeenCalled(); expect(mocks.check).not.toHaveBeenCalled();
  });

  it('does not let a late permission grant recreate disabled reminders', async () => {
    mocks.check.mockResolvedValue({ display: 'prompt' });
    let resolvePermission!: (value: { display: string }) => void;
    mocks.request.mockImplementation(() => new Promise((resolve) => { resolvePermission = resolve; }));
    const pending = scheduleWorkoutReminders({ enabled: true, time: '12:00' }, ['Wed']);
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalled());
    const cancel = cancelWorkoutReminders();
    resolvePermission({ display: 'granted' });
    expect((await pending).enabled).toBe(false); await cancel;
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('cleans up a failed schedule and reports a disabled result', async () => {
    mocks.schedule.mockRejectedValue(new Error('Native scheduling failed'));
    const result = await scheduleWorkoutReminders({ enabled: true, time: '12:00' }, ['Wed']);
    expect(result.enabled).toBe(false); expect(result.message).toMatch(/could not be updated/);
    expect(mocks.cancel).toHaveBeenCalledTimes(2);
  });
});

describe('Native rest alerts', () => {
  it('schedules the deadline with OS vibration and default channel sound', async () => {
    const deadline = Date.now() + 60000;
    expect(await scheduleRestAlert(deadline)).toBe(true);
    expect(mocks.channel).toHaveBeenCalledWith(expect.objectContaining({ id: 'atlas-rest', vibration: true, importance: 4 }));
    expect(mocks.channel.mock.calls[0][0].sound).toBeUndefined();
    expect(mocks.schedule).toHaveBeenCalledWith({ notifications: [expect.objectContaining({
      id: REST_ALERT_ID, channelId: 'atlas-rest', schedule: { at: new Date(deadline), allowWhileIdle: true }, isExactNotification: true,
    })] });
    expect(mocks.request).not.toHaveBeenCalled();
    await cancelRestAlert();
    expect(mocks.cancel).toHaveBeenLastCalledWith({ notifications: [{ id: REST_ALERT_ID }] });
  });

  it('uses an inexact alarm with truthful delay feedback and never launches settings', async () => {
    mocks.exact.mockResolvedValue({ exact_alarm: 'denied' });
    expect(await scheduleRestAlert(Date.now() + 60000)).toBe(true);
    expect(mocks.schedule.mock.calls[0][0].notifications[0].isExactNotification).toBe(false);
    expect((await getRestAlertStatus()).message).toMatch(/may delay/);
    expect(mocks.changeExact).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled();
  });

  it('allows an inexact alarm if the precise-alarm check is unavailable', async () => {
    mocks.exact.mockRejectedValue(new Error('Not available'));
    expect(await scheduleRestAlert(Date.now() + 60000)).toBe(true);
    expect(mocks.schedule.mock.calls[0][0].notifications[0].isExactNotification).toBe(false);
  });

  it('does not request permission while scheduling and rejects expired deadlines', async () => {
    mocks.check.mockResolvedValue({ display: 'prompt' });
    expect(await scheduleRestAlert(Date.now() + 60000)).toBe(false);
    expect(await scheduleRestAlert(Date.now() - 1)).toBe(false);
    expect(await scheduleRestAlert(NaN)).toBe(false);
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('serializes cancellation after an in-flight native schedule', async () => {
    let finish!: () => void;
    mocks.schedule.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const pending = scheduleRestAlert(Date.now() + 60000);
    await vi.waitFor(() => expect(mocks.schedule).toHaveBeenCalledOnce());
    const cancel = cancelRestAlert();
    finish(); expect(await pending).toBe(false); await cancel;
    expect(mocks.cancel).toHaveBeenLastCalledWith({ notifications: [{ id: REST_ALERT_ID }] });
    expect(mocks.schedule).toHaveBeenCalledOnce();
    expect(await scheduleRestAlert(Date.now() + 90000)).toBe(true);
  });

  it('invalidates a schedule still waiting for a permission check', async () => {
    let finish!: (value: { display: string }) => void;
    mocks.check.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const pending = scheduleRestAlert(Date.now() + 60000);
    await vi.waitFor(() => expect(mocks.check).toHaveBeenCalledOnce());
    const cancel = cancelRestAlert(); finish({ display: 'granted' });
    expect(await pending).toBe(false); await cancel;
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
