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
  const allowed = isDemo && isDemoMode() && isAuthenticated && actualRole === 'superadmin' && !!user?.id && !!user?.email;
  const apply = (reset: boolean) => {
    setError('');
    try {
      const actor = { id: user?.id ?? '', email: user?.email ?? '', role: actualRole, authenticated: isAuthenticated };
      if (!allowed) throw new Error('Sign in as a superadmin and enter DEMO mode first.');
      setResult(reset ? resetIntegrityDemoScenario(actor, confirmed, reason) : applyIntegrityDemoScenario(selected, actor, confirmed, reason));
      setConfirmed(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not replace DEMO data.'); }
  };
  return <section className="mt-4 space-y-3 border-t pt-4" aria-label="DEMO integrity scenarios">
    <h3 className="text-sm font-semibold">DEMO ONLY — workflow and evidence practice</h3>
    <p className="text-sm text-muted-foreground">All six modes keep the same 435 named candidates, IDs and tracking codes. Modes change synthetic workflow and evidence problems, not candidate identities. The real checks calculate their scores; no score is forced. Normal creation and editing remain available.</p>
    <p className="text-sm text-muted-foreground">Registration → Training → Medical → Deployment. Fees are paid before a step is passed. Deployment waits for official ministry clearance; a pretend review cannot unlock it.</p>
    {!allowed && <p className="text-sm">Only a signed-in superadmin in DEMO mode can apply or reset these folders.</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      {INTEGRITY_DEMO_SCENARIOS.map(scenario => <label key={scenario.id} className={`rounded border p-3 text-sm ${selected === scenario.id ? 'border-primary bg-muted' : ''}`}>
        <span className="flex items-center gap-2 font-medium"><input type="radio" name="integrity-demo-scenario" value={scenario.id}
          checked={selected === scenario.id} disabled={!allowed} onChange={() => { setSelected(scenario.id); setConfirmed(false); }} />DEMO {scenario.label}</span>
        <span className="mt-1 block text-muted-foreground">{scenario.explanation}</span>
      </label>)}
    </div>
    <label className="block text-sm">Why are you changing the practice mode?
      <Input value={reason} disabled={!allowed} onChange={event => { setReason(event.target.value); setConfirmed(false); }}
        placeholder="For example: practice finding a missing bank slip" />
    </label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={!allowed}
      onChange={event => setConfirmed(event.target.checked)} className="mt-1" />
      I understand this changes generated DEMO workflow, payments and synthetic evidence while keeping candidate identities and manually added records.
      The base roster stays at 435; candidates I create are additional and are not deleted by switching modes. Live storage, uploaded live files and sign-in accounts are not changed. Uploaded statements must be removed explicitly before mode switching.
    </label>
    <div className="flex flex-wrap gap-2">
      <Button disabled={!allowed || !confirmed || !reason.trim()} onClick={() => apply(false)}>Apply DEMO {INTEGRITY_DEMO_SCENARIOS.find(scenario => scenario.id === selected)?.label}</Button>
      <Button variant="outline" disabled={!allowed || !confirmed || !reason.trim()} onClick={() => apply(true)}>Reset with DEMO reload</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {result && <div role="status" className="space-y-1 rounded border p-3 text-sm">
      <p>DEMO measured browser score: {result.before.score} ({levelName[result.before.level]}) → {result.after.score} ({levelName[result.after.level]}).</p>
      {result.starting && <p>Practice folder started at {result.starting.score}; the real checks now give {result.after.score}.</p>}
      <p>{result.after.candidates} pretend people · {result.after.findings} check flags · {result.after.documents} synthetic documents.</p>
      <p>Bank slips: {result.after.bank.matched} exact matches · {result.after.bank.short} too small · {result.after.bank.over} too large · {result.after.bank.missing} missing · {result.after.bank['reference-mismatch']} wrong references · {result.after.bank['currency-mismatch']} wrong currencies.</p>
    </div>}
    <p className="text-xs text-muted-foreground">HIGH normally means 85 or more, MEDIUM 60 or more, LOW below 60. Your current thresholds and real audit checks are used unchanged.
      Unusual fees or repeated settings changes can change the result. A good score is not official clearance. Reset discards practice edits.</p>
  </section>;
};

export default IntegrityDemoScenarios;
