import { getPaymentStatuses, savePaymentStatuses } from '../data-store';

export const updatePaymentStatus = async (candidateId: string, stageId: number, isPaid: boolean): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const statuses = getPaymentStatuses();
    const index = statuses.findIndex(status => status.candidateId === candidateId && status.stageId === stageId);

    if (index !== -1) {
        statuses[index].isPaid = isPaid;
    } else if (isPaid) {
        statuses.push({ candidateId, stageId, isPaid: true });
    }
    savePaymentStatuses(statuses);
};
