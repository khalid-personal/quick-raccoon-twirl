import { v4 as uuidv4 } from 'uuid';
import { Payment, Candidate, CandidatePaymentStatus, ForeignAgency, LocalAgency } from '../types';
import { getPayments, savePayments, savePaymentsLocal, getCandidates, saveCandidates, getForeignAgencies, getLocalAgencies, getPaymentStatuses, savePaymentStatuses, savePaymentStatusesLocal } from '../data-store';
import { recordApprovalLog } from './log-management';
import { supabase } from '../supabase';
import { isDemoMode } from '../demo-mode';
import { contractCountryOf, minimumPerCandidate } from '../currency';
import { requireAgencyOperations } from '../agency-resolution';
import { resolveActorIdentity } from '../demo-identities';

export const initializeCandidateStageCheckout = async (candidateId: string, stageId: number, amount: number): Promise<{ checkoutUrl: string; transactionReference: string }> => {
    if (!candidateId || !Number.isInteger(stageId) || !Number.isFinite(amount) || amount <= 0) throw new Error('Candidate, stage and fee are required for checkout.');
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) throw new Error('Sign in to your candidate account before starting payment.');
    const response = await fetch('/api/chechepay/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ candidateId, stageId, expectedAmount: amount }),
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The checkout API is unavailable. Start the portal API server or check the deployment.');
    const result = await response.json() as { checkout_url?: string; tx_ref?: string; error?: string };
    if (!response.ok || !result.checkout_url || !result.tx_ref) throw new Error(result.error || 'ChechePay checkout could not be initialized.');
    let url: URL;
    try { url = new URL(result.checkout_url); } catch { throw new Error('The payment provider returned an invalid checkout link.'); }
    if (url.protocol !== 'https:') throw new Error('The payment provider returned an insecure checkout link.');
    return { checkoutUrl: url.toString(), transactionReference: result.tx_ref };
};

// Mock function to simulate Stripe Checkout Session creation
export const initiatePayment = async (
    payerForeignAgencyId: string,
    candidateIds: string[],
    actorId: string,
    actorEmail: string,
    requestedCurrency?: string,
): Promise<{ checkoutUrl: string, paymentId: string }> => {
    if (!isDemoMode()) throw new Error('Foreign-agency settlement is demo-only until a live provider is connected.');
    if (!actorId || !actorEmail || !candidateIds.length || new Set(candidateIds).size !== candidateIds.length) {
        throw new Error('An operator and distinct selected candidates are required.');
    }
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call delay

    const allCandidates = getCandidates();
    const foreignAgencies = getForeignAgencies();
    const localAgencies = getLocalAgencies();

    const payerAgency = foreignAgencies.find(fa => fa.id === payerForeignAgencyId);
    if (!payerAgency) {
        throw new Error("Payer foreign agency not found.");
    }

    const candidatesToPayFor = allCandidates.filter(c => candidateIds.includes(c.id));
    if (candidatesToPayFor.length !== candidateIds.length) {
        throw new Error("One or more candidates not found.");
    }
    
    // Ensure all candidates belong to the same local agency for a single payment
    const uniqueLocalAgencyIds = new Set(candidatesToPayFor.map(c => c.local_agency_id));
    if (uniqueLocalAgencyIds.size !== 1) {
        throw new Error("All selected candidates must belong to the same local agency for a single payment transaction.");
    }
    const payeeLocalAgencyId = Array.from(uniqueLocalAgencyIds)[0];
    const payeeAgency = localAgencies.find(la => la.id === payeeLocalAgencyId);
    if (!payeeAgency) {
        throw new Error("Payee local agency not found for selected candidates.");
    }
    requireAgencyOperations('foreign', payerForeignAgencyId);
    requireAgencyOperations('local', payeeLocalAgencyId);

    if (candidatesToPayFor.some(candidate => candidate.foreign_agency_id !== payerForeignAgencyId
        && !candidate.profile_shares?.some(share => share.foreign_agency_id === payerForeignAgencyId))) {
        throw new Error('Select only candidates assigned or shared with the paying foreign agency.');
    }
    const countries = [...new Set(candidatesToPayFor.map(contractCountryOf))];
    if (countries.length !== 1) throw new Error('Pay for one work contract country at a time.');
    const required = minimumPerCandidate(countries[0]);
    if (!required) throw new Error('Record a supported work contract destination country before paying.');
    if (requestedCurrency && requestedCurrency !== required.currency) throw new Error('Payment currency must match the work contract country.');
    const amount = Math.round(candidatesToPayFor.length * required.amount * 100) / 100;

    const newPayment: Payment = {
        id: uuidv4(),
        initiated_by: { id: actorId, email: resolveActorIdentity(actorId, actorEmail, allCandidates).email },
        initiated_at: new Date().toISOString(),
        origin: 'agency-checkout',
        stripe_payment_intent_id: `pi_mock_${uuidv4().substring(0, 8)}`, // Mock Stripe ID
        amount: amount,
        currency: required.currency,
        payer_type: 'foreign-agency',
        payer_display_name: payerAgency.name,
        contract_country: countries[0],
        provider: 'manual',
        provider_reference: `DEMO-BANK-${uuidv4()}`,
        payment_method: 'DEMO / synthetic foreign settlement',
        status: 'pending',
        payer_foreign_agency_id: payerForeignAgencyId,
        payee_local_agency_id: payeeLocalAgencyId,
        candidate_ids: candidateIds,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    const payments = getPayments();
    payments.push(newPayment);
    savePayments(payments);

    // Update candidate payment status to 'pending_payment'
    const updatedCandidates = allCandidates.map((c): Candidate => {
        if (candidateIds.includes(c.id)) {
            return { ...c, payment_status: 'pending_payment', last_payment_id: newPayment.id };
        }
        return c;
    });
    saveCandidates(updatedCandidates);

    await recordApprovalLog(
        actorId,
        actorEmail,
        'Payment',
        newPayment.id,
        'Created',
        `Initiated payment of ${amount} ${required.currency} from ${payerAgency.name} to ${payeeAgency.name} for ${candidateIds.length} candidates. DEMO / synthetic settlement.`
    );

    // Mock checkout URL
    const checkoutUrl = `/mock-payment-checkout?paymentId=${newPayment.id}&amount=${amount}&currency=${newPayment.currency}`;

    return { checkoutUrl, paymentId: newPayment.id };
};

export const getAllPayments = async (): Promise<Payment[]> => getPayments();

export const getPaymentsByForeignAgency = async (agencyId: string): Promise<Payment[]> =>
    getPayments().filter(payment => payment.payer_foreign_agency_id === agencyId);

export const getPaymentsByLocalAgency = async (agencyId: string): Promise<Payment[]> =>
    getPayments().filter(payment => payment.payee_local_agency_id === agencyId);

interface RecordStagePaymentInput {
    id?: string;
    candidateId: string;
    stageId: number;
    amount: number;
    currency?: string;
    actorId?: string;
    actorEmail?: string;
    provider: NonNullable<Payment['provider']>;
    providerReference: string;
    alreadyPersisted?: boolean;
    receiptNumber?: string;
    chechePayReceipt?: Payment['chechepay_receipt'];
    initiatedBy?: Payment['initiated_by'];
    initiatedAt?: string;
    origin?: Payment['origin'];
}

export const recordVerifiedStagePayment = async (input: RecordStagePaymentInput): Promise<Payment> => {
    const candidate = getCandidates().find(item => item.id === input.candidateId);
    if (!candidate) throw new Error('Candidate not found for payment.');
    if (!Number.isInteger(input.stageId) || !Number.isFinite(input.amount) || input.amount <= 0 || !input.providerReference.trim()) {
        throw new Error('Verified stage payment details are invalid.');
    }
    if (input.chechePayReceipt && (input.provider !== 'chechepay'
        || input.chechePayReceipt.transaction_reference !== input.providerReference
        || input.chechePayReceipt.amount !== input.amount
        || input.chechePayReceipt.currency !== (input.currency ?? 'ETB')
        || input.chechePayReceipt.status !== 'SUCCEEDED')) {
        throw new Error('ChechePay receipt does not match the verified payment.');
    }

    const payments = getPayments();
    const existing = payments.find(payment => payment.provider_reference === input.providerReference);
    const payment: Payment = existing ? { ...existing, ...(input.chechePayReceipt ? { chechepay_receipt: input.chechePayReceipt } : {}), ...(input.receiptNumber ? { receipt_number: input.receiptNumber } : {}) } : {
        id: input.id ?? uuidv4(),
        initiated_by: input.initiatedBy && isDemoMode()
            ? { id: input.initiatedBy.id, email: resolveActorIdentity(input.initiatedBy.id, input.initiatedBy.email, [candidate]).email } : input.initiatedBy,
        initiated_at: input.initiatedAt,
        recorded_by: input.actorId ? { id: input.actorId, email: isDemoMode() ? resolveActorIdentity(input.actorId, input.actorEmail, [candidate]).email : input.actorEmail } : undefined,
        origin: input.origin ?? 'stage-payment',
        stage_id: input.stageId,
        provider: input.provider,
        provider_reference: input.providerReference,
        receipt_number: input.receiptNumber ?? `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${uuidv4().slice(0, 8).toUpperCase()}`,
        chechepay_receipt: input.chechePayReceipt,
        payment_method: input.provider === 'chechepay' ? 'ChechePay' : input.provider,
        amount: input.amount,
        currency: input.currency ?? 'ETB',
        status: 'succeeded',
        payer_type: 'candidate',
        payer_candidate_id: input.candidateId,
        payer_foreign_agency_id: '',
        payee_local_agency_id: candidate.local_agency_id ?? getLocalAgencies()[0]?.id ?? '',
        candidate_ids: [input.candidateId],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };

    if (!existing || input.chechePayReceipt || input.receiptNumber) {
        const updatedPayments = existing ? payments.map(item => item.id === existing.id ? payment : item) : [...payments, payment];
        if (input.alreadyPersisted) savePaymentsLocal(updatedPayments);
        else savePayments(updatedPayments);
    }
    const statuses = getPaymentStatuses();
    const status = statuses.find(item => item.candidateId === input.candidateId && item.stageId === input.stageId);
    if (!status?.isPaid) {
        const updatedStatuses = [
            ...statuses.filter(item => item.candidateId !== input.candidateId || item.stageId !== input.stageId),
            { candidateId: input.candidateId, stageId: input.stageId, isPaid: true },
        ];
        if (input.alreadyPersisted) savePaymentStatusesLocal(updatedStatuses);
        else savePaymentStatuses(updatedStatuses);
    }

    if (!existing && !input.alreadyPersisted && input.actorId && input.actorEmail) {
        await recordApprovalLog(input.actorId, input.actorEmail, 'Payment', payment.id, 'Created', `Verified ${input.provider} payment of ${payment.amount} ${payment.currency} for candidate ${candidate.tracking_code}, stage ${input.stageId}.${input.provider === 'mock' ? ' Practice / synthetic checkout, not real bank proof.' : ''}`);
    }
    return payment;
};

export const mockPayForStage = async (candidateId: string, stageId: number, amount: number): Promise<Payment> => {
    if (!isDemoMode()) throw new Error('Demo stage payments cannot be recorded outside the demo sandbox.');
    await new Promise(resolve => setTimeout(resolve, 300));
    return recordVerifiedStagePayment({
        candidateId, stageId, amount, provider: 'mock', providerReference: `demo_${uuidv4()}`,
        initiatedBy: resolveActorIdentity(candidateId, undefined, getCandidates()), initiatedAt: new Date().toISOString(), origin: 'candidate-checkout',
        actorId: candidateId, actorEmail: resolveActorIdentity(candidateId, undefined, getCandidates()).email,
    });
};

// Mock function to simulate Stripe Webhook processing
export const processPaymentWebhook = async (paymentId: string, status: 'succeeded' | 'failed'): Promise<Payment> => {
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate webhook processing delay

    const payments = getPayments();
    const paymentIndex = payments.findIndex(p => p.id === paymentId);

    if (paymentIndex === -1) {
        throw new Error("Payment not found for webhook processing.");
    }

    const payment = payments[paymentIndex];
    payment.status = status;
    payment.updated_at = new Date().toISOString();
    savePayments(payments);

    const allCandidates = getCandidates();
    const updatedCandidates = allCandidates.map((c): Candidate => {
        if (payment.candidate_ids.includes(c.id)) {
            return { ...c, payment_status: status === 'succeeded' ? 'paid' : 'payment_failed' };
        }
        return c;
    });
    saveCandidates(updatedCandidates);

    const payerAgency = getForeignAgencies().find(fa => fa.id === payment.payer_foreign_agency_id);
    const payeeAgency = getLocalAgencies().find(la => la.id === payment.payee_local_agency_id);

    await recordApprovalLog(
        'system', // Webhooks are system actions
        isDemoMode() ? 'payment-simulator@dawm.test' : 'Payment provider system',
        'Payment',
        payment.id,
        'Updated',
        `Payment ${payment.id} status updated to '${status}' for ${payment.candidate_ids.length} candidates. From ${payerAgency?.name || 'N/A'} to ${payeeAgency?.name || 'N/A'}.`
    );

    return payment;
};