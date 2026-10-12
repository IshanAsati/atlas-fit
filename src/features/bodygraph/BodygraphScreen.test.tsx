// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BodygraphScreen } from './BodygraphScreen';
import * as db from '../../data/db';
import * as backup from '../../data/backup';
import type { WorkoutSession } from '../../data/types';

// Mock recharts ResponsiveContainer to render children in jsdom
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 400, height: 230 }}>
        {children}
      </div>
    ),
  };
});

const mockSession: WorkoutSession = {
  id: 'session-101',
  title: 'Full Body Test Session',
  startedAt: Date.now() - 3600000,
  endedAt: Date.now(),
  location: 'gym',
  state: 'done',
  items: [
    {
      exerciseId: 'push-up',
      sets: [
        { reps: 10, loadKg: 0, done: true, effort: 2 },
        { reps: 10, loadKg: 0, done: true, effort: 2 },
      ],
    },
  ],
};

describe('BodygraphScreen Component (§4.6, §9)', () => {
  beforeEach(() => {
    vi.spyOn(db, 'getWorkoutSessions').mockResolvedValue([mockSession]);
    vi.spyOn(backup, 'downloadBackupFile').mockResolvedValue();
    vi.spyOn(backup, 'importBackupFile').mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders mode switcher pills: Mode A (Targets) vs Mode B (Activity)', async () => {
    render(<BodygraphScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Exercise Targets \(Mode A\)/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Training Activity Heatmap \(Mode B\)/i })).toBeDefined();
    });

    // Default is Mode A
    expect(screen.getByRole('button', { name: /Exercise Targets \(Mode A\)/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('allows searching and picking an exercise in Mode A', async () => {
    render(<BodygraphScreen />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search exercise/i)).toBeDefined();
    });

    const input = screen.getByPlaceholderText(/Search exercise/i);
    fireEvent.change(input, { target: { value: 'squat' } });

    await waitFor(() => {
      // Autocomplete list shows matches
      expect(screen.getByRole('button', { name: /Bodyweight Squat/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Bodyweight Squat/i }));

    await waitFor(() => {
      expect(screen.getByText('Bodyweight Squat')).toBeDefined();
      expect(screen.getByText('Quads')).toBeDefined();
    });
  });

  it('switches to Mode B and displays time window filters and activity labels', async () => {
    render(<BodygraphScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Training Activity Heatmap/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Training Activity Heatmap/i }));

    await waitFor(() => {
      expect(screen.getByText('Activity Time Window')).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'Last 7 Days' })[0]).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'Last 30 Days' })[0]).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'All Time' })[0]).toBeDefined();
      expect(screen.getByText(/Training activity estimate based on logged sets/i)).toBeDefined();
    });
  });

  it('renders interactive 3D Bodygraph with Front and Back view flip toggle', async () => {
    render(<BodygraphScreen />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Front View' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Back View' })).toBeDefined();
    });

    // Toggle to Back view
    fireEvent.click(screen.getByRole('button', { name: 'Back View' }));
    expect(screen.getByRole('button', { name: 'Back View' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('renders Weekly Volume Chart section', async () => {
    render(<BodygraphScreen />);

    await waitFor(() => {
      expect(screen.getByText('Muscle Volume Distribution')).toBeDefined();
      expect(screen.getByText(/Completed working sets per muscle group/i)).toBeDefined();
      expect(screen.getByTestId('responsive-container')).toBeDefined();
    });
  });

  it('renders expandable workout history log with completed session details', async () => {
    render(<BodygraphScreen />);

    await waitFor(() => {
      expect(screen.getByText('Workout History Log')).toBeDefined();
      expect(screen.getByText('Full Body Test Session')).toBeDefined();
      expect(screen.getByText(/2 sets/i)).toBeDefined();
    });

    // Expand the session
    const sessionBtn = screen.getByRole('button', { name: /Full Body Test Session/i });
    fireEvent.click(sessionBtn);

    await waitFor(() => {
      expect(screen.getByText(/Set 1: 10 reps/i)).toBeDefined();
      expect(screen.getByText(/Set 2: 10 reps/i)).toBeDefined();
    });
  });

  it('handles Export Backup and Restore Backup with confirmation dialog (§9)', async () => {
    render(<BodygraphScreen />);

    await waitFor(() => {
      expect(screen.getByText('Data Backup & Restore')).toBeDefined();
      expect(screen.getByRole('button', { name: /Export Backup \(JSON\)/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Restore Backup/i })).toBeDefined();
    });

    // Test Export
    fireEvent.click(screen.getByRole('button', { name: /Export Backup \(JSON\)/i }));
    await waitFor(() => {
      expect(backup.downloadBackupFile).toHaveBeenCalledTimes(1);
    });

    // Test file input change triggers restore confirmation dialog
    const file = new File(['{"schema": 1}'], 'atlas-backup.json', { type: 'application/json' });
    const hiddenFileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(hiddenFileInput).toBeDefined();

    fireEvent.change(hiddenFileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Confirm Backup Restore')).toBeDefined();
      expect(screen.getByText(/Restoring/i)).toBeDefined();
      expect(screen.getByRole('button', { name: 'Confirm & Restore' })).toBeDefined();
    });

    // Confirm restore
    fireEvent.click(screen.getByRole('button', { name: 'Confirm & Restore' }));
    await waitFor(() => {
      expect(backup.importBackupFile).toHaveBeenCalledWith(file);
    });
  });
});
