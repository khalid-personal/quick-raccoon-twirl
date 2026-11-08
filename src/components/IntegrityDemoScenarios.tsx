import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, CheckCircle2, CircleAlert, Layers3, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { applyIntegrityDemoScenario, INTEGRITY_DEMO_SCENARIOS, type IntegrityDemoMeasurement, type IntegrityDemoScenarioId } from '@/lib/demo-integrity-scenarios';

const levelName = { red: 'LOW', yellow: 'MEDIUM', green: 'HIGH' };
const IntegrityDemoScenarios: React.FC = () => {
  const { user, actualRole, isAuthenticated, isDemo } = useAuth();
  const readSelected = () => INTEGRITY_DEMO_SCENARIOS.find(scenario => scenario.id === sessionStorage.getItem('dawm_integrity_scenario'))?.id;
  const [selected, setSelected] = useState<IntegrityDemoScenarioId | undefined>(readSelected);
  const [result, setResult] = useState<{ before: IntegrityDemoMeasurement; after: IntegrityDemoMeasurement; starting?: IntegrityDemoMeasurement } | null>(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const [pending, setPending] = useState<IntegrityDemoScenarioId>();
  useEffect(() => {
    const refresh = () => setSelected(readSelected());
    window.addEventListener('demo-scenario-changed', refresh);
    return () => window.removeEventListener('demo-scenario-changed', refresh);
  }, []);
  const allowed = isDemo && isDemoMode() && isAuthenticated && actualRole === 'superadmin' && !!user?.id && !!user?.email;
  const apply = async (id: IntegrityDemoScenarioId) => {
    if (applyingRef.current) return;
    applyingRef.current = true;
    setError(''); setResult(null); setPending(id);
    setApplying(true);
    try {
      const actor = { id: user?.id ?? '', email: user?.email ?? '', role: actualRole, authenticated: isAuthenticated };
      if (!allowed) throw new Error('Sign in as a superadmin and enter DEMO mode first.');
      const outcome = await applyIntegrityDemoScenario(id, actor, true, `One-click demo scenario switch: ${id}`);
      setSelected(id);
      setResult(outcome);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not replace DEMO data.'); }
    finally { applyingRef.current = false; setApplying(false); setPending(undefined); }
  };
  return <section className="mt-4 space-y-4" aria-label="DEMO integrity scenarios" aria-busy={applying}>
    <div className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-4">
      <div className="rounded-xl bg-primary/10 p-2 text-primary"><Layers3 className="h-5 w-5" /></div>
      <div><h3 className="font-semibold">Pipeline scenarios</h3><p className="mt-1 text-sm text-muted-foreground">Click a card to switch immediately. Same 435 candidates; different progress, fee collections and workload.</p>
        <p className="mt-2 text-xs text-muted-foreground">Demo records only. Candidate identities, your settings and real records are preserved. Uploaded statements and held cases still block replacement.</p></div>
    </div>
    {!allowed && <p className="text-sm">Sign in as a superadmin and enter DEMO mode to change the practice example.</p>}
    <div className="grid gap-3 sm:grid-cols-2" aria-label="Choose scenario">
      {INTEGRITY_DEMO_SCENARIOS.map(scenario => {
        const Icon = scenario.id === 'high' ? CheckCircle2 : scenario.id === 'low' ? CircleAlert : scenario.id === 'high-medium' ? ArrowDownRight : ArrowUpRight;
        const color = scenario.id === 'low' ? 'bg-red-500/10 text-red-600' : scenario.id === 'high' || scenario.id === 'medium-high' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600';
        return <button key={scenario.id} type="button" aria-label={`Switch to DEMO ${scenario.label}`} aria-pressed={selected === scenario.id}
          disabled={!allowed || applying} onClick={() => void apply(scenario.id)}
          className={`group rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${selected === scenario.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'hover:border-primary/50 hover:bg-muted/30'}`}>
          <span className="flex items-center gap-3"><span className={`rounded-xl p-2 ${color}`}><Icon className="h-5 w-5" /></span><span className="flex-1 font-semibold">{scenario.label}</span>
            {pending === scenario.id ? <Loader2 aria-label="Updating demo records" className="h-4 w-4 animate-spin" /> : selected === scenario.id ? <Check aria-label="Current scenario" className="h-4 w-4 text-primary" /> : null}</span>
          <span className="mt-3 block text-sm leading-relaxed text-muted-foreground">{scenario.explanation}</span>
        </button>;
      })}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <div role="status" className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
      <p className="font-semibold">{INTEGRITY_DEMO_SCENARIOS.find(scenario => scenario.id === selected)?.label} is active</p>
      <div className="grid grid-cols-3 gap-3">{[
        ['Record score', `${result.after.score}/100`], ['Deployed files', result.after.deployed], ['Returned', result.after.returned],
        ['Active tasks', result.after.activeTasks], ['Overdue tasks', result.after.overdueTasks], ['Warnings', result.after.findings],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</div>
      <p className="text-muted-foreground">Score: {result.before.score} ({levelName[result.before.level]}) → {result.after.score} ({levelName[result.after.level]}).</p>
      <p>{result.after.candidates} candidates · Completed files include returnees; active deployments are the remainder.</p>
      <p>{result.after.flaggedPayments} flagged payments · {result.after.openPaymentCases} open payment reviews · {result.after.openAgencyCases} open agency cases.</p>
      <p className="text-xs text-muted-foreground">Bank entries: {result.after.bank.matched} matching · {result.after.bank.short} underpaid · {result.after.bank.over} overpaid · {result.after.bank.missing} missing.</p>
    </div>}
    <p className="text-xs text-muted-foreground">Registration → Training → Medical → Deployment. Completed examples are synthetic history, not new travel authorization. Future stages still require paid fees and official ministry clearance. Scores use your existing fees and thresholds.</p>
  </section>;
};

export default IntegrityDemoScenarios;
