// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { demoMode, demoPay, initializeCheckout, successToast, errorToast } = vi.hoisted(() => ({
  demoMode: vi.fn(), demoPay: vi.fn(), initializeCheckout: vi.fn(), successToast: vi.fn(), errorToast: vi.fn(),
}));
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: demoMode }));
vi.mock('@/lib/api', () => ({ api: { mockPayForStage: demoPay, initializeCandidateStageCheckout: initializeCheckout } }));
vi.mock('sonner', () => ({ toast: { success: successToast, error: errorToast } }));
import PaymentGate from '../PaymentGate';

describe('candidate stage-payment control', () => {
  let container: HTMLDivElement;
  let root: Root;
  let client: QueryClient;
  const refresh = vi.fn();
  const render = async () => {
    await act(async () => {
      root.render(<QueryClientProvider client={client}><PaymentGate stageTitle="Deployment" feeAmount={6000} isPaid={false} trackingCode="TRK-D0327" candidateId="demo-candidate" stageId={4} onPaymentSuccess={refresh} /></QueryClientProvider>);
    });
  };
  const click = async (label: string) => {
    const button = [...document.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === label || element.textContent?.trim() === label);
    expect(button, `Button ${label} is rendered`).toBeDefined();
    await act(async () => { button!.click(); });
  };
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    demoMode.mockReturnValue(true);
    demoPay.mockResolvedValue({ id: 'demo-payment' });
    container = document.createElement('div'); document.body.appendChild(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['publicTracking', 'TRK-D0327'], { timeline: [{ stage_id: 4, is_fee_paid: false }] });
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove(); client.clear(); vi.unstubAllGlobals();
  });
  it('lets a candidate open and confirm a demo stage payment and refreshes paid state', async () => {
    await render();
    const payButton = document.querySelector('button[aria-label="Pay with ChechePay"]');
    expect(payButton?.textContent?.trim()).toBe('Pay with');
    expect(payButton?.querySelector('img')?.getAttribute('width')).toBe('160');
    await click('Pay with ChechePay');
    expect(document.querySelector('button[aria-label="Pay with ChechePay"] img')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await click('Confirm demo payment');
    expect(demoPay).toHaveBeenCalledWith('demo-candidate', 4, 6000);
    expect(refresh).toHaveBeenCalledOnce();
    expect(client.getQueryData(['publicTracking', 'TRK-D0327'])).toMatchObject({ timeline: [{ stage_id: 4, is_fee_paid: true }] });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(initializeCheckout).not.toHaveBeenCalled();
  });
  it('allows retry after checkout fails instead of leaving the payment control busy', async () => {
    demoMode.mockReturnValue(false);
    initializeCheckout.mockRejectedValue(new Error('Candidate record was not found.'));
    await render();
    await click('Pay with ChechePay');
    await click('Continue to ChechePay');
    expect(errorToast).toHaveBeenCalledWith('Candidate record was not found.');
    const confirm = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Continue to ChechePay');
    expect(confirm?.disabled).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(client.getQueryData(['publicTracking', 'TRK-D0327'])).toMatchObject({ timeline: [{ is_fee_paid: false }] });
  });
});