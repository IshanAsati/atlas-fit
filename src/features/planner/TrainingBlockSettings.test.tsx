import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import type { TrainingBlockSettings } from '../../data/types';
import { TrainingBlockControls } from './TrainingBlockSettings';

const value: TrainingBlockSettings = { enabled: true, lengthWeeks: 6, startDate: '2026-03-01', deloadLastWeek: true };
const stylesheet = document.createElement('style');
beforeAll(() => {
  // Vitest stubs CSS imports; inject the shipped rules for this size check.
  stylesheet.textContent = readFileSync('src/features/planner/TrainingBlockSettings.css', 'utf8');
  document.head.append(stylesheet);
});
afterAll(() => stylesheet.remove());

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 2, 9, 12));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('TrainingBlockControls', () => {
  it('shows the saved week and history-led progression conditions with accessible controls', () => {
    render(<TrainingBlockControls value={value} onSave={vi.fn()} />);
    expect(screen.getByText('Week 2 of 6 · Build')).toBeDefined();
    expect(screen.getByText(/previous performance supports it/)).toBeDefined();
    expect((screen.getByLabelText('Enable training block') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe('2026-03-01');
    expect((screen.getByLabelText('Block length') as HTMLSelectElement).value).toBe('6');
    expect(screen.getByText(/Stop or swap/)).toBeDefined();
  });

  it('starts disabled without persisting defaults and saves only after the explicit action', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TrainingBlockControls onSave={onSave} />);
    expect(screen.getByText('Training block off')).toBeDefined();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Enable training block'));
    fireEvent.change(screen.getByLabelText('Block length'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-03-02' } });
    fireEvent.click(screen.getByLabelText('Deload in the last week'));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save training block' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ enabled: true, lengthWeeks: 8, startDate: '2026-03-02', deloadLastWeek: false }));
    expect(screen.getByRole('status').textContent).toMatch(/saved/);
  });

  it('saves disabled settings explicitly without altering the parent value', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TrainingBlockControls value={value} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('Enable training block'));
    expect(value.enabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Save training block' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...value, enabled: false }));
  });

  it('requires a valid start date with an associated accessible error', () => {
    const onSave = vi.fn();
    render(<TrainingBlockControls value={value} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } });
    const input = screen.getByLabelText('Start date');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/valid calendar date/);
    fireEvent.click(screen.getByRole('button', { name: 'Save training block' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').some((alert) => alert.textContent?.includes('before saving'))).toBe(true);
  });

  it('shows future, deload and complete states rather than silently repeating', () => {
    const { rerender } = render(<TrainingBlockControls value={{ ...value, startDate: '2026-04-01' }} onSave={vi.fn()} />);
    expect(screen.getByText('Training block not started')).toBeDefined();
    rerender(<TrainingBlockControls value={{ ...value, lengthWeeks: 4, startDate: '2026-02-16' }} onSave={vi.fn()} />);
    expect(screen.getByText('Week 4 of 4 · Deload')).toBeDefined();
    expect(screen.getByText(/15% lighter load/)).toBeDefined();
    rerender(<TrainingBlockControls value={{ ...value, startDate: '2026-01-01' }} onSave={vi.fn()} />);
    expect(screen.getByText('Training block complete')).toBeDefined();
    expect(screen.getByText(/do not repeat automatically/)).toBeDefined();
  });

  it('drafts an explicit restart today and waits for Save before invoking the parent', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<TrainingBlockControls value={{ ...value, enabled: false, startDate: '2026-01-01' }} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restart from today' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/Restart drafted/);
    expect(screen.getByText('Week 1 of 6 · Build')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save training block' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ ...value, startDate: '2026-03-09' }));
  });

  it('prevents duplicate saves and locks fields while persistence is pending', async () => {
    let finish!: () => void;
    const onSave = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<TrainingBlockControls value={value} onSave={onSave} />);
    const button = screen.getByRole('button', { name: 'Save training block' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Saving training block…' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Start date') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('region', { name: 'Training block' }).getAttribute('aria-busy')).toBe('true');
    await act(async () => { finish(); });
    expect((screen.getByRole('button', { name: 'Save training block' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('retains draft and offers retry when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('storage failed')).mockResolvedValueOnce(undefined);
    render(<TrainingBlockControls value={value} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Block length'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save training block' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/try saving again/));
    expect((screen.getByLabelText('Block length') as HTMLSelectElement).value).toBe('8');
    fireEvent.click(screen.getByRole('button', { name: 'Save training block' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it('honors disabled and never submits an enclosing form', () => {
    const onSave = vi.fn();
    const submit = vi.fn((event) => event.preventDefault());
    const { rerender } = render(<form onSubmit={submit}><TrainingBlockControls value={value} onSave={onSave} disabled /></form>);
    screen.getAllByRole('button').forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByLabelText('Enable training block') as HTMLInputElement).disabled).toBe(true);
    rerender(<form onSubmit={submit}><TrainingBlockControls value={value} onSave={onSave} /></form>);
    screen.getAllByRole('button').forEach((button) => expect(button.getAttribute('type')).toBe('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Restart from today' }));
    expect(submit).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('uses 14px support text, 16px fields, and at least 44px action targets', () => {
    render(<TrainingBlockControls value={value} onSave={vi.fn()} />);
    expect(getComputedStyle(screen.getByText(/Follow 4, 6, or 8 weeks/)).fontSize).toBe('14px');
    expect(getComputedStyle(screen.getByLabelText('Start date')).fontSize).toBe('16px');
    screen.getAllByRole('button').forEach((button) => expect(parseFloat(getComputedStyle(button).minHeight)).toBeGreaterThanOrEqual(44));
  });
});
