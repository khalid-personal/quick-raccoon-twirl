// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MinistrySubmissionCountdown from '../MinistrySubmissionCountdown';
import { getConfig, saveConfig } from '@/lib/data-store';

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T20:00:00+03:00'));
});
afterEach(() => vi.useRealTimers());
describe('payment header ministry tracker', () => {
  it('ticks every second and updates for ministry calendar edits without resetting the payment page', async () => {
    saveConfig({ ...getConfig(), ministrySubmissionWindow: { startsOn: '2026-11-07', endsOn: '2026-11-07' } });
    const container = document.createElement('div'), root = createRoot(container);
    const interval = vi.spyOn(window, 'setInterval'), clear = vi.spyOn(window, 'clearInterval');
    await act(async () => root.render(<MinistrySubmissionCountdown />));
    expect(container.querySelector('[role="timer"]')?.textContent).toBe('0d 04h 00m 00s');
    await act(async () => vi.advanceTimersByTime(1000));
    expect(container.querySelector('[role="timer"]')?.textContent).toBe('0d 03h 59m 59s');
    await act(async () => {
      saveConfig({ ...getConfig(), ministrySubmissionWindow: { startsOn: '2026-11-01', endsOn: '2026-11-06' } });
      window.dispatchEvent(new Event('supabase-data-changed'));
    });
    expect(container.querySelector('[role="timer"]')?.textContent).toBe('Window overdue');
    await act(async () => root.unmount());
    expect(clear).toHaveBeenCalledWith(interval.mock.results[0].value);
    interval.mockRestore(); clear.mockRestore();
  });
});
