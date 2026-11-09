import { useEffect } from 'react';
import { toast } from 'sonner';
import { isDemoMode } from '@/lib/demo-mode';
import { isSupabaseDataMode, refreshJourneyFromSupabase } from '@/lib/supabase-sync';

export const useJourneyStatusSync = (userId?: string, demo = false) => {
  useEffect(() => {
    if (!userId || demo || !isSupabaseDataMode()) return;
    let active = true, pending = false, notified = false;
    const refresh = async () => {
      if (!active || pending || document.hidden || isDemoMode()) return;
      pending = true;
      try {
        await refreshJourneyFromSupabase(() => active);
        notified = false;
      } catch (error) {
        if (active && !notified) {
          toast.error(error instanceof Error ? `Journey status refresh failed: ${error.message}` : 'Journey status refresh failed. Check your connection and sign-in.');
          notified = true;
        }
      } finally { pending = false; }
    };
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [userId, demo]);
};
