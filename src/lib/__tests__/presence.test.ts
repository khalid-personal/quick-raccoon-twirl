import { describe, expect, it, vi } from 'vitest';

vi.mock('../data-store', () => ({ getAttendanceRecords: vi.fn(), getCandidates: vi.fn(), saveAttendanceRecords: vi.fn() }));
vi.mock('../demo-mode', () => ({ DEMO_KEY_PREFIX: 'dawm_demo_', isDemoMode: () => false }));

import { presenceFor, type PresenceSnapshot } from '../presence';

const now = Date.parse('2026-11-06T12:00:00Z');

describe('local presence', () => {
  it('shows a fresh session as online and reports its latest activity', () => {
    const snapshot: PresenceSnapshot = { sessions: { first: { subjectId: 'staff-1', kind: 'staff', seenAt: '2026-11-06T11:59:30Z' } }, lastSeen: {} };
    expect(presenceFor(snapshot, 'staff', 'staff-1', undefined, now)).toEqual({ online: true, lastSeen: '2026-11-06T11:59:30Z' });
  });

  it('does not call stale or future sessions online', () => {
    const snapshot: PresenceSnapshot = { sessions: { stale: { subjectId: 'candidate-1', kind: 'candidate', seenAt: '2026-11-06T11:55:00Z' }, future: { subjectId: 'candidate-1', kind: 'candidate', seenAt: '2026-11-06T12:01:00Z' } }, lastSeen: {} };
    expect(presenceFor(snapshot, 'candidate', 'candidate-1', undefined, now).online).toBe(false);
  });

  it('keeps staff and candidate identities separate and retains last-seen data', () => {
    const snapshot: PresenceSnapshot = { sessions: { first: { subjectId: 'same-id', kind: 'staff', seenAt: '2026-11-06T11:59:30Z' } }, lastSeen: { 'candidate:same-id': '2026-11-05T12:00:00Z' } };
    expect(presenceFor(snapshot, 'candidate', 'same-id', '2026-11-04T12:00:00Z', now)).toEqual({ online: false, lastSeen: '2026-11-05T12:00:00Z' });
  });
});
