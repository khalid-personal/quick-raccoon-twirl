import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface ApiRequest extends IncomingMessage {
  body?: unknown;
}

interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
}

interface InitializeBody {
  candidateId?: unknown;
  stageId?: unknown;
  expectedAmount?: unknown;
}

interface InitializeResponse {
  checkout_url?: string;
  tx_ref?: string;
}

const respond = (res: ApiResponse, status: number, body: unknown) => res.status(status).json(body);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed.' });
  }

  const secretKey = process.env.CHECHE_SECRET_KEY;
  const financeBaseUrl = process.env.CHECHE_FINANCE_BASE_URL;
  const appBaseUrl = process.env.CHECHE_APP_URL;
  const stageFeeConfig = process.env.CHECHE_STAGE_FEES_JSON;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey || !financeBaseUrl || !appBaseUrl || !stageFeeConfig || !supabaseUrl || !serviceRoleKey) {
    return respond(res, 503, { error: 'ChechePay checkout or Supabase server verification is not configured.' });
  }
  if (!/^sk_(test|live)_/.test(secretKey)) {
    return respond(res, 503, { error: 'CHECHE_SECRET_KEY must be a private ChechePay sk_test_ or sk_live_ key.' });
  }

  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return respond(res, 401, { error: 'A signed-in candidate session is required.' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return respond(res, 401, { error: 'Candidate session is invalid or expired.' });
  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles')
    .select('role,is_approved,candidate_id')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== 'candidate' || profile.is_approved !== true) {
    return respond(res, 403, { error: 'Only an approved candidate can start this payment.' });
  }

  const body = req.body as InitializeBody | undefined;
  const candidateId = typeof body?.candidateId === 'string' ? body.candidateId.trim() : '';
  const stageId = Number(body?.stageId);
  if (!candidateId || profile.candidate_id !== candidateId || !Number.isInteger(stageId)) {
    return respond(res, 400, { error: 'Candidate and stage are invalid for this session.' });
  }
  const { data: candidate, error: candidateError } = await supabaseAdmin.from('candidates').select('id').eq('id', candidateId).maybeSingle();
  if (candidateError || !candidate) return respond(res, 404, { error: 'Candidate record was not found.' });

  let fees: Record<string, unknown>;
  try {
    fees = JSON.parse(stageFeeConfig) as Record<string, unknown>;
  } catch {
    return respond(res, 500, { error: 'Server stage-fee configuration is invalid.' });
  }
  const amount = Number(fees[String(stageId)]);
  if (!Number.isFinite(amount) || amount <= 0) return respond(res, 400, { error: 'This stage has no configured ChechePay fee.' });
  const expectedAmount = Number(body?.expectedAmount);
  if (!Number.isFinite(expectedAmount) || Math.abs(expectedAmount - amount) > 0.001) {
    return respond(res, 409, { error: 'The displayed stage fee does not match the server fee.' });
  }

  const referencePayload = Buffer.from(JSON.stringify({
    candidateId, stageId, nonce: randomUUID(), initiatedBy: authData.user.id, initiatedAt: new Date().toISOString(),
  })).toString('base64url');
  const referenceSignature = createHmac('sha256', secretKey).update(referencePayload).digest('hex');
  const txRef = `dawm.${referencePayload}.${referenceSignature}`;
  const returnUrl = new URL(`/payment/return/${encodeURIComponent(txRef)}`, appBaseUrl);

  try {
    const response = await fetch(`${financeBaseUrl.replace(/\/$/, '')}/transactions/initialize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': secretKey },
      body: JSON.stringify({ amount: amount.toFixed(2), tx_ref: txRef, currency: 'ETB', return_url: returnUrl.toString() }),
    });
    if (!response.ok) return respond(res, 502, { error: 'ChechePay could not initialize checkout.' });
    const result = await response.json() as InitializeResponse;
    if (!result.checkout_url) return respond(res, 502, { error: 'ChechePay returned an incomplete checkout response.' });
    return respond(res, 200, { checkout_url: result.checkout_url, tx_ref: result.tx_ref || txRef, amount: amount.toFixed(2), currency: 'ETB' });
  } catch {
    return respond(res, 502, { error: 'Could not reach ChechePay.' });
  }
}
