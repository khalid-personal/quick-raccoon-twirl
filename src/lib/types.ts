// All types and constants are exported directly above. No named export blocks needed.
// --- Notification Types ---
export type NotificationType = 'candidate' | 'payment' | 'profile' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  link: string; // Route to navigate to
  read: boolean;
  recipient_id?: string; // ID of the StaffUser (or candidate) who should receive this notification
  created_at: string;
}
export type StageStatus = 'Pending' | 'In Progress' | 'Passed' | 'Failed' | 'Issued' | 'Completed';
export type MedicalStatus = 'Pending' | 'Passed' | 'Failed';
export type UserRole = 'superadmin' | 'admin' | 'staff' | 'agency' | 'foreign-agency' | 'foreign-agency-staff' | 'local-agency' | 'viewer' | 'candidate' | 'auditor';

// NEW: COC Training Facility Interface
export interface CocFacility {
  id: string;
  name: string;
  address?: string;
  contact_email?: string;
  phone_number?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  gps_url?: string;
  created_at: string;
}

// NEW: Local Agency Interface
export interface LocalAgency {
  id: string;
  name: string;
  address?: string;
  contact_email?: string;
  phone_number?: string;
  created_at: string;
}

// NEW: Foreign Agency Interface (if not already defined, for consistency)
export interface ForeignAgency {
  id: string;
  name: string;
  country_code?: string;
  address?: string;
  contact_email?: string;
  phone_number?: string;
  created_at: string;
}

export interface AgencyPartnership {
  local_agency_id: string;
  foreign_agency_id: string;
  status: 'active' | 'pending' | 'suspended';
  agreement_reference?: string;
  started_at: string;
}

export interface ProfileShare {
  foreign_agency_id: string;
  sent_at: string;
  sent_by: string;
}

// NEW: AppConfig Interface (Moved from data-seed.ts)
export interface AppConfig {
    countryOptions: string[];
    cocFacilities: CocFacility[];
    foreignAgencies: ForeignAgency[];
    localAgencies: LocalAgency[];
    agencyPartnerships?: AgencyPartnership[];
  stageFees?: Record<number, number>;
    stageFeesInitialized?: boolean;
  staffTaskWeights?: Record<string, number>;
  integrityScoreThresholds?: { greenMin: number; yellowMin: number };
  ministrySubmissionWindow?: { startsOn: string; endsOn: string };
}

// NEW: Staff User Interface
export interface StaffUser {
  id: string;
  email: string;
  role: Exclude<UserRole, 'candidate'>; // admin, staff, agency, local-agency
  is_approved: boolean;
  created_at: string;
  last_synced_at?: string;
  last_online_at?: string;
  auth_code_used?: string;
  foreign_agency_id?: string;
  local_agency_id?: string;
  phone_number?: string;
  profile_image_url?: string;
  profile_edit_pending?: boolean;
  profile_edit_data?: Partial<StaffUser>;
  profile_edit_requested_at?: string;
  profile_edit_approved_at?: string;
  profile_edit_rejected_at?: string;
  profile_edit_rejection_reason?: string;
}
// --- Agency-to-Agency Chat Types ---
// Removed redundant export type statement for AgencyChatThread and AgencyChatMessage
export type AgencyChatSender = 'local-agency' | 'foreign-agency' | 'admin';

export interface AgencyChatMessage {
  id: string;
  local_agency_id: string;
  foreign_agency_id: string;
  sender: AgencyChatSender;
  sender_id: string; // StaffUser id
  sender_name: string;
  message: string;
  timestamp: string;
  is_read_by_local_agency: boolean;
  is_read_by_foreign_agency: boolean;
  candidate_id?: string; //
  tagged_candidate_ids?: string[]; // Candidate profiles linked in this message
  thread_id?: string; // Link back to the thread
}

// For listing chat threads between linked agencies
export interface AgencyChatThread {
  id: string;
  local_agency_id: string;
  foreign_agency_id: string;
  last_message: AgencyChatMessage | null;
  unread_count_local: number;
  unread_count_foreign: number;
}


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
  assigned_staff_id?: string;
  follow_up_due_at?: string;
  follow_up_note?: string;
}

export interface UploadScanReport {
  status: 'clear' | 'review' | 'blocked';
  findings: string[];
  scanned_at: string;
  fingerprint?: string;
}

export interface Document {
  id: string;
  candidate_id: string;
  stage_id?: number;
  file_name: string;
  file_type: string;
  storage_key: string;
  uploaded_at: string;
  // Placeholder secure URL for public view
  public_url?: string; 
  doc_kind?: DocumentKind;
  extracted?: ExtractedDocumentFields;
  scan_report?: UploadScanReport;
}

// Set by the (example) external document system; superadmin can control it manually in Settings.
export interface ExternalDocumentStatus {
  work_contract?: boolean;
  visa?: boolean;
  destination_city?: string;
  destination_country?: string;
  updated_at?: string;
}

export type DocumentKind = 'work_contract' | 'visa' | 'other';

export interface ExtractedDocumentFields {
  employer?: string;
  destination_country?: string;
  destination_city?: string;
  job_title?: string;
  salary?: string;
  start_date?: string;
  document_number?: string;
  issue_date?: string;
  expiry_date?: string;
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

export type CandidatePaymentStatus = 'unpaid' | 'pending_payment' | 'paid' | 'payment_failed';
export interface PaymentStatus {
  candidateId: string;
  stageId: number;
  isPaid: boolean;
}
export type ElmisStatus = 'verified' | 'not_found' | 'mismatch' | 'pending' | 'error';
export interface ElmisRecord {
  status: ElmisStatus;
  registration_id?: string;
  checked_at: string;
  mode: 'live' | 'sandbox';
  mismatches?: string[];
  message?: string;
}
export type CandidateReturnStatus = 'not-planned' | 'planning' | 'ticket-booked' | 'returned' | 'delayed';

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  alt_phone?: string;
  address?: string;
}

export interface EmployerContact {
  company: string;
  contact_name: string;
  role?: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface WorkContractRecord {
  status: 'not-sent' | 'sent' | 'received' | 'rejected';
  url?: string;
  sent_at?: string;
  sent_by?: string;
  received_at?: string;
  received_by?: string;
  note?: string;
}

export interface EmploymentJourney {
  home_city: string;
  coc_facility_id: string;
  destination_city: string;
  destination_country: string;
  departed_at: string;
  contract_completed_at?: string;
  employer_name?: string;
  contract_reference?: string;
  returned_at: string;
  reapplied_at?: string;
}

export interface FlightDetails {
  airline?: string;
  ticket_number?: string;
  flight_number: string; // IATA code and number, e.g. ET472
  departure_airport: string; // IATA code
  arrival_airport: string; // IATA code
  departure_time: string; // ISO
  arrival_time?: string; // ISO
  note?: string;
  updated_at?: string;
}

export interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  dob: string; // ISO date string - REQUIRED
  passport_number: string; // REQUIRED
  passport_nationality?: string;
  passport_issuing_country?: string;
  passport_expiry_date?: string;
  passport_document_type?: string;
  tracking_code: string;
  country_of_origin: string; // REQUIRED
  batch_name?: string; // New optional field for grouping
  marital_status: 'Single' | 'Married' | 'Divorced' | 'Widowed'; // New field
  gender?: 'male' | 'female';
  phone_number?: string; // NEW FIELD
  email: string; // NEW FIELD: Candidate login email
  external_status?: ExternalDocumentStatus;
  arrival?: { arrived_at: string; confirmed_by: 'candidate' | 'foreign-agency' | 'admin'; note?: string | null };
  emergency_contact?: EmergencyContact; // Family member or friend to call about the candidate
  employer?: EmployerContact; // Who the candidate works for abroad, shown once a contract is received
  home_city?: string; // Ethiopian city the candidate comes from (used for the map)
  home_region?: string; // Ethiopian regional state/city administration used by map filters
  coc_facility_id?: string; // NEW FIELD: Link to COC Training Facility by ID
  foreign_agency_id?: string; // NEW FIELD: Link to Foreign Employment Agency by ID
  profile_shares?: ProfileShare[];
  local_agency_id?: string; // NEW FIELD: Link to the Local Agency that manages this candidate by ID
  assigned_staff_id?: string; // NEW FIELD: Direct assignment to a staff user
  professional_summary?: string;
  occupation?: string;
  skills?: string[];
  languages?: string[];
  intro_video_url?: string;
  work_contract_record?: WorkContractRecord;
  profile_image_url?: string; // NEW FIELD: URL for candidate's profile image
  passport_image_url?: string; // Image (URL or data URL) of the passport bio page
  profile_image_scan_report?: UploadScanReport;
  passport_image_scan_report?: UploadScanReport;
  created_at: string;
  updated_at: string;
  last_synced_at?: string;
  payment_status: CandidatePaymentStatus; // NEW FIELD: Overall payment status for the candidate
  last_payment_id?: string; // NEW FIELD: Link to the last payment transaction
  expected_return_date?: string;
  actual_return_date?: string;
  return_status?: CandidateReturnStatus;
  return_support_notes?: string;
  employment_history?: EmploymentJourney[];
  flight?: FlightDetails;
  elmis?: ElmisRecord;
  visa?: VisaRecord;
  clearance?: ClearanceRecord;
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
    document_tags?: Array<{ id: string; file_name: string; stage_id?: number }>;
}

// NEW: Approval Log Type
export interface ApprovalLog {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_email: string;
  target_type: 'StaffUser' | 'AuthorizationCode' | 'Config' | 'Candidate' | 'AttendanceRecord' | 'Payment' | 'IntegrityOverride'; // Added 'Candidate' and 'AttendanceRecord'
  target_id: string; // ID of the user/code/config item affected
  action: 'Created' | 'Approved' | 'Rejected' | 'Updated' | 'Deleted';
  description: string;
}

export const STAFF_ROLES: Array<Exclude<UserRole, 'candidate'>> = ['superadmin', 'staff', 'foreign-agency', 'foreign-agency-staff', 'local-agency', 'viewer', 'auditor'];

// A superadmin's signed exception to a flagged integrity finding. Findings keep a stable id, so an override survives recalculation.
export interface IntegrityOverride {
  id: string; // equals the finding id
  finding_id: string;
  rule: string;
  severity: string;
  title: string;
  reason: string;
  overridden_by_id: string;
  overridden_by_email: string;
  overridden_at: string;
  revoked_at?: string;
  revoked_by_email?: string;
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
  id: string;
  code: string;
  is_used: boolean;
  created_at: string;
  used_at?: string;
  created_by_admin_id?: string;
  local_agency_id?: string;
  foreign_agency_id?: string;
  expires_at?: string;
  is_active?: boolean;
  usage_count?: number;
  max_uses?: number;
}

export interface ChechePayReceipt {
  transaction_reference: string;
  processor_reference?: string;
  amount: number;
  currency: string;
  status: 'SUCCEEDED';
  verified_at: string;
}

// NEW: Payment Interface
export interface Payment {
  id: string;
  initiated_by?: { id: string; email?: string };
  recorded_by?: { id: string; email?: string };
  initiated_at?: string;
  origin?: 'candidate-checkout' | 'agency-checkout' | 'stage-payment';
  stage_id?: number;
  provider?: 'mock' | 'chechepay' | 'manual';
  provider_reference?: string;
  receipt_number?: string;
  chechepay_receipt?: ChechePayReceipt;
  demo_evidence?: {
    synthetic: true;
    bank_name: string;
    confirmation: { reference: string; amount: number; currency: string; status: Payment['status']; confirmed_at: string };
    identities: Array<{ candidate_id: string; name: string; tracking_code: string; passport_number: string }>;
    disclaimer: string;
  };
  payment_method?: string;
  payer_display_name?: string;
  stripe_payment_intent_id?: string; // Actual Stripe ID if integrated
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  payer_type?: 'foreign-agency' | 'candidate'; // Foreign agency payments must be in the contract country's currency
  contract_country?: string; // Country where the work contract originates
  payer_candidate_id?: string; // Set when the candidate pays the local agency directly
  payer_foreign_agency_id: string; // ID of the foreign agency making the payment (empty for candidate payments)
  payee_local_agency_id: string; // ID of the local agency receiving the payment
  candidate_ids: string[]; // IDs of candidates covered by this payment
  created_at: string;
  updated_at: string;
}

// Combined data structure for Admin view
export interface CandidateDetail extends Candidate {
  stages: CandidateStage[];
  documents: Document[];
  medical_results: MedicalResult[];
  chat_messages: ChatMessage[]; // NEW: Include chat messages
  coc_facility_name?: string; // For display purposes
  foreign_agency_name?: string; // For display purposes
  local_agency_name?: string; // For display purposes
}

export interface CandidateSummary extends Candidate {
  progress_percent: number;
  // Add a calculated status for filtering purposes
  overall_status: 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
  // NEW Payment Status fields
  is_medical_paid: boolean;
  paid_stage_ids: number[]; // Stages whose fee has been paid
  coc_facility_name?: string; // For display purposes
  foreign_agency_name?: string; // For display purposes
  local_agency_name?: string; // For display purposes
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
  // Optional display names included in public tracking payload
  coc_facility_name?: string;
  foreign_agency_name?: string;
  local_agency_name?: string;
  journey?: {
    home_city?: string;
    home_region?: string;
    home?: { lat: number; lon: number; label: string };
    facility?: { lat: number; lon: number; label: string };
    center?: { name: string; city?: string; address?: string; phone_number?: string; contact_email?: string; gps_url?: string; lat?: number; lon?: number };
    training_status?: StageStatus;
    destination?: { lat: number; lon: number; label: string };
    deployment_status?: StageStatus;
    arrived_at?: string;
  };
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
    is_fee_paid: boolean; // NEW: Placeholder status for fee payment
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

export type CandidateStatusBucket = 'Pending' | 'In Progress' | 'Completed' | 'Blocked';
type NamedCount = { name: string; value: number };

// Aggregated figures for the executive dashboard
export interface ExecutiveMetrics {
    generatedAt: string;
    totals: {
        candidates: number; active: number; deployed: number; blocked: number;
        newLast30: number; newPrev30: number; deploymentRate: number;
        avgDaysActive: number; avgDaysToDeploy: number; unreadMessages: number;
    };
    status: Array<{ name: CandidateStatusBucket; value: number }>;
    funnel: Array<{ stageTitle: string; ordinal: number; reached: number; completed: number; blocked: number; avgDays: number; conversion: number }>;
    trend: Array<{ month: string; registered: number; deployed: number; revenue: number }>;
    finance: {
        currency: string; collected: number; feesDue: number; feesPaid: number; outstanding: number;
        collectionRate: number; transactions: number; avgTransaction: number;
    };
    medical: { passed: number; failed: number; pending: number; total: number; passRate: number };
    documents: { contractCount: number; visaCount: number; contractRate: number; visaRate: number; totalFiles: number };
    byOrigin: NamedCount[];
    byForeignAgency: NamedCount[];
    byCocFacility: NamedCount[];
    byLocalAgency: NamedCount[];
    needsAttention: Array<{ id: string; name: string; trackingCode: string; stageTitle: string; daysInStage: number; reason: string }>;
    needsAttentionTotal: number;
    activity: Array<{ id: string; timestamp: string; actor: string; description: string; action: string }>;
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

export type CandidateSortField = 'first_name' | 'tracking_code' | 'progress_percent' | 'overall_status' | 'country_of_origin' | 'marital_status' | 'foreign_agency_name' | 'local_agency_name' | 'coc_facility_name'; // Added foreign_agency_name, local_agency_name, coc_facility_name
export type SortDirection = 'asc' | 'desc';

// NEW: Time Filter Type
export type TimeFilter = 'All' | 'Month' | 'Bi-Yearly' | 'Yearly';

export const ALL_STAGES: Stage[] = [
  { id: 1, slug: 'registration', title: 'Registration', ordinal: 1, icon: '📝' },
  { id: 3, slug: 'training', title: 'Training', ordinal: 2, icon: '📚' },
  { id: 2, slug: 'medical', title: 'Medical Check', ordinal: 3, icon: '🩺' },
  { id: 4, slug: 'deployment', title: 'Deployment', ordinal: 4, icon: '✈️' },
];

export const TOTAL_STAGES = ALL_STAGES.length;

// Added `profileImageFile` to the FieldErrors type
export interface FieldErrors<T> {
  // ...existing properties...
  profileImageFile?: string;
}
export type VisaStatus = 'validated' | 'not_found' | 'expired' | 'cancelled' | 'mismatch' | 'pending' | 'error';
export interface VisaRecord {
  visa_number: string;
  status: VisaStatus;
  expiry_date?: string;
  occupation?: string;
  sponsor_name?: string;
  mismatches?: string[];
  message?: string;
  mode: 'live' | 'sandbox';
  source?: 'lookup' | 'callback' | 'simulation';
  checked_at: string;
}

export type ClearanceStepKey = 'enjaz' | 'tasheer';
export type ClearanceStepStatus = 'pending' | 'completed' | 'rejected';
export interface ClearanceStep {
  status: ClearanceStepStatus;
  reference?: string;
  mode?: 'live' | 'sandbox' | 'manual';
  message?: string;
  updated_at: string;
  updated_by?: string;
}
export interface ClearanceRecord {
  enjaz?: ClearanceStep;
  tasheer?: ClearanceStep;
  local_ready_at?: string;
  local_ready_by?: string;
  labour_ministry?: {
    status: 'pending' | 'cleared' | 'rejected' | 'error';
    mode?: 'live' | 'sandbox';
    simulated?: boolean;
    certificate_no?: string;
    qr_image_url?: string;
    verification_url?: string;
    issued_at?: string;
    message?: string;
  };
  cleared_at?: string;
  cleared_by?: string;
  certificate_no?: string;
}
