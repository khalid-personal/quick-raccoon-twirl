import { supabase } from './supabase';
import { LS_AGENCY_MESSAGES, LS_AGENCY_THREADS, LS_APPROVAL_LOGS, LS_ATTENDANCE, LS_AUTH_CODES, LS_CANDIDATE_DRAFTS, LS_CANDIDATE_STAGES, LS_COC_FACILITIES, LS_CANDIDATES, LS_DOCUMENTS, LS_FOREIGN_AGENCIES, LS_INTEGRITY_OVERRIDES, LS_LOCAL_AGENCIES, LS_MEDICAL_RESULTS, LS_NOTIFICATIONS, LS_PAYMENT_STATUS, LS_PAYMENTS, LS_RECEIPT_TOKENS, LS_STAFF_USERS, LS_CHAT_MESSAGES, LS_CONFIG } from './data-keys';
import { isDemoMode } from './demo-mode';

export const isSupabaseDataMode = (): boolean => import.meta.env.VITE_USE_LOCAL_MOCK !== 'true'
  && !!import.meta.env.VITE_SUPABASE_URL
  && !!import.meta.env.VITE_SUPABASE_ANON_KEY
  && import.meta.env.VITE_SUPABASE_ANON_KEY !== 'mock-anon-key';
export const clearSupabaseCache = (): void => {
  // Data is stored in the shared local cache; clearing auth query state is handled by the app query client.
};

const DATA_TABLES = [
  { table: 'candidates', key: LS_CANDIDATES },
  { table: 'candidate_stages', key: LS_CANDIDATE_STAGES },
  { table: 'medical_results', key: LS_MEDICAL_RESULTS },
  { table: 'documents', key: LS_DOCUMENTS },
  { table: 'staff_users', key: LS_STAFF_USERS },
  { table: 'chat_messages', key: LS_CHAT_MESSAGES },
  { table: 'payments', key: LS_PAYMENTS },
  { table: 'payment_statuses', key: LS_PAYMENT_STATUS },
  { table: 'local_agencies', key: LS_LOCAL_AGENCIES },
  { table: 'foreign_agencies', key: LS_FOREIGN_AGENCIES },
  { table: 'coc_facilities', key: LS_COC_FACILITIES },
  { table: 'agency_threads', key: LS_AGENCY_THREADS },
  { table: 'agency_messages', key: LS_AGENCY_MESSAGES },
  { table: 'notifications', key: LS_NOTIFICATIONS },
  { table: 'authorization_codes', key: LS_AUTH_CODES },
  { table: 'approval_logs', key: LS_APPROVAL_LOGS },
  { table: 'integrity_overrides', key: LS_INTEGRITY_OVERRIDES },
  { table: 'candidate_drafts', key: LS_CANDIDATE_DRAFTS },
  { table: 'receipt_tokens', key: LS_RECEIPT_TOKENS, getId: (record: unknown) => (record as { token: string }).token },
] as const;

const DIRECT_TABLES = [
  { table: 'attendance_records', key: LS_ATTENDANCE, columns: 'id,staff_id,staff_email,check_in_time,check_out_time' },
] as const;

const PAGE_SIZE = 1000;

const fetchAllRows = async <T,>(table: string, columns: string): Promise<T[]> => {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select(columns).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data as T[] ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
};

export const hydrateFromSupabase = async (): Promise<void> => {
  const [dataRows, directRows, configResult] = await Promise.all([
    Promise.all(DATA_TABLES.map(({ table }) => fetchAllRows<{ id: string; data: unknown }>(table, 'id,data'))),
    Promise.all(DIRECT_TABLES.map(({ table, columns }) => fetchAllRows<Record<string, unknown>>(table, columns))),
    supabase.from('app_config').select('id,data').eq('id', 'global').maybeSingle(),
  ]);
  if (configResult.error) throw configResult.error;

  DATA_TABLES.forEach(({ key }, index) => {
    const rows = dataRows[index];
    const records = rows.map(row => ({ ...(row.data as Record<string, unknown>), id: (row.data as { id?: string } | null)?.id ?? row.id }));
    localStorage.setItem(key, JSON.stringify(records));
  });
  DIRECT_TABLES.forEach(({ key }, index) => {
    localStorage.setItem(key, JSON.stringify(directRows[index]));
  });
  if (configResult.data?.data) localStorage.setItem(LS_CONFIG, JSON.stringify(configResult.data.data));
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
};

export const flushSupabaseSync = async (table: string, records: unknown[], getId?: (record: unknown) => string): Promise<string | null> => {
  if (!isSupabaseDataMode() || isDemoMode()) return null;
  const payload = table === 'attendance_records'
    ? records
    : records.map(record => {
      const item = record as { id?: string };
      return { id: getId?.(record) ?? item.id, data: record };
    });
  if (payload.length > 0) {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) return error.message;
  }

  const keepIds = new Set(payload.map(item => (item as { id?: string }).id).filter((id): id is string => !!id));
  const existingRows = await fetchAllRows<{ id: string }>(table, 'id');
  const staleIds = existingRows.map(row => row.id).filter(id => !keepIds.has(id));
  for (let offset = 0; offset < staleIds.length; offset += 100) {
    const { error } = await supabase.from(table).delete().in('id', staleIds.slice(offset, offset + 100));
    if (error) return error.message;
  }
  return null;
};
