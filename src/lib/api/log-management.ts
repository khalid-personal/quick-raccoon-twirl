import { v4 as uuidv4 } from 'uuid';
import { ApprovalLog, ApprovalAction } from '../types';
import { getApprovalLogs, saveApprovalLogs } from '../data-store';

// Helper function to record an approval/rejection/update action
export const recordApprovalLog = async (
    actorId: string,
    actorEmail: string,
    targetType: ApprovalLog['target_type'],
    targetId: string,
    action: ApprovalAction,
    description: string
): Promise<ApprovalLog> => {
    await new Promise(resolve => setTimeout(resolve, 10));
    const allLogs = getApprovalLogs();

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

    allLogs.push(newLog);
    saveApprovalLogs(allLogs);
    return newLog;
};

// GET /api/admin/logs
export const getApprovalLogsHistory = async (): Promise<ApprovalLog[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    // Return logs sorted by newest first
    return getApprovalLogs().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};