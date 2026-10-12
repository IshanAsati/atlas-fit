// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { PlateCalculator } from './PlateCalculator.tsx';

afterEach(cleanup);

describe('PlateCalculator', () => {
  function open() { fireEvent.click(screen.getByText('Plate calculator')); }

  it('is an optional inline utility and shows a live equal-pair result', () => {
    render(<PlateCalculator initialLoadKg={100} />);
    const summary = screen.getByText('Plate calculator');
    expect(summary.closest('details')?.open).toBe(false);
    fireEvent.click(summary);
    expect(screen.getByLabelText('Target load (kg)').getAttribute('value')).toBe('100');
    expect(screen.getByRole('status').textContent).toContain('25 kg × 1 + 15 kg × 1');
    expect(screen.getByRole('status').textContent).toContain('Total loaded100 kg');
  });

  it('converts target and bar on a local unit switch and selects pounds presets', () => {
    render(<PlateCalculator initialLoadKg={100} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'lb' }));
    expect(screen.getByLabelText<HTMLInputElement>('Target load (lb)').value).toBe('220.46');
    expect(screen.getByLabelText<HTMLInputElement>('Bar weight (lb)').value).toBe('44.09');
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: '45 lb' }).checked).toBe(true);
    expect(screen.queryByRole('checkbox', { name: '0.5 kg' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Closest lower load');
    expect(screen.getByRole('status').textContent).toContain('Remaining to target1.37 lb');
  });

  it('starts in pounds from a canonical kg snapshot with a 45 lb default bar', () => {
    render(<PlateCalculator unit="lb" initialLoadKg={100} />);
    open();
    expect(screen.getByLabelText<HTMLInputElement>('Target load (lb)').value).toBe('220.46');
    expect(screen.getByLabelText<HTMLInputElement>('Bar weight (lb)').value).toBe('45');
  });

  it('converts current edits when the parent preference changes instead of reloading the snapshot', () => {
    const { rerender } = render(<PlateCalculator unit="kg" initialLoadKg={100} />);
    open();
    fireEvent.change(screen.getByLabelText('Target load (kg)'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Bar weight (kg)'), { target: { value: '15' } });
    rerender(<PlateCalculator unit="lb" initialLoadKg={200} />);
    expect(screen.getByLabelText<HTMLInputElement>('Target load (lb)').value).toBe('176.37');
    expect(screen.getByLabelText<HTMLInputElement>('Bar weight (lb)').value).toBe('33.07');
  });

  it('does not replace edited target when a new logged load arrives', () => {
    const { rerender } = render(<PlateCalculator initialLoadKg={100} />);
    open();
    fireEvent.change(screen.getByLabelText('Target load (kg)'), { target: { value: '70' } });
    rerender(<PlateCalculator initialLoadKg={200} />);
    expect(screen.getByLabelText<HTMLInputElement>('Target load (kg)').value).toBe('70');
  });

  it('uses only selected plate sizes and updates immediately as sizes are unchecked', () => {
    render(<PlateCalculator initialLoadKg={100} />);
    open();
    for (const checkbox of screen.getAllByRole('checkbox')) fireEvent.click(checkbox);
    expect(screen.getByRole('status').textContent).toContain('No plates — bar only');
    expect(screen.getByRole('status').textContent).toContain('Total loaded20 kg');
    expect(screen.getByRole('status').textContent).toContain('Remaining to target80 kg');
    expect(screen.getByText(/Assumes unlimited matching pairs/)).toBeDefined();
    fireEvent.click(screen.getByRole('checkbox', { name: '20 kg' }));
    expect(screen.getByRole('status').textContent).toContain('20 kg × 2');
    expect(screen.getByRole('status').textContent).toContain('Exact load');
  });

  it('shows a lower load with remaining weight instead of overshooting', () => {
    render(<PlateCalculator initialLoadKg={22.4} />);
    open();
    expect(screen.getByRole('status').textContent).toContain('Closest lower load');
    expect(screen.getByRole('status').textContent).toContain('Total loaded22 kg');
    expect(screen.getByRole('status').textContent).toContain('Remaining to target0.4 kg');
  });

  it('accepts a configurable zero-weight bar and rejects blank, negative, and below-bar targets', () => {
    render(<PlateCalculator initialLoadKg={10} />);
    open();
    expect(screen.getByRole('alert').textContent).toContain('at least the bar weight');
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.change(screen.getByLabelText('Bar weight (kg)'), { target: { value: '0' } });
    expect(screen.getByRole('status').textContent).toContain('Total loaded10 kg');
    fireEvent.change(screen.getByLabelText('Target load (kg)'), { target: { value: '' } });
    expect(screen.getByRole('alert').textContent).toContain('Enter a target');
    fireEvent.change(screen.getByLabelText('Target load (kg)'), { target: { value: '-5' } });
    expect(screen.getByRole('alert').textContent).toContain('Enter a target');
  });

  it('defaults to the bar alone without a workout and keeps each instance independently labelled', () => {
    render(<><PlateCalculator /><PlateCalculator initialLoadKg={60} /></>);
    const calculators = screen.getAllByText('Plate calculator').map((summary) => summary.closest('details')!);
    calculators.forEach((calculator) => { fireEvent.click(within(calculator).getByText('Plate calculator')); });
    const first = within(calculators[0]).getByLabelText<HTMLInputElement>('Target load (kg)');
    const second = within(calculators[1]).getByLabelText<HTMLInputElement>('Target load (kg)');
    expect(first.id).not.toBe(second.id);
    expect(first.value).toBe('20');
    expect(second.value).toBe('60');
    expect(within(calculators[0]).getByRole('status').textContent).toContain('Exact load');
  });
});
