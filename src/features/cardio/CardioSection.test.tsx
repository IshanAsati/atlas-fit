import 'fake-indexeddb/auto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { getCardioSessions, saveCardioSession, deleteCardioSession } from '../../data/cardio';
import type { CardioSession } from '../../data/types';
import { CardioSection } from './CardioSection';

vi.mock('../../data/cardio', () => ({ getCardioSessions: vi.fn(), saveCardioSession: vi.fn(), deleteCardioSession: vi.fn() }));
const stored: CardioSession = { id: 'saved', activity: 'run', durationMin: 30, distanceKm: 5, intensity: 'easy', completedAt: new Date(2026, 2, 1).getTime() };
const stylesheet = document.createElement('style');
beforeAll(() => {
  stylesheet.textContent = readFileSync('src/features/cardio/CardioSection.css', 'utf8');
  document.head.append(stylesheet);
});
afterAll(() => stylesheet.remove());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 2, 12));
  vi.mocked(getCardioSessions).mockResolvedValue([]);
  vi.mocked(saveCardioSession).mockResolvedValue(undefined);
  vi.mocked(deleteCardioSession).mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

async function openForm() {
  await waitFor(() => expect(screen.queryByText('Loading cardio…')).toBeNull());
  fireEvent.click(screen.getByText('Log cardio'));
}

describe('CardioSection', () => {
  it('renders a separate, actionable empty state with labelled inputs and local today', async () => {
    render(<CardioSection />);
    await openForm();
    expect(screen.getByRole('region', { name: 'Cardio' })).toBeDefined();
    expect(screen.getByText('Separate from strength sets')).toBeDefined();
    expect(screen.getByText(/No cardio logged yet/)).toBeDefined();
    for (const label of ['Activity', 'Duration (minutes)', 'Distance (km, optional)', 'Distance unit', 'Completed date', 'Effort', 'Notes (optional)']) expect(screen.getByLabelText(label)).toBeDefined();
    expect((screen.getByLabelText('Completed date') as HTMLInputElement).value).toBe('2026-03-02');
    expect(saveCardioSession).not.toHaveBeenCalled();
  });

  it('explicitly saves fractional duration, miles as km, effort, notes, and a local past date across months', async () => {
    render(<CardioSection />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Activity'), { target: { value: 'cycle' } });
    fireEvent.change(screen.getByLabelText('Duration (minutes)'), { target: { value: '20.5' } });
    fireEvent.change(screen.getByLabelText('Distance unit'), { target: { value: 'mi' } });
    fireEvent.change(screen.getByLabelText('Distance (mi, optional)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Completed date'), { target: { value: '2026-02-28' } });
    fireEvent.change(screen.getByLabelText('Effort'), { target: { value: 'hard' } });
    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: '  Hills  ' } });
    expect(saveCardioSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save cardio session' }));
    await waitFor(() => expect(saveCardioSession).toHaveBeenCalledWith(expect.objectContaining({ activity: 'cycle', durationMin: 20.5, distanceKm: 3.218688, intensity: 'hard', notes: 'Hills', completedAt: new Date(2026, 1, 28).getTime() })));
    expect(screen.getByRole('status').textContent).toMatch(/saved on this device/);
    expect(screen.getByText(/Hard · 2 mi/)).toBeDefined();
    expect((screen.getByLabelText('Duration (minutes)') as HTMLInputElement).value).toBe('');
  });

  it('keeps draft distance equivalent when changing units and uses only the current local week', async () => {
    vi.mocked(getCardioSessions).mockResolvedValue([stored, { ...stored, id: 'monday', completedAt: new Date(2026, 2, 2).getTime(), durationMin: 10, distanceKm: 1.609344 }]);
    render(<CardioSection />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Distance (km, optional)'), { target: { value: '1.609344' } });
    fireEvent.change(screen.getByLabelText('Distance unit'), { target: { value: 'mi' } });
    expect(Number((screen.getByLabelText('Distance (mi, optional)') as HTMLInputElement).value)).toBeCloseTo(1);
    expect(screen.getByText('This week (Mon–Sun): 10 logged minutes · 1 mi logged distance')).toBeDefined();
  });

  it('associates validation errors and blocks invalid duration, distance and future dates', async () => {
    render(<CardioSection />);
    await openForm();
    const save = screen.getByRole('button', { name: 'Save cardio session' });
    fireEvent.click(save);
    expect(screen.getByLabelText('Duration (minutes)').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText('Duration (minutes)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Distance (km, optional)'), { target: { value: '-1' } });
    fireEvent.click(save);
    expect(screen.getByRole('alert').textContent).toMatch(/distance greater than 0/);
    fireEvent.change(screen.getByLabelText('Distance (km, optional)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Completed date'), { target: { value: '2026-03-03' } });
    fireEvent.click(save);
    expect(screen.getByRole('alert').textContent).toMatch(/today or a valid past date/);
    expect(screen.getByLabelText('Completed date').getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(saveCardioSession).not.toHaveBeenCalled();
  });

  it('preserves fields without false success when saving fails, and allows retry', async () => {
    vi.mocked(saveCardioSession).mockRejectedValueOnce(new Error('Storage full'));
    render(<CardioSection />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Duration (minutes)'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Notes (optional)'), { target: { value: 'Keep this' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save cardio session' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not saved/));
    expect((screen.getByLabelText('Duration (minutes)') as HTMLInputElement).value).toBe('15');
    expect((screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value).toBe('Keep this');
    expect(screen.queryByText(/saved on this device/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save cardio session' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/saved on this device/));
  });

  it('locks the form and prevents duplicate saves during a pending write', async () => {
    let finish!: () => void;
    vi.mocked(saveCardioSession).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<CardioSection />);
    await openForm();
    fireEvent.change(screen.getByLabelText('Duration (minutes)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save cardio session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(saveCardioSession).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Duration (minutes)').closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByRole('region', { name: 'Cardio' }).getAttribute('aria-busy')).toBe('true');
    await act(async () => { finish(); });
  });

  it('requires confirmation to delete, supports cancellation, and keeps a failed delete visible', async () => {
    vi.mocked(getCardioSessions).mockResolvedValue([stored]);
    vi.mocked(deleteCardioSession).mockRejectedValueOnce(new Error('Cannot write'));
    render(<CardioSection />);
    await waitFor(() => expect(screen.getByText('Run · 30 min')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /^Delete run/ }));
    expect(deleteCardioSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep record' }));
    expect(screen.queryByRole('button', { name: 'Confirm delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Delete run/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/not deleted/));
    expect(screen.getByText('Run · 30 min')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(screen.getByText(/No cardio logged yet/)).toBeDefined());
    expect(deleteCardioSession).toHaveBeenCalledWith(stored.id);
  });

  it('shows a load error instead of an empty-state claim and can retry', async () => {
    vi.mocked(getCardioSessions).mockRejectedValueOnce(new Error('Cannot read'));
    render(<CardioSection />);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Could not load/));
    expect(screen.queryByText(/No cardio logged yet/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry cardio history' }));
    await waitFor(() => expect(screen.getByText(/No cardio logged yet/)).toBeDefined());
  });

  it('limits compact history and offers all records without a new tab', async () => {
    vi.mocked(getCardioSessions).mockResolvedValue(Array.from({ length: 6 }, (_, index) => ({ ...stored, id: String(index) })));
    render(<CardioSection compact />);
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Show all 6 cardio sessions' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer cardio sessions' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('uses 14px support, 16px fields and at least 44px action targets', async () => {
    render(<CardioSection />);
    await openForm();
    expect(getComputedStyle(screen.getByText(/This week/)).fontSize).toBe('14px');
    expect(getComputedStyle(screen.getByLabelText('Duration (minutes)')).fontSize).toBe('16px');
    screen.getAllByRole('button').forEach((button) => expect(parseFloat(getComputedStyle(button).minHeight)).toBeGreaterThanOrEqual(44));
  });
});
