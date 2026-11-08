import {
    CandidateSummary,
    DashboardSummary,
    PipelineDistribution,
    CandidateSortField,
    SortDirection,
    ALL_STAGES,
    PaymentAnalytics,
    TimeFilter,
} from '../types';
import { getCandidates, getCandidateStages, getPaymentStatuses, getPayments, getLocalAgencies, getForeignAgencies, getCocFacilities, getConfig } from '../data-store'; // Import new getters
import { stageFeeCovered } from '../stage-readiness';
import { calculateProgress, calculateOverallStatus, getFilterStartDate } from '../utils-data';
import { getStageId } from './utils';

// Helper function to filter candidates by creation date
const filterCandidatesByTime = (candidates: CandidateSummary[], filter: TimeFilter): CandidateSummary[] => {
    const startDate = getFilterStartDate(filter);
    if (!startDate) return candidates;

    const startTime = startDate.getTime();

    return candidates.filter(c => {
        const createdTime = new Date(c.created_at).getTime();
        return createdTime >= startTime;
    });
};

// Helper function to filter candidates by foreign agency ID
const filterCandidatesByForeignAgencyId = (candidates: CandidateSummary[], foreignAgencyName?: string): CandidateSummary[] => {
    if (!foreignAgencyName) return candidates;
    const foreignAgency = getForeignAgencies().find(fa => fa.name === foreignAgencyName);
    if (!foreignAgency) return []; // If agency name doesn't exist, no candidates match
    return candidates.filter(c => c.foreign_agency_id === foreignAgency.id || c.profile_shares?.some(share => share.foreign_agency_id === foreignAgency.id));
};

// NEW: Helper function to filter candidates by Local Agency ID
const filterCandidatesByLocalAgencyName = (candidates: CandidateSummary[], localAgencyName?: string): CandidateSummary[] => {
    console.log(`[filterCandidatesByLocalAgencyName] Filtering by Local Agency Name: ${localAgencyName}`);
    if (!localAgencyName) {
        console.log("[filterCandidatesByLocalAgencyName] No Local Agency name provided, returning all candidates.");
        return candidates;
    }
    const localAgency = getLocalAgencies().find(la => la.name === localAgencyName);
    if (!localAgency) {
        console.log(`[filterCandidatesByLocalAgencyName] Local Agency '${localAgencyName}' not found, returning empty array.`);
        return []; // If agency name doesn't exist, no candidates match
    }
    const filtered = candidates.filter(c => c.local_agency_id === localAgency.id);
    console.log(`[filterCandidatesByLocalAgencyName] Candidates before filter: ${candidates.length}, after filter: ${filtered.length}`);
    return filtered;
};

// GET /api/admin/batches
export const getBatches = async (): Promise<string[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const deploymentStage = ALL_STAGES.find(s => s.slug === 'deployment');

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
                cs => cs.candidate_id === candidate.id && cs.stage_id === deploymentStage?.id
            );
            return flightStage?.status === 'Completed';
        });
        return !allCompleted;
    }).sort(); // Sort alphabetically for consistency

    return activeBatches;
};

// GET /api/admin/summary
export const getDashboardSummary = async (
    filter: TimeFilter = 'All', 
    foreignAgencyNameFilter?: string, // Changed to name
    localAgencyNameFilter?: string // Changed to name
): Promise<DashboardSummary> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();

    // 1. Augment candidates with status and names
    const candidatesWithStatus = candidates.map(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id);
        const overall_status = calculateOverallStatus(candidateStages);

        const foreignAgency = candidate.foreign_agency_id ? getForeignAgencies().find(fa => fa.id === candidate.foreign_agency_id) : undefined;
        const localAgency = candidate.local_agency_id ? getLocalAgencies().find(la => la.id === candidate.local_agency_id) : undefined;
        const cocFacility = candidate.coc_facility_id ? getCocFacilities().find(cf => cf.id === candidate.coc_facility_id) : undefined;

        return { 
            ...candidate, 
            overall_status,
            foreign_agency_name: foreignAgency?.name,
            local_agency_name: localAgency?.name,
            coc_facility_name: cocFacility?.name,
        };
    }) as CandidateSummary[];

    // 2. Apply time filter
    let filteredCandidates = filterCandidatesByTime(candidatesWithStatus, filter);
    
    // 3. Apply foreign agency filter
    filteredCandidates = filterCandidatesByForeignAgencyId(filteredCandidates, foreignAgencyNameFilter);

    // 4. Apply Local agency filter
    filteredCandidates = filterCandidatesByLocalAgencyName(filteredCandidates, localAgencyNameFilter);

    let pending = 0;
    let in_progress = 0;
    let completed = 0;
    let blocked = 0;

    filteredCandidates.forEach(candidate => {
        const status = candidate.overall_status;

        if (status === 'Pending') pending++;
        else if (status === 'In Progress') in_progress++;
        else if (status === 'Completed') completed++;
        else if (status === 'Blocked') blocked++;
    });

    return {
        total: filteredCandidates.length,
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
    sortDirection: SortDirection = 'asc', // Default direction
    timeFilter: TimeFilter = 'All',
    foreignAgencyNameFilter?: string, // Changed to name
    localAgencyNameFilter?: string // Changed to name
): Promise<CandidateSummary[]> => {
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const paymentStatuses = getPaymentStatuses();
    const foreignAgencies = getForeignAgencies();
    const localAgencies = getLocalAgencies();
    const cocFacilities = getCocFacilities();
    const q = query.toLowerCase();
    
    const medicalStage = ALL_STAGES.find(s => s.slug === 'medical');

    // 1. Augment candidates with calculated status/progress and payment status
    const candidatesWithStatus = candidates.map(candidate => {
        const candidateStages = allStages.filter(cs => cs.candidate_id === candidate.id);
        const progress_percent = calculateProgress(candidateStages);
        const overall_status = calculateOverallStatus(candidateStages);
        
        const is_medical_paid = !!medicalStage && stageFeeCovered(candidate, medicalStage.id, getConfig().stageFees ?? {}, paymentStatuses, getPayments());

        const foreignAgency = candidate.foreign_agency_id ? foreignAgencies.find(fa => fa.id === candidate.foreign_agency_id) : undefined;
        const localAgency = candidate.local_agency_id ? localAgencies.find(la => la.id === candidate.local_agency_id) : undefined;
        const cocFacility = candidate.coc_facility_id ? cocFacilities.find(cf => cf.id === candidate.coc_facility_id) : undefined;
        
        return {
            ...candidate,
            progress_percent,
            overall_status,
            is_medical_paid,
            paid_stage_ids: ALL_STAGES.filter(stage => stageFeeCovered(candidate, stage.id, getConfig().stageFees ?? {}, paymentStatuses, getPayments())).map(stage => stage.id),
            foreign_agency_name: foreignAgency?.name,
            local_agency_name: localAgency?.name,
            coc_facility_name: cocFacility?.name,
        };
    });

    // 2. Apply time filter first
    let filteredCandidates = filterCandidatesByTime(candidatesWithStatus, timeFilter);
    
    // 3. Apply foreign agency filter
    filteredCandidates = filterCandidatesByForeignAgencyId(filteredCandidates, foreignAgencyNameFilter);

    // 4. Apply Local agency filter
    console.log(`[searchCandidates] Applying Local agency filter: ${localAgencyNameFilter}`);
    filteredCandidates = filterCandidatesByLocalAgencyName(filteredCandidates, localAgencyNameFilter);

    // 5. Apply search/status/batch filters
    filteredCandidates = filteredCandidates.filter(c => {
        const matchesQuery =
            c.first_name.toLowerCase().includes(q) ||
            c.last_name.toLowerCase().includes(q) ||
            c.passport_number.toLowerCase().includes(q) ||
            c.tracking_code.toLowerCase().includes(q) ||
            (c.foreign_agency_name?.toLowerCase().includes(q)) ||
            (c.local_agency_name?.toLowerCase().includes(q)) ||
            (c.coc_facility_name?.toLowerCase().includes(q));

        const matchesStatus = !filterStatus || c.overall_status === filterStatus;

        const matchesBatch = !filterBatch || c.batch_name === filterBatch;

        return matchesQuery && matchesStatus && matchesBatch;
    });

    // 6. Sort candidates
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
            case 'overall_status': {
                // Define a custom order for status
                const statusOrder: Record<CandidateSummary['overall_status'], number> = {
                    'Blocked': 1,
                    'In Progress': 2,
                    'Pending': 3,
                    'Completed': 4,
                };
                compareNumbers(statusOrder[a.overall_status], statusOrder[b.overall_status]);
                break;
            }
            case 'marital_status':
                compareStrings(a.marital_status, b.marital_status);
                break;
            case 'country_of_origin':
                compareStrings(a.country_of_origin, b.country_of_origin);
                break;
            case 'foreign_agency_name':
                compareStrings(a.foreign_agency_name, b.foreign_agency_name);
                break;
            case 'local_agency_name':
                compareStrings(a.local_agency_name, b.local_agency_name);
                break;
            case 'coc_facility_name':
                compareStrings(a.coc_facility_name, b.coc_facility_name);
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
export const getPipelineDistribution = async (
    filter: TimeFilter = 'All', 
    foreignAgencyNameFilter?: string, // Changed to name
    localAgencyNameFilter?: string // Changed to name
): Promise<PipelineDistribution[]> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const allStages = getCandidateStages();
    const foreignAgencies = getForeignAgencies();
    const localAgencies = getLocalAgencies();
    const cocFacilities = getCocFacilities();
    
    // 1. Augment candidates with status and names
    const candidatesWithStatus = candidates.map(candidate => {
        const foreignAgency = candidate.foreign_agency_id ? foreignAgencies.find(fa => fa.id === candidate.foreign_agency_id) : undefined;
        const localAgency = candidate.local_agency_id ? localAgencies.find(la => la.id === candidate.local_agency_id) : undefined;
        const cocFacility = candidate.coc_facility_id ? cocFacilities.find(cf => cf.id === candidate.coc_facility_id) : undefined;

        return { 
            ...candidate, 
            overall_status: calculateOverallStatus(allStages.filter(cs => cs.candidate_id === candidate.id)),
            foreign_agency_name: foreignAgency?.name,
            local_agency_name: localAgency?.name,
            coc_facility_name: cocFacility?.name,
        };
    }) as CandidateSummary[];

    // 2. Apply time filter
    let filteredCandidates = filterCandidatesByTime(candidatesWithStatus, filter);
    
    // 3. Apply foreign agency filter
    filteredCandidates = filterCandidatesByForeignAgencyId(filteredCandidates, foreignAgencyNameFilter);

    // 4. Apply Local agency filter
    filteredCandidates = filterCandidatesByLocalAgencyName(filteredCandidates, localAgencyNameFilter);

    // Initialize distribution map for all stages
    const distributionMap = new Map<number, { pending: number, inProgress: number, blocked: number }>();
    ALL_STAGES.forEach(stage => {
        distributionMap.set(stage.id, { pending: 0, inProgress: 0, blocked: 0 });
    });

    // Determine the current blocking stage for each candidate
    filteredCandidates.forEach(candidate => {
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
export const getPaymentAnalytics = async (
    filter: TimeFilter = 'All', 
    foreignAgencyNameFilter?: string, // Changed to name
    localAgencyNameFilter?: string // Changed to name
): Promise<PaymentAnalytics> => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const candidates = getCandidates();
    const paymentStatuses = getPaymentStatuses();
    const foreignAgencies = getForeignAgencies();
    const localAgencies = getLocalAgencies();
    const cocFacilities = getCocFacilities();
    
    // 1. Augment candidates with status (needed for filtering utility)
    const candidatesWithStatus = candidates.map(candidate => {
        const foreignAgency = candidate.foreign_agency_id ? foreignAgencies.find(fa => fa.id === candidate.foreign_agency_id) : undefined;
        const localAgency = candidate.local_agency_id ? localAgencies.find(la => la.id === candidate.local_agency_id) : undefined;
        const cocFacility = candidate.coc_facility_id ? cocFacilities.find(cf => cf.id === candidate.coc_facility_id) : undefined;

        return { 
            ...candidate, 
            overall_status: 'Pending', // Placeholder, not used for payment analytics filtering
            foreign_agency_name: foreignAgency?.name,
            local_agency_name: localAgency?.name,
            coc_facility_name: cocFacility?.name,
        };
    }) as CandidateSummary[];
    
    // 2. Apply time filter
    let filteredCandidates = filterCandidatesByTime(candidatesWithStatus, filter);
    
    // 3. Apply foreign agency filter
    filteredCandidates = filterCandidatesByForeignAgencyId(filteredCandidates, foreignAgencyNameFilter);

    // 4. Apply Local agency filter
    filteredCandidates = filterCandidatesByLocalAgencyName(filteredCandidates, localAgencyNameFilter);
    
    const configuredFees = getConfig().stageFees ?? {};
    const stagesWithFees = ALL_STAGES
        .map(stage => ({ ...stage, fee_amount: configuredFees[stage.id] ?? stage.fee_amount }))
        .filter(stage => stage.fee_amount !== undefined);
    
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
            totalCandidates: filteredCandidates.length,
            paidCandidates: 0,
        });
    });
    
    // Calculate fees based on filtered candidates and stages with fees
    filteredCandidates.forEach(candidate => {
        stagesWithFees.forEach(stage => {
            const feeAmount = stage.fee_amount!;
            
            const isPaid = stageFeeCovered(candidate, stage.id, getConfig().stageFees ?? {}, paymentStatuses, getPayments());
            
            const analytics = stageAnalyticsMap.get(stage.id)!;
            
            // Every candidate in the filtered set is assumed to owe the fee for this stage
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