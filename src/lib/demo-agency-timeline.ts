import { ALL_STAGES } from './types';
import { stageFeeCovered, stageIsComplete } from './stage-readiness';
import type { DemoDataset } from './demo-dataset';

export function backtrackDemoAgencyTimelines(data: DemoDataset, pauses: ReadonlyMap<string, string>, fees: Record<number, number>): void {
  for (const [agencyId, cutoff] of pauses) {
    if (!agencyId || !Number.isFinite(Date.parse(cutoff))) throw new Error('DEMO agency pause requires an agency and a valid recorded decision date.');
  }
  const after = (value: string | undefined, cutoff: string) => !!value && Date.parse(value) > Date.parse(cutoff);
  const atPause = (value: string, cutoff: string) => after(value, cutoff) ? cutoff : value;
  const affected = new Map(data.candidates.flatMap(candidate => {
    const cutoff = candidate.foreign_agency_id && pauses.get(candidate.foreign_agency_id);
    return cutoff ? [[candidate.id, cutoff] as const] : [];
  }));
  if (!affected.size) return;
  data.stages = data.stages.map(stage => {
    const cutoff = affected.get(stage.candidate_id);
    if (!cutoff) return stage;
    return {
      ...stage, updated_at: atPause(stage.updated_at, cutoff),
      ...(after(stage.date, cutoff) || !stage.date && after(stage.updated_at, cutoff) && stage.status !== 'Pending'
        ? { status: 'Pending' as const, date: undefined, reference_id: undefined } : {}),
    };
  });
  for (const candidate of data.candidates) {
    const cutoff = affected.get(candidate.id);
    if (!cutoff) continue;
    const stages = ALL_STAGES.map(definition => data.stages.find(stage => stage.candidate_id === candidate.id && stage.stage_id === definition.id));
    const unfinished = stages.findIndex(stage => !stage || !stageIsComplete(stage.status));
    const reached = unfinished < 0 ? ALL_STAGES.length : unfinished;
    stages.forEach((stage, index) => {
      if (stage && index > reached) {
        stage.status = 'Pending'; stage.date = undefined; stage.reference_id = undefined;
      }
    });
    const contract = candidate.work_contract_record;
    if (contract && (after(contract.sent_at, cutoff) || after(contract.received_at, cutoff))) {
      candidate.work_contract_record = after(contract.sent_at, cutoff)
        ? { status: 'not-sent', note: 'DEMO: contract handoff backtracked to the agency pause.' }
        : { ...contract, status: 'sent', received_at: undefined, received_by: undefined };
    }
    if (candidate.visa && after(candidate.visa.checked_at, cutoff)) candidate.visa = undefined;
    if (candidate.clearance) {
      const clearance = candidate.clearance;
      if (after(clearance.local_ready_at, cutoff)) clearance.local_ready_at = undefined;
      for (const key of ['enjaz', 'tasheer'] as const) {
        if (clearance[key] && after(clearance[key].updated_at, cutoff)) clearance[key] = { status: 'pending', mode: 'sandbox', updated_at: cutoff };
      }
      if (reached < ALL_STAGES.length) clearance.labour_ministry = { status: 'pending', mode: 'sandbox', simulated: true,
        message: 'DEMO: deployment not completed before the agency pause; no official clearance.' };
    }
    if (after(candidate.flight?.departure_time, cutoff) || reached < ALL_STAGES.length) {
      candidate.flight = undefined; candidate.arrival = undefined;
      candidate.contract_start_date = undefined; candidate.contract_end_date = undefined;
      candidate.expected_return_date = undefined; candidate.actual_return_date = undefined;
      candidate.employment_history = undefined; candidate.return_status = 'not-planned';
    }
    candidate.external_status = { ...candidate.external_status,
      work_contract: candidate.work_contract_record?.status === 'received',
      visa: !!candidate.visa && reached >= 3, updated_at: cutoff };
    candidate.created_at = atPause(candidate.created_at, cutoff);
    candidate.updated_at = atPause(candidate.updated_at, cutoff);
    // Support and actual returns for candidates deployed before a hold stay available.
    data.documents = data.documents.filter(document => document.candidate_id !== candidate.id
      || reached === ALL_STAGES.length && document.stage_id === undefined
      || !after(document.uploaded_at, cutoff) && (document.stage_id === undefined || ALL_STAGES.findIndex(stage => stage.id === document.stage_id) <= reached));
    data.medicals = data.medicals.filter(medical => medical.candidate_id !== candidate.id || reached >= 2 && !after(medical.exam_date, cutoff));
  }
  data.payments = data.payments.filter(payment => payment.candidate_ids.every(id => {
    const cutoff = affected.get(id);
    if (!cutoff) return true;
    if (after(payment.created_at, cutoff)) return false;
    if (payment.payer_type !== 'candidate' || payment.stage_id === undefined) return true;
    const stages = ALL_STAGES.map(stage => data.stages.find(record => record.candidate_id === id && record.stage_id === stage.id));
    const current = stages.findIndex(stage => !stage || !stageIsComplete(stage.status));
    return current < 0 || ALL_STAGES.findIndex(stage => stage.id === payment.stage_id) <= current;
  })).map(payment => {
    const cutoffs = payment.candidate_ids.flatMap(id => affected.get(id) ?? []);
    const cutoff = cutoffs.sort()[0];
    return cutoff ? { ...payment, updated_at: atPause(payment.updated_at, cutoff) } : payment;
  });
  for (const candidate of data.candidates.filter(candidate => affected.has(candidate.id))) {
    const payments = data.payments.filter(payment => payment.payer_candidate_id === candidate.id);
    candidate.last_payment_id = payments.at(-1)?.id;
    const current = ALL_STAGES.find(stage => !stageIsComplete(data.stages.find(record => record.candidate_id === candidate.id && record.stage_id === stage.id)?.status ?? 'Pending'));
    candidate.payment_status = current && !stageFeeCovered(candidate, current.id, fees, data.paymentStatuses, data.payments) ? 'pending_payment' : 'paid';
    for (const flag of data.paymentStatuses.filter(flag => flag.candidateId === candidate.id)) {
      flag.isPaid = stageFeeCovered(candidate, flag.stageId, fees, data.paymentStatuses, data.payments);
    }
  }
}
