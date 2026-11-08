// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, getSessionMock } = vi.hoisted(() => ({ createClientMock: vi.fn(), getSessionMock: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));
vi.mock('../../supabase', () => ({ supabase: { auth: { getSession: getSessionMock } } }));
vi.mock('../../supabase-sync', () => ({
  isSupabaseDataMode: () => false,
  flushSupabaseSync: vi.fn(async () => null),
}));
vi.mock('../../demo-mode', () => ({ DEMO_KEY_PREFIX: 'dawm_demo_', isDemoMode: () => false }));

import { initializeDataStore, getCandidates, getPayments, getPaymentStatuses, savePaymentStatuses } from '../../data-store';
import { initializeCandidateStageCheckout, mockPayForStage, recordVerifiedStagePayment } from '../payment-processing';
import initializeCheckout from '../../../../api/chechepay/initialize';
import verifyCheckout from '../../../../api/chechepay/verify';

const makeResponse = () => {
  const response = {
    statusCode: 0,
    body: undefined as unknown,
    setHeader: vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
  };
  return response;
};

describe('ChechePay stage payment', () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'candidate-token' } }, error: null });
    localStorage.clear();
    initializeDataStore();
    vi.stubEnv('CHECHE_SECRET_KEY', 'sk_test_unit');
    vi.stubEnv('CHECHE_FINANCE_BASE_URL', 'https://dev.chechepay.example/finance/api/v1');
    vi.stubEnv('SUPABASE_URL', 'https://unit.supabase.example');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
    vi.stubEnv('CHECHE_APP_URL', 'http://localhost:8080');
    vi.stubEnv('CHECHE_STAGE_FEES_JSON', '{"1":500}');

    const responses: Record<string, { data: unknown; error: null }> = {
      profiles: { data: { role: 'candidate', is_approved: true, candidate_id: 'candidate-1' }, error: null },
      candidates: { data: { id: 'candidate-1', data: { local_agency_id: 'local-1' } }, error: null },
      payments: { data: null, error: null },
      payment_statuses: { data: null, error: null },
    };
    createClientMock.mockReturnValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
      from: (table: string) => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          contains: vi.fn(() => query),
          limit: vi.fn(() => query),
          maybeSingle: vi.fn(async () => responses[table] ?? { data: null, error: null }),
          insert: vi.fn(async () => ({ error: null })),
          upsert: vi.fn(async () => ({ error: null })),
        };
        return query;
      },
    });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      checkout_url: 'https://checkout.chechepay.example/checkout/test',
      tx_ref: 'signed-reference',
      status: 'SUCCEEDED',
      amount: '500.00',
      currency: 'ETB',
      is_final: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  });

  it('records a verified stage payment and is idempotent by provider reference', async () => {
    const candidate = getCandidates()[0];
    savePaymentStatuses(getPaymentStatuses().filter(status => status.candidateId !== candidate.id || status.stageId !== 1));
    const input = {
      candidateId: candidate.id,
      stageId: 1,
      amount: 500,
      provider: 'chechepay' as const,
      providerReference: 'dawm.test.signed-reference',
    };

    const payment = await recordVerifiedStagePayment(input);
    const repeated = await recordVerifiedStagePayment(input);

    expect(repeated.id).toBe(payment.id);
    expect(payment.status).toBe('succeeded');
    expect(getPayments().filter(item => item.provider_reference === input.providerReference)).toHaveLength(1);
    expect(getPaymentStatuses().filter(item => item.candidateId === candidate.id && item.stageId === 1 && item.isPaid)).toHaveLength(1);
  });
  it('starts candidate checkout with authenticated sessions even when remote data sync is disabled', async () => {
    const checkout = await initializeCandidateStageCheckout('candidate-1', 1, 500);
    expect(checkout.checkoutUrl).toBe('https://checkout.chechepay.example/checkout/test');
    expect(fetch).toHaveBeenCalledWith('/api/chechepay/initialize', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer candidate-token' }) }));
  });
  it('refuses to start checkout without a real candidate session', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    await expect(initializeCandidateStageCheckout('candidate-1', 1, 500)).rejects.toThrow(/Sign in/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects simulated stage-payment records outside demo mode', async () => {
    await expect(mockPayForStage('candidate-1', 1, 500)).rejects.toThrow(/outside the demo sandbox/);
  });

  it('rejects initialize requests that are not POST', async () => {
    const response = makeResponse();
    await initializeCheckout({ method: 'GET', headers: {} } as never, response as never);
    expect(response.statusCode).toBe(405);
    expect(response.setHeader).toHaveBeenCalledWith('Allow', 'POST');
  });
  it('preserves ChechePay confirmation fields and rejects mismatched receipt data', async () => {
    const candidate = getCandidates()[0];
    const input = { candidateId: candidate.id, stageId: 1, amount: 500, currency: 'ETB', provider: 'chechepay' as const, providerReference: 'dawm.receipt', receiptNumber: 'RCPT-SERVER', alreadyPersisted: true };
    const receipt = { transaction_reference: input.providerReference, amount: 500, currency: 'ETB', status: 'SUCCEEDED' as const, verified_at: '2026-11-07T00:00:00Z', processor_reference: 'PROCESSOR-1' };
    const payment = await recordVerifiedStagePayment({ ...input, chechePayReceipt: receipt });
    expect(payment.receipt_number).toBe('RCPT-SERVER');
    expect(payment.chechepay_receipt).toEqual(receipt);
    await expect(recordVerifiedStagePayment({ ...input, chechePayReceipt: { ...receipt, amount: 400 } })).rejects.toThrow(/receipt does not match/);
  });

  it('initializes hosted checkout only for the signed-in candidate and returns a checkout URL', async () => {
    const response = makeResponse();
    await initializeCheckout({
      method: 'POST',
      headers: { authorization: 'Bearer candidate-token' },
      body: { candidateId: 'candidate-1', stageId: 1, expectedAmount: 500 },
    } as never, response as never);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ checkout_url: 'https://checkout.chechepay.example/checkout/test', amount: '500.00', currency: 'ETB' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects checkout initialization without a candidate bearer token', async () => {
    const response = makeResponse();
    await initializeCheckout({ method: 'POST', headers: {}, body: { candidateId: 'candidate-1', stageId: 1, expectedAmount: 500 } } as never, response as never);
    expect(response.statusCode).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects unsigned verification references before contacting Supabase or ChechePay', async () => {
    const response = makeResponse();
    await verifyCheckout({ method: 'POST', headers: {}, body: { tx_ref: 'not-a-signed-reference' } } as never, response as never);
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Transaction reference is invalid.' });
  });

  it('verifies a final successful transaction before persisting payment and stage status', async () => {
    const { createHmac, randomUUID } = await import('node:crypto');
    const payload = Buffer.from(JSON.stringify({ candidateId: 'candidate-1', stageId: 1, nonce: randomUUID() })).toString('base64url');
    const signature = createHmac('sha256', 'sk_test_unit').update(payload).digest('hex');
    const txRef = `dawm.${payload}.${signature}`;
    const response = makeResponse();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      tx_ref: txRef,
      status: 'SUCCEEDED',
      amount: '500.00',
      currency: 'ETB',
      is_final: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await verifyCheckout({ method: 'POST', headers: {}, body: { tx_ref: txRef } } as never, response as never);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ status: 'SUCCEEDED', is_final: true, candidateId: 'candidate-1', stageId: 1 });
    expect(response.body).toMatchObject({ payment: { provider: 'chechepay', chechepay_receipt: { transaction_reference: txRef, amount: 500, currency: 'ETB', status: 'SUCCEEDED' } } });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('accepts full UUID candidate references generated by initialization', async () => {
    const { createHmac, randomUUID } = await import('node:crypto');
    const candidateId = randomUUID();
    const payload = Buffer.from(JSON.stringify({ candidateId, stageId: 1, nonce: randomUUID() })).toString('base64url');
    const txRef = `dawm.${payload}.${createHmac('sha256', 'sk_test_unit').update(payload).digest('hex')}`;
    expect(txRef.length).toBeGreaterThan(200);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ tx_ref: txRef, status: 'SUCCEEDED', amount: '500.00', currency: 'ETB', is_final: true }), { status: 200 }));
    const response = makeResponse();
    await verifyCheckout({ method: 'POST', headers: {}, body: { tx_ref: txRef } } as never, response as never);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ candidateId, payment: { chechepay_receipt: { transaction_reference: txRef } } });
  });
});
