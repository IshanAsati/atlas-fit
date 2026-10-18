// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePosePlayback } from './usePosePlayback';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('usePosePlayback', () => {
  it('loops between two reference poses and stops on manual selection', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePosePlayback(true, 'squat'));
    expect(result.current.pose).toBe('start');
    act(() => result.current.togglePlayback());
    expect(result.current.isPlaying).toBe(true);
    act(() => vi.advanceTimersByTime(1400));
    expect(result.current.pose).toBe('peak');
    act(() => result.current.selectPose('start'));
    expect(result.current.isPlaying).toBe(false);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.pose).toBe('start');
  });

  it('resets playback when the exercise changes', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ id }) => usePosePlayback(true, id), {
      initialProps: { id: 'one' },
    });
    act(() => result.current.togglePlayback());
    act(() => vi.advanceTimersByTime(1400));
    rerender({ id: 'two' });
    expect(result.current.pose).toBe('start');
    expect(result.current.isPlaying).toBe(false);
  });

  it('stops while disabled and does not resume when re-enabled', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ enabled }) => usePosePlayback(enabled, 'squat'), {
      initialProps: { enabled: true },
    });
    act(() => result.current.togglePlayback());
    expect(result.current.isPlaying).toBe(true);
    rerender({ enabled: false });
    expect(result.current.isPlaying).toBe(false);
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.pose).toBe('start');
    rerender({ enabled: true });
    expect(result.current.isPlaying).toBe(false);
    act(() => vi.advanceTimersByTime(1400));
    expect(result.current.pose).toBe('start');
  });

  it('does not play when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    const { result } = renderHook(() => usePosePlayback(true, 'squat'));
    act(() => result.current.togglePlayback());
    expect(result.current.reducedMotion).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });
});