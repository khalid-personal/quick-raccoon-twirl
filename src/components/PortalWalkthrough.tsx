import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { readWalkthrough, saveWalkthrough, walkthroughSteps, type WalkthroughState } from '@/lib/portal-walkthrough';

const PortalWalkthrough: React.FC = () => {
  const { userRole, candidateTrackingCode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = React.useState<WalkthroughState | null>(() => readWalkthrough());
  const [highlighted, setHighlighted] = React.useState(false);
  const steps = userRole ? walkthroughSteps(userRole, candidateTrackingCode) : [];
  const active = isDemoMode() && state?.active && state.role === userRole;
  const step = active ? steps[state.index] : undefined;

  React.useEffect(() => {
    const start = (event: Event) => {
      if (!userRole || !isDemoMode()) return;
      const saved = readWalkthrough();
      const resume = (event as CustomEvent<{ resume: boolean }>).detail.resume && saved?.role === userRole && !saved.completed;
      const index = resume ? Math.min(saved.index, steps.length - 1) : 0;
      const next = { role: userRole, index, active: true, completed: false, returnTo: location.pathname + location.search };
      saveWalkthrough(next);
      setState(next);
      navigate(steps[index].path);
    };
    window.addEventListener('start-demo-walkthrough', start);
    return () => window.removeEventListener('start-demo-walkthrough', start);
  }, [userRole, candidateTrackingCode, location.pathname, location.search, navigate]);

  React.useEffect(() => {
    setHighlighted(false);
    if (!step || location.pathname !== step.path.split('?')[0]) return;
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
  }, [step?.path, step?.selector, state?.index, location.pathname]);

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
    <aside key={state.index} aria-label="Demo walkthrough" aria-live="polite" className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-6 duration-300 fixed inset-x-3 top-20 z-[60] ml-auto max-h-[calc(100dvh-20rem)] w-auto max-w-sm overflow-y-auto rounded-lg border bg-card p-4 text-card-foreground shadow-xl sm:right-5 sm:inset-x-auto">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-primary">Demo walkthrough · {state.index + 1} of {steps.length}</p><h2 className="mt-1 text-base font-semibold">{step.title}</h2></div>
        <Button size="icon" variant="ghost" aria-label="Exit walkthrough" title="Exit walkthrough" onClick={() => close(false)}><X className="h-4 w-4" /></Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{step.detail}</p>
      {!highlighted && <Button variant="link" className="h-auto px-0 text-xs" onClick={() => navigate(step.path)}>Return to this feature</Button>}
      <div className="mt-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => close(false)}><BookOpen className="mr-1 h-4 w-4" />Manual</Button>
        <div className="flex gap-2"><Button size="sm" variant="outline" disabled={state.index === 0} onClick={() => move(state.index - 1)}><ArrowLeft className="h-4 w-4" /><span className="sr-only">Previous</span></Button>
          {state.index === steps.length - 1 ? <Button size="sm" onClick={() => close(true)}>Finish</Button> : <Button size="sm" onClick={() => move(state.index + 1)}>Next <ArrowRight className="ml-1 h-4 w-4" /></Button>}
        </div>
      </div>
    </aside>
  );
};

export default PortalWalkthrough;