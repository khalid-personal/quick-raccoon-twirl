import { v4 as uuidv4 } from 'uuid';
import type { UserRole } from './types';
import { getAttendanceRecords, getCandidates, saveAttendanceRecords } from './data-store';
import { DEMO_KEY_PREFIX, isDemoMode } from './demo-mode';

export type PresenceKind = 'staff' | 'candidate';
export interface PresenceSession { subjectId: string; kind: PresenceKind; seenAt: string; role?: UserRole; localAgencyId?: string; foreignAgencyId?: string }
export interface PresenceSnapshot { sessions: Record<string, PresenceSession>; lastSeen: Record<string, string> }
const PRESENCE_KEY = 'dawm_presence';
const ONLINE_WINDOW_MS = 2 * 60_000;
const presenceKey = () => `${isDemoMode() ? DEMO_KEY_PREFIX : ''}${PRESENCE_KEY}`;

export const readPresence = (): PresenceSnapshot => {
  try {
    const stored = JSON.parse(localStorage.getItem(presenceKey()) ?? '{}') as Partial<PresenceSnapshot>;
    return { sessions: stored.sessions ?? {}, lastSeen: stored.lastSeen ?? {} };
  } catch {
    return { sessions: {}, lastSeen: {} };
  }
};

export const presenceFor = (snapshot: PresenceSnapshot, kind: PresenceKind, subjectId: string, fallbackLastSeen?: string, now = Date.now()) => {
  const key = `${kind}:${subjectId}`;
  const active = Object.values(snapshot.sessions).filter(session => session.kind === kind && session.subjectId === subjectId);
  const timestamps = [snapshot.lastSeen[key], fallbackLastSeen, ...active.map(session => session.seenAt)]
    .filter((value): value is string => !!value && Number.isFinite(Date.parse(value)));
  const lastSeen = timestamps.sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const online = active.some(session => {
    const age = now - Date.parse(session.seenAt);
    return age >= 0 && age < ONLINE_WINDOW_MS;
  });
  return { online, lastSeen };
};

const savePresence = (snapshot: PresenceSnapshot) => {
  localStorage.setItem(presenceKey(), JSON.stringify(snapshot));
  window.dispatchEvent(new Event('dawm-presence-changed'));
};

export const startPresence = (staffId: string, email: string, role?: UserRole | null, trackingCode?: string | null): (() => void) => {
  const sessionId = uuidv4();
  const kind: PresenceKind = role === 'candidate' ? 'candidate' : 'staff';
  const subjectId = kind === 'candidate' ? getCandidates().find(candidate => candidate.tracking_code === trackingCode)?.id ?? staffId : staffId;
  const key = `${kind}:${subjectId}`;
  const update = (active: boolean) => {
    try {
      const snapshot = readPresence();
      const seenAt = new Date().toISOString();
      Object.entries(snapshot.sessions).forEach(([id, session]) => {
        if (Date.now() - Date.parse(session.seenAt) > 24 * 60 * 60_000) delete snapshot.sessions[id];
      });
      if (active) snapshot.sessions[sessionId] = { subjectId, kind, seenAt };
      else delete snapshot.sessions[sessionId];
      snapshot.lastSeen[key] = seenAt;
      savePresence(snapshot);
    } catch (error) {
      console.warn('[presence] Could not update local presence.', error);
    }
  };
  if (kind === 'staff') saveAttendanceRecords([...getAttendanceRecords(), { id: sessionId, staff_id: staffId, staff_email: email, check_in_time: new Date().toISOString() }]);
  update(true);
  const heartbeat = window.setInterval(() => update(true), 30_000);
  return () => {
    window.clearInterval(heartbeat);
    update(false);
    if (kind !== 'staff') return;
    const records = getAttendanceRecords();
    const index = records.findIndex(record => record.id === sessionId);
    if (index >= 0) {
      records[index] = { ...records[index], check_out_time: new Date().toISOString() };
      saveAttendanceRecords(records);
    }
  };
};

export const endAttendanceSession = async (staffId: string, email: string, _role?: UserRole | null): Promise<void> => {
  const now = new Date().toISOString();
  const records = getAttendanceRecords();
  let changed = false;
  records.forEach((record, index) => {
    if (record.staff_id === staffId && record.staff_email === email && !record.check_out_time) {
      records[index] = { ...record, check_out_time: now };
      changed = true;
    }
  });
  if (changed) saveAttendanceRecords(records);
};
