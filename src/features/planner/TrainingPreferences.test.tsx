import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { TrainingPreferences, type TrainingPreferenceValue } from './TrainingPreferences';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const empty: TrainingPreferenceValue = { targetMuscles: [], avoidEquipment: [], restrictions: [] };

describe('TrainingPreferences', () => {
  it('toggles a target muscle via human-readable chip', () => {
    const onChange = vi.fn();
    render(<TrainingPreferences value={empty} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Abs' }));
    expect(onChange).toHaveBeenCalledWith({ ...empty, targetMuscles: ['abs'] });
  });

  it('applies the Legs preset without inventing other selections', () => {
    const onChange = vi.fn();
    render(<TrainingPreferences value={empty} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Legs' }));
    expect(onChange).toHaveBeenCalledWith({
      ...empty,
      targetMuscles: ['quads', 'hamstrings', 'glutes', 'calves'],
    });
  });

  it('toggles Smith machine avoidance and explains emphasis', () => {
    const onChange = vi.fn();
    render(<TrainingPreferences value={empty} onChange={onChange} />);
    expect(
      screen.getByText(/Targets mean emphasis, not exclusion/i),
    ).toBeDefined();
    expect(
      screen.getByText(/stays in your inventory/i),
    ).toBeDefined();
    fireEvent.change(screen.getByLabelText(/Search equipment to avoid/i), {
      target: { value: 'smith' },
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Smith machine' }));
    expect(onChange).toHaveBeenCalledWith({ ...empty, avoidEquipment: ['smith-machine'] });
  });

  it('adds and removes a specific exercise via search (limited results)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<TrainingPreferences value={empty} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/Search exercises to avoid/i), {
      target: { value: 'push-up' },
    });
    fireEvent.click(screen.getByRole('button', { name: '+ Push-up' }));
    expect(onChange).toHaveBeenCalledWith({ ...empty, restrictions: ['push-up'] });

    const withOne: TrainingPreferenceValue = { ...empty, restrictions: ['push-up'] };
    const onChange2 = vi.fn();
    rerender(<TrainingPreferences value={withOne} onChange={onChange2} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Push-up from avoided exercises' }),
    );
    expect(onChange2).toHaveBeenCalledWith(empty);
  });
});
