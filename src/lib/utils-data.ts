import { CandidateStage, CandidateSummary, TOTAL_STAGES, TimeFilter } from './types';

// Helper function to check if DOB is 18+
export const isAdult = (dob: string): boolean => {
    const birthDate = new Date(dob);
    const ageDiffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDiffMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970) >= 18;
};

// --- Progress Calculation Utility ---

export function calculateProgress(candidateStages: CandidateStage[]): number {
  if (candidateStages.length === 0) return 0;

  const completedStages = candidateStages.filter(
    (cs) => cs.status === 'Passed' || cs.status === 'Issued' || cs.status === 'Completed'
  ).length;

  return Math.floor((completedStages / TOTAL_STAGES) * 100);
}

// --- Overall Status Calculation Utility ---

export function calculateOverallStatus(candidateStages: CandidateStage[]): CandidateSummary['overall_status'] {
    const completedStages = candidateStages.filter(
        (cs) => cs.status === 'Passed' || cs.status === 'Issued' || cs.status === 'Completed'
    );
    
    // Check for Blocked (any stage failed)
    const failedStage = candidateStages.find(cs => cs.status === 'Failed');
    if (failedStage) {
        return 'Blocked';
    }

    // Check for Completed (all stages passed/issued/completed)
    if (completedStages.length === TOTAL_STAGES) {
        return 'Completed';
    }
    
    // Check for In Progress (at least one stage passed/issued/completed, but not all)
    if (completedStages.length > 0) {
        return 'In Progress';
    }

    // Otherwise, Pending (no stages completed yet)
    return 'Pending';
}

// --- Time Filter Utility ---

export function getFilterStartDate(filter: TimeFilter): Date | null {
    const now = new Date();
    switch (filter) {
        case 'Month':
            return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        case 'Bi-Yearly':
            return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        case 'Yearly':
            return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        case 'All':
        default:
            return null;
    }
}