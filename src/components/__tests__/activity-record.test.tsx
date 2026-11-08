// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import ActivityRecord from '../ActivityRecord';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
it('shows human explanations immediately and keeps the unchanged technical snapshot collapsed', async () => {
  const description = 'Amount discrepancy escalation requested: underpayment, bank. Snapshot: {"payment":{"amount":9000,"currency":"ETB","provider_reference":"BANK-1"},"line":{"amount":7200,"currency":"ETB"}}';
  await act(async () => root.render(<ActivityRecord activity={{ description, action: 'Updated', timestamp: '2026-11-08', actor_id: 'demo-superadmin', actor_email: 'superadmin1@dawm.test' }} />));
  expect(container.textContent).toContain('A payment shortfall needs review');
  expect(container.textContent).toContain('1,800 ETB');
  expect(container.textContent).toContain('superadmin1 ·');
  const original = container.querySelector('details')!;
  expect(original.open).toBe(false);
  expect(original.querySelector('p')?.textContent).toBe(description);
});
