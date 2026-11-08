import { v4 as uuidv4 } from 'uuid';
import { ApprovalLog } from '../types';
import { getApprovalLogs, getCandidates, getLocalAgencies, getPayments, saveApprovalLogs } from '../data-store';
import { isDemoMode } from '../demo-mode';
import { paymentCandidateSummary, resolveActorIdentity } from '../demo-identities';

// Record an approval or administrative action
export const recordApprovalLog = async (
    actorId: string,
    actorEmail: string,
    targetType: ApprovalLog['target_type'],
    targetId: string,
    action: ApprovalLog['action'],
    description: string
): Promise<ApprovalLog> => {
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async operation

    const candidates = getCandidates();
    const actor = isDemoMode() ? resolveActorIdentity(actorId, actorEmail, candidates) : { id: actorId, email: actorEmail };
    const payment = targetType === 'Payment' ? getPayments().find(item => item.id === targetId) : undefined;
    const candidate = targetType === 'Candidate' ? candidates.find(item => item.id === targetId) : undefined;
    const context = payment
        ? `${paymentCandidateSummary(payment, candidates)}; ${payment.provider_reference || payment.receipt_number || payment.id}; ${getLocalAgencies().find(agency => agency.id === payment.payee_local_agency_id)?.name ?? payment.payee_local_agency_id}`
        : candidate ? `${candidate.first_name} ${candidate.last_name} (${candidate.tracking_code}); ${getLocalAgencies().find(agency => agency.id === candidate.local_agency_id)?.name ?? candidate.local_agency_id}` : '';
    const newLog: ApprovalLog = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        actor_id: actorId,
        actor_email: actor.email ?? actorEmail,
        target_type: targetType,
        target_id: targetId,
        action: action,
        description: context ? `${description} [Record context: ${context}]` : description,
    };

    const allLogs = getApprovalLogs();
    allLogs.push(newLog);
    saveApprovalLogs(allLogs);

    return newLog;
};

// Get all approval logs (for Superadmin view)
export const getAllApprovalLogs = async (): Promise<ApprovalLog[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getApprovalLogs().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};