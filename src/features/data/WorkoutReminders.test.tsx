import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutReminders } from './WorkoutReminders';

const mocks = vi.hoisted(() => ({ available: vi.fn(), schedule: vi.fn() }));
vi.mock('../../native/notifications', () => ({ nativeNotificationsAvailable: mocks.available, scheduleWorkoutReminders: mocks.schedule }));
beforeEach(() => { vi.resetAllMocks(); mocks.available.mockReturnValue(true); mocks.schedule.mockResolvedValue({ enabled: true, message: 'Reminders scheduled.' }); });
afterEach(cleanup);

describe('Workout reminder settings', () => {
  it('keeps a draft and schedules only after the explicit save action', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<WorkoutReminders weekdays={['Mon', 'Fri']} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Remind me to train'));
    fireEvent.change(screen.getByLabelText('Reminder time'), { target: { value: '09:20' } });
    expect(mocks.schedule).not.toHaveBeenCalled(); expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save reminders' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ enabled: true, time: '09:20' }));
    expect(mocks.schedule).toHaveBeenCalledWith({ enabled: true, time: '09:20' }, ['Mon', 'Fri']);
    expect(screen.getByRole('status').textContent).toContain('scheduled');
  });

  it('persists disabled rather than enabled when permission is denied', async () => {
    mocks.schedule.mockResolvedValue({ enabled: false, message: 'Notifications are not allowed.' });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<WorkoutReminders value={{ enabled: true, time: '18:00' }} weekdays={['Tue']} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save reminders' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ enabled: false, time: '18:00' }));
    expect(screen.getByRole('alert').textContent).toContain('not allowed');
    expect((screen.getByLabelText('Remind me to train') as HTMLInputElement).checked).toBe(false);
  });

  it('sends disabled settings for cancellation when switched off', async () => {
    mocks.schedule.mockResolvedValue({ enabled: false, message: 'Workout reminders are off.' });
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<WorkoutReminders value={{ enabled: true, time: '18:00' }} weekdays={['Tue']} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Remind me to train'));
    fireEvent.click(screen.getByRole('button', { name: 'Save reminders' }));
    await waitFor(() => expect(mocks.schedule).toHaveBeenCalledWith({ enabled: false, time: '18:00' }, ['Tue']));
  });

  it('makes the browser limitation clear and does not schedule on mount', () => {
    mocks.available.mockReturnValue(false);
    render(<WorkoutReminders weekdays={[]} onSave={vi.fn()} />);
    expect(screen.getByText(/Android app, not this browser/)).toBeDefined();
    expect((screen.getByLabelText('Remind me to train') as HTMLInputElement).disabled).toBe(true);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });

  it('surfaces persistence errors without a false success', async () => {
    render(<WorkoutReminders value={{ enabled: true, time: '18:00' }} weekdays={['Tue']} onSave={vi.fn().mockRejectedValue(new Error('Storage'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save reminders' }));
    expect((await screen.findByRole('alert')).textContent).toContain('not saved');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('preserves edits across unrelated renders but refreshes restored settings without scheduling', () => {
    const onSave = vi.fn();
    const { rerender } = render(<WorkoutReminders value={{ enabled: false, time: '18:00' }} weekdays={['Tue']} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Reminder time'), { target: { value: '09:20' } });
    rerender(<WorkoutReminders value={{ enabled: false, time: '18:00' }} weekdays={['Tue', 'Thu']} onSave={onSave} />);
    expect((screen.getByLabelText('Reminder time') as HTMLInputElement).value).toBe('09:20');
    rerender(<WorkoutReminders value={{ enabled: true, time: '07:00' }} weekdays={['Tue', 'Thu']} onSave={onSave} />);
    expect((screen.getByLabelText('Reminder time') as HTMLInputElement).value).toBe('07:00');
    expect((screen.getByLabelText('Remind me to train') as HTMLInputElement).checked).toBe(true);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
