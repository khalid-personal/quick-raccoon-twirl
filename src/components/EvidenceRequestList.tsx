import { useState } from 'react';
import { AlarmClock, CalendarDays, FileClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EVIDENCE_STATUS_LABELS, getEvidenceRequests, type EvidenceRequestStatus } from '@/lib/evidence-requests';
import type { PaymentStatementSource, ReconciliationCaseEvent } from '@/lib/bank-statement-store';
import { isForeignPayment } from '@/lib/currency';
import { currentVerifiedPaymentIds } from '@/lib/payment-review-clearance';

export default function EvidenceRequestList({ events, source, onReview }: {
  events: ReconciliationCaseEvent[]; source: PaymentStatementSource; onReview: (event: ReconciliationCaseEvent) => void;
}) {
  const [filter, setFilter] = useState<EvidenceRequestStatus | 'all'>('all');
  const verified = currentVerifiedPaymentIds();
  const requests = getEvidenceRequests(events, new Date(), verified).filter(({ event }) =>
    (event.source ?? (event.evidence.payment && !isForeignPayment(event.evidence.payment) ? 'candidate' : 'foreign')) === source,
  );
  const visible = requests.filter(request => filter === 'all' || request.status === filter);
  if (!requests.length) return null;
  return <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
    <h3 className="flex items-center gap-2 font-semibold"><FileClock className="h-5 w-5" />Evidence waiting room</h3>
    <p className="text-xs text-muted-foreground">Submission windows include the whole deadline day (Addis Ababa time). In-portal reminders refresh every minute while the portal is open; no email, SMS, or background alarm is sent.</p>
    <div className="flex flex-wrap gap-2">
      {(['all', 'overdue', 'due-soon', 'pending', 'scheduled'] as const).map(status => <Button key={status} size="sm" variant={filter === status ? 'default' : 'outline'} aria-pressed={filter === status} onClick={() => setFilter(status)}>
        {status === 'overdue' && <AlarmClock className="mr-1 h-4 w-4" />}{status === 'all' ? 'All requests' : EVIDENCE_STATUS_LABELS[status]} · {status === 'all' ? requests.length : requests.filter(request => request.status === status).length}
      </Button>)}
    </div>
    <div className="max-h-96 space-y-2 overflow-y-auto">
      {visible.map(({ event, status }) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><Badge variant={status === 'overdue' ? 'destructive' : 'secondary'}>{EVIDENCE_STATUS_LABELS[status]}</Badge>{event.synthetic && <Badge variant="outline">DEMO / synthetic</Badge>}<span className="break-all text-sm font-medium">{event.evidence.payment?.receipt_number || event.caseId}</span></div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3 shrink-0" />{event.submissionStart || event.createdAt.slice(0, 10)} through {event.dueDate} · Owner: {event.owner}</p>
          <p className="mt-1 text-sm">{event.note}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onReview(event)}>Review request</Button>
      </div>)}
      {!visible.length && <p className="text-sm text-muted-foreground">No requests match this status.</p>}
    </div>
  </section>;
}
