import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, LocateFixed, Pause, Play, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { readWalkthrough, saveWalkthrough, walkthroughSteps, type WalkthroughState } from '@/lib/portal-walkthrough';
import { getCandidates, getCandidateStages } from '@/lib/data-store';
import { useLayoutEdit } from '@/lib/layout-edit';
import { PopupMoveControl } from './ui/popup-window';
import JourneyArrowField from './JourneyArrowField';

interface FocusArea { x: number; y: number; width: number; height: number; viewportWidth: number; viewportHeight: number }

const PortalWalkthrough: React.FC = () => {
  const { userRole, candidateTrackingCode, userLocalAgencyId, userForeignAgencyId, user, viewAs } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = React.useState<WalkthroughState | null>(() => readWalkthrough());
  const [focusArea, setFocusArea] = React.useState<FocusArea | null>(null);
  const [following, setFollowing] = React.useState(true);
  const [practiceOpen, setPracticeOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLElement>(null);
  const targetRef = React.useRef<Element | null>(null);
  const { editing, setEditing } = useLayoutEdit();
  const editingRef = React.useRef(editing);
  editingRef.current = editing;
  const actorId = viewAs?.userId ?? user?.id;
  const candidateId = React.useMemo(() => {
    const assignedIds = new Set(userRole === 'staff' ? getCandidateStages().filter(stage => stage.assigned_staff_id === actorId).map(stage => stage.candidate_id) : []);
    return getCandidates().find(candidate => (!userLocalAgencyId || candidate.local_agency_id === userLocalAgencyId)
      && (!userForeignAgencyId || candidate.foreign_agency_id === userForeignAgencyId)
      && (userRole !== 'staff' || candidate.assigned_staff_id === actorId || assignedIds.has(candidate.id)))?.id;
  }, [actorId, userRole, userLocalAgencyId, userForeignAgencyId]);
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
      navigate(steps[index].path, { state: { walkthroughScrollY: window.scrollY } });
    };
    window.addEventListener('start-demo-walkthrough', start);
    return () => window.removeEventListener('start-demo-walkthrough', start);
  }, [userRole, steps, location.pathname, location.search, navigate]);

  React.useEffect(() => { setPracticeOpen(false); }, [state?.index, active]);

  React.useEffect(() => {
    if (!step?.practiceLayout) return;
    const wasEditing = editingRef.current;
    return () => setEditing(wasEditing);
  }, [step, setEditing]);
  React.useEffect(() => {
    if (!step?.practiceLayout) return;
    setEditing(subIndex < step.instructions.length - 1);
  }, [step, subIndex, setEditing]);

  React.useEffect(() => {
    if (!step?.practiceWindow) return;
    if (subIndex === 4) { setPracticeOpen(false); return; }
    setPracticeOpen(true);
    let performed = false;
    const demonstrate = () => {
      if (performed) return;
      const popup = document.querySelector<HTMLElement>('[data-tour="walkthrough-window-practice"]');
      if (!popup) return;
      if (subIndex === 2) {
        popup.querySelector<HTMLButtonElement>('[aria-label="Minimize window"]')?.click();
      } else {
        if (popup.dataset.state === 'closed') {
          const restore = [...document.querySelectorAll<HTMLButtonElement>('[aria-label="Candidate workspace dock"] button')]
            .find(button => button.textContent?.startsWith('Window practice') && !button.getAttribute('aria-label')?.startsWith('Close'));
          if (!restore) return;
          restore.click();
          return;
        }
        if (subIndex === 1) popup.querySelector<HTMLButtonElement>('[aria-label="Resize window"]')?.click();
      }
      performed = true;
    };
    demonstrate();
    const observer = new MutationObserver(demonstrate);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] });
    return () => observer.disconnect();
  }, [step, subIndex]);

  React.useEffect(() => {
    setFocusArea(null);
    targetRef.current = null;
    if (!step || location.pathname !== step.path.split('?')[0]) return;
    const requiredParams = new URLSearchParams(step.path.split('?')[1] ?? '');
    const actualParams = new URLSearchParams(location.search);
    if ([...requiredParams].some(([key, value]) => actualParams.get(key) !== value)) return;
    let target: Element | null = null;
    let frame = 0;
    let scrolled = false;
    const measure = () => {
      if (!target?.isConnected) { setFocusArea(null); return; }
      const bounds = target.getBoundingClientRect();
      if (!bounds.width || !bounds.height || target.closest('[hidden], [aria-hidden="true"], [data-state="closed"]')) { setFocusArea(null); return; }
      const x = Math.max(8, bounds.left - 8);
      const y = Math.max(8, bounds.top - 8);
      const right = Math.min(window.innerWidth - 8, bounds.right + 8);
      const bottom = Math.min(window.innerHeight - 8, bounds.bottom + 8);
      const next = right > x && bottom > y ? { x, y, width: right - x, height: bottom - y, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight } : null;
      setFocusArea(previous => previous && next && previous.x === next.x && previous.y === next.y && previous.width === next.width
        && previous.height === next.height && previous.viewportWidth === next.viewportWidth && previous.viewportHeight === next.viewportHeight ? previous : next);
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === 'hidden') measure();
      else frame = requestAnimationFrame(measure);
    };
    const find = () => {
      const element = [...document.querySelectorAll(step.instructionSelectors?.[subIndex] ?? step.selector)]
        .find(element => !element.closest('[hidden], [aria-hidden="true"], [data-state="closed"]'));
      const available = !!element;
      if (available && target === element && target?.isConnected) return;
      target?.classList.remove('portal-tour-highlight');
      targetRef.current = null;
      if (!available) { target = null; setFocusArea(null); return; }
      target = element;
      targetRef.current = element;
      target.classList.add('portal-tour-highlight');
      if (following && !scrolled && !target.closest('[aria-label="Demo walkthrough"]')) {
        scrolled = true;
        target.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
      }
      measure();
      scheduleMeasure();
    };
    panelRef.current?.scrollTo?.({ top: 0 });
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'data-state'] });
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(document.body);
    window.addEventListener('scroll', scheduleMeasure, true);
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
      target?.classList.remove('portal-tour-highlight');
      targetRef.current = null;
    };
  }, [step, state?.index, subIndex, location.pathname, location.search, following]);

  if (!step || !state) return null;
  const move = (index: number, nextSubIndex = 0) => {
    const next = { ...state, index, subIndex: nextSubIndex };
    saveWalkthrough(next);
    setState(next);
    const [pathname, search] = steps[index].path.split('?');
    const actualParams = new URLSearchParams(location.search);
    if (index !== state.index || location.pathname !== pathname || [...new URLSearchParams(search)].some(([key, value]) => actualParams.get(key) !== value)) {
      navigate(steps[index].path, { state: { walkthroughScrollY: window.scrollY } });
    }
  };
  const close = (completed: boolean) => {
    const next = { ...state, active: false, completed };
    saveWalkthrough(next);
    setState(next);
    navigate(state.returnTo || '/guide');
  };
  const focusTitle = step.instructionTitles?.[subIndex] ?? `Part ${subIndex + 1} · ${step.title}`;

  return (
    <>
    {focusArea && <div className="portal-tour-spotlight" aria-hidden="true">
      <svg width="100%" height="100%" viewBox={`0 0 ${focusArea.viewportWidth} ${focusArea.viewportHeight}`}>
        <path d={`M0 0H${focusArea.viewportWidth}V${focusArea.viewportHeight}H0Z M${focusArea.x} ${focusArea.y}v${focusArea.height}h${focusArea.width}v-${focusArea.height}Z`} fillRule="evenodd" fill="rgb(8 20 35 / 28%)" />
        <rect x={focusArea.x} y={focusArea.y} width={focusArea.width} height={focusArea.height} rx="12" className="portal-tour-focus-frame" />
      </svg>
      <div className="portal-tour-feature-tag" style={{ left: Math.min(focusArea.x + 12, Math.max(12, focusArea.viewportWidth - 280)), top: Math.max(12, focusArea.y - 36) }}><LocateFixed size={14} /><span>{subIndex + 1}. {focusTitle}</span></div>
    </div>}
    <aside ref={panelRef} data-popup-window="" aria-label="Demo walkthrough" className={`portal-popup portal-tour-panel fixed bottom-[88px] left-4 z-[60] ${step.practiceWindow && practiceOpen ? 'max-h-[38dvh]' : 'max-h-[45dvh]'} sm:max-h-[70dvh] w-[calc(100vw-2rem)] max-w-[28rem] overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground shadow-2xl`}>
      <div data-popup-drag-handle="" className="flex items-start justify-between gap-3 sm:pr-10">
        <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><Sparkles size={14} /> Guided experience · {state.index + 1} of {steps.length}</p><h2 className="mt-1 text-xl font-semibold">{step.title}</h2></div>
        <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-500/10 hover:text-red-700" aria-label="Exit walkthrough" title="Exit walkthrough" onClick={() => close(false)}><X className="h-4 w-4" /></Button>
      </div>
      <PopupMoveControl />
      <JourneyArrowField compact paused />
      <div role="progressbar" aria-label="Walkthrough progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={state.index + 1} className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${(state.index + 1) / steps.length * 100}%` }} /></div>
      <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer font-medium">About this feature</summary><p className="mt-2">{step.detail}</p></details>
      <div className="mt-3 flex items-center justify-between gap-2"><p className="text-sm font-semibold">What to do</p><Button size="sm" variant="ghost" aria-pressed={following} onClick={() => setFollowing(value => !value)}>{following ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}{following ? 'Pause following' : 'Resume following'}</Button></div>
      <p className="text-xs text-muted-foreground">{following ? 'Opening the right view and following the feature for you.' : 'Automatic scrolling paused. You can move around freely.'} Records never change automatically.</p>
      <p className="mt-2 text-xs font-medium">Substep {subIndex + 1} of {step.instructions.length}</p>
      <nav aria-label="Feature substeps" className="mt-2 flex flex-wrap gap-2">{step.instructions.map((instruction, index) => <Button key={instruction} size="sm" variant={index === subIndex ? 'default' : 'outline'} aria-label={`Substep ${index + 1}: ${instruction}`} aria-current={index === subIndex ? 'step' : undefined} onClick={() => move(state.index, index)}>{index + 1}{step.instructionTitles?.[index] ? `. ${step.instructionTitles[index]}` : ''}</Button>)}</nav>
      <div data-tour="walkthrough-instruction" className="portal-tour-instruction mt-3 rounded-xl p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><LocateFixed size={15} />{focusTitle}</p><p aria-live="polite" aria-atomic="true" className="text-base leading-relaxed">{step.instructions[subIndex]}</p></div>
      {subIndex === step.instructions.length - 1 && <div className="mt-4 rounded-xl border bg-muted/50 p-3"><p className="text-xs font-semibold">Before you continue</p><p className="mt-1 text-sm text-muted-foreground">{step.check}</p></div>}
      {!focusArea && <p className="mt-3 text-sm text-muted-foreground">Locating this feature. If its dashboard panel is hidden, restore it in Edit layout. The guide does not unhide saved panels.</p>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => close(false)}><BookOpen className="mr-1 h-4 w-4" />Exit guide</Button>
        <div className="flex gap-2"><Button size="sm" variant="outline" aria-label="Previous" disabled={state.index === 0 && subIndex === 0} onClick={() => subIndex > 0 ? move(state.index, subIndex - 1) : move(state.index - 1, steps[state.index - 1].instructions.length - 1)}><ArrowLeft className="h-4 w-4" /></Button>
          {subIndex < step.instructions.length - 1 ? <Button size="sm" onClick={() => move(state.index, subIndex + 1)}>Next substep <ArrowRight className="ml-1 h-4 w-4" /></Button>
            : state.index === steps.length - 1 ? <Button size="sm" onClick={() => close(true)}>Finish walkthrough</Button> : <Button size="sm" onClick={() => move(state.index + 1)}>Next step <ArrowRight className="ml-1 h-4 w-4" /></Button>}
        </div>
      </div>
    </aside>
    <Dialog open={practiceOpen && !!step.practiceWindow} onOpenChange={setPracticeOpen}>
      <DialogContent data-tour="walkthrough-window-practice" className="top-[28%] max-w-md sm:top-[50%]">
        <DialogHeader><DialogTitle>Window practice</DialogTitle><DialogDescription>Try resizing, minimizing and restoring this popup. No portal records are changed.</DialogDescription></DialogHeader>
        <label className="space-y-2 text-sm">Practice note<Input defaultValue="My workspace" /></label>
        <p className="pb-4 text-sm text-muted-foreground">Yellow minus: minimize. Red X: close. Bottom-right corner: resize.</p>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default PortalWalkthrough;