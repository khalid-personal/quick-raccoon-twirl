import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { readWalkthrough, saveWalkthrough, walkthroughSteps, type WalkthroughState } from '@/lib/portal-walkthrough';
import { getCandidates, getCandidateStages } from '@/lib/data-store';

const PortalWalkthrough: React.FC = () => {
  const { userRole, candidateTrackingCode, userLocalAgencyId, userForeignAgencyId, user, viewAs } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = React.useState<WalkthroughState | null>(() => readWalkthrough());
  const [highlighted, setHighlighted] = React.useState(false);
  const actorId = viewAs?.userId ?? user?.id;
  const assignedIds = new Set(getCandidateStages().filter(stage => stage.assigned_staff_id === actorId).map(stage => stage.candidate_id));
  const candidate = getCandidates().find(candidate => (!userLocalAgencyId || candidate.local_agency_id === userLocalAgencyId)
    && (!userForeignAgencyId || candidate.foreign_agency_id === userForeignAgencyId)
    && (userRole !== 'staff' || candidate.assigned_staff_id === actorId || assignedIds.has(candidate.id)));
  const candidateId = candidate?.id;
  const steps = React.useMemo(() => userRole ? walkthroughSteps(userRole, candidateTrackingCode, candidateId)
    .filter(step => !!candidateId || !step.path.startsWith('/admin/candidate/')) : [], [userRole, candidateTrackingCode, candidateId]);
  const active = isDemoMode() && state?.active && state.role === userRole;
  const step = active ? steps[state.index] : undefined;

  React.useEffect(() => {
    const start = (event: Event) => {
      if (!userRole || !isDemoMode()) return;
      const saved = readWalkthrough();
      const resume = (event as CustomEvent<{ resume?: boolean }>).detail?.resume && saved?.role === userRole && !saved.completed;
      const index = resume ? Math.min(saved.index, steps.length - 1) : 0;
      const next = { role: userRole, index, active: true, completed: false, returnTo: resume ? saved.returnTo : location.pathname + location.search };
      saveWalkthrough(next);
      setState(next);
      navigate(steps[index].path);
    };
    window.addEventListener('start-demo-walkthrough', start);
    return () => window.removeEventListener('start-demo-walkthrough', start);
  }, [userRole, steps, location.pathname, location.search, navigate]);

  React.useEffect(() => {
    setHighlighted(false);
    if (!step || location.pathname !== step.path.split('?')[0]) return;
    const requiredParams = new URLSearchParams(step.path.split('?')[1] ?? '');
    const actualParams = new URLSearchParams(location.search);
    if ([...requiredParams].some(([key, value]) => actualParams.get(key) !== value)) return;
    let target: Element | null = null;
    const find = () => {
      const element = document.querySelector(step.selector);
      if (!element || target) return;
      target = element;
      target.classList.add('portal-tour-highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlighted(true);
    };
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); target?.classList.remove('portal-tour-highlight'); };
  }, [step, state?.index, location.pathname, location.search]);

  if (!step || !state) return null;
  const move = (index: number) => {
    const next = { ...state, index };
    saveWalkthrough(next);
    setState(next);
    navigate(steps[index].path);
  };
  const close = (completed: boolean) => {
    const next = { ...state, active: false, completed };
    saveWalkthrough(next);
    setState(next);
    navigate(state.returnTo || '/guide');
  };

  return (
    <aside key={state.index} aria-label="Demo walkthrough" aria-live="polite" className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 duration-300 fixed inset-x-3 top-20 z-[60] ml-auto max-h-[calc(100dvh-7rem)] w-auto max-w-sm overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground shadow-xl sm:right-5 sm:inset-x-auto">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-primary">Demo walkthrough · {state.index + 1} of {steps.length}</p><h2 className="mt-1 text-base font-semibold">{step.title}</h2></div>
        <Button size="icon" variant="ghost" aria-label="Exit walkthrough" title="Exit walkthrough" onClick={() => close(false)}><X className="h-4 w-4" /></Button>
      </div>
      <div role="progressbar" aria-label="Walkthrough progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={state.index + 1} className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${(state.index + 1) / steps.length * 100}%` }} /></div>
      <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Do this now</p>
      <ol className="mt-2 space-y-3">{step.instructions.map((instruction, index) => <li key={instruction} className="flex gap-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><span>{instruction}</span></li>)}</ol>
      <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"><p className="text-xs font-semibold">Before you continue</p><p className="mt-1 text-sm text-muted-foreground">{step.check}</p></div>
      {!highlighted && <Button variant="link" className="h-auto px-0 text-xs" onClick={() => navigate(step.path)}>Return to this feature</Button>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => close(false)}><BookOpen className="mr-1 h-4 w-4" />Manual</Button>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={state.index === 0} onClick={() => move(state.index - 1)}><ArrowLeft className="h-4 w-4" /><span className="sr-only">Previous</span></Button>
          {state.index === steps.length - 1 ? <Button size="sm" onClick={() => close(true)}>Finish walkthrough</Button> : <Button size="sm" onClick={() => move(state.index + 1)}>Next step <ArrowRight className="ml-1 h-4 w-4" /></Button>}
        </div>
      </div>
    </aside>
  );
};

export default PortalWalkthrough;