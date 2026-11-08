import {
  initializeDataStore, getDocuments, saveDocuments, getApprovalLogs, getCandidateStages, getCandidates, getCocFacilities, getConfig, getForeignAgencies, getLocalAgencies, getMedicalResults,
  getPaymentStatuses, getPayments, saveApprovalLogs, saveCandidateStages, saveCandidates, saveCocFacilities, saveConfig, saveForeignAgencies,
  saveLocalAgencies, saveMedicalResults, savePaymentStatuses, savePayments, getStaffUsers, saveStaffUsers,
} from './data-store';
import { clearDemoStorage, getDemoScenario, isDemoMode, setDemoScenario, type DemoScenario } from './demo-mode';
import { DEMO_PREFIX, buildMergedStore, isDemoLoaded, demoConfigPatch, generateDemoDataset } from './demo-dataset';
import { ensureDemoBankEvidence } from './demo-bank-evidence';

const isDemoId = (id: string) => id.startsWith(DEMO_PREFIX);

export const loadDemoData = (scenario: DemoScenario = getDemoScenario()): { candidates: number } => {
  if (!isDemoMode()) throw new Error('Synthetic demo data can only be loaded in the demo sandbox.');
  const demo = generateDemoDataset(Date.now(), scenario);
  const priorStages = getCandidateStages().filter(stage => !isDemoId(stage.candidate_id));
  saveCocFacilities(buildMergedStore(getCocFacilities(), demo.cocFacilities));
  saveLocalAgencies(buildMergedStore(getLocalAgencies(), demo.localAgencies));
  saveForeignAgencies(buildMergedStore(getForeignAgencies(), demo.foreignAgencies));
  saveConfig(demoConfigPatch(getConfig(), demo));
  saveStaffUsers(buildMergedStore(getStaffUsers(), demo.staffUsers));
  // Parents are written before their children so the server accepts the foreign keys.
  saveCandidates(buildMergedStore(getCandidates(), demo.candidates));
  saveMedicalResults(buildMergedStore(getMedicalResults(), demo.medicals));
  saveDocuments(buildMergedStore(getDocuments(), demo.documents));
  savePayments(buildMergedStore(getPayments(), demo.payments));
  savePaymentStatuses([...getPaymentStatuses().filter(p => !isDemoId(p.candidateId)), ...demo.paymentStatuses]);
  saveCandidateStages([...priorStages, ...demo.stages]);
  saveApprovalLogs(buildMergedStore(getApprovalLogs(), demo.logs));
  ensureDemoBankEvidence();
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
  return { candidates: demo.candidates.length };
};

export const applyDemoScenario = (scenario: DemoScenario): void => {
  if (!isDemoMode()) throw new Error('Operational scenarios are only available in the demo sandbox.');
  setDemoScenario(scenario);
  clearDemoStorage();
  loadDemoData(scenario);
  initializeDataStore();
  sessionStorage.setItem(VERSION_KEY, DEMO_VERSION);
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
};

export const removeDemoData = (): void => {
  const remainingStages = getCandidateStages().filter(stage => !isDemoId(stage.candidate_id));
  saveCandidates(getCandidates().filter(candidate => !isDemoId(candidate.id)));
  savePaymentStatuses(getPaymentStatuses().filter(p => !isDemoId(p.candidateId)));
  savePayments(getPayments().filter(p => !isDemoId(p.id)));
  saveMedicalResults(getMedicalResults().filter(m => !isDemoId(m.id)));
  saveDocuments(getDocuments().filter(d => !isDemoId(d.id)));
  saveCandidateStages(remainingStages);
  saveApprovalLogs(getApprovalLogs().filter(l => !isDemoId(l.id)));
  saveCocFacilities(getCocFacilities().filter(c => !isDemoId(c.id)));
  saveLocalAgencies(getLocalAgencies().filter(a => !isDemoId(a.id)));
  saveForeignAgencies(getForeignAgencies().filter(a => !isDemoId(a.id)));
  saveStaffUsers(getStaffUsers().filter(u => !isDemoId(u.id)));
  const config = getConfig();
  saveConfig({
    ...config,
    cocFacilities: config.cocFacilities.filter(c => !isDemoId(c.id)),
    localAgencies: config.localAgencies.filter(a => !isDemoId(a.id)),
    foreignAgencies: config.foreignAgencies.filter(a => !isDemoId(a.id)),
  });
  window.dispatchEvent(new CustomEvent('supabase-data-changed'));
};

// Fills the isolated demo storage the first time a demo tab starts.
// Bump when the demo data shape changes so open demo tabs rebuild their sandbox.
const DEMO_VERSION = '12';
const VERSION_KEY = 'dawm_demo_version';
const PARTNERSHIPS_KEY = 'dawm_demo_partnerships_initialized';
const WORKFLOW_EXAMPLES_KEY = 'dawm_demo_workflow_examples_v1';

const ensureDemoWorkflowExamples = () => {
  if (localStorage.getItem(WORKFLOW_EXAMPLES_KEY)) return;
  const generated = generateDemoDataset(Date.now(), getDemoScenario());
  const candidates = getCandidates();
  const stages = getCandidateStages();
  const sampleById = new Map(generated.candidates.filter(candidate => candidate.clearance?.local_ready_at).map(candidate => [candidate.id, candidate]));
  saveCandidates(candidates.map(candidate => {
    const sample = sampleById.get(candidate.id);
    const own = stages.filter(stage => stage.candidate_id === candidate.id);
    const localChecksDone = [1, 3, 2].every(id => own.some(stage => stage.stage_id === id && ['Completed', 'Passed', 'Issued'].includes(stage.status)));
    return sample && localChecksDone && !candidate.clearance?.local_ready_at && !candidate.clearance?.labour_ministry
      && own.some(stage => stage.stage_id === 4 && stage.status === 'In Progress')
      ? { ...candidate, clearance: sample.clearance } : candidate;
  }));
  const payments = getPayments();
  const existingIds = new Set(payments.map(payment => payment.id));
  const attempts = generated.payments.filter(payment => payment.status === 'failed' || payment.status === 'refunded')
    .filter(payment => !payments.some(existing => existing.id === payment.id && existing.status === payment.status))
    .map(payment => ({ ...payment, id: `${payment.id}-checkout-sample`, provider_reference: `${payment.provider_reference}-SAMPLE`, receipt_number: `${payment.receipt_number}-SAMPLE` }))
    .filter(payment => !existingIds.has(payment.id));
  savePayments([...payments, ...attempts]);
  localStorage.setItem(WORKFLOW_EXAMPLES_KEY, '1');
};

const ensureDemoPartnerships = () => {
  if (localStorage.getItem(PARTNERSHIPS_KEY)) return;
  const config = getConfig();
  const current = config.agencyPartnerships ?? [];
  if (!current.some(item => isDemoId(item.local_agency_id) || isDemoId(item.foreign_agency_id))) {
    const locals = getLocalAgencies().filter(agency => isDemoId(agency.id));
    const foreigns = getForeignAgencies().filter(agency => isDemoId(agency.id));
    saveConfig({ ...config, agencyPartnerships: [...current, ...locals.flatMap(local => foreigns.map(foreign => ({
      local_agency_id: local.id, foreign_agency_id: foreign.id, status: 'active' as const,
      agreement_reference: 'Demo partnership', started_at: local.created_at,
    })))] });
  }
  localStorage.setItem(PARTNERSHIPS_KEY, '1');
};

export const repairDemoStagePlaceholders = (): number => {
  if (!isDemoMode()) return 0;
  const stages = getCandidateStages();
  const candidates = getCandidates();
  const affected = new Set(candidates.filter(candidate => isDemoId(candidate.id)).filter(candidate => {
    const own = stages.filter(stage => stage.candidate_id === candidate.id);
    return own.length === 4 && own.every(stage => !isDemoId(stage.id) && !stage.notes && !stage.date && !stage.reference_id
      && !stage.assigned_staff_id && !stage.follow_up_due_at && stage.status === 'Pending');
  }).map(candidate => candidate.id));
  if (!affected.size) return 0;
  const generated = generateDemoDataset(Date.now(), getDemoScenario());
  const generatedById = new Map(generated.candidates.map(candidate => [candidate.id, candidate]));
  saveCandidates(candidates.map(candidate => {
    const replacement = affected.has(candidate.id) ? generatedById.get(candidate.id) : undefined;
    return replacement?.clearance?.local_ready_at && !candidate.clearance?.labour_ministry
      ? { ...candidate, clearance: replacement.clearance } : candidate;
  }));
  saveCandidateStages([...stages.filter(stage => !affected.has(stage.candidate_id)), ...generated.stages.filter(stage => affected.has(stage.candidate_id))]);
  return affected.size;
};

export const bootDemo = () => {
  if (!isDemoMode()) return;
  const current = sessionStorage.getItem(VERSION_KEY) === DEMO_VERSION;
  if (current && isDemoLoaded(getCandidates())) { repairDemoStagePlaceholders(); ensureDemoWorkflowExamples(); ensureDemoPartnerships(); ensureDemoBankEvidence(); return; }
  sessionStorage.setItem(VERSION_KEY, DEMO_VERSION);
  clearDemoStorage();
  loadDemoData(getDemoScenario());
  initializeDataStore();
  ensureDemoPartnerships();
};
