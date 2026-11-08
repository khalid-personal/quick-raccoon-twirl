// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IntegrityDemoScenarios from '../IntegrityDemoScenarios';

const auth = vi.hoisted(() => ({
  user: { id: 'signed-in-admin', email: 'operator@example.test' },
  actualRole: 'superadmin', isAuthenticated: true, isDemo: true,
}));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => auth }));
vi.mock('@/lib/demo-integrity-scenarios', async importOriginal => {
  const original = await importOriginal<typeof import('@/lib/demo-integrity-scenarios')>();
  return { ...original, applyIntegrityDemoScenario: vi.fn(), resetIntegrityDemoScenario: vi.fn() };
});
import { applyIntegrityDemoScenario, resetIntegrityDemoScenario } from '@/lib/demo-integrity-scenarios';
import type { IntegrityDemoMeasurement } from '@/lib/demo-integrity-scenarios';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem('dawm_demo_session', '1');
  auth.actualRole = 'superadmin';
  auth.isAuthenticated = true;
  auth.isDemo = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe('DEMO scenario replacement controls', () => {
  it('awaits completed writes and shows actual flagged payment and agency case counts', async () => {
    const measurement: IntegrityDemoMeasurement = { score: 69, level: 'yellow', candidates: 435, findings: 60, documents: 870,
      deployed: 78, returned: 4, activeTasks: 357, overdueTasks: 110,
      bank: { matched: 2160, short: 5, over: 5, missing: 5, 'reference-mismatch': 0, 'currency-mismatch': 0 },
      flaggedPayments: 15, openPaymentCases: 15, openAgencyCases: 1 };
    let complete!: (result: Awaited<ReturnType<typeof applyIntegrityDemoScenario>>) => void;
    vi.mocked(applyIntegrityDemoScenario).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    await act(async () => root.render(<IntegrityDemoScenarios />));
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelector('[aria-label="Updating demo records"]')).not.toBeNull();
    expect(Array.from(container.querySelectorAll('input, button')).every(element => (element as HTMLInputElement).disabled)).toBe(true);
    expect(container.querySelector('[role=status]')).toBeNull();
    await act(async () => complete({ before: { ...measurement, score: 100, level: 'green' }, after: measurement, starting: measurement }));
    expect(container.querySelector('[role=status]')?.textContent).toContain('15 flagged payments · 15 open payment reviews · 1 open agency cases');
    expect(container.textContent).toContain('100 (HIGH) → 69 (MEDIUM)');
    expect(container.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a failed switch without claiming replacement succeeded and allows retry', async () => {
    vi.mocked(applyIntegrityDemoScenario).mockRejectedValueOnce(new Error('Previous demo records were restored.'));
    await act(async () => root.render(<IntegrityDemoScenarios />));
    await act(async () => container.querySelector('button')!.click());
    expect(container.querySelector('[role=alert]')?.textContent).toContain('Previous demo records were restored');
    expect(container.querySelector('[role=status]')).toBeNull();
    expect(container.querySelector('button')?.disabled).toBe(false);
  });

  it('switches immediately from six styled cards without a text or checkbox confirmation', async () => {
    await act(async () => root.render(<IntegrityDemoScenarios />));
    expect(Array.from(container.querySelectorAll('button')).map(button => button.getAttribute('aria-label')))
      .toEqual(['Switch to DEMO Low', 'Switch to DEMO Low→Medium', 'Switch to DEMO Medium', 'Switch to DEMO Medium→High', 'Switch to DEMO High→Medium', 'Switch to DEMO High']);
    expect(container.textContent).toContain('Uploaded statements and held cases still block replacement');
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('button')?.disabled).toBe(false);
    await act(async () => container.querySelector('button')!.click());
    expect(applyIntegrityDemoScenario).toHaveBeenCalledWith('low', {
      id: auth.user.id, email: auth.user.email, role: 'superadmin', authenticated: true,
    }, true, 'One-click demo scenario switch: low');
  });

  it('blocks unsigned users, non-superadmins and live mode even if the UI context says DEMO', async () => {
    for (const condition of ['unsigned', 'admin', 'live']) {
      auth.isAuthenticated = condition !== 'unsigned';
      auth.actualRole = condition === 'admin' ? 'admin' : 'superadmin';
      sessionStorage.setItem('dawm_demo_session', condition === 'live' ? '0' : '1');
      await act(async () => root.render(<IntegrityDemoScenarios />));
      expect(Array.from(container.querySelectorAll('input, button')).every(element => (element as HTMLInputElement).disabled)).toBe(true);
    }
    expect(applyIntegrityDemoScenario).not.toHaveBeenCalled();
    expect(resetIntegrityDemoScenario).not.toHaveBeenCalled();
  });
});
