// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BodygraphFigure, getMuscleFillColor } from './BodygraphFigure';
import { Bodygraph } from './Bodygraph';
import { MuscleDrawer } from './MuscleDrawer';
import type { WorkoutSession } from '../../data/types';
import { FRONT_MUSCLES, BACK_MUSCLES } from '../../data/muscles';

afterEach(() => {
  cleanup();
});

describe('getMuscleFillColor', () => {
  it('returns exact spec colors for classification and heatmap values', () => {
    expect(getMuscleFillColor('primary')).toBe('#FF4757');
    expect(getMuscleFillColor('secondary')).toBe('#00D2FF');
    expect(getMuscleFillColor('neutral')).toBe('#202633');
    expect(getMuscleFillColor(undefined)).toBe('#202633');

    // Heatmap numbers
    expect(getMuscleFillColor(0)).toBe('#202633');
    expect(getMuscleFillColor(2)).toBe('#123854');
    expect(getMuscleFillColor(5)).toBe('#0284c7');
    expect(getMuscleFillColor(10)).toBe('#00e5ff');
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
    expect(chestEl?.getAttribute('fill')).toBe('#FF4757');

    const bicepsEl = document.getElementById('biceps');
    expect(bicepsEl?.getAttribute('fill')).toBe('#00D2FF');

    const absEl = document.getElementById('abs');
    expect(absEl?.getAttribute('fill')).toBe('#202633');
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
    expect(latsEl?.getAttribute('fill')).toBe('#0284c7'); // 5 sets -> electric sky

    const trapsEl = document.getElementById('traps');
    expect(trapsEl?.getAttribute('fill')).toBe('#FF4757');
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
  it('renders interactive flipper with front and back views, toggles perspective', () => {
    render(<Bodygraph selectedExercise="push-up" />);

    // Flipper region exists
    const flipper = screen.getByRole('region', { name: /interactive 3d bodygraph/i });
    expect(flipper).toBeDefined();
    expect(flipper.getAttribute('class')).not.toContain('is-back');

    // Switch to Back view
    const backBtn = screen.getByRole('button', { name: /back view/i });
    fireEvent.click(backBtn);

    expect(flipper.getAttribute('class')).toContain('is-back');
  });

  it('opens MuscleDrawer when a muscle is clicked in Bodygraph', () => {
    render(<Bodygraph mode="targets" selectedExercise="push-up" />);

    const chestEls = document.querySelectorAll('#chest');
    expect(chestEls.length).toBeGreaterThan(0);

    fireEvent.click(chestEls[0]);

    // Drawer should open
    expect(screen.getByText('Chest (pectorals)')).toBeDefined();
  });
});
