// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import FeatureInfo from '../FeatureInfo';

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
describe('plain-language feature help', () => {
  it.each([
    ['Payment issues', 'Compare the receipt with the bank deposit.', 'Saving a note does not send a message or change the payment status.'],
    ['Medical compliance', 'Review ministry-supplied exam results', 'Results and stage progress are read-only'],
    ['Record checks', 'A warning means the record needs a closer look', 'it does not prove fraud.'],
    ['Document checks', 'Find sent contracts without a covering payment', 'does not approve a document or authorize departure.'],
    ['Money sent', 'Open an outbound receipt', 'Candidate fees and bank-audit tools are not part of this view.'],
    ['Staff accounts', 'Agency managers review and manage their own staff accounts', 'assigning a task does not approve an account.'],
  ])('explains %s and its limits without technical jargon', async (title, explanation, limit) => {
    await act(async () => root.render(<FeatureInfo title={title} />));
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="About ${title}"]`)!.click());
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain(explanation);
    expect(dialog?.textContent).toContain(limit);
    expect(dialog?.textContent).not.toContain('scope');
    expect(dialog?.textContent).not.toContain('reconciliation');
  });
});
