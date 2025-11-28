import { v4 as uuidv4 } from 'uuid';
import { Payment, Candidate, CandidatePaymentStatus, ForeignAgency, LocalAgency } from '../types';
import { getPayments, savePayments, getCandidates, saveCandidates, getForeignAgencies, getLocalAgencies } from '../data-store';
import { recordApprovalLog } from './log-management';

// Mock function to simulate Stripe Checkout Session creation
export const initiatePayment = async (
    payerForeignAgencyId: string,
    candidateIds: string[],
    actorId: string,
    actorEmail: string
): Promise<{ checkoutUrl: string, paymentId: string }> => {
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

    // Mock calculation of total amount (e.g., 1000 ETB per candidate)
    const amount = candidatesToPayFor.length * 1000; // Example fee

    const newPayment: Payment = {
        id: uuidv4(),
        stripe_payment_intent_id: `pi_mock_${uuidv4().substring(0, 8)}`, // Mock Stripe ID
        amount: amount,
        currency: 'ETB',
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
    const updatedCandidates = allCandidates.map(c => {
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
        `Initiated payment of ${amount} ETB from ${payerAgency.name} to ${payeeAgency.name} for ${candidateIds.length} candidates.`
    );

    // Mock checkout URL
    const checkoutUrl = `/mock-payment-checkout?paymentId=${newPayment.id}&amount=${amount}&currency=${newPayment.currency}`;

    return { checkoutUrl, paymentId: newPayment.id };
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
    const updatedCandidates = allCandidates.map(c => {
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
        'system@agency.com',
        'Payment',
        payment.id,
        'Updated',
        `Payment ${payment.id} status updated to '${status}' for ${payment.candidate_ids.length} candidates. From ${payerAgency?.name || 'N/A'} to ${payeeAgency?.name || 'N/A'}.`
    );

    return payment;
};