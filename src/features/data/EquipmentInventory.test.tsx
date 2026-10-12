import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EquipmentInventory } from './EquipmentInventory';
import { DEFAULT_EQUIPMENT } from '../../data/equipment';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const base = {
  location: 'home' as const,
  onLocationChange: vi.fn(),
  equipment: {
    home: [...DEFAULT_EQUIPMENT.home],
    gym: [...DEFAULT_EQUIPMENT.gym],
    travel: [...DEFAULT_EQUIPMENT.travel],
  },
  onToggle: vi.fn(),
  onResetLocation: vi.fn(),
};

describe('EquipmentInventory', () => {
  it('shows per-location counts and the current selection count', () => {
    render(<EquipmentInventory {...base} />);
    expect(screen.getByRole('button', { name: /Home \(6\)/ })).toBeDefined();
    expect(screen.getByText('6 items available for Home')).toBeDefined();
  });

  it('filters by search with a labelled input and offers clear on empty results', () => {
    render(<EquipmentInventory {...base} />);
    fireEvent.change(screen.getByLabelText('Search available equipment'), {
      target: { value: 'zzz-no-such-gear' },
    });
    expect(screen.getByText(/No matching equipment/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('Bodyweight')).toBeDefined();
  });

  it('filters by category chip (Abs) and keeps the location', () => {
    const onLocationChange = vi.fn();
    render(<EquipmentInventory {...base} onLocationChange={onLocationChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abs' }));
    // Gym · Abs entries surface; unrelated Home-only gear hides.
    expect(screen.getByLabelText(/Captain's chair/)).toBeDefined();
    expect(screen.queryByLabelText('Resistance bands / tubes')).toBeNull();
    expect(onLocationChange).not.toHaveBeenCalled();
  });

  it('reports toggles with the retained location and resets only that location', () => {
    const onToggle = vi.fn();
    const onResetLocation = vi.fn();
    render(<EquipmentInventory {...base} onToggle={onToggle} onResetLocation={onResetLocation} />);
    fireEvent.click(screen.getByLabelText('Cable station'));
    expect(onToggle).toHaveBeenCalledWith('home', 'cable', true);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Home equipment to defaults' }));
    expect(onResetLocation).toHaveBeenCalledWith('home');
  });

  it('keeps bodyweight always selected and disabled', () => {
    render(<EquipmentInventory {...base} />);
    const bodyweight = screen.getByLabelText('Bodyweight') as HTMLInputElement;
    expect(bodyweight.checked).toBe(true);
    expect(bodyweight.disabled).toBe(true);
  });
});
