import { Candidate, CandidateStage, MedicalResult, Document, StaffUser, ChatMessage, ApprovalLog, AttendanceRecord, AuthorizationCode, CocFacility, LocalAgency, ForeignAgency, AppConfig, Payment, PaymentStatus, Notification, AgencyChatThread, AgencyChatMessage, IntegrityOverride } from './types';
import { LS_CANDIDATES, LS_CANDIDATE_STAGES, LS_MEDICAL_RESULTS, LS_DOCUMENTS, LS_CONFIG, LS_STAFF_USERS, LS_PAYMENT_STATUS, LS_CHAT_MESSAGES, LS_APPROVAL_LOGS, LS_ATTENDANCE, LS_AUTH_CODES, LS_COC_FACILITIES, LS_LOCAL_AGENCIES, LS_FOREIGN_AGENCIES, LS_PAYMENTS, LS_NOTIFICATIONS, LS_DISABLE_SEED, LS_AGENCY_THREADS, LS_AGENCY_MESSAGES, LS_CANDIDATE_DRAFTS, LS_DRAFTS, LS_INTEGRITY_OVERRIDES } from './data-keys';
import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';
import { flushSupabaseSync, isSupabaseDataMode } from './supabase-sync';
import { v5 as uuidv5 } from 'uuid';
import { prefillCandidateRegion } from './ethiopia-regions';
import { normalizeCandidateStages } from './candidate-stage-normalization';
import { activeDirectoryConfig, activeDirectoryEntries } from './retired-directories';

const dataStorage = {
  getItem: (key: string) => window['localStorage'].getItem(isDemoMode() ? `${DEMO_KEY_PREFIX}${key}` : key),
  setItem: (key: string, value: string) => window['localStorage'].setItem(isDemoMode() ? `${DEMO_KEY_PREFIX}${key}` : key, value),
};

const writeSyncedCollection = <T,>(key: string, table: string, records: T[], getId?: (record: T) => string) => {
  dataStorage.setItem(key, JSON.stringify(records));
  if (!isSupabaseDataMode() || isDemoMode()) return;
  void flushSupabaseSync(table, records, getId as ((record: unknown) => string) | undefined).then(message => {
    if (message) window.dispatchEvent(new CustomEvent('supabase-sync-error', { detail: { message: `Could not sync ${table}: ${message}` } }));
  }).catch(error => {
    window.dispatchEvent(new CustomEvent('supabase-sync-error', { detail: { message: `Could not sync ${table}: ${error instanceof Error ? error.message : 'unknown error'}` } }));
  });
};

const writeSyncedValue = <T,>(key: string, table: string, id: string, value: T) => {
  dataStorage.setItem(key, JSON.stringify(value));
  if (!isSupabaseDataMode() || isDemoMode()) return;
  void flushSupabaseSync(table, [value], () => id).then(message => {
    if (message) window.dispatchEvent(new CustomEvent('supabase-sync-error', { detail: { message: `Could not sync ${table}: ${message}` } }));
  }).catch(error => {
    window.dispatchEvent(new CustomEvent('supabase-sync-error', { detail: { message: `Could not sync ${table}: ${error instanceof Error ? error.message : 'unknown error'}` } }));
  });
};
// --- Notification Functions ---
export const getNotifications = (): Notification[] => JSON.parse(dataStorage.getItem(LS_NOTIFICATIONS) || '[]');
export const saveNotifications = (data: Notification[]) => {
  try {
    writeSyncedCollection(LS_NOTIFICATIONS, 'notifications', data);
    // Notify same-tab listeners immediately
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('notifications-changed', { detail: data }));
      } catch (e) {
        // Older browsers may not accept CustomEvent constructor usage
        try {
          const evt = document.createEvent('Event');
          evt.initEvent('notifications-changed', true, true);
          window.dispatchEvent(evt);
        } catch (err) {
          console.warn('[data-store] saveNotifications: event dispatch fallback failed', err);
        }
      }
    }
  } catch (e) {
    console.warn('[data-store] saveNotifications: failed to persist or broadcast', e);
  }
};
export const getNotificationsForUser = (userId: string): Notification[] => getNotifications().filter(n => n.recipient_id === userId);
export const addNotification = (notification: Notification) => {
  const all = getNotifications();
  all.unshift(notification);
  saveNotifications(all);
};
import { SEED_CANDIDATES, SEED_CANDIDATE_STAGES, SEED_MEDICAL_RESULTS, SEED_DOCUMENTS, SEED_CONFIG, SEED_STAFF_USERS, SEED_CHAT_MESSAGES, SEED_APPROVAL_LOGS, SEED_ATTENDANCE, SEED_AUTH_CODES, SEED_COC_FACILITIES, SEED_LOCAL_AGENCIES, SEED_FOREIGN_AGENCIES, SEED_PAYMENTS, SEED_AGENCY_THREADS, SEED_AGENCY_MESSAGES } from './data-seed';
import { LS_RECEIPT_TOKENS } from './data-keys';

// --- Getter Functions ---

export const getCandidates = (): Candidate[] => (JSON.parse(dataStorage.getItem(LS_CANDIDATES) || '[]') as Candidate[]).map(prefillCandidateRegion);
const readCandidateStages = (): CandidateStage[] => JSON.parse(dataStorage.getItem(LS_CANDIDATE_STAGES) || '[]');
export const getCandidateStages = (): CandidateStage[] => readCandidateStages();
const filterMalePregnancyResults = (results: MedicalResult[]): MedicalResult[] => {
  const maleCandidateIds = new Set(getCandidates().filter(candidate => candidate.gender === 'male').map(candidate => candidate.id));
  return results.filter(result => !(maleCandidateIds.has(result.candidate_id) && result.exam_type === 'Pregnancy'));
};
export const getMedicalResults = (): MedicalResult[] => {
  const results = JSON.parse(dataStorage.getItem(LS_MEDICAL_RESULTS) || '[]') as MedicalResult[];
  const filtered = filterMalePregnancyResults(results);
  return filtered;
};
export const getDocuments = (): Document[] => JSON.parse(dataStorage.getItem(LS_DOCUMENTS) || '[]');
export const getConfig = (): AppConfig => activeDirectoryConfig(JSON.parse(dataStorage.getItem(LS_CONFIG) || JSON.stringify(SEED_CONFIG)));
export const getStaffUsers = (): StaffUser[] => JSON.parse(dataStorage.getItem(LS_STAFF_USERS) || '[]');
export const getPaymentStatuses = (): PaymentStatus[] => JSON.parse(dataStorage.getItem(LS_PAYMENT_STATUS) || '[]');
export const getChatMessages = (): ChatMessage[] => JSON.parse(dataStorage.getItem(LS_CHAT_MESSAGES) || '[]');
export const getAgencyThreads = (): AgencyChatThread[] => JSON.parse(dataStorage.getItem(LS_AGENCY_THREADS) || '[]');
export const getAgencyMessages = (): AgencyChatMessage[] => JSON.parse(dataStorage.getItem(LS_AGENCY_MESSAGES) || '[]');
export const getApprovalLogs = (): ApprovalLog[] => JSON.parse(dataStorage.getItem(LS_APPROVAL_LOGS) || '[]');
export const getAttendanceRecords = (): AttendanceRecord[] => JSON.parse(dataStorage.getItem(LS_ATTENDANCE) || '[]');
export const getAuthorizationCodes = (): AuthorizationCode[] => JSON.parse(dataStorage.getItem(LS_AUTH_CODES) || '[]');
export const getCocFacilities = (): CocFacility[] => activeDirectoryEntries(JSON.parse(dataStorage.getItem(LS_COC_FACILITIES) || '[]'));
export const getLocalAgencies = (): LocalAgency[] => activeDirectoryEntries(JSON.parse(dataStorage.getItem(LS_LOCAL_AGENCIES) || '[]'));
export const getForeignAgencies = (): ForeignAgency[] => activeDirectoryEntries(JSON.parse(dataStorage.getItem(LS_FOREIGN_AGENCIES) || '[]'));
export const getPayments = (): Payment[] => JSON.parse(dataStorage.getItem(LS_PAYMENTS) || '[]'); // NEW
export const getIntegrityOverrides = (): IntegrityOverride[] => JSON.parse(dataStorage.getItem(LS_INTEGRITY_OVERRIDES) || '[]');
export const saveIntegrityOverrides = (data: IntegrityOverride[]) => writeSyncedCollection(LS_INTEGRITY_OVERRIDES, 'integrity_overrides', data);

// --- Draft helpers (for preview/autosave)
export const getCandidateDrafts = (): Candidate[] => JSON.parse(dataStorage.getItem(LS_CANDIDATE_DRAFTS) || '[]');
export const saveCandidateDrafts = (data: Candidate[]) => writeSyncedCollection(LS_CANDIDATE_DRAFTS, 'candidate_drafts', data);
export const saveCandidateDraft = (candidate: Candidate) => {
  try {
    const drafts = getCandidateDrafts();
    const idx = drafts.findIndex(d => d.id === candidate.id);
    if (idx >= 0) drafts[idx] = candidate;
    else drafts.unshift(candidate);
    saveCandidateDrafts(drafts);
    // notify same-tab listeners
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('candidate-draft-changed', { detail: candidate }));
      } catch (e) {
        try {
          const evt = document.createEvent('Event');
          evt.initEvent('candidate-draft-changed', true, true);
          window.dispatchEvent(evt);
        } catch (err) {
          console.warn('[data-store] saveCandidateDraft: event dispatch fallback failed', err);
        }
      }
    }
  } catch (e) {
    console.warn('[data-store] saveCandidateDraft failed', e);
  }
};

// Generic draft helpers (keyed store)
export const getDrafts = (): Record<string, unknown> => JSON.parse(dataStorage.getItem(LS_DRAFTS) || '{}');
export const getDraft = (key: string) => getDrafts()[key];
export const saveDraft = (key: string, value: unknown) => {
  try {
    const all = getDrafts();
    all[key] = value;
    dataStorage.setItem(LS_DRAFTS, JSON.stringify(all));
    // dispatch generic draft event
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('draft-changed', { detail: { key, value } }));
      } catch (e) {
        try {
          const evt = document.createEvent('Event');
          evt.initEvent('draft-changed', true, true);
          window.dispatchEvent(evt);
        } catch (err) {
          console.warn('[data-store] saveDraft: event dispatch fallback failed', err);
        }
      }
    }
  } catch (e) {
    console.warn('[data-store] saveDraft failed', e);
  }
};

export const removeDraft = (key: string) => {
  try {
    const all = getDrafts();
    if (all[key]) {
      delete all[key];
      dataStorage.setItem(LS_DRAFTS, JSON.stringify(all));
    }
  } catch (e) {
    console.warn('[data-store] removeDraft failed', e);
  }
};


// Receipt tokens for public access
interface ReceiptToken {
  token: string;
  paymentId: string;
  expires_at: string; // ISO
}

export const getReceiptTokens = (): ReceiptToken[] => JSON.parse(dataStorage.getItem(LS_RECEIPT_TOKENS) || '[]');

// --- Seed toggle helpers ---
export const isSeedDisabled = (): boolean => {
  try {
    // If a localStorage override exists, prefer it (so the UI toggle takes priority)
    const localOverride = dataStorage.getItem(LS_DISABLE_SEED);
    if (localOverride !== null) {
      return localOverride === 'true';
    }
    // Otherwise fall back to Vite env flag
    return import.meta.env.VITE_DISABLE_SEED === 'true';
  } catch (e) {
    // If anything goes wrong, default to false (do not disable seed)
    console.warn('[data-store] isSeedDisabled: error reading seed toggle, defaulting to false', e);
    return false;
  }
};

export const setSeedDisabled = (disabled: boolean) => {
  try {
    dataStorage.setItem(LS_DISABLE_SEED, disabled ? 'true' : 'false');
  } catch (e) {
    console.warn('[data-store] setSeedDisabled: Could not persist seed toggle', e);
  }
};

// --- Setter Functions ---

export const saveCandidates = (data: Candidate[]) => writeSyncedCollection(LS_CANDIDATES, 'candidates', data.map(prefillCandidateRegion));
export const saveCandidateStages = (data: CandidateStage[], options: { recordHistory?: boolean } = {}) => {
  if (options.recordHistory === false && !isDemoMode()) throw new Error('Only an explicit practice scenario replacement may reset stage history.');
  const previous = new Map(readCandidateStages().map(stage => [stage.id, stage]));
  const snapshot = (stage: CandidateStage) => ({ status: stage.status, date: stage.date, updated_at: stage.updated_at, location: stage.location });
  const records = (isDemoMode() ? normalizeCandidateStages(data, getCandidates()) : data).map(stage => {
    const before = previous.get(stage.id);
    if (options.recordHistory === false || !before || before.status === stage.status && before.date === stage.date && JSON.stringify(before.location) === JSON.stringify(stage.location)) return stage;
    return { ...stage, history: [...(before.history?.length ? before.history : [snapshot(before)]), snapshot(stage)] };
  });
  writeSyncedCollection(LS_CANDIDATE_STAGES, 'candidate_stages', records);
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
};
export const saveMedicalResults = (data: MedicalResult[]) => writeSyncedCollection(LS_MEDICAL_RESULTS, 'medical_results', filterMalePregnancyResults(data));
export const saveDocuments = (data: Document[]) => writeSyncedCollection(LS_DOCUMENTS, 'documents', data);
export const saveConfig = (data: AppConfig) => writeSyncedValue(LS_CONFIG, 'app_config', 'global', activeDirectoryConfig(data));
export const saveStaffUsers = (data: StaffUser[]) => writeSyncedCollection(LS_STAFF_USERS, 'staff_users', data);
export const savePaymentStatuses = (data: PaymentStatus[]) => writeSyncedCollection(LS_PAYMENT_STATUS, 'payment_statuses', data, status => uuidv5(`${status.candidateId}:${status.stageId}`, uuidv5.URL));
export const savePaymentStatusesLocal = (data: PaymentStatus[]) => dataStorage.setItem(LS_PAYMENT_STATUS, JSON.stringify(data));
export const saveChatMessages = (data: ChatMessage[]) => writeSyncedCollection(LS_CHAT_MESSAGES, 'chat_messages', data);
export const saveAgencyThreads = (data: AgencyChatThread[]) => writeSyncedCollection(LS_AGENCY_THREADS, 'agency_threads', data);
export const saveAgencyMessages = (data: AgencyChatMessage[]) => writeSyncedCollection(LS_AGENCY_MESSAGES, 'agency_messages', data);
export const saveApprovalLogs = (data: ApprovalLog[]) => writeSyncedCollection(LS_APPROVAL_LOGS, 'approval_logs', data);
export const saveAttendanceRecords = (data: AttendanceRecord[]) => writeSyncedCollection(LS_ATTENDANCE, 'attendance_records', data);
export const saveAuthorizationCodes = (data: AuthorizationCode[]) => writeSyncedCollection(LS_AUTH_CODES, 'authorization_codes', data);
export const saveCocFacilities = (data: CocFacility[]) => writeSyncedCollection(LS_COC_FACILITIES, 'coc_facilities', activeDirectoryEntries(data));
export const saveLocalAgencies = (data: LocalAgency[]) => writeSyncedCollection(LS_LOCAL_AGENCIES, 'local_agencies', activeDirectoryEntries(data));
export const saveForeignAgencies = (data: ForeignAgency[]) => writeSyncedCollection(LS_FOREIGN_AGENCIES, 'foreign_agencies', activeDirectoryEntries(data));
export const savePayments = (data: Payment[]) => writeSyncedCollection(LS_PAYMENTS, 'payments', data);
export const savePaymentsLocal = (data: Payment[]) => dataStorage.setItem(LS_PAYMENTS, JSON.stringify(data));
export const saveReceiptTokens = (data: ReceiptToken[]) => writeSyncedCollection(LS_RECEIPT_TOKENS, 'receipt_tokens', data, token => token.token);

// --- Initialization ---

export function initializeDataStore() {
  // Retire only named placeholders; historical candidate, staff and payment references stay intact.
  for (const key of [LS_COC_FACILITIES, LS_LOCAL_AGENCIES, LS_FOREIGN_AGENCIES, LS_CONFIG]) {
    const raw = dataStorage.getItem(key);
    if (!raw) continue;
    const records = JSON.parse(raw);
    const active = key === LS_CONFIG ? activeDirectoryConfig(records) : activeDirectoryEntries(records);
    if (JSON.stringify(records) !== JSON.stringify(active)) {
      const log: ApprovalLog = {
        id: crypto.randomUUID(), timestamp: new Date().toISOString(), actor_id: 'directory-retirement',
        actor_email: 'System directory cleanup', target_type: 'Config', target_id: key, action: 'Updated',
        description: `Removed retired placeholder directory entries. Candidate IDs, assignments and payment evidence were preserved. Previous directory snapshot: ${raw}`,
      };
      dataStorage.setItem(LS_APPROVAL_LOGS, JSON.stringify([...getApprovalLogs(), log]));
      dataStorage.setItem(key, JSON.stringify(active));
    }
  }
  // If the developer has set VITE_DISABLE_SEED=true, skip re-seeding localStorage.
  // This preserves any local changes made via the UI between reloads.
  // Default behavior (no flag) remains the same and will seed on first load.
  // Respect the in-app/localStorage toggle if present, otherwise fall back to env var
  if (isSeedDisabled()) {
    console.log('[data-store] Seeding disabled via seed toggle (localStorage or VITE_DISABLE_SEED); skipping initializeDataStore().');
    return;
  }

  const seedIfMissing = (key: string, value: unknown) => {
    if (dataStorage.getItem(key) === null) {
      dataStorage.setItem(key, JSON.stringify(value));
    }
  };

  seedIfMissing(LS_CANDIDATES, SEED_CANDIDATES);
  seedIfMissing(LS_CANDIDATE_STAGES, SEED_CANDIDATE_STAGES);
  seedIfMissing(LS_MEDICAL_RESULTS, SEED_MEDICAL_RESULTS);
  seedIfMissing(LS_DOCUMENTS, SEED_DOCUMENTS);
  seedIfMissing(LS_CHAT_MESSAGES, SEED_CHAT_MESSAGES);
  seedIfMissing(LS_APPROVAL_LOGS, SEED_APPROVAL_LOGS);
  seedIfMissing(LS_ATTENDANCE, SEED_ATTENDANCE);
  seedIfMissing(LS_AUTH_CODES, SEED_AUTH_CODES);
  seedIfMissing(LS_STAFF_USERS, SEED_STAFF_USERS);
  seedIfMissing(LS_CONFIG, SEED_CONFIG);
  seedIfMissing(LS_COC_FACILITIES, SEED_COC_FACILITIES);
  seedIfMissing(LS_LOCAL_AGENCIES, SEED_LOCAL_AGENCIES);
  seedIfMissing(LS_FOREIGN_AGENCIES, SEED_FOREIGN_AGENCIES);
  seedIfMissing(LS_AGENCY_THREADS, SEED_AGENCY_THREADS);
  seedIfMissing(LS_AGENCY_MESSAGES, SEED_AGENCY_MESSAGES);
  seedIfMissing(LS_PAYMENTS, SEED_PAYMENTS);
  seedIfMissing(LS_RECEIPT_TOKENS, []);

  // Initialize config with new fields
  const currentConfig = getConfig(); // This will now return SEED_CONFIG if cleared
  if (currentConfig.agencyPartnerships === undefined) {
    currentConfig.agencyPartnerships = [];
  }
  const stageFees = currentConfig.stageFeesInitialized
    ? currentConfig.stageFees ?? {}
    : { ...SEED_CONFIG.stageFees, ...(currentConfig.stageFees ?? {}) };
  saveConfig({ 
      ...currentConfig, 
      countryOptions: currentConfig.countryOptions || SEED_CONFIG.countryOptions,
      cocFacilities: currentConfig.cocFacilities || SEED_CONFIG.cocFacilities, // NEW
      foreignAgencies: currentConfig.foreignAgencies || SEED_CONFIG.foreignAgencies,
      localAgencies: currentConfig.localAgencies || SEED_CONFIG.localAgencies, // NEW
      stageFees,
      stageFeesInitialized: true,
  });
}

// Run initialization immediately
initializeDataStore();
