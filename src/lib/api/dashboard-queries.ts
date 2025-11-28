import {
    CandidateSummary,
    DashboardSummary,
    PipelineDistribution,
    CandidateSortField,
    SortDirection,
    ALL_STAGES,
    PaymentAnalytics,
} from '../types';
import { getCandidates, getCandidateStages, getPaymentStatuses } from '../data-store';
import { calculateProgress, calculateOverallStatus } from '../utils-data';
import { getStageId } from './utils';

// GET /api/admin/batches
export const getBatches = async (): Promise<string[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const flightDepartureStageId = getStageId('flight_departure');

    const batches = new Set<string>();

    candidates.forEach(candidate => {
        if (candidate.batch_name) {
            batches.add(candidate.batch_name);
        }
    });

    // Filter out batches where ALL candidates have completed the final stage
    const activeBatches = Array.from(batches).filter(batch => {
        const candidatesInBatch = candidates.filter(c => c.batch_name === batch);
        const allCompleted = candidatesInBatch.every(candidate => {
            const flightStage = allStages.find(
                cs => cs.candidate_id === candidate.id && cs.stage_id === flightDepartureStageId
            );
            return flightStage?.status === 'Completed';
        });
        return !allCompleted;
    }).sort(); // Sort alphabetically for consistency

    return activeBatches;
};

// GET /api/admin/summary
export const getDashboardSummary = async (): Promise<DashboardSummary> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();

    let pending = 0;
    let in_progress = 0;
    let completed = 0;
    let blocked = 0;

    candidates.forEach(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id);
        const status = calculateOverallStatus(candidateStages);

        if (status === 'Pending') pending++;
        else if (status === 'In Progress') in_progress++;
        else if (status === 'Completed') completed++;
        else if (status === 'Blocked') blocked++;
    });

    return {
        total: candidates.length,
        pending,
        in_progress,
        completed,
        blocked,
    };
};

// GET /api/admin/search?q=
export const searchCandidates = async (
    query: string,
    filterStatus?: CandidateSummary['overall_status'],
    filterBatch?: string,
    sortBy: CandidateSortField = 'tracking_code', // Default sort
    sortDirection: SortDirection = 'asc' // Default direction
): Promise<CandidateSummary[]> => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const q = query.toLowerCase();

    // 1. Augment candidates with calculated status/progress
    const candidatesWithStatus = candidates.map(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id);
        const progress_percent = calculateProgress(candidateStages);
        const overall_status = calculateOverallStatus(candidateStages);
        return {
            ...candidate,
            progress_percent,
            overall_status,
        };
    });

    // 2. Filter candidates
    const filteredCandidates = candidatesWithStatus.filter(c => {
        const matchesQuery =
            c.first_name.toLowerCase().includes(q) ||
            c.last_name.toLowerCase().includes(q) ||
            c.passport_number.toLowerCase().includes(q) ||
            c.tracking_code.toLowerCase().includes(q);

        const matchesStatus = !filterStatus || c.overall_status === filterStatus;

        const matchesBatch = !filterBatch || c.batch_name === filterBatch;

        return matchesQuery && matchesStatus && matchesBatch;
    });

    // 3. Sort candidates
    const sortedCandidates = filteredCandidates.sort((a, b) => {
        let comparison = 0;

        // Helper for string comparison
        const compareStrings = (valA: string | undefined, valB: string | undefined) => {
            const strA = (valA || '').toLowerCase();
            const strB = (valB || '').toLowerCase();
            if (strA < strB) comparison = -1;
            if (strA > strB) comparison = 1;
        };

        // Helper for numeric comparison
        const compareNumbers = (valA: number, valB: number) => {
            comparison = valA - valB;
        };

        switch (sortBy) {
            case 'progress_percent':
                compareNumbers(a.progress_percent, b.progress_percent);
                break;
            case 'overall_status':
                // Define a custom order for status
                const statusOrder: Record<CandidateSummary['overall_status'], number> = {
                    'Blocked': 1,
                    'In Progress': 2,
                    'Pending': 3,
                    'Completed': 4,
                };
                compareNumbers(statusOrder[a.overall_status], statusOrder[b.overall_status]);
                break;
            case 'marital_status':
                compareStrings(a.marital_status, b.marital_status);
                break;
            case 'country_of_origin':
                compareStrings(a.country_of_origin, b.country_of_origin);
                break;
            case 'tracking_code':
                compareStrings(a.tracking_code, b.tracking_code);
                break;
            case 'first_name':
            default:
                compareStrings(a.first_name + a.last_name, b.first_name + b.last_name);
                break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sortedCandidates;
};

// GET /api/admin/pipeline-distribution
export const getPipelineDistribution = async (): Promise<PipelineDistribution[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();

    // Initialize distribution map for all stages
    const distributionMap = new Map<number, { pending: number, inProgress: number, blocked: number }>();
    ALL_STAGES.forEach(stage => {
        distributionMap.set(stage.id, { pending: 0, inProgress: 0, blocked: 0 });
    });

    // Determine the current blocking stage for each candidate
    candidates.forEach(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id).sort((a, b) => {
            const stageA = ALL_STAGES.find(s => s.id === a.stage_id)?.ordinal || 0;
            const stageB = ALL_STAGES.find(s => s.id === b.stage_id)?.ordinal || 0;
            return stageA - stageB;
        });

        let currentBlockingStageId: number | null = null;
        let isBlockedByFailure = false;

        for (const cs of candidateStages) {
            if (cs.status === 'Failed') {
                currentBlockingStageId = cs.stage_id;
                isBlockedByFailure = true;
                break;
            }
            if (cs.status === 'Pending' || cs.status === 'In Progress') {
                currentBlockingStageId = cs.stage_id;
                break;
            }
        }

        if (currentBlockingStageId) {
            const currentData = distributionMap.get(currentBlockingStageId)!;
            if (isBlockedByFailure) {
                currentData.blocked += 1;
            } else if (candidateStages.find(cs => cs.stage_id === currentBlockingStageId)?.status === 'In Progress') {
                currentData.inProgress += 1;
            } else {
                currentData.pending += 1;
            }
            distributionMap.set(currentBlockingStageId, currentData);
        }
        // Candidates who completed all stages are not counted here.
    });

    // Format output
    return ALL_STAGES.map(stage => {
        const data = distributionMap.get(stage.id)!;
        return {
            stageTitle: stage.title,
            ordinal: stage.ordinal,
            pendingCount: data.pending,
            inProgressCount: data.inProgress,
            blockedCount: data.blocked,
        };
    });
};

// GET /api/admin/payment-analytics
export const getPaymentAnalytics = async (): Promise<PaymentAnalytics> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const paymentStatuses = getPaymentStatuses();
    
    const stagesWithFees = ALL_STAGES.filter(s => s.fee_amount !== undefined);
    
    let totalFeesDue = 0;
    let totalFeesPaid = 0;
    
    const stageAnalyticsMap = new Map<number, PaymentAnalytics['stages'][number]>();
    
    // Initialize map for stages with fees
    stagesWithFees.forEach(stage => {
        stageAnalyticsMap.set(stage.id, {
            stageTitle: stage.title,
            stageId: stage.id,
            feesDue: 0,
            feesPaid: 0,
            totalCandidates: candidates.length,
            paidCandidates: 0,
        });
    });
    
    // Calculate fees based on all candidates and stages with fees
    candidates.forEach(candidate => {
        stagesWithFees.forEach(stage => {
            const feeAmount = stage.fee_amount!;
            
            const isPaid = paymentStatuses.some(ps => 
                ps.candidateId === candidate.id && ps.stageId === stage.id && ps.isPaid
            );
            
            const analytics = stageAnalyticsMap.get(stage.id)!;
            
            // Every candidate is assumed to owe the fee for this stage
            totalFeesDue += feeAmount;
            analytics.feesDue += feeAmount;
            
            if (isPaid) {
                totalFeesPaid += feeAmount;
                analytics.feesPaid += feeAmount;
                analytics.paidCandidates += 1;
            }
            
            stageAnalyticsMap.set(stage.id, analytics);
        });
    });
    
    return {
        totalFeesDue,
        totalFeesPaid,
        stages: Array.from(stageAnalyticsMap.values()).sort((a, b) => {
            const stageA = ALL_STAGES.find(s => s.id === a.stageId)?.ordinal || 0;
            const stageB = ALL_STAGES.find(s => s.id === b.stageId)?.ordinal || 0;
            return stageA - stageB;
        }),
    };
};