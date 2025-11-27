export type StageStatus = 'Pending' | 'In Progress' | 'Passed' | 'Failed' | 'Issued' | 'Completed';
export type MedicalStatus = 'Pending' | 'Passed' | 'Failed';
export type UserRole = 'admin' | 'staff' | 'viewer';

export interface Stage {
  id: number;
  slug: string;
  title: string;
  ordinal: number;
  icon: string; // Added icon field
  fee_amount?: number; // NEW: Optional fee amount associated with the stage
}

export interface CandidateStage {
  id: string;
  candidate_id: string;
  stage_id: number;
  status: StageStatus;
  notes?: string;
  date?: string; // ISO date string
  updated_at: string;
  reference_id?: string; // Added field for Labor ID, Visa Number, etc.
}

export interface Document {
  id: string;
  candidate_id: string;
  stage_id?: number;
  file_name: string;
  file_type: string;
  storage_key: string;
  uploaded_at: string;
  // Mocked secure URL for public view
  public_url?: string; 
}

export interface MedicalResult {
  id: string;
  candidate_id: string;
  exam_type: string; // e.g., 'HIV','Pregnancy','Final Agency Medical'
  status: MedicalStatus;
  exam_date?: string; // ISO date string
  notes?: string;
  document_id?: string;
}

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  dob: string; // ISO date string - REQUIRED
  passport_number: string; // REQUIRED
  tracking_code: string;
  country_of_origin: string; // REQUIRED
  batch_name?: string; // New optional field for grouping
  marital_status: 'Single' | 'Married' | 'Divorced' | 'Widowed'; // New field
  phone_number?: string; // NEW FIELD
  created_at: string;
  updated_at: string;
}

// Combined data structure for Admin view
export interface CandidateDetail extends Candidate {
  stages: CandidateStage[];
  documents: Document[];
  medical_results: MedicalResult[];
}

// Summary data structure for Admin Dashboard view
export interface CandidateSummary extends Candidate {
  progress_percent: number;
  // Add a calculated status for filtering purposes
  overall_status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  // Removed is_minor: boolean;
}

export interface DashboardSummary {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  blocked: number;
}

// Data structure for Public Tracking view
export interface PublicTrackingData {
  candidate_name: string;
  tracking_code: string;
  progress_percent: number;
  timeline: Array<{
    title: string;
    status: StageStatus;
    date?: string;
    notes?: string;
    is_medical_stage: boolean;
    medical_status_summary?: MedicalStatus | StageStatus; // Only Pass/Fail/Pending summary for medical stages
    documents: Document[];
    fee_amount?: number; // NEW: Fee amount for this stage
    is_fee_paid: boolean; // NEW: Mock status for fee payment
  }>;
}

// Data structure for the pipeline distribution chart
export interface PipelineDistribution {
    stageTitle: string;
    ordinal: number;
    pendingCount: number;
    inProgressCount: number;
    blockedCount: number;
}

// --- Sorting Types ---
export type CandidateSortField = 'first_name' | 'tracking_code' | 'progress_percent' | 'overall_status' | 'country_of_origin' | 'marital_status';
export type SortDirection = 'asc' | 'desc';

// Constants for Stages (based on SQL seed)
export const ALL_STAGES: Stage[] = [
  { id: 1, slug: 'initial_medical', title: 'Initial Medical Exam', ordinal: 10, icon: 'HeartPulse', fee_amount: 1500 }, // Added fee
  { id: 2, slug: 'coc_training', title: 'CoC Training', ordinal: 20, icon: 'GraduationCap' },
  { id: 3, slug: 'security_clearance', title: 'Security / Interpol Clearance', ordinal: 30, icon: 'ShieldCheck' },
  { id: 4, slug: 'labor_id', title: 'Labor ID Registration', ordinal: 40, icon: 'Fingerprint' },
  { id: 5, slug: 'contract_signing', title: 'Agency Contract Signing', ordinal: 50, icon: 'FileSignature' },
  { id: 6, slug: 'biometrics_passport', title: 'Biometrics + Passport Processing', ordinal: 60, icon: 'Scan' },
  { id: 7, slug: 'job_matching', title: 'Job Matching', ordinal: 70, icon: 'Users' },
  { id: 8, slug: 'visa_processing', title: 'Visa Processing', ordinal: 80, icon: 'Plane' },
  { id: 9, slug: 'final_medical', title: 'Final Medical Clearance', ordinal: 90, icon: 'Stethoscope', fee_amount: 1000 }, // Added fee
  { id: 10, slug: 'pdo', title: 'Pre-Departure Orientation', ordinal: 100, icon: 'Briefcase' },
  { id: 11, slug: 'flight_departure', title: 'Flight Booking + Departure', ordinal: 110, icon: 'PlaneTakeoff' },
];

export const TOTAL_STAGES = ALL_STAGES.length;