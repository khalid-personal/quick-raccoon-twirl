import type { Candidate, LocalAgency, Payment } from './types';

export interface ActivityPresentation {
  title: string;
  summary: string;
  practice: boolean;
  facts: Array<{ label: string; value: string }>;
  warning?: string;
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const amount = (value: unknown, currency: string): string | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString()} ${currency}`.trim() : undefined;

export function presentActivity(description: string, action: string, context: {
  candidates?: Candidate[]; agencies?: LocalAgency[]; payment?: Payment;
} = {}): ActivityPresentation {
  const practice = /demo only|synthetic|scenario practice|practice evidence|no live files/i.test(description);
  const facts: ActivityPresentation['facts'] = [];
  let warning: string | undefined;
  let snapshot: Record<string, unknown> | undefined;
  const marker = /(?:Snapshot:|Previous receipt)\s*/i.exec(description);
  if (marker) {
    const start = marker.index + marker[0].length;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = start;
    for (; end < description.length; end++) {
      const char = description[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '{') depth++;
      else if (char === '}' && --depth === 0) { end++; break; }
    }
    try {
      const parsed: unknown = JSON.parse(description.slice(start, end));
      if (record(parsed)) snapshot = parsed;
      else warning = 'The saved payment details are not in a readable format. Open the original record below.';
    } catch {
      warning = 'The saved payment details are incomplete. Open the original record below.';
    }
  }
  const payment = snapshot && record(snapshot.payment) ? snapshot.payment : snapshot && 'amount' in snapshot ? snapshot : context.payment;
  const line = snapshot && record(snapshot.line) ? snapshot.line
    : snapshot && Array.isArray(snapshot.matchingLines) && snapshot.matchingLines.length === 1 && record(snapshot.matchingLines[0]) ? snapshot.matchingLines[0] : undefined;
  if (payment) {
    const ids = Array.isArray(payment.candidate_ids) ? payment.candidate_ids.filter((id): id is string => typeof id === 'string') : [];
    const names = ids.map(id => context.candidates?.find(candidate => candidate.id === id)).filter(candidate => candidate !== undefined);
    const evidence = 'demo_evidence' in payment && record(payment.demo_evidence) ? payment.demo_evidence : undefined;
    const identities = evidence && Array.isArray(evidence.identities) ? evidence.identities.filter(record) : [];
    const identityNames = identities.map(identity => `${text(identity.name)}${text(identity.tracking_code) ? ` (${text(identity.tracking_code)})` : ''}`).filter(Boolean);
    const candidateNames = identityNames.length ? identityNames.join(', ') : names.map(candidate => `${candidate.first_name} ${candidate.last_name} (${candidate.tracking_code})`).join(', ');
    if (candidateNames) facts.push({ label: 'Candidate', value: candidateNames });
    else if (text(payment.payer_display_name)) facts.push({ label: 'Payer', value: text(payment.payer_display_name) });
    const agency = context.agencies?.find(item => item.id === payment.payee_local_agency_id);
    if (agency) facts.push({ label: 'Receiving agency', value: agency.name });
    const reference = text(payment.provider_reference) || text(payment.receipt_number);
    if (reference) facts.push({ label: 'Payment reference', value: reference });
    const currency = text(payment.currency);
    const recorded = amount(payment.amount, currency);
    const received = line && amount(line.amount, text(line.currency));
    if (recorded) facts.push({ label: 'Receipt amount', value: recorded });
    if (received) facts.push({ label: 'Bank amount', value: received });
    if (line && currency === text(line.currency) && typeof payment.amount === 'number' && typeof line.amount === 'number') {
      const difference = amount(Math.abs(payment.amount - line.amount), currency);
      if (difference) facts.push({ label: line.amount < payment.amount ? 'Amount short' : line.amount > payment.amount ? 'Extra amount' : 'Difference', value: difference });
    }
  }
  const deadline = /(?:Follow-up:|Reply by)\s*(\d{4}-\d{2}-\d{2})/.exec(description)?.[1];
  if (deadline) facts.push({ label: 'Follow-up date', value: deadline });
  const reason = /Reason:\s*(.*?)(?=\s+Follow-up:|\s+Reply by|\s+Measured before=|\s+Snapshot:|\s+Case |\s+No legal finding|$)/i.exec(description)?.[1];
  if (reason && !/synthetic|demo only/i.test(reason)) facts.push({ label: 'Reason given', value: reason.replace(/\.\s*$/, '') });
  if (/Amount discrepancy escalation requested/i.test(description)) {
    const short = /underpayment/.test(description);
    const basis = /(?:underpayment|overpayment),\s*(contract|stage-fee|bank)/.exec(description)?.[1];
    if (basis === 'contract' || basis === 'stage-fee') return {
      title: basis === 'contract' ? 'Contract payment amount needs review' : 'Candidate stage fee needs review',
      summary: basis === 'contract' ? 'The recorded transfer differs from the expected contract amount. Verify the contract and candidate allocation; this is not a confirmed bank shortfall.'
        : 'Recorded candidate receipts differ from the stage fee. Check that each receipt belongs to this candidate and stage before deciding what remains payable.',
      practice, facts, warning,
    };
    return { title: short ? 'A payment shortfall needs review' : 'An extra payment amount needs review',
      summary: short ? 'The bank amount is lower than the receipt. Check the candidate and payment reference, then ask the agency to explain the difference.'
        : 'The bank amount is higher than the receipt. Check whether the extra amount belongs to this payment.',
      practice, facts, warning };
  }
  if (/Verified underpayment portal pause requested/i.test(description)) return {
    title: 'Agency pause requested after a checked payment shortfall',
    summary: 'The review recorded a candidate-linked bank shortfall and requested a pause on new agency activity. Check the payment issue for the current decision and any appeal. This is not a legal finding or a payment-provider freeze.',
    practice, facts, warning,
  };
  const decision = /Agency resolution (reinstate|suspend|resolve|request-response|escalate|appeal)\s+requested/i.exec(description)?.[1];
  if (decision) {
    const titles: Record<string, string> = { reinstate: 'Request to let the agency resume work', suspend: 'Request to pause new agency activity',
      resolve: 'Request to close the payment issue', 'request-response': 'Agency reply requested', escalate: 'Payment issue sent for further review', appeal: 'Agency appeal requested' };
    return { title: titles[decision], summary: 'A review action was requested with the recorded reason. Open the payment issue for its current status; this audit entry does not by itself confirm the final decision.', practice, facts, warning };
  }
  if (/Agency appeal submission requested/i.test(description)) return {
    title: 'Agency explanation submitted for review',
    summary: 'The agency requested an appeal review. Any existing pause stays in place until an administrator explicitly lets the agency resume work.',
    practice, facts, warning,
  };
  const scores = /Measured before=(\d+)\/(\w+), after=(\d+)\/(\w+)/.exec(description);
  if (scores) {
    const level = /\b(high-medium|low-medium|medium-high|high|medium|low)\b/.exec(description)?.[1];
    const labels: Record<string, string> = { low: 'Low-readiness practice scenario selected', 'low-medium': 'Low-to-medium practice scenario selected', medium: 'Medium-readiness practice scenario selected',
      'medium-high': 'Medium-to-high practice scenario selected', 'high-medium': 'High-to-medium practice scenario selected', high: 'High-readiness practice scenario selected' };
    facts.push({ label: 'Record check score', value: `${scores[1]} → ${scores[3]} out of 100` });
    return { title: level ? labels[level] : 'Practice scenario updated',
      summary: 'Candidate stages, payment records and bank differences were updated for this practice scenario. Live records and official clearance were not changed.',
      practice: true, facts, warning };
  }
  if (/generated complete synthetic confirmation/i.test(description)) {
    return { title: 'Practice payment evidence prepared',
      summary: 'A sample receipt, candidate identity record and matching bank entry were created for checking. This is not a bank-authenticated confirmation or official clearance.',
      practice: true, facts, warning };
  }
  const readable = description.split(/\s*(?:Snapshot:|Previous receipt|\[Record context:)/i)[0]
    .replace(/\{[\s\S]*$/, '').replace(/\bDEMO ONLY:?\s*/gi, '').replace(/\bsynthetic\b/gi, 'practice')
    .replace(/\bDEMO\b/gi, 'practice').trim();
  const summary = readable.length > 320 ? `${readable.slice(0, 317)}...` : readable;
  return { title: `${action || 'Recorded'} activity`, summary: summary || 'Open the original record for the saved details.', practice, facts, warning };
}
