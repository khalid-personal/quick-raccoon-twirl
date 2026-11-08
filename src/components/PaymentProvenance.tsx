import { useQuery } from '@tanstack/react-query';
import { CandidateWorkspaceLink, EntityProfileButton } from './CandidateQuickViewProvider';
import api from '@/lib/api';
import { getCandidates, getForeignAgencies, getLocalAgencies, getPayments } from '@/lib/data-store';
import { paymentProvenance } from '@/lib/payment-provenance';
import { ALL_STAGES, type Payment } from '@/lib/types';
import { PAYMENT_STATUS_LABELS } from '@/lib/payment-ledger';
import { actorDisplayName, type ActorIdentity } from '@/lib/demo-identities';

export default function PaymentProvenance({ payment, onCandidateOpen }: { payment: Payment; onCandidateOpen?: () => void }) {
  const { data: logs = [], isLoading, isError } = useQuery({
    queryKey: ['paymentProvenanceLogs', payment.id], queryFn: api.getAllApprovalLogs,
  });
  const allCandidates = getCandidates();
  const trail = paymentProvenance(payment, logs, getPayments(), allCandidates);
  const candidates = allCandidates.filter(candidate => payment.candidate_ids.includes(candidate.id));
  const actorLink = (actor: ActorIdentity | undefined, missing: string) => {
    if (!actor) return isLoading ? 'Loading audit history…' : missing;
    const label = actor.name ? `${actor.name}${actor.email ? ` · ${actor.email}` : ''}` : actor.email || actor.id;
    return allCandidates.some(candidate => candidate.id === actor.id)
      ? <CandidateWorkspaceLink to={`/admin/candidate/${actor.id}`} candidateId={actor.id} tab="payments" onClick={onCandidateOpen}>{label}</CandidateWorkspaceLink>
      : <EntityProfileButton kind="staff" entityId={actor.id}>{label}</EntityProfileButton>;
  };
  const payer = payment.payer_display_name || getForeignAgencies().find(agency => agency.id === payment.payer_foreign_agency_id)?.name ||
    getCandidates().find(candidate => candidate.id === payment.payer_candidate_id)?.tracking_code || payment.payer_candidate_id || payment.payer_foreign_agency_id || 'Not recorded';
  const payee = getLocalAgencies().find(agency => agency.id === payment.payee_local_agency_id)?.name || payment.payee_local_agency_id || 'Not recorded';
  return <section className="space-y-4 rounded-xl border bg-muted/20 p-4" aria-label="Superadmin payment investigation">
    <h3 className="font-semibold">Who paid and who updated the record</h3>
    <p className="text-xs text-muted-foreground">Only saved details are shown. The person paying may not be the person who started the payment. Missing history does not prove who was responsible.</p>
    {(payment.demo_evidence?.synthetic || payment.id.startsWith('demo-') || payment.provider === 'mock' || /synthetic/i.test(payment.payment_method ?? '')) && <p role="note" className="text-xs text-muted-foreground">Practice / synthetic payment and staff attribution. Not real bank proof or a live bank confirmation.</p>}
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-muted-foreground">Payer → recipient</dt><dd className="break-words"><EntityProfileButton kind="foreign-agency" entityId={payment.payer_foreign_agency_id}>{payer}</EntityProfileButton> → <EntityProfileButton kind="local-agency" entityId={payment.payee_local_agency_id}>{payee}</EntityProfileButton></dd></div>
      <div><dt className="text-xs text-muted-foreground">Initiated by</dt><dd className="break-all">{actorLink(trail.initiator, 'Initiator not recorded')}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Recorded / verified by</dt><dd className="break-all">{actorLink(trail.recorder, 'Recorder not recorded')}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Origin / payment channel</dt><dd>{payment.origin || 'Origin not recorded'} · {payment.provider || payment.payment_method || 'Channel not recorded'}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Initiated / recorded</dt><dd>{new Date(payment.initiated_at || payment.created_at).toLocaleString()}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Last recorded update</dt><dd>{new Date(payment.updated_at).toLocaleString()}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Linked stage</dt><dd>{ALL_STAGES.find(stage => stage.id === payment.stage_id)?.title || 'Agency settlement / no stage recorded'}</dd></div>
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Payment record ID / transfer reference</dt><dd className="break-all font-mono text-xs">{payment.id} · {payment.provider_reference || 'No provider reference'}</dd></div>
    </dl>
    {payment.chechepay_receipt && <p className="text-sm">ChechePay confirmation recorded {new Date(payment.chechepay_receipt.verified_at).toLocaleString()} · Processor: {payment.chechepay_receipt.processor_reference || 'Not recorded'}.</p>}
    <div>
      <h4 className="mb-2 text-sm font-semibold">Candidates covered and contract details</h4>
      <ul className="space-y-2 text-sm">{candidates.map(candidate => <li key={candidate.id}>
        <CandidateWorkspaceLink candidateId={candidate.id} tab="payments" onClick={onCandidateOpen} className="font-medium underline underline-offset-2" to={`/admin/candidate/${candidate.id}`}>{candidate.first_name} {candidate.last_name} · {candidate.tracking_code}</CandidateWorkspaceLink>
        <p className="text-xs text-muted-foreground">Contract sent by: {candidate.work_contract_record?.sent_by || 'Not recorded'} · Received by: {candidate.work_contract_record?.received_by || 'Not recorded'} · Destination: {candidate.external_status?.destination_country || 'Not recorded'}</p>
      </li>)}</ul>
      {!candidates.length && <p className="text-sm text-muted-foreground">No linked candidate records found.</p>}
      {payment.candidate_ids.filter(id => !candidates.some(candidate => candidate.id === id)).map(id => <p key={id} className="break-all text-xs text-amber-700">Linked candidate {id} is unavailable.</p>)}
    </div>
    <div>
      <h4 className="mb-2 text-sm font-semibold">Payment activity history</h4>
      {isLoading ? <p className="text-sm">Loading activity…</p> : isError ? <p role="alert" className="text-sm text-destructive">Could not load payment history. We cannot show who made earlier changes.</p> : <ol className="space-y-3 border-l pl-4">
        {trail.paymentEvents.map(event => <li key={event.id} className="text-sm">
          <p className="font-medium">{event.action} · {actorDisplayName(event.actor_id, event.actor_email, allCandidates)}</p>
          <p className="whitespace-pre-wrap break-words">{event.description}</p>
          <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
        </li>)}
        {!trail.paymentEvents.length && <li className="text-sm text-muted-foreground">No earlier payment activity was recorded. The current status does not show who changed it before.</li>}
      </ol>}
      {!isError && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Related candidate activity ({trail.candidateEvents.length})</summary>
        <ol className="mt-2 space-y-2">{trail.candidateEvents.map(event => <li key={event.id}><p>{event.action} · {actorDisplayName(event.actor_id, event.actor_email, allCandidates)} · {new Date(event.timestamp).toLocaleString()}</p><p className="break-words text-xs text-muted-foreground">{event.description}</p></li>)}</ol>
        <p className="mt-2 text-xs text-muted-foreground">These events concern linked candidates; they are context, not proof that the actor initiated this payment.</p>
      </details>}
    </div>
    <details className="text-sm"><summary className="cursor-pointer font-medium">Related transfers ({trail.relatedPayments.length})</summary>
      <ul className="mt-2 space-y-2">{trail.relatedPayments.map(other => <li key={other.id} className="break-words">
        <p>{other.receipt_number || other.id} · {other.amount.toLocaleString()} {other.currency} · {PAYMENT_STATUS_LABELS[other.status]}</p>
        <p className="text-xs text-muted-foreground">{new Date(other.created_at).toLocaleString()} · {other.provider_reference === payment.provider_reference && payment.provider_reference ? 'Same provider reference — investigate reuse' : 'Shares a candidate; not necessarily a duplicate'}</p>
      </li>)}</ul>
    </details>
  </section>;
}
