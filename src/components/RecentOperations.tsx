import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortalData } from '@/hooks/use-portal-data';
import { verifiedPaymentIds } from '@/lib/payment-review-clearance';
import { loadBankStatement } from '@/lib/bank-statement-store';
import { isCleared } from '@/lib/ksa-visa';
import { activityCategory, activityHighlights, type ActivityCategory } from '@/lib/activity-presentation';
import type { ExecutiveMetrics } from '@/lib/types';
import ActivityRecord from './ActivityRecord';
import { navigationItemClass } from './ui/navigation-rail';

export default function RecentOperations({ activity, localAgencyId, paymentPath }: {
  activity: ExecutiveMetrics['activity']; localAgencyId?: string; paymentPath: string;
}) {
  const data = usePortalData();
  const [category, setCategory] = useState<ActivityCategory | 'All'>('All');
  const [statementFor, refresh] = useState(() => loadBankStatement);
  useEffect(() => {
    const update = () => refresh(() => (agencyId: string, source: 'foreign' | 'candidate') => loadBankStatement(agencyId, source));
    window.addEventListener('bank-statement-changed', update);
    return () => window.removeEventListener('bank-statement-changed', update);
  }, []);
  const candidates = data.candidates.filter(candidate => !localAgencyId || candidate.local_agency_id === localAgencyId);
  const ids = new Set(candidates.map(candidate => candidate.id));
  const payments = data.payments.filter(payment => localAgencyId ? payment.payee_local_agency_id === localAgencyId : payment.candidate_ids.some(id => ids.has(id)));
  const verified = useMemo(() => verifiedPaymentIds(data.payments, data.candidates, data.stages, data.paymentStatuses, data.stageFees, statementFor), [data.candidates, data.payments, data.stages, data.paymentStatuses, data.stageFees, statementFor]);
  const settled = payments.filter(payment => payment.status === 'succeeded');
  const checked = settled.filter(payment => verified.has(payment.id)).length;
  const allChecked = settled.length > 0 && checked === settled.length;
  const visible = activity.filter(item => category === 'All' || activityCategory(item.description) === category);
  return <div className="space-y-5">
    <section aria-label="Current operational insights" className="space-y-3">
      <p className="text-sm text-muted-foreground">Current record insights—not invented activity events. A clean payment check is not ministry approval.</p>
      <div className="portal-metric-grid">
        <Link to={paymentPath} className="rounded-2xl border bg-primary/5 p-4"><p className="text-sm font-medium">{allChecked ? 'All received receipts checked' : settled.length ? 'Received receipts checked' : 'No received receipts to check'}</p><p className="mt-2 text-2xl font-semibold">{checked} / {settled.length}</p><p className="mt-2 text-xs text-muted-foreground">Exact bank details and required checks · open payments</p></Link>
        <Link to={paymentPath} className="rounded-2xl border bg-card p-4"><p className="text-sm font-medium">Pending transfers</p><p className="mt-2 text-2xl font-semibold">{payments.filter(payment => payment.status === 'pending').length}</p><p className="mt-2 text-xs text-muted-foreground">Not counted as received or bank-confirmed</p></Link>
        <div className="rounded-2xl border bg-primary/5 p-4"><p className="text-sm font-medium">Official ministry clearance</p><p className="mt-2 text-2xl font-semibold">{candidates.filter(isCleared).length}</p><p className="mt-2 text-xs text-muted-foreground">{candidates.filter(candidate => candidate.clearance?.local_ready_at && !isCleared(candidate)).length} locally ready, still awaiting ministry</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-sm font-medium">New registrations · 7 days</p><p className="mt-2 text-2xl font-semibold">{candidates.filter(candidate => { const age = Date.now() - Date.parse(candidate.created_at); return age >= 0 && age <= 7 * 86400000; }).length}</p><p className="mt-2 text-xs text-muted-foreground">Recorded intake in the selected agency scope</p></div>
      </div>
    </section>
    <div role="group" aria-label="Activity topics" className="navigation-rail">{(['All', 'Payments', 'Journey & ministry', 'Documents', 'Agency decisions', 'Accounts & records'] as const).map(topic =>
      <button type="button" key={topic} aria-pressed={category === topic} className={navigationItemClass(category === topic)} onClick={() => setCategory(topic)}>{topic} · {activity.filter(item => topic === 'All' || activityCategory(item.description) === topic).length}</button>)}</div>
    <p className="text-xs text-muted-foreground">Highlights from the latest {activity.length} saved actions. All topics prioritizes a mix of real actions; choose a topic for its newest records.</p>
    <div className="portal-record-grid">{(category === 'All' ? activityHighlights(visible) : visible.slice(0, 12)).map(item => <ActivityRecord key={item.id} activity={item} />)}</div>
    {!visible.length && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No recorded activity for this topic. No successful actions are fabricated when payment issues are clear.</p>}
    {visible.length > 12 && <p className="text-xs text-muted-foreground">{category === 'All' ? 'Showing 12 topic-balanced highlights in chronological order.' : 'Showing the latest 12 actions in this topic.'}</p>}
  </div>;
}
