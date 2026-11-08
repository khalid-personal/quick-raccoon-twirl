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
  const panelRef = React.useRef<HTMLElement>(null);
  const [position, setPosition] = React.useState<{ left: number; top?: number; bottom?: number }>({ left: 16, bottom: 88 });
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
  const subIndex = Math.max(0, Math.min(state?.subIndex ?? 0, (step?.instructions.length ?? 1) - 1));

  React.useEffect(() => {
    const start = (event: Event) => {
      if (!userRole || !isDemoMode()) return;
      const saved = readWalkthrough();
      const resume = (event as CustomEvent<{ resume?: boolean }>).detail?.resume && saved?.role === userRole && !saved.completed;
      const index = resume ? Math.min(saved.index, steps.length - 1) : 0;
      const next = { role: userRole, index, subIndex: resume ? saved.subIndex ?? 0 : 0, active: true, completed: false, returnTo: resume ? saved.returnTo : location.pathname + location.search };
      saveWalkthrough(next);
      setState(next);
      navigate(steps[index].path);
    };
    window.addEventListener('start-demo-walkthrough', start);
    return () => window.removeEventListener('start-demo-walkthrough', start);
  }, [userRole, steps, location.pathname, location.search, navigate]);

  React.useEffect(() => {
    setHighlighted(false);
    setPosition({ left: 16, bottom: 88 });
    if (!step || location.pathname !== step.path.split('?')[0]) return;
    const requiredParams = new URLSearchParams(step.path.split('?')[1] ?? '');
    const actualParams = new URLSearchParams(location.search);
    if ([...requiredParams].some(([key, value]) => actualParams.get(key) !== value)) return;
    let target: Element | null = null;
    const positionPanel = () => {
      if (!target || !panelRef.current) return;
      const bounds = target.getBoundingClientRect();
      const panel = panelRef.current.getBoundingClientRect();
      const margin = 16;
      const top = Math.max(80, Math.min(bounds.top, window.innerHeight - panel.height - 88));
      const next = window.innerWidth >= 768 && bounds.right + panel.width + margin * 2 <= window.innerWidth
        ? { left: bounds.right + margin, top }
        : window.innerWidth >= 768 && bounds.left >= panel.width + margin * 2
          ? { left: bounds.left - panel.width - margin, top }
          : { left: margin, bottom: 88 };
      setPosition(previous => previous.left === next.left && previous.top === next.top && previous.bottom === next.bottom ? previous : next);
    };
    const find = () => {
      const element = document.querySelector(step.instructionSelectors?.[subIndex] ?? step.selector);
      if (!element || target?.isConnected) return;
      target = element;
      target.classList.add('portal-tour-highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlighted(true);
      positionPanel();
    };
    panelRef.current?.scrollTo?.({ top: 0 });
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(positionPanel) : null;
    if (panelRef.current) resizeObserver?.observe(panelRef.current);
    window.addEventListener('resize', positionPanel);
    window.addEventListener('scroll', positionPanel, true);
    return () => {
      observer.disconnect(); resizeObserver?.disconnect();
      window.removeEventListener('resize', positionPanel); window.removeEventListener('scroll', positionPanel, true);
      target?.classList.remove('portal-tour-highlight');
    };
  }, [step, state?.index, subIndex, location.pathname, location.search]);

  if (!step || !state) return null;
  const move = (index: number, nextSubIndex = 0) => {
    const next = { ...state, index, subIndex: nextSubIndex };
    saveWalkthrough(next);
    setState(next);
    if (index !== state.index) navigate(steps[index].path);
  };
  const close = (completed: boolean) => {
    const next = { ...state, active: false, completed };
    saveWalkthrough(next);
    setState(next);
    navigate(state.returnTo || '/guide');
  };

  return (
    <aside ref={panelRef} aria-label="Demo walkthrough" aria-live="polite" style={position} className="motion-safe:animate-in motion-safe:fade-in duration-300 fixed z-[60] max-h-[calc(100dvh-7rem)] w-[calc(100vw-2rem)] max-w-[30rem] overflow-y-auto rounded-2xl border-2 border-primary/30 bg-card p-6 text-card-foreground shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-primary">Demo walkthrough · {state.index + 1} of {steps.length}</p><h2 className="mt-1 text-xl font-semibold">{step.title}</h2></div>
        <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-500/10 hover:text-red-700" aria-label="Exit walkthrough" title="Exit walkthrough" onClick={() => close(false)}><X className="h-4 w-4" /></Button>
      </div>
      <div role="progressbar" aria-label="Walkthrough progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={state.index + 1} className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${(state.index + 1) / steps.length * 100}%` }} /></div>
      <p className="mt-3 text-base text-muted-foreground">{step.detail}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Do this now</p>
      <p className="mt-2 text-xs font-medium">Substep {subIndex + 1} of {step.instructions.length}</p>
      <nav aria-label="Feature substeps" className="mt-2 flex flex-wrap gap-2">{step.instructions.map((instruction, index) => <Button key={instruction} size="sm" variant={index === subIndex ? 'default' : 'outline'} aria-label={`Substep ${index + 1}: ${instruction}`} aria-current={index === subIndex ? 'step' : undefined} onClick={() => move(state.index, index)}>{state.index + 1}.{index + 1}</Button>)}</nav>
      <p className="mt-3 rounded-xl border bg-primary/5 p-4 text-base leading-relaxed">{step.instructions[subIndex]}</p>
      {subIndex === step.instructions.length - 1 && <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"><p className="text-xs font-semibold">Before you continue</p><p className="mt-1 text-sm text-muted-foreground">{step.check}</p></div>}
      {!highlighted && <div className="mt-3 text-sm text-muted-foreground"><p>This feature is not visible here. Return to its dashboard menu; if the tile is hidden, restore it using Edit layout.</p><Button variant="link" className="h-auto px-0 text-sm" onClick={() => navigate(step.path)}>Return to this feature</Button></div>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => close(false)}><BookOpen className="mr-1 h-4 w-4" />Manual</Button>
        <div className="flex gap-2"><Button size="sm" variant="outline" aria-label="Previous" disabled={state.index === 0 && subIndex === 0} onClick={() => subIndex > 0 ? move(state.index, subIndex - 1) : move(state.index - 1, steps[state.index - 1].instructions.length - 1)}><ArrowLeft className="h-4 w-4" /></Button>
          {subIndex < step.instructions.length - 1 ? <Button size="sm" onClick={() => move(state.index, subIndex + 1)}>Next substep <ArrowRight className="ml-1 h-4 w-4" /></Button>
            : state.index === steps.length - 1 ? <Button size="sm" onClick={() => close(true)}>Finish walkthrough</Button> : <Button size="sm" onClick={() => move(state.index + 1)}>Next step <ArrowRight className="ml-1 h-4 w-4" /></Button>}
        </div>
      </div>
    </aside>
  );
};

export default PortalWalkthrough;