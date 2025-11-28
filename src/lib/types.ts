export type StageStatus = 'Pending' | 'In Progress' | 'Passed' | 'Failed' | 'Issued' | 'Completed';
export type MedicalStatus = 'Pending' | 'Passed' | 'Failed';
export type UserRole = 'admin' | 'staff' | 'agency' | 'local-agency' | 'candidate'; // Added 'local-agency' role

// NEW: Staff User Interface
export interface StaffUser {
  id: string;
  email: string;
  role: Exclude<UserRole, 'candidate'>; // admin, staff, agency, local-agency
  is_approved: boolean;
  created_at: string;
  auth_code_used?: string; // NEW: Store the authorization code used for signup
  foreign_agency?: string; // NEW: Link staff/agency users to a specific foreign agency
  coc_agency_name?: string; // NEW: For 'local-agency' role, this links to the Local Agency (e.g., 'NuraLink') that employs the staff.
}

export const STAFF_ROLES: Array<Exclude<UserRole, 'candidate'>> = ['admin', 'staff', 'agency', 'local-agency'];

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
  email: string; // NEW FIELD: Candidate login email
  coc_agency?: string; // NEW FIELD: COC Training Agency
  foreign_agency?: string; // NEW FIELD: Foreign Employment Agency
  managing_local_agency?: string; // NEW FIELD: The Local Agency managing this candidate
  profile_image_url?: string; // NEW FIELD: URL for candidate's profile image
  created_at: string;
  updated_at: string;
}

// NEW: Chat Message Types
export type ChatSender = 'candidate' | 'admin' | 'staff';

export interface ChatMessage {
    id: string;
    candidate_id: string;
    sender: ChatSender;
    sender_name: string; // e.g., Candidate Name or Staff Email
    message: string;
    timestamp: string; // ISO date string
    is_read_by_admin: boolean;
    is_read_by_candidate: boolean;
    trackingCode?: string; // NEW: Added for AdminChatViewer summary
}

// NEW: Approval Log Type
export interface ApprovalLog {
    id: string;
    timestamp: string;
    actor_id: string;
    actor_email: string;
    target_type: 'StaffUser' | 'AuthorizationCode' | 'Config' | 'Candidate' | 'AttendanceRecord'; // Added 'Candidate' and 'AttendanceRecord'
    target_id: string; // ID of the user/code/config item affected
    action: 'Created' | 'Approved' | 'Rejected' | 'Updated' | 'Deleted';
    description: string;
}

// NEW: Attendance Record Type
export interface AttendanceRecord {
    id: string;
    staff_id: string;
    staff_email: string;
    check_in_time: string; // ISO date string
    check_out_time?: string; // ISO date string, optional if still checked in
}

// NEW: Authorization Code Type
export interface AuthorizationCode {
    code: string;
    coc_agency_name?: string; // Optional: For 'local-agency' staff, this links to the Local Agency (e.g., 'NuraLink') that employs them.
    foreign_agency_name?: string; // Optional: Link to a specific foreign agency
    created_by_admin_id: string;
    created_at: string;
    expires_at?: string; // Optional expiry date
    is_active: boolean;
    usage_count: number;
    max_uses?: number; // Optional max usage count
}

// Combined data structure for Admin view
export interface CandidateDetail extends Candidate {
  stages: CandidateStage[];
  documents: Document[];
  medical_results: MedicalResult[];
  chat_messages: ChatMessage[]; // NEW: Include chat messages
}

// Summary data structure for Admin Dashboard view
export interface CandidateSummary extends Candidate {
  progress_percent: number;
  // Add a calculated status for filtering purposes
  overall_status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  // NEW Payment Status fields
  is_initial_medical_paid: boolean;
  is_final_medical_paid: boolean;
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
    stage_id: number; // ADDED
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

// NEW: Data structure for Payment Analytics
export interface PaymentAnalytics {
    totalFeesDue: number;
    totalFeesPaid: number;
    stages: Array<{
        stageTitle: string;
        stageId: number;
        feesDue: number;
        feesPaid: number;
        totalCandidates: number;
        paidCandidates: number;
    }>;
}

// --- Sorting Types ---
export type CandidateSortField = 'first_name' | 'tracking_code' | 'progress_percent' | 'overall_status' | 'country_of_origin' | 'marital_status' | 'foreign_agency'; // Added foreign_agency
export type SortDirection = 'asc' | 'desc';

// NEW: Time Filter Type
export type TimeFilter = 'All' | 'Month' | 'Bi-Yearly' | 'Yearly';

// Constants for Stages (based on SQL seed)
export const ALL_STAGES: Stage[] = [
  { id: 1, slug: 'initial_medical', title: 'Initial Medical Exam', ordinal: 10, icon: 'HeartPulse', fee_amount: 1500 }, // 1
  { id: 2, slug: 'coc_training', title: 'CoC Training', ordinal: 20, icon: 'GraduationCap' }, // 2
  { id: 4, slug: 'labor_id', title: 'Labor ID Registration', ordinal: 30, icon: 'Fingerprint' }, // 3
  { id: 3, slug: 'security_clearance', title: 'Security Clearance from Federal Government of Ethiopia Forensics Department (via Fingerprint)', ordinal: 40, icon: 'ShieldCheck' }, // 4 - Updated Title
  { id: 7, slug: 'job_matching', title: 'Job Matching with Foreign Employment Agency', ordinal: 50, icon: 'Users' }, // 5 - Updated Title
  { id: 5, slug: 'contract_signing', title: 'Agency Contract Signing', ordinal: 60, icon: 'FileSignature' }, // 6
  { id: 6, slug: 'final_elmis_clearance', title: 'Final ELMIS Clearance (QR Code released)', ordinal: 70, icon: 'QrCode' }, // 7 - NEW STAGE (Replaced Biometrics)
  { id: 8, slug: 'visa_processing', title: 'Visa Processing', ordinal: 80, icon: 'Plane' }, // 8
  { id: 9, slug: 'final_medical', title: 'Final Medical Clearance', ordinal: 90, icon: 'Stethoscope', fee_amount: 1000 }, // 9
  { id: 10, slug: 'pdo', title: 'Pre-Departure Orientation', ordinal: 100, icon: 'Briefcase' }, // 10
  { id: 11, slug: 'flight_departure', title: 'Flight Booking + Departure', ordinal: 110, icon: 'PlaneTakeoff' }, // 11
];

export const TOTAL_STAGES = ALL_STAGES.length;