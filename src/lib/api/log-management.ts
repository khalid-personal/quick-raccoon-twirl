import { v4 as uuidv4 } from 'uuid';
import { ApprovalLog, UserRole } from '../types';
import { getApprovalLogs, saveApprovalLogs } from '../data-store';

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

    const newLog: ApprovalLog = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        actor_id: actorId,
        actor_email: actorEmail,
        target_type: targetType,
        target_id: targetId,
        action: action,
        description: description,
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