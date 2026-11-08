import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { isDemoMode } from '@/lib/demo-mode';
import { applyIntegrityDemoScenario, resetIntegrityDemoScenario, INTEGRITY_DEMO_SCENARIOS, type IntegrityDemoMeasurement, type IntegrityDemoScenarioId } from '@/lib/demo-integrity-scenarios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const levelName = { red: 'LOW', yellow: 'MEDIUM', green: 'HIGH' };
const IntegrityDemoScenarios: React.FC = () => {
  const { user, actualRole, isAuthenticated, isDemo } = useAuth();
  const [selected, setSelected] = useState<IntegrityDemoScenarioId>(() => INTEGRITY_DEMO_SCENARIOS.find(scenario => scenario.id === sessionStorage.getItem('dawm_integrity_scenario'))?.id ?? 'medium');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<{ before: IntegrityDemoMeasurement; after: IntegrityDemoMeasurement; starting?: IntegrityDemoMeasurement } | null>(null);
  const [error, setError] = useState('');
  const [applying, setApplying] = useState(false);
  const allowed = isDemo && isDemoMode() && isAuthenticated && actualRole === 'superadmin' && !!user?.id && !!user?.email;
  const apply = async (reset: boolean) => {
    if (applying) return;
    setError('');
    setApplying(true);
    try {
      const actor = { id: user?.id ?? '', email: user?.email ?? '', role: actualRole, authenticated: isAuthenticated };
      if (!allowed) throw new Error('Sign in as a superadmin and enter DEMO mode first.');
      setResult(reset ? resetIntegrityDemoScenario(actor, confirmed, reason) : await applyIntegrityDemoScenario(selected, actor, confirmed, reason));
      setConfirmed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not replace DEMO data.'); }
    finally { setApplying(false); }
  };
  return <section className="mt-4 space-y-3 border-t pt-4" aria-label="DEMO integrity scenarios">
    <h3 className="text-sm font-semibold">Practice with demo records</h3>
    <p className="text-sm text-muted-foreground">Choose one of six examples to practice finding and fixing problems. Each keeps the same 435 candidates and tracking codes, but changes their progress and made-up payment proof. Manual candidate creation is disabled; existing support details remain editable. The score comes from the usual checks.</p>
    <p className="text-sm text-muted-foreground">Registration → Training → Medical → Deployment. Fees are paid before a step is passed. Deployment waits for official ministry clearance; a pretend review cannot unlock it.</p>
    {!allowed && <p className="text-sm">Sign in as a superadmin and enter DEMO mode to change the practice example.</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      {INTEGRITY_DEMO_SCENARIOS.map(scenario => <label key={scenario.id} className={`rounded border p-3 text-sm ${selected === scenario.id ? 'border-primary bg-muted' : ''}`}>
        <span className="flex items-center gap-2 font-medium"><input type="radio" name="integrity-demo-scenario" value={scenario.id}
          checked={selected === scenario.id} disabled={!allowed || applying} onChange={() => { setSelected(scenario.id); setConfirmed(false); }} />DEMO {scenario.label}</span>
        <span className="mt-1 block text-muted-foreground">{scenario.explanation}</span>
      </label>)}
    </div>
    <label className="block text-sm">Why are you changing the practice mode?
      <Input value={reason} disabled={!allowed || applying} onChange={event => { setReason(event.target.value); setConfirmed(false); }}
        placeholder="For example: practice finding a missing bank slip" />
    </label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!allowed || applying}
      onChange={event => setConfirmed(event.target.checked)} className="mt-1" />
      I understand this replaces the generated demo progress, payments and made-up proof, but keeps candidate names, tracking codes and records I added myself.
      The original list stays at 435; legacy additional candidates are retained. Real records, uploaded real files and sign-in accounts are not changed. I must remove uploaded statements myself before switching examples.
    </label>
    <div className="flex flex-wrap gap-2">
      <Button disabled={!allowed || applying || !confirmed || !reason.trim()} onClick={() => apply(false)}>{applying ? 'Updating demo records…' : `Apply DEMO ${INTEGRITY_DEMO_SCENARIOS.find(scenario => scenario.id === selected)?.label}`}</Button>
      <Button variant="outline" disabled={!allowed || applying || !confirmed || !reason.trim()} onClick={() => apply(true)}>Reset demo records</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <div role="status" className="space-y-1 rounded border p-3 text-sm">
      <p>Demo record check score: {result.before.score} ({levelName[result.before.level]}) → {result.after.score} ({levelName[result.after.level]}).</p>
      {result.starting && <p>This example started at {result.starting.score}; the checks now give {result.after.score}.</p>}
      <p>{result.after.candidates} demo candidates · {result.after.findings} warnings · {result.after.documents} made-up documents.</p>
      <p>{result.after.flaggedPayments} flagged payments · {result.after.openPaymentCases} open payment reviews · {result.after.openAgencyCases} open agency cases.</p>
      <p>Review missing slips in payment evidence and amount gaps in agency cases. Generated cases are practice reviews, not suspensions or proof of agency fault.</p>
      <p>Bank slips: {result.after.bank.matched} exact matches · {result.after.bank.short} too small · {result.after.bank.over} too large · {result.after.bank.missing} missing · {result.after.bank['reference-mismatch']} wrong references · {result.after.bank['currency-mismatch']} wrong currencies.</p>
    </div>}
    <p className="text-xs text-muted-foreground">HIGH normally means 85 or more, MEDIUM 60 or more, LOW below 60. The score uses your current settings and the usual record checks.
      Fees and settings changes can affect it. A good score is not official clearance. Reset discards edits to generated practice records.</p>
  </section>;
};

export default IntegrityDemoScenarios;
