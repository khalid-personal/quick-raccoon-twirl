// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LandingPage from '@/pages/LandingPage';
import DeveloperDocs from '@/pages/DeveloperDocs';
import { enterDemo } from '@/lib/demo-mode';

vi.mock('@/lib/demo-mode', () => ({ enterDemo: vi.fn() }));
let container: HTMLDivElement, root: Root;
let reducedMotion = false;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.mocked(enterDemo).mockClear();
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  reducedMotion = false;
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') && reducedMotion, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal('IntersectionObserver', class {
    observe = vi.fn();
    disconnect = vi.fn();
  });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = async (path = '/') => act(async () => root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/" element={<LandingPage />} /><Route path="/developers" element={<DeveloperDocs />} /><Route path="/login" element={<p>Existing sign in</p>} /></Routes></MemoryRouter>));
const click = async (selector: string) => act(async () => container.querySelector<HTMLElement>(selector)!.click());

describe('public DAWM website', () => {
  it('compares rollout scope interactively without inventing prices or subscriptions', async () => {
    await render();
    const institution = container.querySelector<HTMLButtonElement>('.public-rollout-selector button:last-child')!;
    await act(async () => institution.click());
    expect(institution.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('#rollout-detail')?.textContent).toContain('review permissions, audit ownership');
    expect(container.querySelector('#pricing')?.textContent).toContain('Pricing to be confirmed');
    expect(container.querySelector('#pricing')?.textContent).not.toMatch(/\$\d|ETB\s*\d|Subscribe|Buy now/);
    expect(enterDemo).not.toHaveBeenCalled();
  });
  it('animates illustrative connectivity and lets visitors pause it without changing the candidate journey', async () => {
    await render();
    expect(container.querySelector('.public-hero')?.getAttribute('data-motion')).toBe('active');
    expect(container.querySelectorAll('animateMotion')).toHaveLength(4);
    expect(container.querySelector('.public-atmosphere')?.getAttribute('aria-hidden')).toBe('true');
    await click('.public-motion-control');
    expect(container.querySelector('.public-hero')?.getAttribute('data-motion')).toBe('static');
    expect(container.querySelectorAll('animateMotion')).toHaveLength(0);
    expect(container.querySelector('#journey-tab-0')?.getAttribute('aria-selected')).toBe('true');
    await click('.public-motion-control');
    expect(container.querySelectorAll('animateMotion')).toHaveLength(4);
  });
  it('keeps a complete static illustration when reduced motion is requested', async () => {
    reducedMotion = true;
    await render();
    expect(container.querySelector('.public-hero')?.getAttribute('data-motion')).toBe('static');
    expect(container.querySelectorAll('animateMotion')).toHaveLength(0);
    expect(container.querySelectorAll('.public-network-node')).toHaveLength(4);
  });
  it('suspends animation when the document is hidden and resumes only when it is visible', async () => {
    await render();
    await act(async () => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.querySelectorAll('animateMotion')).toHaveLength(0);
    await act(async () => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.querySelectorAll('animateMotion')).toHaveLength(4);
  });
  it('opens a product homepage before sign-in with real public navigation and clear pricing boundaries', async () => {
    await render();
    expect(container.querySelector('h1')?.textContent).toContain('everyone in sync');
    expect(container.querySelectorAll('.public-feature-card')).toHaveLength(4);
    expect(container.querySelectorAll('.public-pricing-card')).toHaveLength(3);
    expect(container.querySelector('#pricing')?.textContent).toContain('not a purchasable plan');
    expect(container.querySelector('#pricing')?.textContent).toContain('No checkout');
    expect(container.querySelector('a[href="/login?tab=candidate"]')).not.toBeNull();
    await click('.public-nav a[href="/login"]');
    expect(container.textContent).toContain('Existing sign in');
  });
  it('lets users explore each journey stage by click and keyboard without changing portal records', async () => {
    const recordsBefore = { ...localStorage };
    await render();
    await click('#journey-tab-2');
    expect(container.querySelector('#journey-tab-2')?.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('#journey-panel')?.textContent).toContain('Put readiness before departure');
    await act(async () => container.querySelector('#journey-tab-2')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(container.querySelector('#journey-tab-3')?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement?.id).toBe('journey-tab-3');
    expect(container.querySelector('#journey-panel')?.textContent).toContain('Official ministry confirmation');
    expect({ ...localStorage }).toEqual(recordsBefore);
  });
  it('uses the existing separated demo entry point instead of fake sign-in or a new data flow', async () => {
    await render();
    await click('.public-hero .public-button-lime');
    expect(enterDemo).toHaveBeenCalledTimes(1);
  });
  it('opens developer docs and discloses future APIs, provider prerequisites and server-side access boundaries', async () => {
    await render();
    await click('.public-nav a[href="/developers"]');
    expect(container.querySelector('h1')?.textContent).toContain('Keep the trust');
    expect(container.textContent).toContain('Public API not yet available');
    expect(container.textContent).toContain('no public base URL');
    expect(container.textContent).toContain('No live candidate or agency synchronization is claimed');
    expect(container.textContent).toContain('authoritative server-side authorization');
    expect(container.querySelectorAll('.public-docs-content section')).toHaveLength(5);
    expect(container.querySelectorAll('table tbody tr')).toHaveLength(5);
    for (const link of container.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Documentation topics"] a')) {
      expect(container.querySelector(link.getAttribute('href')!)).not.toBeNull();
    }
  });
  it('opens and closes mobile navigation on navigation selection', async () => {
    await render();
    await click('.public-menu-toggle');
    expect(container.querySelector('.public-menu-toggle')?.getAttribute('aria-expanded')).toBe('true');
    await click('.public-nav a[href="/developers"]');
    expect(container.querySelector('.public-menu-toggle')?.getAttribute('aria-expanded')).toBe('false');
  });
});
