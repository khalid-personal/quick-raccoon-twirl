import type { ApprovalLog, Payment } from './types';

export const paymentProvenance = (payment: Payment, logs: ApprovalLog[], payments: Payment[]) => {
  const paymentEvents = logs.filter(log => log.target_type === 'Payment' && log.target_id === payment.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const candidateEvents = logs.filter(log => log.target_type === 'Candidate' && payment.candidate_ids.includes(log.target_id))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const initiation = paymentEvents.find(log => log.action === 'Created' && log.description.startsWith('Initiated payment'));
  const creation = paymentEvents.find(log => log.action === 'Created');
  const initiator = payment.initiated_by ?? (initiation ? { id: initiation.actor_id, email: initiation.actor_email } : undefined);
  const recorder = payment.recorded_by ?? (creation ? { id: creation.actor_id, email: creation.actor_email } : undefined);
  const relatedPayments = payments.filter(other => other.id !== payment.id && (
    (!!payment.provider_reference && other.provider_reference === payment.provider_reference) ||
    other.candidate_ids.some(id => payment.candidate_ids.includes(id))
  ));
  return { paymentEvents, candidateEvents, initiator, recorder, relatedPayments };
};
