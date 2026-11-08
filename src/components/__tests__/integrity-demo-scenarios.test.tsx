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
  it('shows exactly six labeled choices, plain explanations, and replacement confirmation', async () => {
    await act(async () => root.render(<IntegrityDemoScenarios />));
    expect(Array.from(container.querySelectorAll('input[type=radio]')).map(input => input.closest('label')?.querySelector('span')?.textContent))
      .toEqual(['DEMO Low', 'DEMO Low→Medium', 'DEMO Medium', 'DEMO Medium→High', 'DEMO High→Medium', 'DEMO High']);
    expect(container.textContent).toContain('Live storage, uploaded live files and sign-in accounts are not changed');
    expect(container.textContent).toContain('pretend review cannot unlock it');
    expect(Array.from(container.querySelectorAll('button')).every(button => button.disabled)).toBe(true);
    const reason = container.querySelector('input:not([type=radio]):not([type=checkbox])')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(reason, 'Practice finding missing proof');
      reason.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => (container.querySelector('input[type=checkbox]') as HTMLInputElement).click());
    expect(container.querySelector('button')?.disabled).toBe(false);
    await act(async () => container.querySelector('button')!.click());
    expect(applyIntegrityDemoScenario).toHaveBeenCalledWith('medium', {
      id: auth.user.id, email: auth.user.email, role: 'superadmin', authenticated: true,
    }, true, 'Practice finding missing proof');
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
