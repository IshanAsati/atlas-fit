// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BodygraphFigure } from './BodygraphFigure';
import { getMuscleFillColor } from './muscleColors';
import { Bodygraph } from './Bodygraph';
import { MuscleDrawer } from './MuscleDrawer';
import type { WorkoutSession } from '../../data/types';
import { FRONT_MUSCLES, BACK_MUSCLES } from '../../data/muscles';

afterEach(() => {
  cleanup();
});

describe('getMuscleFillColor', () => {
  it('returns exact spec colors for classification and heatmap values', () => {
    expect(getMuscleFillColor('primary')).toBe('var(--muscle-primary, #E86672)');
    expect(getMuscleFillColor('secondary')).toBe('var(--muscle-secondary, #A88BDA)');
    expect(getMuscleFillColor('neutral')).toBe('var(--muscle-neutral, #DADFD5)');
    expect(getMuscleFillColor(undefined)).toBe('var(--muscle-neutral, #DADFD5)');

    // Heatmap numbers
    expect(getMuscleFillColor(0)).toBe('var(--muscle-neutral, #DADFD5)');
    expect(getMuscleFillColor(2)).toBe('var(--muscle-activity-low, #C0CDAA)');
    expect(getMuscleFillColor(5)).toBe('var(--muscle-activity-mid, #8EA976)');
    expect(getMuscleFillColor(10)).toBe('var(--muscle-activity-high, #54794B)');
  });
});

describe('BodygraphFigure', () => {
  it('renders all front canonical muscles with proper id, className="mg", role="button", and aria-label', () => {
    const handleSelect = vi.fn();
    render(
      <BodygraphFigure
        view="front"
        highlightMap={{ chest: 'primary', biceps: 'secondary' }}
        onSelectMuscle={handleSelect}
      />,
    );

    for (const muscleId of FRONT_MUSCLES) {
      const el = document.getElementById(muscleId);
      expect(el).not.toBeNull();
      expect(el?.getAttribute('class')).toContain('mg');
      expect(el?.getAttribute('role')).toBe('button');
      expect(el?.getAttribute('tabindex')).toBe('0');
      expect(el?.getAttribute('aria-label')).toBeTruthy();
    }

    const chestEl = document.getElementById('chest');
    expect(chestEl?.getAttribute('fill')).toBe('var(--muscle-primary, #E86672)');

    const bicepsEl = document.getElementById('biceps');
    expect(bicepsEl?.getAttribute('fill')).toBe('var(--muscle-secondary, #A88BDA)');

    const absEl = document.getElementById('abs');
    expect(absEl?.getAttribute('fill')).toBe('var(--muscle-neutral, #DADFD5)');
  });

  it('renders all back canonical muscles with proper id and className="mg"', () => {
    const handleSelect = vi.fn();
    render(
      <BodygraphFigure
        view="back"
        highlightMap={{ lats: 5, traps: 'primary' }}
        onSelectMuscle={handleSelect}
      />,
    );

    for (const muscleId of BACK_MUSCLES) {
      const el = document.getElementById(muscleId);
      expect(el).not.toBeNull();
      expect(el?.getAttribute('class')).toContain('mg');
    }

    const latsEl = document.getElementById('lats');
    expect(latsEl?.getAttribute('fill')).toBe('var(--muscle-activity-mid, #8EA976)');

    const trapsEl = document.getElementById('traps');
    expect(trapsEl?.getAttribute('fill')).toBe('var(--muscle-primary, #E86672)');
  });

  it('handles click and keyboard Enter on muscle elements', () => {
    const handleSelect = vi.fn();
    render(<BodygraphFigure view="front" onSelectMuscle={handleSelect} />);

    const chestEl = document.getElementById('chest');
    expect(chestEl).not.toBeNull();

    if (chestEl) {
      fireEvent.click(chestEl);
      expect(handleSelect).toHaveBeenCalledWith('chest');

      fireEvent.keyDown(chestEl, { key: 'Enter' });
      expect(handleSelect).toHaveBeenCalledWith('chest');

      fireEvent.keyDown(chestEl, { key: ' ' });
      expect(handleSelect).toHaveBeenCalledWith('chest');
    }
  });
});

describe('MuscleDrawer', () => {
  const mockSessions: WorkoutSession[] = [
    {
      id: 'session-1',
      title: 'Chest & Arms',
      location: 'gym',
      startedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      endedAt: Date.now() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000,
      state: 'done',
      items: [
        {
          exerciseId: 'push-up',
          sets: [
            { reps: 12, loadKg: 0, done: true },
            { reps: 10, loadKg: 0, done: true },
            { reps: 8, loadKg: 0, done: true },
          ],
        },
      ],
    },
  ];

  it('renders muscle details, calculated working sets, and targeting exercises', () => {
    const handleClose = vi.fn();
    const handleSelectEx = vi.fn();

    render(
      <MuscleDrawer
        muscleId="chest"
        isOpen={true}
        onClose={handleClose}
        sessions={mockSessions}
        onSelectExercise={handleSelectEx}
      />,
    );

    expect(screen.getByText('Chest (pectorals)')).toBeDefined();
    expect(screen.getByText('Pushing muscles of the torso.')).toBeDefined();

    // 3 working sets week and month
    const statNumbers = screen.getAllByText('3');
    expect(statNumbers.length).toBeGreaterThanOrEqual(1);

    // Targeting exercises
    const pushupBtn = screen.getByText('Push-up');
    expect(pushupBtn).toBeDefined();

    fireEvent.click(pushupBtn);
    expect(handleSelectEx).toHaveBeenCalledWith('push-up');
  });

  it('closes on Escape key and close button', () => {
    const handleClose = vi.fn();
    render(
      <MuscleDrawer
        muscleId="chest"
        isOpen={true}
        onClose={handleClose}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: /close muscle details/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});

describe('Bodygraph', () => {
  it('switches the visible view without duplicate IDs or hidden muscle tab stops', () => {
    render(<Bodygraph selectedExercise="push-up" />);

    // Flipper region exists
    const flipper = screen.getByRole('region', { name: /interactive bodygraph/i });
    expect(flipper).toBeDefined();
    expect(flipper.getAttribute('class')).not.toContain('is-back');

    // Switch to Back view
    const backBtn = screen.getByRole('button', { name: /back view/i });
    fireEvent.click(backBtn);

    expect(flipper.getAttribute('class')).toContain('is-back');
    expect(document.querySelectorAll('#side_delts')).toHaveLength(1);
    expect(document.querySelector('#chest')).toBeNull();
    expect(document.querySelector('#lats')).not.toBeNull();
  });

  it('opens MuscleDrawer when a muscle is clicked in Bodygraph', () => {
    render(<Bodygraph mode="targets" selectedExercise="push-up" />);

    const chestEls = document.querySelectorAll('#chest');
    expect(chestEls.length).toBeGreaterThan(0);

    fireEvent.click(chestEls[0]);

    // Drawer should open
    expect(screen.getByText('Chest (pectorals)')).toBeDefined();
  });

  it('has a list alternative for small muscle regions', () => {
    render(<Bodygraph sessions={[]} selectedExercise="push-up" />);
    fireEvent.click(screen.getByText('Choose a muscle from a list'));
    fireEvent.click(screen.getByRole('button', { name: 'Lower back' }));
    expect(screen.getByRole('dialog', { name: 'Spinal erectors (lower back)' })).toBeDefined();
  });

  it('does not launch exercise details from its target picker', () => {
    const onSelectExercise = vi.fn();
    render(<Bodygraph sessions={[]} onSelectExercise={onSelectExercise} />);
    fireEvent.change(screen.getByLabelText('Inspect Exercise Targets'), { target: { value: 'bodyweight-squat' } });
    expect(onSelectExercise).not.toHaveBeenCalled();
  });
});
