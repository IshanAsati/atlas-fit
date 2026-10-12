// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MirrorDemo } from './MirrorDemo';
import * as gifs from '../../data/exerciseGifs';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const gif = { exId: '0001', name: '3/4 sit-up', gifUrl: 'https://cdn.jsdelivr.net/gh/x/0001.gif' };

describe('MirrorDemo', () => {
  it('looks up and saves a mirror demo only on explicit taps', async () => {
    const lookup = vi.spyOn(gifs, 'findMirrorGif').mockResolvedValue(gif);
    const cache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue(cache) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, clone: () => ({}),
      headers: { get: () => 'image/gif' },
    }));
    render(<MirrorDemo name="3/4 Sit-Up" />);
    expect(lookup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Try animated demo/ }));
    await waitFor(() => expect(lookup).toHaveBeenCalledWith('3/4 Sit-Up'));
    expect(await screen.findByRole('button', { name: /Save demo offline/ })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Save demo offline/ }));
    await waitFor(() => expect(cache.put).toHaveBeenCalled());
    expect(await screen.findByText(/saved on this device for offline use/)).toBeDefined();
  });

  it('reports a missing mirror honestly without caching anything', async () => {
    vi.spyOn(gifs, 'findMirrorGif').mockResolvedValue(null);
    const put = vi.fn();
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match: vi.fn(), put }) });
    render(<MirrorDemo name="Nonexistent Exercise" />);
    fireEvent.click(screen.getByRole('button', { name: /Try animated demo/ }));
    expect(await screen.findByText(/No mirror demo found/)).toBeDefined();
    expect(put).not.toHaveBeenCalled();
  });
});
