import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as health from '../../native/healthConnect';
import { HealthSummary } from './HealthSummary';

vi.mock('../../native/healthConnect', () => ({
  nativeHealthAvailable: vi.fn(), getHealthConnectStatus: vi.fn(), getTodayHealthSummary: vi.fn(),
  requestHealthAccess: vi.fn(), openHealthConnect: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(health.nativeHealthAvailable).mockReturnValue(true);
  vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: false });
  vi.mocked(health.getTodayHealthSummary).mockResolvedValue({ date: '2026-10-12', steps: 1234, distanceKm: 0.9, activeCalories: 84 });
  vi.mocked(health.openHealthConnect).mockResolvedValue();
});
afterEach(cleanup);

describe('Today’s health', () => {
  it('shows browser fallback without invented metrics or a connect button', () => {
    vi.mocked(health.nativeHealthAvailable).mockReturnValue(false);
    render(<HealthSummary />);
    expect(screen.getByText(/not this browser/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(health.getHealthConnectStatus).not.toHaveBeenCalled();
  });
  it('requires an explicit connect action before requesting access', async () => {
    render(<HealthSummary />);
    const connect = await screen.findByRole('button', { name: 'Connect Health Connect' });
    expect(health.requestHealthAccess).not.toHaveBeenCalled();
    expect(health.getTodayHealthSummary).not.toHaveBeenCalled();
    vi.mocked(health.requestHealthAccess).mockResolvedValue(true);
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: true });
    fireEvent.click(connect);
    expect(await screen.findByText('Steps')).toBeTruthy();
    expect(health.requestHealthAccess).toHaveBeenCalledOnce();
  });
  it('honestly explains denied steps access', async () => {
    vi.mocked(health.requestHealthAccess).mockResolvedValue(false);
    render(<HealthSummary />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Health Connect' }));
    expect(await screen.findByText(/Steps access was not granted/)).toBeTruthy();
    expect(health.getTodayHealthSummary).not.toHaveBeenCalled();
  });
  it('shows three readable readings with units', async () => {
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: true });
    render(<HealthSummary />);
    expect(await screen.findByText('1,234')).toBeTruthy();
    expect(screen.getByText('0.9 km')).toBeTruthy();
    expect(screen.getByText('84 kcal')).toBeTruthy();
    expect(screen.getByText(/not saved to Atlas Fit/)).toBeTruthy();
    expect(health.requestHealthAccess).not.toHaveBeenCalled();
  });
  it('keeps missing optional metrics distinct from actual zero steps', async () => {
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: true });
    vi.mocked(health.getTodayHealthSummary).mockResolvedValue({ date: '2026-10-12', steps: 0, distanceKm: null, activeCalories: null });
    render(<HealthSummary />);
    expect(await screen.findByText('0')).toBeTruthy();
    expect(screen.getAllByText('Not available')).toHaveLength(2);
    expect(screen.queryByText(/has not recorded steps yet/)).toBeNull();
  });
  it('explains missing step data without fabricating zero', async () => {
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: true });
    vi.mocked(health.getTodayHealthSummary).mockResolvedValue({ date: '2026-10-12', steps: null, distanceKm: null, activeCalories: null });
    render(<HealthSummary />);
    expect(await screen.findByText('No data yet')).toBeTruthy();
    expect(screen.getByText(/has not recorded steps yet/)).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });
  it('opens the provider install page only on a user action', async () => {
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'install-required', permissionsGranted: false });
    render(<HealthSummary />);
    const install = await screen.findByRole('button', { name: 'Install or update Health Connect' });
    expect(health.openHealthConnect).not.toHaveBeenCalled();
    fireEvent.click(install);
    expect(health.openHealthConnect).toHaveBeenCalledOnce();
  });
  it('shows unsupported device reason and never prompts', async () => {
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'unavailable', permissionsGranted: false });
    render(<HealthSummary />);
    expect(await screen.findByText(/requires Android 9 or later/)).toBeTruthy();
    expect(health.requestHealthAccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Connect Health Connect' })).toBeNull();
  });
  it('allows a manual refresh without requesting permission', async () => {
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: true });
    render(<HealthSummary />);
    await screen.findByText('Steps');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(health.getTodayHealthSummary).toHaveBeenCalledTimes(2));
    expect(health.requestHealthAccess).not.toHaveBeenCalled();
  });
  it('rechecks access on foreground and clears readings after revocation', async () => {
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: true });
    render(<HealthSummary />);
    await screen.findByText('Steps');
    vi.mocked(health.getHealthConnectStatus).mockResolvedValue({ status: 'available', permissionsGranted: false });
    fireEvent(document, new Event('visibilitychange'));
    await screen.findByRole('button', { name: 'Connect Health Connect' });
    expect(screen.queryByText('1,234')).toBeNull();
    expect(health.getTodayHealthSummary).toHaveBeenCalledOnce();
    expect(health.requestHealthAccess).not.toHaveBeenCalled();
  });
  it('offers retry after a read error', async () => {
    vi.mocked(health.getHealthConnectStatus).mockRejectedValueOnce(new Error('Provider unavailable'));
    render(<HealthSummary />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByRole('button', { name: 'Connect Health Connect' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('surfaces permission dialog failures', async () => {
    vi.mocked(health.requestHealthAccess).mockRejectedValue(new Error('No permission Activity'));
    render(<HealthSummary />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Health Connect' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' }).hasAttribute('disabled')).toBe(false);
  });
});
