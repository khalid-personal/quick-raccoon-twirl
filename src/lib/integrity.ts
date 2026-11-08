import { ALL_STAGES } from './types';
import { checkForeignPayment, isForeignPayment } from './currency';
import type { ApprovalLog, IntegrityOverride, Candidate, CandidateStage, Document, MedicalResult, Payment, PaymentStatus, StaffUser } from './types';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  id: string;
  rule: string;
  severity: Severity;
  title: string;
  detail: string;
  candidateId?: string;
  paymentId?: string;
  actor?: string;
}

export interface IntegrityInput {
  candidates: Candidate[];
  stages: CandidateStage[];
  documents?: Document[];
  payments: Payment[];
  paymentStatuses: PaymentStatus[];
  medicals: MedicalResult[];
  logs: ApprovalLog[];
  stageFees?: Record<number, number>;
  now?: number;
}

export function scopeIntegrityFindings(findings: Finding[], candidates: Candidate[], payments: Payment[], localAgencyId?: string, staff: StaffUser[] = []): Finding[] {
  if (!localAgencyId) return findings;
  const candidateIds = new Set(candidates.filter(candidate => candidate.local_agency_id === localAgencyId).map(candidate => candidate.id));
  const paymentIds = new Set(payments.filter(payment => payment.payee_local_agency_id === localAgencyId
    || payment.candidate_ids.some(id => candidateIds.has(id))).map(payment => payment.id));
  const actors = new Set(staff.filter(person => person.local_agency_id === localAgencyId).flatMap(person => [person.id, person.email]));
  actors.add(localAgencyId);
  return findings.filter(finding => !!finding.candidateId && candidateIds.has(finding.candidateId)
    || !!finding.paymentId && paymentIds.has(finding.paymentId)
    || !!finding.actor && actors.has(finding.actor));
}

export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 25, high: 10, medium: 4, low: 1 };

const DONE = new Set(['Passed', 'Issued', 'Completed']);
const DEPLOYMENT_STAGE = ALL_STAGES[ALL_STAGES.length - 1].id;
const normalize = (value?: string) => (value ?? '').replace(/[\s-]/g, '').toUpperCase();
const nameOf = (c: Candidate) => `${c.first_name} ${c.last_name}`.trim();

const groupDuplicates = <T,>(items: T[], key: (item: T) => string): T[][] => {
  const map = new Map<string, T[]>();
  items.forEach(item => {
    const k = key(item);
    if (!k) return;
    map.set(k, [...(map.get(k) ?? []), item]);
  });
  return [...map.values()].filter(group => group.length > 1);
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const ageAt = (dob: string, at: number) => {
  const birth = new Date(dob).getTime();
  return Number.isFinite(birth) ? (at - birth) / (365.25 * 86_400_000) : NaN;
};

// Each rule inspects data the portal already holds, so risks surface without anyone filing a report.
export const analyzeIntegrity = (input: IntegrityInput): Finding[] => {
  const { candidates, stages, documents = [], payments, paymentStatuses, medicals, logs, stageFees = {} } = input;
  const now = input.now ?? Date.now();
  const findings: Finding[] = [];
  const seenIds = new Map<string, number>();
  // Ids are derived from the rule and its subject (never from list position) so an override survives recalculation.
  const add = (finding: Omit<Finding, 'id'> & { key?: string | number }) => {
    const { key, ...rest } = finding;
    const base = `${rest.rule}:${rest.candidateId ?? rest.paymentId ?? rest.actor ?? 'global'}${key !== undefined ? `:${key}` : ''}`;
    const n = (seenIds.get(base) ?? 0) + 1;
    seenIds.set(base, n);
    findings.push({ ...rest, id: n === 1 ? base : `${base}#${n}` });
  };
  const time = (value?: string) => { const t = value ? new Date(value).getTime() : NaN; return Number.isFinite(t) ? t : NaN; };
  const DAY = 86_400_000;

  const stagesOf = (candidateId: string) => stages.filter(s => s.candidate_id === candidateId);
  const ordinalOf = (stageId: number) => ALL_STAGES.find(s => s.id === stageId)?.ordinal ?? 0;

  groupDuplicates(candidates, c => normalize(c.passport_number)).forEach(group => {
    group.forEach(c => add({
      rule: 'duplicate-passport', severity: 'critical', candidateId: c.id,
      title: 'Passport number shared by several candidates',
      detail: `${nameOf(c)} shares passport ${c.passport_number} with ${group.filter(o => o.id !== c.id).map(nameOf).join(', ')}. Possible duplicate or fraudulent identity.`,
    }));
  });

  groupDuplicates(candidates, c => normalize(c.phone_number)).forEach(group => {
    group.forEach(c => add({
      rule: 'duplicate-phone', severity: 'medium', candidateId: c.id,
      title: 'Phone number shared by several candidates',
      detail: `${nameOf(c)} uses the same phone number as ${group.filter(o => o.id !== c.id).map(nameOf).join(', ')}.`,
    }));
  });

  candidates.forEach(c => {
    const imageReports: Array<[string, Candidate['profile_image_scan_report']]> = [
      ['profile photo', c.profile_image_scan_report],
      ['passport image', c.passport_image_scan_report],
    ];
    imageReports.forEach(([label, report]) => {
      if (report?.status === 'review') {
        add({ rule: 'candidate-image-review', severity: 'medium', candidateId: c.id, title: 'Candidate image needs compliance review', detail: `${nameOf(c)}: the ${label} upload was flagged for review. ${report.findings.join(' ')}` });
      }
    });

    const candidateStages = stagesOf(c.id);
    const deployed = candidateStages.some(s => s.stage_id === DEPLOYMENT_STAGE && DONE.has(s.status)) || !!c.arrival;
    const age = ageAt(c.dob, now);
    if (Number.isFinite(age) && age < 18) {
      add({ rule: 'underage', severity: 'critical', candidateId: c.id, title: 'Candidate is under 18', detail: `${nameOf(c)} is ${Math.floor(age)} years old according to the date of birth on file.` });
    } else if (Number.isFinite(age) && age > 60) {
      add({ rule: 'implausible-age', severity: 'low', candidateId: c.id, title: 'Unusual age', detail: `${nameOf(c)} is ${Math.floor(age)} years old. Check the date of birth.` });
    }

    const completed = candidateStages.filter(s => DONE.has(s.status)).map(s => ordinalOf(s.stage_id));
    const highest = completed.length ? Math.max(...completed) : 0;
    ALL_STAGES.filter(stage => stage.ordinal < highest).forEach(stage => {
      const record = candidateStages.find(s => s.stage_id === stage.id);
      if (!record || !DONE.has(record.status)) {
        add({ key: stage.id, rule: 'skipped-stage', severity: 'high', candidateId: c.id, title: 'Stage skipped', detail: `${nameOf(c)} is past a later stage but "${stage.title}" was never completed.` });
      }
    });

    candidateStages.filter(s => DONE.has(s.status)).forEach(s => {
      const fee = stageFees[s.stage_id] ?? 0;
      if (fee > 0 && !paymentStatuses.some(p => p.candidateId === c.id && p.stageId === s.stage_id && p.isPaid)) {
        const title = ALL_STAGES.find(stage => stage.id === s.stage_id)?.title ?? `Stage ${s.stage_id}`;
        add({ key: s.stage_id, rule: 'stage-without-payment', severity: 'high', candidateId: c.id, title: 'Stage passed without recorded payment', detail: `${nameOf(c)} passed "${title}" but no payment is recorded for it (fee ${fee}).` });
      }
    });

    const results = medicals.filter(m => m.candidate_id === c.id);
    if (deployed) {
      const latestFinal = [...results].sort((a, b) => String(b.exam_date).localeCompare(String(a.exam_date)));
      const failing = results.some(m => m.status === 'Failed') && !latestFinal.some(m => m.status === 'Passed');
      if (failing) {
        add({ rule: 'deployed-medical-failed', severity: 'critical', candidateId: c.id, title: 'Deployed with a failed medical', detail: `${nameOf(c)} is deployed but has failed medical results and no passing one.` });
      } else if (!results.some(m => m.status === 'Passed')) {
        add({ rule: 'deployed-no-medical', severity: 'high', candidateId: c.id, title: 'Deployed without a passed medical', detail: `${nameOf(c)} is deployed but has no passed medical result on file.` });
      }
    }

    if (c.arrival && c.arrival.confirmed_by !== 'candidate') {
      add({ rule: 'arrival-override', severity: 'low', candidateId: c.id, title: 'Arrival confirmed on the candidate\'s behalf', detail: `${nameOf(c)}'s arrival was confirmed by ${c.arrival.confirmed_by}, not by the candidate.` });
    }

    const reachedTraining = candidateStages.some(s => s.stage_id !== ALL_STAGES[0].id && DONE.has(s.status));
    if (c.elmis?.status === 'mismatch') {
      add({ rule: 'elmis-mismatch', severity: 'high', candidateId: c.id, title: 'ELMIS record does not match', detail: `${nameOf(c)}: ${c.elmis.mismatches?.join(', ') || 'details differ from the ELMIS registration'}.` });
    } else if (c.elmis?.status === 'not_found') {
      add({ rule: 'elmis-not-found', severity: 'high', candidateId: c.id, title: 'Not registered in ELMIS', detail: `${nameOf(c)} could not be found in ELMIS.` });
    } else if (reachedTraining && c.elmis?.status !== 'verified') {
      add({ rule: 'elmis-unverified', severity: 'medium', candidateId: c.id, title: 'Not verified in ELMIS', detail: `${nameOf(c)} has progressed beyond registration without an ELMIS verification.` });
    }

    const stageRecord = (stageId: number) => candidateStages.find(s => s.stage_id === stageId);
    const stageTitle = (stageId: number) => ALL_STAGES.find(stage => stage.id === stageId)?.title ?? `Stage ${stageId}`;
    const doneStages = candidateStages.filter(s => DONE.has(s.status));

    doneStages.forEach(s => {
      if (time(s.date) > now + DAY) {
        add({ key: s.stage_id, rule: 'future-dated-stage', severity: 'high', candidateId: c.id, title: 'Stage completed on a future date', detail: `${nameOf(c)}: "${stageTitle(s.stage_id)}" is marked complete on ${s.date?.slice(0, 10)}, which has not happened yet.` });
      }
      if (time(s.date) < time(c.created_at) - 30 * DAY) {
        add({ key: s.stage_id, rule: 'stage-before-registration', severity: 'medium', candidateId: c.id, title: 'Stage dated before the candidate was registered', detail: `${nameOf(c)}: "${stageTitle(s.stage_id)}" is dated ${s.date?.slice(0, 10)}, well before the record was created.` });
      }
    });
    const dated = ALL_STAGES.map(stage => ({ stage, record: stageRecord(stage.id) })).filter(x => x.record && DONE.has(x.record.status) && Number.isFinite(time(x.record.date)));
    for (let i = 1; i < dated.length; i += 1) {
      if (time(dated[i].record!.date) < time(dated[i - 1].record!.date)) {
        add({ key: dated[i].stage.id, rule: 'stage-date-order', severity: 'high', candidateId: c.id, title: 'Stage dates out of order', detail: `${nameOf(c)}: "${dated[i].stage.title}" is dated before "${dated[i - 1].stage.title}".` });
      }
    }
    candidateStages.filter(s => s.status === 'In Progress' && now - time(s.updated_at) > 120 * DAY).forEach(s => {
      add({ key: s.stage_id, rule: 'stale-stage', severity: 'low', candidateId: c.id, title: 'Stage stuck in progress', detail: `${nameOf(c)}: "${stageTitle(s.stage_id)}" has not been updated for over 120 days.` });
    });

    const trainingId = ALL_STAGES.find(stage => stage.slug === 'training')?.id;
    if (trainingId && !c.coc_facility_id && candidateStages.some(s => s.stage_id === trainingId && (DONE.has(s.status) || s.status === 'In Progress'))) {
      add({ rule: 'training-no-center', severity: 'medium', candidateId: c.id, title: 'Training without a CoC center', detail: `${nameOf(c)} is in or past CoC training but no CoC training center is assigned.` });
    }
    if (!c.local_agency_id) {
      add({ rule: 'no-local-agency', severity: 'medium', candidateId: c.id, title: 'No local agency responsible', detail: `${nameOf(c)} is not linked to a local agency, so nobody is accountable for the file.` });
    }
    if (deployed && !c.foreign_agency_id) {
      add({ rule: 'deployed-no-foreign-agency', severity: 'high', candidateId: c.id, title: 'Deployed without a foreign agency', detail: `${nameOf(c)} is deployed but no foreign agency is on record.` });
    }
    if (deployed && c.visa?.status !== 'validated') {
      add({ rule: 'deployed-visa-not-validated', severity: 'critical', candidateId: c.id, title: 'Deployed without a validated visa', detail: `${nameOf(c)} is deployed but the visa is ${c.visa ? c.visa.status.replace('_', ' ') : 'not on record'}.` });
    }
    if (deployed && c.visa?.status === 'validated' && !(c.clearance?.enjaz?.status === 'completed' && c.clearance?.tasheer?.status === 'completed')) {
      add({ rule: 'deployed-not-cleared', severity: 'high', candidateId: c.id, title: 'Deployed without Enjaz and Tasheer clearance', detail: `${nameOf(c)} is deployed but digital clearance is incomplete.` });
    }
    if (c.visa?.status === 'validated' && c.visa.expiry_date) {
      const left = (time(c.visa.expiry_date) - now) / DAY;
      if (left < 0 && !deployed) add({ rule: 'visa-expired', severity: 'high', candidateId: c.id, title: 'Visa expired before deployment', detail: `${nameOf(c)}'s visa expired on ${c.visa.expiry_date.slice(0, 10)}.` });
      else if (left >= 0 && left <= 30 && !deployed) add({ rule: 'visa-expiring', severity: 'medium', candidateId: c.id, title: 'Visa expires within 30 days', detail: `${nameOf(c)}'s visa expires on ${c.visa.expiry_date.slice(0, 10)} and the candidate has not departed.` });
    }
    if (c.visa && ['mismatch', 'cancelled'].includes(c.visa.status)) {
      add({ rule: 'visa-problem', severity: 'high', candidateId: c.id, title: `Visa ${c.visa.status}`, detail: `${nameOf(c)}: ${c.visa.mismatches?.join(', ') || c.visa.message || `the visa check returned "${c.visa.status}".`}` });
    }
    const departure = stageRecord(DEPLOYMENT_STAGE);
    if (c.arrival && departure && DONE.has(departure.status) && time(c.arrival.arrived_at) < time(departure.date)) {
      add({ rule: 'arrival-before-departure', severity: 'high', candidateId: c.id, title: 'Arrival recorded before departure', detail: `${nameOf(c)} is recorded as arrived on ${c.arrival.arrived_at.slice(0, 10)}, before the departure date.` });
    }
    if (deployed && !c.passport_image_url) {
      add({ rule: 'deployed-no-passport-image', severity: 'medium', candidateId: c.id, title: 'No passport image on file', detail: `${nameOf(c)} is deployed but the passport scan is missing.` });
    }
    if (!c.phone_number && !c.email) {
      add({ rule: 'no-contact', severity: 'low', candidateId: c.id, title: 'No contact details', detail: `${nameOf(c)} has neither a phone number nor an email.` });
    }
    if (!c.emergency_contact?.phone) {
      add({ rule: 'no-emergency-contact', severity: 'low', candidateId: c.id, title: 'No emergency contact', detail: `${nameOf(c)} has no emergency contact on file.` });
    }
    if (c.external_status?.work_contract && !c.employer?.phone) {
      add({ rule: 'contract-no-employer-contact', severity: 'medium', candidateId: c.id, title: 'Contract received but no employer contact', detail: `${nameOf(c)} has a work contract but nobody to call at the employer in an emergency.` });
    }
    if (c.passport_number && !/^[A-Z0-9]{6,10}$/.test(normalize(c.passport_number))) {
      add({ rule: 'passport-format', severity: 'medium', candidateId: c.id, title: 'Unusual passport number format', detail: `${nameOf(c)}'s passport "${c.passport_number}" is not 6-10 letters or digits.` });
    }
    if (c.return_status !== 'returned' && c.expected_return_date && time(c.expected_return_date) < now - 30 * DAY && deployed) {
      add({ rule: 'return-overdue', severity: 'medium', candidateId: c.id, title: 'Return overdue', detail: `${nameOf(c)} was expected back on ${c.expected_return_date.slice(0, 10)} and no return is recorded.` });
    }

    results.forEach(m => {
      if (m.status !== 'Pending' && !m.exam_date) add({ key: m.id, rule: 'medical-no-date', severity: 'low', candidateId: c.id, title: 'Medical result without an exam date', detail: `${nameOf(c)}: ${m.exam_type} is ${m.status} but has no exam date.` });
      if (time(m.exam_date) > now + DAY) add({ key: m.id, rule: 'medical-future-date', severity: 'high', candidateId: c.id, title: 'Medical dated in the future', detail: `${nameOf(c)}: ${m.exam_type} is dated ${m.exam_date?.slice(0, 10)}.` });
      if (m.status === 'Pending' && now - time(m.exam_date) > 60 * DAY) add({ key: m.id, rule: 'medical-stale', severity: 'low', candidateId: c.id, title: 'Medical pending for over 60 days', detail: `${nameOf(c)}: ${m.exam_type} has been pending since ${m.exam_date?.slice(0, 10)}.` });
    });
    const medicalStage = stageRecord(ALL_STAGES.find(stage => stage.slug === 'medical')!.id);
    if (medicalStage && DONE.has(medicalStage.status) && results.some(m => m.status === 'Failed') && !results.some(m => m.status === 'Passed')) {
      add({ rule: 'medical-stage-failed-results', severity: 'critical', candidateId: c.id, title: 'Medical stage passed despite failed results', detail: `${nameOf(c)}: the Medical Check stage is passed but every recorded exam failed.` });
    }
    const lastExam = results.map(m => time(m.exam_date)).filter(Number.isFinite).sort((a, b) => b - a)[0];
    if (departure && DONE.has(departure.status) && Number.isFinite(lastExam) && Number.isFinite(time(departure.date)) && time(departure.date) - lastExam > 180 * DAY) {
      add({ rule: 'medical-expired-at-departure', severity: 'high', candidateId: c.id, title: 'Medical older than 6 months at departure', detail: `${nameOf(c)} departed more than 180 days after the latest medical exam.` });
    }
  });

  documents.filter(document => document.scan_report?.status === 'review').forEach(document => {
    const candidate = candidates.find(item => item.id === document.candidate_id);
    add({
      rule: 'document-review-flag',
      severity: 'high',
      candidateId: document.candidate_id,
      title: 'Uploaded document flagged for review',
      detail: `${candidate ? nameOf(candidate) : 'Candidate'}: ${document.file_name}. ${document.scan_report?.findings.join(' ') ?? ''}`,
    });
  });

  groupDuplicates(payments, p => (p.provider_reference ?? '').trim().toLowerCase()).forEach(group => {
    group.forEach(p => add({ rule: 'duplicate-payment-reference', severity: 'critical', paymentId: p.id, title: 'Payment reference reused', detail: `Reference ${p.provider_reference} appears on ${group.length} payments. A receipt may have been reused.` }));
  });
  groupDuplicates(payments, p => (p.receipt_number ?? '').trim().toLowerCase()).forEach(group => {
    group.forEach(p => add({ rule: 'duplicate-receipt', severity: 'high', paymentId: p.id, title: 'Receipt number reused', detail: `Receipt ${p.receipt_number} appears on ${group.length} payments.` }));
  });


  groupDuplicates(candidates, c => `${nameOf(c).toLowerCase()}|${c.dob}`).forEach(group => {
    group.forEach(c => add({ rule: 'duplicate-identity', severity: 'high', candidateId: c.id, title: 'Same name and date of birth registered twice', detail: `${nameOf(c)} (${c.dob}) appears ${group.length} times. Check for a duplicate registration under another passport.` }));
  });
  groupDuplicates(candidates, c => (c.email ?? '').trim().toLowerCase()).forEach(group => {
    group.forEach(c => add({ rule: 'duplicate-email', severity: 'medium', candidateId: c.id, title: 'Email shared by several candidates', detail: `${nameOf(c)} uses the same email as ${group.filter(o => o.id !== c.id).map(nameOf).join(', ')}.` }));
  });

  const candidateById = new Map(candidates.map(c => [c.id, c]));
  const localCounts = new Map<string, number>();
  candidates.forEach(c => { if (c.local_agency_id) localCounts.set(c.local_agency_id, (localCounts.get(c.local_agency_id) ?? 0) + 1); });
  localCounts.forEach((count, agencyId) => {
    if (candidates.length >= 20 && count / candidates.length > 0.6) {
      add({ rule: 'agency-concentration', severity: 'medium', actor: agencyId, title: 'One local agency holds most candidates', detail: `A single local agency manages ${Math.round((count / candidates.length) * 100)}% of all candidates. Review for steering of candidates.` });
    }
  });

  payments.forEach(p => {
    if (time(p.created_at) > now + DAY) add({ rule: 'payment-future', severity: 'high', paymentId: p.id, title: 'Payment dated in the future', detail: `Payment of ${p.amount} ${p.currency} is dated ${p.created_at.slice(0, 10)}.` });
    const covered = p.candidate_ids.map(id => candidateById.get(id)).filter((c): c is Candidate => !!c);
    if (!isForeignPayment(p) && p.payer_candidate_id && !p.candidate_ids.includes(p.payer_candidate_id)) {
      add({ rule: 'payer-not-candidate', severity: 'high', paymentId: p.id, title: 'Candidate fee paid by someone else', detail: `Payment ${p.id.slice(0, 8)} was paid by a different candidate than the one it covers.` });
    }
    covered.forEach(c => {
      if (isForeignPayment(p) && c.foreign_agency_id && p.payer_foreign_agency_id && c.foreign_agency_id !== p.payer_foreign_agency_id) {
        add({ key: c.id, rule: 'payer-agency-mismatch', severity: 'high', paymentId: p.id, title: 'Paid by an agency not linked to the candidate', detail: `Payment ${p.id.slice(0, 8)} covers ${nameOf(c)} but the payer is not the candidate's foreign agency.` });
      }
      if (c.local_agency_id && p.payee_local_agency_id && c.local_agency_id !== p.payee_local_agency_id) {
        add({ key: c.id, rule: 'payee-agency-mismatch', severity: 'high', paymentId: p.id, title: 'Paid to an agency not managing the candidate', detail: `Payment ${p.id.slice(0, 8)} covers ${nameOf(c)} but went to a different local agency.` });
      }
      if (time(p.created_at) < time(c.created_at) - DAY) {
        add({ key: c.id, rule: 'payment-before-registration', severity: 'medium', paymentId: p.id, title: 'Payment predates the candidate record', detail: `Payment ${p.id.slice(0, 8)} is older than ${nameOf(c)}'s registration.` });
      }
    });
    if (isForeignPayment(p)) {
        const issue = checkForeignPayment(p, candidates);
      if (issue) {
        const meta = {
          etb: { rule: 'foreign-payment-etb', severity: 'critical' as const, title: 'Foreign agency payment made in ETB' },
          'wrong-currency': { rule: 'foreign-payment-currency', severity: 'high' as const, title: 'Foreign agency payment in the wrong currency' },
          'below-minimum': { rule: 'foreign-payment-below-minimum', severity: 'high' as const, title: 'Foreign agency payment below the regulated minimum' },
        }[issue.issue];
        add({ ...meta, paymentId: p.id, detail: `Payment of ${p.amount} ${p.currency}: ${issue.message}` });
      }
    }
    const fee = p.stage_id && !isForeignPayment(p) ? stageFees[p.stage_id] : undefined;
    if (fee && p.status === 'succeeded' && p.candidate_ids.length === 1 && Math.abs(p.amount - fee) > fee * 0.25) {
      add({ rule: 'fee-mismatch', severity: 'medium', paymentId: p.id, title: 'Payment differs from the stage fee', detail: `${p.amount} ${p.currency} was paid for a stage with a fee of ${fee}.` });
    }
    if (p.status === 'succeeded' && !p.provider_reference?.trim() && p.provider !== 'manual') {
      add({ rule: 'payment-no-reference', severity: 'medium', paymentId: p.id, title: 'Online payment without a provider reference', detail: `Payment of ${p.amount} ${p.currency} succeeded with no provider reference to reconcile.` });
    }
    if (p.status === 'refunded') {
      add({ rule: 'refund', severity: 'low', paymentId: p.id, title: 'Refunded payment', detail: `Payment of ${p.amount} ${p.currency} was refunded. Confirm the reason.` });
    }
  });

  const amountGroup = (payment: Payment) => `${payment.currency.toUpperCase()}:${isForeignPayment(payment) ? 'foreign' : `candidate:${payment.stage_id ?? 'unassigned'}`}`;
  const amountsByCurrency = new Map<string, number[]>();
  payments.filter(p => p.status === 'succeeded').forEach(p => {
    const currency = amountGroup(p);
    amountsByCurrency.set(currency, [...(amountsByCurrency.get(currency) ?? []), p.amount]);
  });
  const typicalByCurrency = new Map(
    [...amountsByCurrency].map(([currency, amounts]) => [currency, amounts.length >= 5 ? median(amounts) : 0]),
  );
  payments.forEach(p => {
    if (p.provider === 'manual' && !(p.provider_reference ?? '').trim()) {
      add({ rule: 'manual-no-reference', severity: 'high', paymentId: p.id, title: 'Offline payment without a reference', detail: `Manual payment of ${p.amount} ${p.currency} has no bank or receipt reference.` });
    }
    if (p.status === 'succeeded' && p.candidate_ids.length === 0) {
      add({ rule: 'payment-no-candidate', severity: 'high', paymentId: p.id, title: 'Payment not linked to a candidate', detail: `Payment of ${p.amount} ${p.currency} succeeded but covers no candidate.` });
    }
    const typical = typicalByCurrency.get(amountGroup(p)) ?? 0;
    if (typical > 0 && p.status === 'succeeded' && p.amount > typical * 3) {
      add({ rule: 'payment-outlier', severity: 'medium', paymentId: p.id, title: 'Unusually large payment', detail: `${p.amount} ${p.currency} is more than 3x the typical payment for this payment flow and stage (${typical}).` });
    }
    if (p.provider === 'manual' && p.status === 'succeeded' && p.amount % 1000 === 0 && p.amount >= 10000 && !p.receipt_number) {
      add({ rule: 'round-manual-payment', severity: 'low', paymentId: p.id, title: 'Large round-number offline payment', detail: `${p.amount} ${p.currency} was recorded offline with no receipt number.` });
    }
  });

  const byActor = new Map<string, ApprovalLog[]>();
  logs.forEach(l => byActor.set(l.actor_email, [...(byActor.get(l.actor_email) ?? []), l]));
  byActor.forEach((entries, actor) => {
    const afterHours = entries.filter(l => { const h = new Date(l.timestamp).getHours(); return h >= 22 || h < 5; });
    if (afterHours.length >= 3) {
      add({ rule: 'after-hours-activity', severity: 'medium', actor, title: 'Repeated after-hours changes', detail: `${actor} made ${afterHours.length} changes between 22:00 and 05:00.` });
    }
    const stageChanges = entries.filter(l => l.target_type === 'Candidate' && /stage/i.test(l.description)).map(l => new Date(l.timestamp).getTime()).sort((a, b) => a - b);
    for (let i = 0; i + 9 < stageChanges.length; i += 1) {
      if (stageChanges[i + 9] - stageChanges[i] <= 10 * 60_000) {
        add({ rule: 'bulk-stage-changes', severity: 'high', actor, title: 'Burst of stage changes', detail: `${actor} changed 10 or more candidate stages within 10 minutes.` });
        break;
      }
    }

    const weekend = entries.filter(l => [0, 6].includes(new Date(l.timestamp).getDay()));
    if (weekend.length >= 8) {
      add({ rule: 'weekend-activity', severity: 'low', actor, title: 'Heavy weekend activity', detail: `${actor} made ${weekend.length} changes on weekends.` });
    }
    const configChanges = entries.filter(l => l.target_type === 'Config');
    if (configChanges.length >= 5) {
      add({ rule: 'config-churn', severity: 'medium', actor, title: 'Frequent configuration changes', detail: `${actor} changed settings ${configChanges.length} times.` });
    }
    const paymentEdits = entries.filter(l => l.target_type === 'Payment' && ['Updated', 'Deleted'].includes(l.action));
    if (paymentEdits.length >= 3) {
      add({ rule: 'payment-edits', severity: 'high', actor, title: 'Payments edited or deleted', detail: `${actor} edited or deleted ${paymentEdits.length} payment records.` });
    }
    const overrides = entries.filter(l => l.target_type === 'IntegrityOverride');
    if (overrides.length >= 5) {
      add({ rule: 'frequent-overrides', severity: 'high', actor, title: 'Many integrity flags overridden', detail: `${actor} overrode ${overrides.length} integrity findings. An auditor should review the reasons.` });
    }
    const deletes = entries.filter(l => l.action === 'Deleted');
    if (deletes.length >= 3) {
      add({ rule: 'repeated-deletions', severity: 'medium', actor, title: 'Repeated deletions', detail: `${actor} deleted ${deletes.length} records.` });
    }
  });

  logs.filter(l => l.target_type === 'StaffUser' && l.action === 'Approved' && l.actor_id && l.actor_id === l.target_id).forEach(l => {
    add({ key: l.id, rule: 'self-approval', severity: 'critical', actor: l.actor_email, title: 'User approved their own account', detail: `${l.actor_email} approved or elevated their own access on ${l.timestamp.slice(0, 10)}.` });
  });
  const superadminDeletes = logs.filter(l => l.target_type === 'Candidate' && l.action === 'Deleted');
  if (superadminDeletes.length >= 5) {
    add({ rule: 'candidate-deletions', severity: 'high', title: 'Candidate records deleted', detail: `${superadminDeletes.length} candidate records have been deleted. Deleting records can hide fraud.` });
  }

  return findings;
};

// Small portfolios are scored linearly. For larger ones the score decays smoothly so that a few flags among hundreds of
// candidates do not read the same as a systemic problem.
export const riskScore = (findings: Finding[], population = 0): number => {
  const total = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  if (population <= 25) return Math.max(0, 100 - total);
  return Math.round(100 * Math.exp(-total / (25 * (population / 10))));
};

export const countBySeverity = (findings: Finding[]): Record<Severity, number> =>
  findings.reduce<Record<Severity, number>>((acc, f) => { acc[f.severity] += 1; return acc; }, { critical: 0, high: 0, medium: 0, low: 0 });

export type IntegrityScoreLevel = 'green' | 'yellow' | 'red';
export const DEFAULT_INTEGRITY_SCORE_THRESHOLDS = { greenMin: 85, yellowMin: 60 } as const;

export const getIntegrityScoreLevel = (
  score: number,
  thresholds: { greenMin: number; yellowMin: number } = DEFAULT_INTEGRITY_SCORE_THRESHOLDS,
): IntegrityScoreLevel => score >= thresholds.greenMin ? 'green' : score >= thresholds.yellowMin ? 'yellow' : 'red';

export interface OverrideSummary { active: Finding[]; overridden: Array<{ finding: Finding; override: IntegrityOverride }>; }

// Overridden findings stay visible to auditors but no longer count toward the score.
export const applyOverrides = (findings: Finding[], overrides: IntegrityOverride[]): OverrideSummary => {
  const live = new Map(overrides.filter(o => !o.revoked_at).map(o => [o.finding_id, o]));
  const summary: OverrideSummary = { active: [], overridden: [] };
  findings.forEach(finding => {
    const override = live.get(finding.id);
    if (override) summary.overridden.push({ finding, override });
    else summary.active.push(finding);
  });
  return summary;
};
