import { useEffect, useState } from 'react';
import { FlaskConical, ChevronDown, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { Button } from './ui/button';
import IntegrityDemoScenarios from './IntegrityDemoScenarios';
import { usePopupScrollLock } from '@/hooks/use-popup-scroll-lock';
import { PopupResizeControl, popupCloseClassName, popupWindowStyle } from './ui/popup-window';

export default function DemoScenarioBar() {
  const { isDemo, isAuthenticated, actualRole } = useAuth();
  const [open, setOpen] = useState(false);
  const allowed = isDemo && isDemoMode() && isAuthenticated && actualRole === 'superadmin';
  usePopupScrollLock(allowed && open);
  useEffect(() => {
    if (!allowed || !open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [allowed, open]);
  if (!allowed) return null;
  return <section aria-label="Demo scenario menu" className="sticky top-0 z-[65] border-b border-amber-400/25 bg-slate-950 px-4 py-2 text-white shadow-sm">
    <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-medium"><FlaskConical className="h-4 w-4 text-amber-300" />Demo mode · practice records only</span>
      <Button variant="ghost" size="sm" aria-expanded={open} className="h-8 text-white hover:bg-white/10 hover:text-white" onClick={() => setOpen(value => !value)}>Switch scenario<ChevronDown className="ml-2 h-4 w-4" /></Button></div>
    {open && <div data-popup-window="" role="dialog" aria-modal="false" aria-label="Switch demo scenario" style={{ ...popupWindowStyle, maxHeight: '75dvh' }} className="absolute left-1/2 top-full mt-2 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border bg-card p-5 pb-9 text-card-foreground shadow-2xl">
      <div className="flex justify-between"><h2 className="font-semibold">Choose a practice scenario</h2><Button variant="ghost" size="icon" className={popupCloseClassName} aria-label="Close scenario menu" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button></div>
      <IntegrityDemoScenarios />
      <PopupResizeControl />
    </div>}
  </section>;
}
