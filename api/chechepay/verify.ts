import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Payment, PaymentStatus } from '../../src/lib/types';

interface ApiRequest extends IncomingMessage {
  body?: unknown;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

interface VerifyBody {
  tx_ref?: unknown;
}

interface ChecheVerifyResponse {
  tx_ref?: string;
  status?: string;
  amount?: string | number;
  currency?: string;
  is_final?: boolean;
  payment_type?: string;
  processor_ref?: string;
}

interface TransactionBinding {
  candidateId: string;
  stageId: number;
  nonce: string;
  initiatedBy?: string;
  initiatedAt?: string;
}

const respond = (res: ApiResponse, status: number, body: unknown) => res.status(status).json(body);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  const secretKey = process.env.CHECHE_SECRET_KEY;
  const financeBaseUrl = process.env.CHECHE_FINANCE_BASE_URL;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !financeBaseUrl || !supabaseUrl || !serviceRoleKey) {
    return respond(res, 503, { error: 'ChechePay verification is not configured on the server.' });
  }
  if (!/^sk_(test|live)_/.test(secretKey)) {
    return respond(res, 503, { error: 'CHECHE_SECRET_KEY must be a private ChechePay sk_test_ or sk_live_ key.' });
  }

  const body = req.body as VerifyBody | undefined;
  const txRef = typeof body?.tx_ref === 'string' ? body.tx_ref.trim() : '';
  if (!txRef || txRef.length > 512) return respond(res, 400, { error: 'A valid transaction reference is required.' });

  const [prefix, payload, signature, ...extra] = txRef.split('.');
  if (prefix !== 'dawm' || !payload || !signature || extra.length > 0) return respond(res, 400, { error: 'Transaction reference is invalid.' });
  const expectedBuffer = Buffer.from(createHmac('sha256', secretKey).update(payload).digest('hex'), 'hex');
  const receivedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return respond(res, 400, { error: 'Transaction reference signature is invalid.' });
  }

  let binding: TransactionBinding;
  try {
    binding = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TransactionBinding;
  } catch {
    return respond(res, 400, { error: 'Transaction reference payload is invalid.' });
  }
  if (!binding.candidateId || !Number.isInteger(binding.stageId) || !binding.nonce) return respond(res, 400, { error: 'Transaction reference payload is incomplete.' });

  let fees: Record<string, unknown>;
  try {
    fees = JSON.parse(process.env.CHECHE_STAGE_FEES_JSON || '{}') as Record<string, unknown>;
  } catch {
    return respond(res, 500, { error: 'Server stage-fee configuration is invalid.' });
  }
  const expectedAmount = Number(fees[String(binding.stageId)]);
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) return respond(res, 400, { error: 'This stage has no configured ChechePay fee.' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existingPaymentRow, error: existingPaymentError } = await supabaseAdmin.from('payments')
    .select('id,data').contains('data', { provider_reference: txRef }).limit(1).maybeSingle();
  if (existingPaymentError) return respond(res, 503, { error: 'Could not load existing verified payment records.' });
  if (existingPaymentRow?.data) {
    const existing = existingPaymentRow.data as Payment;
    if (existing.status === 'succeeded') {
      const { error: statusError } = await supabaseAdmin.from('payment_statuses').upsert({
        id: uuidv5(`${binding.candidateId}:${binding.stageId}`, uuidv5.URL),
        data: { candidateId: binding.candidateId, stageId: binding.stageId, isPaid: true } satisfies PaymentStatus,
      }, { onConflict: 'id' });
      if (statusError) return respond(res, 503, { error: 'Verified payment exists, but its stage status could not be restored.' });
      return respond(res, 200, {
        tx_ref: txRef, status: 'SUCCEEDED', amount: existing.amount, currency: existing.currency,
        is_final: true, candidateId: binding.candidateId, stageId: binding.stageId, paymentId: existing.id,
        payment: existing,
      });
    }
  }

  try {
    const response = await fetch(`${financeBaseUrl.replace(/\/$/, '')}/transactions/merchant-verify/${encodeURIComponent(txRef)}`, {
      headers: { 'X-API-Key': secretKey },
    });
    if (!response.ok) return respond(res, 502, { error: 'ChechePay could not verify this transaction.' });
    const result = await response.json() as ChecheVerifyResponse;
    if (result.tx_ref && result.tx_ref !== txRef) return respond(res, 409, { error: 'ChechePay returned a different transaction reference.' });
    const isSucceeded = result.status === 'SUCCEEDED' && result.is_final === true;
    if (!isSucceeded) return respond(res, 200, {
      tx_ref: txRef, status: result.status || 'PENDING', amount: result.amount,
      currency: result.currency, is_final: result.is_final === true,
    });

    const amount = Number(result.amount);
    if (result.currency !== 'ETB' || !Number.isFinite(amount) || amount + 0.001 < expectedAmount) {
      return respond(res, 409, { error: 'Verified payment amount or currency does not cover this stage fee.' });
    }

    const { data: candidateRow, error: candidateError } = await supabaseAdmin.from('candidates').select('id,data').eq('id', binding.candidateId).maybeSingle();
    if (candidateError || !candidateRow) return respond(res, 404, { error: 'Candidate record was not found.' });
    const candidate = candidateRow.data as { local_agency_id?: string; first_name?: string; last_name?: string; tracking_code?: string };
    const payment: Payment = {
      id: randomUUID(), stage_id: binding.stageId, provider: 'chechepay', provider_reference: txRef,
      initiated_by: typeof binding.initiatedBy === 'string' ? { id: binding.initiatedBy } : undefined,
      initiated_at: typeof binding.initiatedAt === 'string' ? binding.initiatedAt : undefined,
      recorded_by: { id: 'chechepay-server' },
      origin: 'candidate-checkout',
      receipt_number: `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`,
      payment_method: result.payment_type || 'ChechePay', amount, currency: result.currency,
      status: 'succeeded', payer_type: 'candidate', payer_candidate_id: binding.candidateId,
      chechepay_receipt: {
        transaction_reference: txRef, processor_reference: result.processor_ref,
        amount, currency: result.currency, status: 'SUCCEEDED', verified_at: new Date().toISOString(),
      },
      payer_display_name: [candidate.first_name, candidate.last_name].filter(Boolean).join(' '),
      payer_foreign_agency_id: '', payee_local_agency_id: candidate.local_agency_id ?? '',
      candidate_ids: [binding.candidateId], created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const { error: paymentError } = await supabaseAdmin.from('payments').insert({ id: payment.id, data: payment });
    if (paymentError) return respond(res, 503, { error: 'Verified payment could not be saved to Supabase.' });

    const paymentStatus: PaymentStatus = { candidateId: binding.candidateId, stageId: binding.stageId, isPaid: true };
    const statusPayload = { id: uuidv5(`${binding.candidateId}:${binding.stageId}`, uuidv5.URL), data: paymentStatus };
    const { error: statusError } = await supabaseAdmin.from('payment_statuses').upsert(statusPayload, { onConflict: 'id' });
    if (statusError) return respond(res, 503, { error: 'Verified payment was saved, but the stage status could not be updated.' });

    return respond(res, 200, {
      tx_ref: txRef, status: 'SUCCEEDED', amount, currency: result.currency,
      is_final: true, candidateId: binding.candidateId, stageId: binding.stageId, paymentId: payment.id,
      payment,
    });
  } catch {
    return respond(res, 502, { error: 'Could not reach ChechePay for verification.' });
  }
}
