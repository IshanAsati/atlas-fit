import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RestTimer } from './RestTimer';

const mocks = vi.hoisted(() => ({ available: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), status: vi.fn(), request: vi.fn(), vibrate: vi.fn() }));
vi.mock('../../native/notifications', () => ({
  nativeNotificationsAvailable: mocks.available, scheduleRestAlert: mocks.schedule, cancelRestAlert: mocks.cancel,
  getRestAlertStatus: mocks.status, requestNotificationPermission: mocks.request,
}));
vi.mock('@capacitor/haptics', () => ({ Haptics: { vibrate: mocks.vibrate } }));
const flush = async () => { await act(async () => { await Promise.resolve(); }); };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-12T10:00:00Z')); vi.resetAllMocks();
  mocks.available.mockReturnValue(true); mocks.schedule.mockResolvedValue(true); mocks.cancel.mockResolvedValue(undefined);
  mocks.status.mockResolvedValue({ enabled: true, precise: false, message: 'Android may delay alerts.' });
  mocks.request.mockResolvedValue(true); mocks.vibrate.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Rest timer native lifecycle', () => {
  it('schedules silently, adds time, cancels on pause, and reschedules on resume', async () => {
    const now = Date.now();
    render(<RestTimer initialSeconds={60} isOpen onDismiss={vi.fn()} />); await flush();
    expect(mocks.schedule).toHaveBeenLastCalledWith(now + 60000); expect(mocks.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('+30s')); await flush();
    expect(mocks.schedule).toHaveBeenLastCalledWith(now + 90000);
    fireEvent.click(screen.getByText('Pause')); await flush(); expect(mocks.cancel).toHaveBeenCalledOnce();
    act(() => { vi.advanceTimersByTime(10000); });
    fireEvent.click(screen.getByText('+30s')); await flush(); expect(mocks.schedule).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByText('Resume')); await flush();
    expect(mocks.schedule).toHaveBeenLastCalledWith(now + 130000);
  });

  it('reports permission denial after an explicit button press', async () => {
    mocks.schedule.mockResolvedValue(false);
    mocks.status.mockResolvedValue({ enabled: false, precise: false, message: 'Enable rest alerts.' });
    mocks.request.mockResolvedValue(false);
    render(<RestTimer initialSeconds={60} isOpen onDismiss={vi.fn()} />); await flush();
    expect(mocks.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Enable rest alerts' })); await flush();
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(screen.getByRole('status').textContent).toMatch(/not allowed/);
    expect(mocks.schedule).toHaveBeenCalledOnce();
  });

  it('permission grant uses the original deadline, not a restarted countdown', async () => {
    const now = Date.now();
    mocks.schedule.mockResolvedValueOnce(false);
    mocks.status.mockResolvedValueOnce({ enabled: false, precise: false, message: 'Enable rest alerts.' });
    render(<RestTimer initialSeconds={60} isOpen onDismiss={vi.fn()} />); await flush();
    act(() => { vi.advanceTimersByTime(10000); });
    fireEvent.click(screen.getByRole('button', { name: 'Enable rest alerts' })); await flush();
    expect(mocks.schedule).toHaveBeenLastCalledWith(now + 60000);
    expect(screen.getByText('0:50')).toBeDefined();
  });

  it('a late permission grant while paused never schedules an alert', async () => {
    mocks.schedule.mockResolvedValue(false);
    mocks.status.mockResolvedValue({ enabled: false, precise: false, message: 'Enable rest alerts.' });
    let grant!: (value: boolean) => void;
    mocks.request.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
    render(<RestTimer initialSeconds={60} isOpen onDismiss={vi.fn()} />); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Enable rest alerts' }));
    fireEvent.click(screen.getByText('Pause')); await flush();
    await act(async () => { grant(true); }); await flush();
    expect(mocks.schedule).toHaveBeenCalledOnce(); expect(mocks.cancel).toHaveBeenCalledOnce();
  });

  it('cancels on skip and unmount even with an unresolved permission request', async () => {
    mocks.schedule.mockResolvedValue(false);
    mocks.status.mockResolvedValue({ enabled: false, precise: false, message: 'Enable rest alerts.' });
    let grant!: (value: boolean) => void;
    mocks.request.mockImplementation(() => new Promise((resolve) => { grant = resolve; }));
    const dismiss = vi.fn();
    const { unmount } = render(<RestTimer initialSeconds={60} isOpen onDismiss={dismiss} />); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Enable rest alerts' }));
    fireEvent.click(screen.getByText('Skip')); expect(dismiss).toHaveBeenCalledOnce();
    unmount(); await act(async () => { grant(true); });
    expect(mocks.cancel).toHaveBeenCalledTimes(2); expect(mocks.schedule).toHaveBeenCalledOnce();
  });

  it('catches up against the deadline, completes once, and provides foreground haptics', async () => {
    const completed = vi.fn();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    render(<RestTimer initialSeconds={60} isOpen onDismiss={vi.fn()} onTimerComplete={completed} />); await flush();
    vi.setSystemTime(Date.now() + 120000);
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(screen.getByText('Rest complete')).toBeDefined(); expect(completed).toHaveBeenCalledOnce();
    expect(mocks.vibrate).toHaveBeenCalledWith({ duration: 300 }); expect(mocks.cancel).toHaveBeenCalledOnce();
    await act(async () => { vi.advanceTimersByTime(1000); }); expect(completed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Done')); expect(mocks.cancel).toHaveBeenCalledTimes(2);
  });

  it('does not reset the timer when callback props change', async () => {
    const now = Date.now();
    const { rerender } = render(<RestTimer initialSeconds={60} isOpen onDismiss={vi.fn()} />); await flush();
    act(() => { vi.advanceTimersByTime(10000); });
    rerender(<RestTimer initialSeconds={60} isOpen onDismiss={vi.fn()} onTimerComplete={vi.fn()} />); await flush();
    expect(screen.getByText('0:50')).toBeDefined(); expect(mocks.schedule).toHaveBeenCalledOnce();
    expect(mocks.schedule).toHaveBeenCalledWith(now + 60000);
  });

  it('scheduling failures do not block countdown completion or dismissal', async () => {
    mocks.schedule.mockRejectedValue(new Error('Native failure'));
    const completed = vi.fn(); const dismiss = vi.fn();
    render(<RestTimer initialSeconds={1} isOpen onDismiss={dismiss} onTimerComplete={completed} />); await flush();
    expect(screen.getByRole('status').textContent).toMatch(/unavailable/);
    await act(async () => { vi.advanceTimersByTime(1000); }); expect(completed).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Done')); expect(dismiss).toHaveBeenCalledOnce();
  });

  it('preserves a web countdown without native scheduling, permission, or haptics', async () => {
    mocks.available.mockReturnValue(false);
    render(<RestTimer initialSeconds={1} isOpen onDismiss={vi.fn()} />); await flush();
    expect(screen.queryByRole('button', { name: 'Enable rest alerts' })).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/Android-only/);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Rest complete')).toBeDefined();
    expect(mocks.schedule).not.toHaveBeenCalled(); expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.vibrate).not.toHaveBeenCalled();
  });

  it('leaves delivery to Android if JavaScript completes while backgrounded', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<RestTimer initialSeconds={1} isOpen onDismiss={vi.fn()} />); await flush();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Rest complete')).toBeDefined();
    expect(mocks.cancel).not.toHaveBeenCalled(); expect(mocks.vibrate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Done')); expect(mocks.cancel).toHaveBeenCalledOnce();
  });
});
