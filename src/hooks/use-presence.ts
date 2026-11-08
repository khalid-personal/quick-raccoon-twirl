import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';
import { readPresence, type PresenceSession, type PresenceSnapshot } from '@/lib/presence';
import { getCandidates } from '@/lib/data-store';
import { isSupabaseDataMode } from '@/lib/supabase-sync';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const PRESENCE_TOPIC = 'dawm-presence';
const HEARTBEAT_MS = 30_000;

interface SharedPresence extends PresenceSession {
  sessionKey: string;
}

export interface PresenceView extends PresenceSnapshot {
  shared: boolean;
}

const PresenceContext = createContext<PresenceView>({ sessions: {}, lastSeen: {}, shared: false });
export const usePresence = (): PresenceView => useContext(PresenceContext);

const usePresenceSnapshot = (): PresenceView => {
  const auth = useAuth();
  const [localSnapshot, setLocalSnapshot] = useState(readPresence);
  const [sharedSessions, setSharedSessions] = useState<Record<string, PresenceSession>>({});
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const refresh = () => setLocalSnapshot(readPresence());
    const timer = window.setInterval(refresh, 15_000);
    window.addEventListener('storage', refresh);
    window.addEventListener('dawm-presence-changed', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('dawm-presence-changed', refresh);
    };
  }, []);

  useEffect(() => {
    const role = auth.actualRole;
    const userId = auth.user?.id;
    if (!isSupabaseDataMode() || auth.isDemo || !auth.isAuthenticated || !userId || !role) {
      setShared(false);
      setSharedSessions({});
      return;
    }

    const kind = role === 'candidate' ? 'candidate' : 'staff';
    const subjectId = kind === 'candidate'
      ? getCandidates().find(candidate => candidate.tracking_code === auth.candidateTrackingCode)?.id ?? userId
      : userId;
    const identity = {
      subjectId,
      kind,
      role,
      localAgencyId: auth.userLocalAgencyId ?? undefined,
      foreignAgencyId: auth.userForeignAgencyId ?? undefined,
    } satisfies Omit<SharedPresence, 'sessionKey' | 'seenAt'>;
    const channel = supabase.channel(PRESENCE_TOPIC, {
      config: { presence: { key: userId }, private: true },
    });
    let active = true;

    const refresh = () => {
      const state = channel.presenceState<SharedPresence>();
      const next: Record<string, PresenceSession> = {};
      Object.entries(state).forEach(([key, entries]) => {
        entries.forEach((entry, index) => {
          const seenAt = entry.seenAt || new Date().toISOString();
          next[`${key}:${entry.sessionKey || index}`] = { ...entry, seenAt };
        });
      });
      if (active) setSharedSessions(next);
    };

    const track = () => channel.track({ ...identity, seenAt: new Date().toISOString(), sessionKey: userId });
    channel
      .on('presence', { event: 'sync' }, refresh)
      .on('presence', { event: 'join' }, refresh)
      .on('presence', { event: 'leave' }, refresh)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') {
          setShared(true);
          void track();
          refresh();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setShared(false);
        }
      });

    const heartbeat = window.setInterval(() => { void track(); }, HEARTBEAT_MS);
    return () => {
      active = false;
      window.clearInterval(heartbeat);
      setShared(false);
      setSharedSessions({});
      void channel.untrack().finally(() => { void supabase.removeChannel(channel); });
    };
  }, [auth.actualRole, auth.isAuthenticated, auth.isDemo, auth.user?.id, auth.candidateTrackingCode, auth.userLocalAgencyId, auth.userForeignAgencyId]);

  return {
    sessions: { ...localSnapshot.sessions, ...sharedSessions },
    lastSeen: localSnapshot.lastSeen,
    shared,
  };
};

export const PresenceProvider = ({ children }: { children: ReactNode }) =>
  createElement(PresenceContext.Provider, { value: usePresenceSnapshot() }, children);
