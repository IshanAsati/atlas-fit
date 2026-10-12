// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ExerciseLibraryScreen } from './ExerciseLibraryScreen';
import { ExerciseDetailSheet } from './ExerciseDetailSheet';
import { CATALOG, CATALOG_BY_ID } from '../../data/catalog';
import type { Exercise } from '../../data/types';
import * as db from '../../data/db';

// Mock Dexie DB methods
vi.mock('../../data/db', async (importOriginal) => {
  const actual = await importOriginal<typeof db>();
  return {
    ...actual,
    getUserProfile: vi.fn().mockResolvedValue({
      displayName: 'Lifter',
      goal: 'strength',
      experience: 'some',
      activeLocation: 'home',
      equipment: {
        home: ['bodyweight', 'dumbbells', 'mat'],
        gym: ['bench', 'dumbbells', 'barbell', 'squat-rack'],
        travel: ['bodyweight'],
      },
      daysPerWeek: 3,
      durationMin: 45,
      weekdays: ['Mon', 'Wed', 'Fri'],
      restrictions: [],
      discomfortNotes: '',
      otherSports: '',
      liked: [],
      disliked: [],
      pinned: [],
      favourites: ['push-up'],
      onboarded: true,
    }),
    toggleFavourite: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve(id !== 'push-up');
    }),
    toggleRestriction: vi.fn().mockImplementation((_id: string) => {
      return Promise.resolve(true);
    }),
    getActiveWorkout: vi.fn().mockResolvedValue(null),
    saveActiveWorkout: vi.fn().mockResolvedValue(undefined),
  };
});

describe('ExerciseLibraryScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders search bar, filter controls, matching count and RepDB attribution', async () => {
    render(<ExerciseLibraryScreen />);

    // Screen title and subtitle
    expect(screen.getByRole('heading', { name: /Exercise Library/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/Search name, aliases, muscles, equipment.../i)).toBeTruthy();

    // Attribution
    const attribution = screen.getByText(/RepDB \(repdb\.co\)/i);
    expect(attribution).toBeTruthy();
    expect(attribution.closest('a')?.getAttribute('href')).toBe('https://repdb.co');

    // Matching count
    await waitFor(() => {
      const countBar = document.querySelector('.ex-count-bar');
      expect(countBar).toBeTruthy();
      expect(countBar?.textContent).toContain(`Showing ${CATALOG.length} of ${CATALOG.length} exercises`);
    });
  });

  it('performs instant fast search matching exercise name, muscle and equipment', async () => {
    render(<ExerciseLibraryScreen />);

    const searchInput = screen.getByPlaceholderText(/Search name, aliases, muscles, equipment.../i);

    // Search by name
    fireEvent.change(searchInput, { target: { value: 'Push-up' } });

    await waitFor(() => {
      const pushupCards = screen.getAllByText(/Push-up/i);
      expect(pushupCards.length).toBeGreaterThan(0);
    });

    // Clear search
    const clearBtn = screen.getByLabelText(/Clear search/i);
    fireEvent.click(clearBtn);
    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('filters exercises by movement pattern', async () => {
    render(<ExerciseLibraryScreen />);

    const squatChip = screen.getByRole('radio', { name: /Squat/i });
    fireEvent.click(squatChip);

    await waitFor(() => {
      expect(squatChip.getAttribute('class')).toContain('active');
    });

    // Reset filters
    const resetBtn = screen.getByRole('button', { name: /Reset Filters/i });
    fireEvent.click(resetBtn);

    await waitFor(() => {
      expect(squatChip.getAttribute('class')).not.toContain('active');
    });
  });

  it('filters exercises by muscle group and difficulty', async () => {
    render(<ExerciseLibraryScreen />);

    // Muscle group
    const chestChip = screen.getByRole('radio', { name: /Chest/i });
    fireEvent.click(chestChip);

    // Difficulty
    const beginnerChip = screen.getByRole('button', { name: /Beginner \(1\)/i });
    fireEvent.click(beginnerChip);

    await waitFor(() => {
      expect(chestChip.getAttribute('class')).toContain('active');
      expect(beginnerChip.getAttribute('class')).toContain('active');
    });
  });

  it('filters by favourites only and toggles card favorite button', async () => {
    render(<ExerciseLibraryScreen />);

    const favToggle = screen.getByRole('button', { name: /★ Favourites Only/i });
    fireEvent.click(favToggle);

    await waitFor(() => {
      expect(favToggle.getAttribute('aria-pressed')).toBe('true');
    });

    // Find favorite button on card and click
    const favButtons = screen.getAllByTitle(/favourite/i);
    expect(favButtons.length).toBeGreaterThan(0);
    fireEvent.click(favButtons[0]);

    expect(db.toggleFavourite).toHaveBeenCalled();
  });

  it('opens ExerciseDetailSheet when clicking an exercise card', async () => {
    render(<ExerciseLibraryScreen />);

    const card = await screen.findByText('Push-up');
    fireEvent.click(card);

    // Dialog opens
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog.textContent).toContain('Push-up');
    });
  });
});

describe('ExerciseDetailSheet', () => {
  const pushUpEx: Exercise = CATALOG_BY_ID['push-up'] ?? {
    id: 'push-up',
    name: 'Push-up',
    aliases: ['pushup', 'press up'],
    source: 'atlas',
    equipmentIds: ['bodyweight'],
    movement: 'hpush',
    difficulty: 1,
    primary: ['chest'],
    secondary: ['front_delts', 'triceps'],
    instructions: [
      'Start in a plank with hands under shoulders.',
      'Lower chest to floor.',
      'Press back up.',
    ],
    cues: ['Keep core braced', 'Elbows at 45 degrees'],
    mistakes: ['Sagging hips', 'Head drooping'],
    substitutes: ['incline-push-up'],
  };

  afterEach(() => {
    cleanup();
  });

  it('renders start and peak pose toggle buttons and switches pose', () => {
    render(
      <ExerciseDetailSheet
        exercise={pushUpEx}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    const startPoseBtn = screen.getByRole('tab', { name: /Start Pose/i });
    const peakPoseBtn = screen.getByRole('tab', { name: /Peak Pose/i });

    expect(startPoseBtn.getAttribute('aria-selected')).toBe('true');
    expect(peakPoseBtn.getAttribute('aria-selected')).toBe('false');

    fireEvent.click(peakPoseBtn);
    expect(peakPoseBtn.getAttribute('aria-selected')).toBe('true');
    expect(startPoseBtn.getAttribute('aria-selected')).toBe('false');
  });

  it('embeds front and back mini Bodygraph with crimson primary and cyan secondary highlights', () => {
    render(
      <ExerciseDetailSheet
        exercise={pushUpEx}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    // Front & Back labels
    expect(screen.getByText('Front')).toBeTruthy();
    expect(screen.getByText('Back')).toBeTruthy();

    // Anatomical SVGs
    const frontSvg = screen.getByLabelText(/Cartoon bodygraph figure, front view/i);
    const backSvg = screen.getByLabelText(/Cartoon bodygraph figure, back view/i);
    expect(frontSvg).toBeTruthy();
    expect(backSvg).toBeTruthy();

    // Chest is primary -> #FF4757
    const chestGroup = frontSvg.querySelector('#chest');
    expect(chestGroup?.getAttribute('fill')).toBe('#FF4757');

    // Front delts is secondary -> #00D2FF
    const frontDeltsGroup = frontSvg.querySelector('#front_delts');
    expect(frontDeltsGroup?.getAttribute('fill')).toBe('#00D2FF');

    // Triceps is secondary on back -> #00D2FF
    const tricepsGroup = backSvg.querySelector('#triceps');
    expect(tricepsGroup?.getAttribute('fill')).toBe('#00D2FF');
  });

  it('renders instructions, coach cues (green), common mistakes (warn) and equipment badges', () => {
    render(
      <ExerciseDetailSheet
        exercise={pushUpEx}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    // Instructions
    expect(screen.getByText(/Start in a plank with hands under shoulders/i)).toBeTruthy();
    expect(screen.getByText(/Lower your chest toward the floor/i)).toBeTruthy();

    // Coach Cues (green callout)
    expect(screen.getByText(/Coach Cues/i)).toBeTruthy();
    expect(screen.getByText(/Ribs down/i)).toBeTruthy();

    // Common Mistakes (warn callout)
    expect(screen.getByText(/Common Mistakes to Avoid/i)).toBeTruthy();
    expect(screen.getByText(/Hips sagging/i)).toBeTruthy();

    // Equipment badge
    expect(screen.getAllByText(/Bodyweight/i).length).toBeGreaterThan(0);
  });

  it('allows toggling favourite and avoid restriction', async () => {
    render(
      <ExerciseDetailSheet
        exercise={pushUpEx}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    // Toggle Favourite
    const favBtn = screen.getByRole('button', { name: /favourites/i });
    fireEvent.click(favBtn);
    expect(db.toggleFavourite).toHaveBeenCalledWith('push-up');

    // Toggle Avoid
    const avoidBtn = screen.getByRole('button', { name: /avoid/i });
    fireEvent.click(avoidBtn);
    expect(db.toggleRestriction).toHaveBeenCalledWith('push-up');
  });

  it('renders Substitute or Add to Workout in workout mode', () => {
    const handleSub = vi.fn();
    render(
      <ExerciseDetailSheet
        exercise={pushUpEx}
        isOpen={true}
        onClose={vi.fn()}
        onSubstitute={handleSub}
      />,
    );

    const subBtn = screen.getByRole('button', { name: /Substitute Current Exercise/i });
    expect(subBtn).toBeTruthy();
    fireEvent.click(subBtn);
    expect(handleSub).toHaveBeenCalledWith(pushUpEx);
  });

  it('closes on Escape key and close button', () => {
    const handleClose = vi.fn();
    render(
      <ExerciseDetailSheet
        exercise={pushUpEx}
        isOpen={true}
        onClose={handleClose}
      />,
    );

    const closeBtn = screen.getByLabelText(/Close details/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
