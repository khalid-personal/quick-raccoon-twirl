// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JourneyArrowField from '../JourneyArrowField';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('renders many mini faceted arrows, remains still at rest and updates only with scroll', async () => {
  await act(async () => root.render(<JourneyArrowField />));
  const arrows = container.querySelectorAll<HTMLElement>('.journey-shooting-arrow');
  expect(arrows).toHaveLength(24);
  expect(container.querySelector('.journey-arrow-field')?.getAttribute('data-motion')).toBe('scroll');
  expect(arrows[0].style.getPropertyValue('--arrow-size')).toBe('12px');
  const before = arrows[0].style.cssText;
  await act(async () => {});
  expect(arrows[0].style.cssText).toBe(before);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(500);
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(arrows[0].style.cssText).not.toBe(before);
  expect(parseFloat(arrows[0].style.getPropertyValue('--arrow-shift-x'))).toBeLessThan(0);
  expect(parseFloat(arrows[0].style.getPropertyValue('--arrow-shift-y'))).toBeGreaterThan(0);
  const scrolled = arrows[0].style.cssText;
  await act(async () => {});
  expect(arrows[0].style.cssText).toBe(scrolled);
});
it.each([true, false])('keeps compact popup ornamentation static with paused=%s', async paused => {
  await act(async () => root.render(<JourneyArrowField compact paused={paused} />));
  const arrow = container.querySelector<HTMLElement>('.journey-shooting-arrow')!;
  const before = arrow.style.cssText;
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1200);
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(arrow.style.cssText).toBe(before);
  expect(container.querySelectorAll('.journey-shooting-arrow')).toHaveLength(8);
});
it('does not move decorative arrows for reduced-motion users', async () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true, media: '(prefers-reduced-motion: reduce)', onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true) });
  await act(async () => root.render(<JourneyArrowField />));
  const arrow = container.querySelector<HTMLElement>('.journey-shooting-arrow')!;
  const before = arrow.style.cssText;
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1200);
  await act(async () => window.dispatchEvent(new Event('scroll')));
  expect(arrow.style.cssText).toBe(before);
  expect(container.querySelector('.journey-arrow-field')?.getAttribute('data-motion')).toBe('static');
});
