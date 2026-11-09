import type {
  AgencyPartnership, ApprovalLog, AppConfig, Candidate, CandidateStage, ClearanceRecord, CocFacility, Document, ForeignAgency, JourneyLocation, LocalAgency, MedicalResult, Payment, PaymentStatus, StageStatus, StaffUser,
} from './types';
import { ETHIOPIAN_CITIES } from './ethiopia';
import { REGION_NOT_SET, resolveEthiopianRegion } from './ethiopia-regions';
import { currencyForCountry, minimumPerCandidate } from './currency';
import { assignUnassignedStageTasks } from './staff-tasks';
import { airportForCity } from './airports';
import { demoActorIdentity, demoAgencyManager, paymentCandidateSummary, resolveActorIdentity } from './demo-identities';

// A repeatable candidate dataset for demos and testing. Everything it creates has an id starting with "demo-",
// so loading it again replaces it and removing it leaves real records untouched.
export const DEMO_PREFIX = 'demo-';
export const DEMO_CANDIDATE_COUNT = 435;
export type DemoScenario = 'priority' | 'needs-attention' | 'high-performing';

export const demoMedicalLocationFor = (candidateId: string): JourneyLocation | undefined => {
  const match = /^demo-cand-(\d+)$/.exec(candidateId);
  if (!match) return undefined;
  const index = Number(match[1]) % 4;
  return { name: `${['Addis', 'Adama', 'Hawassa', 'Bahir Dar'][index]} Health Assessment Clinic`, city: ['Addis Ababa', 'Adama', 'Hawassa', 'Bahir Dar'][index] };
};

export const demoStageLocationFor = (candidate: Candidate, stage: CandidateStage, facilities: CocFacility[]): JourneyLocation | undefined => {
  if (!/^demo-cand-\d+$/.test(candidate.id) || stage.status === 'Pending' && !stage.date) return undefined;
  if (stage.stage_id === 1 && candidate.home_city) return { name: 'Ministry registration desk', city: candidate.home_city };
  if (stage.stage_id === 2) return demoMedicalLocationFor(candidate.id);
  if (stage.stage_id === 3) {
    const facility = facilities.find(item => item.id === candidate.coc_facility_id);
    return facility ? { name: facility.name, city: facility.city, latitude: facility.latitude, longitude: facility.longitude } : undefined;
  }
  if (stage.stage_id === 4) return { name: 'Addis Ababa departure desk', city: 'Addis Ababa', latitude: 8.9779, longitude: 38.7993 };
  return undefined;
};

const DAY = 86_400_000;
const FEES: Record<number, number> = { 1: 500, 2: 2200, 3: 2000, 4: 6000 };

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const DEMO_COC_CENTERS: Array<Omit<CocFacility, 'created_at'>> = [
  { id: 'demo-coc-1', name: 'Addis Skills CoC Center', city: 'Addis Ababa', address: 'Bole Sub-city, Addis Ababa', latitude: 8.9806, longitude: 38.7578, phone_number: '+251 11 661 0001', contact_email: 'info@addisskills.example.test' },
  { id: 'demo-coc-2', name: 'Adama Technical CoC Center', city: 'Adama', address: 'Industrial Zone, Adama', latitude: 8.5400, longitude: 39.2700, phone_number: '+251 22 111 0002', contact_email: 'info@adamatech.example.test' },
  { id: 'demo-coc-3', name: 'Hawassa Competency Center', city: 'Hawassa', address: 'Tabor Sub-city, Hawassa', latitude: 7.0621, longitude: 38.4763, phone_number: '+251 46 221 0003', contact_email: 'info@hawassacoc.example.test' },
  { id: 'demo-coc-4', name: 'Bahir Dar Training Hub', city: 'Bahir Dar', address: 'Kebele 11, Bahir Dar', latitude: 11.5936, longitude: 37.3908, phone_number: '+251 58 220 0004', contact_email: 'info@bdhub.example.test' },
];

export const DEMO_LOCAL_AGENCIES: Array<Omit<LocalAgency, 'created_at'>> = [
  { id: 'demo-local-1', name: 'Habesha Overseas Employment', address: 'Bole, Addis Ababa', phone_number: '+251 11 550 0011', contact_email: 'ops@habesha-overseas.example.test' },
  { id: 'demo-local-2', name: 'Abay Manpower Services', address: 'Piassa, Addis Ababa', phone_number: '+251 11 111 0012', contact_email: 'ops@abay-manpower.example.test' },
  { id: 'demo-local-3', name: 'Rift Valley Recruitment', address: 'Adama', phone_number: '+251 22 111 0013', contact_email: 'ops@riftvalley.example.test' },
  { id: 'demo-local-4', name: 'Lalibela Workforce Agency', address: 'Bahir Dar', phone_number: '+251 58 111 0014', contact_email: 'ops@lalibela-workforce.example.test' },
];

export const DEMO_FOREIGN_AGENCIES: Array<Omit<ForeignAgency, 'created_at'>> = [
  { id: 'demo-foreign-1', name: 'Riyadh Gulf Recruitment', country_code: 'SA', address: 'Olaya St, Riyadh', phone_number: '+966 11 000 0021', contact_email: 'hire@riyadhgulf.example.test' },
  { id: 'demo-foreign-2', name: 'Emirates Talent Link', country_code: 'AE', address: 'Deira, Dubai', phone_number: '+971 4 000 0022', contact_email: 'hire@emiratestalent.example.test' },
  { id: 'demo-foreign-3', name: 'Doha Manpower Bureau', country_code: 'QA', address: 'West Bay, Doha', phone_number: '+974 4000 0023', contact_email: 'hire@dohamanpower.example.test' },
  { id: 'demo-foreign-4', name: 'Levant Workforce Partners', country_code: 'JO', address: 'Abdali, Amman', phone_number: '+962 6 000 0024', contact_email: 'hire@levantworkforce.example.test' },
];

// Each foreign agency recruits for the destinations of its region.
const DESTINATIONS: Array<Array<[string, string]>> = [
  [['Riyadh', 'Saudi Arabia'], ['Jeddah', 'Saudi Arabia'], ['Dammam', 'Saudi Arabia'], ['Medina', 'Saudi Arabia'], ['Kuwait City', 'Kuwait']],
  [['Dubai', 'United Arab Emirates'], ['Abu Dhabi', 'United Arab Emirates'], ['Muscat', 'Oman'], ['Manama', 'Bahrain']],
  [['Doha', 'Qatar'], ['Kuwait City', 'Kuwait'], ['Manama', 'Bahrain'], ['Muscat', 'Oman']],
  [['Amman', 'Jordan'], ['Beirut', 'Lebanon'], ['Cairo', 'Egypt'], ['Riyadh', 'Saudi Arabia']],
];

const RELATIONS = ['Mother', 'Father', 'Sister', 'Brother', 'Aunt', 'Uncle', 'Husband', 'Friend'];
const EMPLOYER_COMPANIES = ['Al Noor Household Services', 'Gulf Care Family Office', 'Falcon Hospitality Group', 'Desert Rose Facilities', 'Maktoum Residence Staffing', 'Pearl Coast Hotels', 'Najd Home Care', 'Skyline Cleaning Co.'];
const EMPLOYER_PEOPLE = ['Khalid Al-Mansoori', 'Fatima Al-Harbi', 'Omar Al-Qahtani', 'Layla Haddad', 'Yousef Al-Thani', 'Mariam Al-Suwaidi', 'Hamad Al-Sabah', 'Noura Al-Rashid'];
const DIAL: Record<string, string> = { 'Saudi Arabia': '+966 5', 'United Arab Emirates': '+971 5', Qatar: '+974 3', Kuwait: '+965 5', Bahrain: '+973 3', Oman: '+968 9', Jordan: '+962 7', Lebanon: '+961 7', Egypt: '+20 10' };
// Derived from the candidate index so adding them does not disturb the seeded random sequence.
const emergencyContactFor = (i: number, last: string) => {
  const relationship = RELATIONS[(i * 7) % RELATIONS.length];
  const name = `${(i % 2 ? FEMALE : MALE)[(i * 5) % 28]} ${last}`;
  return { name, relationship, phone: `+2519${String(10000000 + ((i * 7919) % 89999999)).padStart(8, '0')}`, address: 'Same household' };
};
const employerFor = (i: number, country: string, city: string) => {
  const dial = DIAL[country] ?? '+966 5';
  return {
    company: EMPLOYER_COMPANIES[(i * 3) % EMPLOYER_COMPANIES.length],
    contact_name: EMPLOYER_PEOPLE[(i * 5) % EMPLOYER_PEOPLE.length],
    role: i % 3 ? 'Sponsor' : 'HR manager',
    phone: `${dial}${String(1000000 + ((i * 104729) % 8999999))}`,
    email: `contact${i}@employer.example.test`,
    address: `${city}, ${country}`,
  };
};
const MALE = ['Abebe', 'Bekele', 'Dawit', 'Eyob', 'Fikru', 'Getachew', 'Henok', 'Ibrahim', 'Kedir', 'Lemma', 'Mulugeta', 'Nahom', 'Olana', 'Samuel', 'Tesfaye', 'Yonas', 'Zerihun', 'Abdi', 'Biruk', 'Chala', 'Desta', 'Elias', 'Girma', 'Jemal', 'Kemal', 'Mohammed', 'Tadele', 'Wondwosen'];
const FEMALE = ['Almaz', 'Birtukan', 'Chaltu', 'Derartu', 'Etenesh', 'Fatuma', 'Genet', 'Hiwot', 'Kidist', 'Lemlem', 'Mekdes', 'Netsanet', 'Rahel', 'Selamawit', 'Tigist', 'Worknesh', 'Yeshi', 'Zeineba', 'Aster', 'Bethlehem', 'Hana', 'Meron', 'Sara', 'Tsehay', 'Aisha', 'Fana', 'Marta', 'Nardos'];
const LAST = ['Tadesse', 'Kebede', 'Alemu', 'Gebre', 'Hailu', 'Mengistu', 'Negash', 'Tilahun', 'Wolde', 'Yimer', 'Ahmed', 'Hussein', 'Abdullahi', 'Bekele', 'Desalegn', 'Fekadu', 'Girma', 'Haile', 'Jemal', 'Lemma', 'Mohammed', 'Shiferaw', 'Teshome', 'Worku', 'Assefa', 'Bogale', 'Demissie', 'Eshetu'];
const MARITAL: Candidate['marital_status'][] = ['Single', 'Single', 'Single', 'Married', 'Divorced', 'Widowed'];
const DEMO_PROFILES: Array<{ occupation: string; skills: string[]; maleOnly?: boolean }> = [
  { occupation: 'Cook', skills: ['Meal preparation', 'Kitchen hygiene', 'Meal planning'] },
  { occupation: 'Nanny', skills: ['Childcare', 'Early learning support', 'Household organization'] },
  { occupation: 'Housekeeper', skills: ['Housekeeping', 'Laundry care', 'Room organization'] },
  { occupation: 'Elder caregiver', skills: ['Elder care', 'Daily support', 'First aid awareness'] },
  { occupation: 'Home cook', skills: ['Home cooking', 'Cleaning routines', 'Time management'] },
  { occupation: 'Hotel attendant', skills: ['Room turnover', 'Guest service', 'Linen handling'] },
  { occupation: 'Commercial cleaner', skills: ['Floor care', 'Sanitation', 'Equipment handling'] },
  { occupation: 'Personal driver', skills: ['Defensive driving', 'Route planning', 'Vehicle upkeep'], maleOnly: true },
  { occupation: 'Home nurse aide', skills: ['Patient hygiene', 'Medication reminders', 'Mobility support'] },
  { occupation: 'Gardener', skills: ['Garden upkeep', 'Irrigation', 'Plant care'], maleOnly: true },
];
const profileFor = (i: number, female: boolean) => {
  const profile = DEMO_PROFILES[(i - 1) % DEMO_PROFILES.length];
  return profile.maleOnly && female ? DEMO_PROFILES[(i + 1) % 5] : profile;
};
const DEMO_LANGUAGES = [['Amharic', 'English'], ['Afaan Oromo', 'Amharic'], ['Tigrinya', 'Amharic'], ['Somali', 'Amharic'], ['Amharic', 'Arabic']];

export interface DemoDataset {
  candidates: Candidate[];
  stages: CandidateStage[];
  medicals: MedicalResult[];
  payments: Payment[];
  paymentStatuses: PaymentStatus[];
  logs: ApprovalLog[];
  cocFacilities: CocFacility[];
  localAgencies: LocalAgency[];
  foreignAgencies: ForeignAgency[];
  documents: Document[];
  staffUsers: StaffUser[];
}

// How far a candidate has progressed. Every phase is internally consistent: a stage is never complete before an earlier one.
type Phase = 'registered' | 'training' | 'medical' | 'visa' | 'clearance' | 'departed' | 'arrived';
const PHASES: Phase[] = ['registered', 'training', 'medical', 'visa', 'clearance', 'departed', 'arrived'];
const PHASE_WEIGHT = [11, 14, 17, 15, 12, 14, 17];

export const generateDemoDataset = (now = Date.now(), scenario: DemoScenario = 'priority'): DemoDataset => {
  const rand = mulberry32(20260719);
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];
  const weighted = (weights: number[]) => {
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i += 1) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  };
  const stamp = (t: number) => new Date(t).toISOString();
  const createdAt = stamp(now - 500 * DAY);

  const cocFacilities: CocFacility[] = DEMO_COC_CENTERS.map(c => ({ ...c, gps_url: `https://www.google.com/maps/search/?api=1&query=${c.latitude},${c.longitude}`, created_at: createdAt }));
  const localAgencies: LocalAgency[] = DEMO_LOCAL_AGENCIES.map(a => ({ ...a, created_at: createdAt }));
  const foreignAgencies: ForeignAgency[] = DEMO_FOREIGN_AGENCIES.map(a => ({ ...a, created_at: createdAt }));

  // Home towns come from the nationwide place list: half weighted by population, half uniform so small towns appear too.
  const cities = ETHIOPIAN_CITIES.filter(c => c.lat > 3 && c.lat < 15.5 && c.lon > 32.5 && c.lon < 48.5);
  const pickCity = () => {
    if (rand() < 0.5) return pick(cities).name;
    const weights = cities.map(c => Math.sqrt(c.population ?? 8000));
    return cities[weighted(weights)].name;
  };

  const candidates: Candidate[] = [];
  const stages: CandidateStage[] = [];
  const medicals: MedicalResult[] = [];
  const payments: Payment[] = [];
  const documents: Document[] = [];
  const paymentStatuses: PaymentStatus[] = [];
  const phaseOf = new Map<string, Phase>();
  let refCounter = 1000;
  const pad = (n: number, width: number) => String(n).padStart(width, '0');

  const addPayment = (c: Candidate, stageId: number, at: number, force?: Partial<Payment>) => {
    const method = pick(['chechepay', 'chechepay', 'mock', 'manual'] as const);
    refCounter += 1;
    const payment: Payment = {
      id: `${DEMO_PREFIX}pay-${c.id.slice(DEMO_PREFIX.length)}-${stageId}`,
      stage_id: stageId,
      provider: method,
      payer_type: 'candidate',
      provider_reference: `${method === 'manual' ? 'BANK' : 'CP'}-${refCounter}`,
      receipt_number: `RC-${pad(refCounter, 6)}`,
      payment_method: method === 'manual' ? 'Bank transfer' : 'ChechePay',
      payer_display_name: `${c.first_name} ${c.last_name}`,
      amount: FEES[stageId],
      currency: 'ETB',
      status: 'succeeded',
      payer_candidate_id: c.id,
      payer_foreign_agency_id: '',
      payee_local_agency_id: c.local_agency_id ?? '',
      candidate_ids: [c.id],
      created_at: stamp(at),
      updated_at: stamp(at),
      ...force,
    };
    payments.push(payment);
    paymentStatuses.push({ candidateId: c.id, stageId, isPaid: payment.status === 'succeeded' });
    return payment;
  };

  for (let i = 1; i <= DEMO_CANDIDATE_COUNT; i += 1) {
    const female = rand() < 0.62;
    const first = pick(female ? FEMALE : MALE);
    const last = pick(LAST);
    const selectedPhase = PHASES[weighted(PHASE_WEIGHT)];
    const isReapplying = i >= 401 && i <= 420;
    const isReturned = i >= 421 && i <= 430;
    const isRedeployed = i >= 431;
    const phase = isReapplying ? PHASES[(i - 401) % 5] : isReturned || isRedeployed ? 'arrived' : selectedPhase;
    const phaseIdx = PHASES.indexOf(phase);
    const localIdx = weighted([30, 28, 22, 20]);
    const foreignIdx = weighted([34, 28, 20, 18]);
    const [destCity, destCountry] = pick(DESTINATIONS[foreignIdx]);
    const cocIdx = rand() < 0.7 ? localIdx : int(0, 3);
    const homeCity = pickCity();
    const homeRegion = resolveEthiopianRegion(homeCity);

    // Gaps between milestones, in days. The registration date is then chosen so the latest milestone is never in the future.
    const gaps = [int(2, 9), int(6, 22), int(28, 70), int(18, 55), int(6, 20), int(4, 16), int(1, 6)];
    const elapsed = gaps.slice(0, phaseIdx).reduce((a, b) => a + b, 0);
    // Most candidates moved recently; a minority have gone quiet so the Needs Attention list stays meaningful.
    // Working candidates have been abroad for very different lengths of time, which spreads contract end dates.
    const slack = phase === 'arrived' ? (i % 3 === 0 ? int(3, 70) : int(30, 540)) : rand() < 0.8 ? int(1, 13) : int(15, 60);
    const registered = now - (elapsed + slack + (isReturned ? 760 : 0)) * DAY - int(0, 20) * 3_600_000;
    const milestone: number[] = [registered];
    gaps.forEach(g => milestone.push(milestone[milestone.length - 1] + g * DAY + int(0, 8) * 3_600_000));

    const id = `${DEMO_PREFIX}cand-${pad(i, 4)}`;
    const dobYear = new Date(now).getFullYear() - int(20, 41);
    const candidate: Candidate = {
      id,
      first_name: first,
      last_name: last,
      dob: `${dobYear}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
      passport_number: `EP${pad(1000000 + i * 137 + int(0, 99), 7)}`,
      tracking_code: `TRK-D${pad(i, 4)}`,
      country_of_origin: 'Ethiopia',
      batch_name: new Date(registered).toISOString().slice(0, 7),
      marital_status: pick(MARITAL),
      gender: female ? 'female' : 'male',
      phone_number: `+2519${pad(int(10000000, 99999999), 8)}`,
      email: `${first}.${last}.${i}@example.test`.toLowerCase(),
      home_city: homeCity,
      ...(homeRegion !== REGION_NOT_SET ? { home_region: homeRegion } : {}),
      professional_summary: `Demonstration profile: ${profileFor(i, female).occupation.toLowerCase()} with experience in ${profileFor(i, female).skills[0].toLowerCase()}.`,
      occupation: profileFor(i, female).occupation,
      skills: profileFor(i, female).skills,
      languages: DEMO_LANGUAGES[(i - 1) % DEMO_LANGUAGES.length],
      intro_video_url: '/demo-intros/illustrative-introduction.mp4',
      coc_facility_id: DEMO_COC_CENTERS[cocIdx].id,
      local_agency_id: DEMO_LOCAL_AGENCIES[localIdx].id,
      foreign_agency_id: DEMO_FOREIGN_AGENCIES[foreignIdx].id,
      profile_image_url: 'generated',
      passport_image_url: 'generated',
      created_at: stamp(registered),
      updated_at: stamp(milestone[phaseIdx]),
      payment_status: 'unpaid',
      external_status: { destination_city: destCity, destination_country: destCountry, work_contract: phaseIdx >= 2, visa: phaseIdx >= 3, updated_at: stamp(registered) },
    };

    candidate.emergency_contact = emergencyContactFor(i, last);
    if (phaseIdx >= 2) candidate.employer = employerFor(i, destCountry, destCity);

    // --- stages ---
    const st = (stageId: number, status: StageStatus, at: number | undefined, notes?: string, reference?: string): CandidateStage => ({
      id: `${DEMO_PREFIX}stg-${pad(i, 4)}-${stageId}`,
      candidate_id: id,
      stage_id: stageId,
      status,
      notes,
      date: at ? stamp(at) : undefined,
      updated_at: stamp(at ?? registered),
      reference_id: reference,
    });
    const s1: StageStatus = phaseIdx >= 1 ? 'Passed' : 'In Progress';
    const s2: StageStatus = phaseIdx >= 3 ? 'Passed' : phaseIdx === 2 ? 'In Progress' : 'Pending';
    const s3: StageStatus = phaseIdx >= 2 ? 'Passed' : phaseIdx === 1 ? 'In Progress' : 'Pending';
    const s4: StageStatus = phaseIdx >= 5 ? 'Completed' : phaseIdx >= 3 ? 'In Progress' : 'Pending';
    stages.push(
      st(1, s1, s1 === 'Passed' ? milestone[1] : milestone[0], s1 === 'Passed' ? 'Documents verified and file opened.' : 'Collecting documents.'),
      st(3, s3, s3 === 'Pending' ? undefined : phaseIdx >= 2 ? milestone[2] : milestone[1], s3 === 'Passed' ? 'CoC assessment passed.' : s3 === 'In Progress' ? 'Attending CoC training.' : undefined),
      st(2, s2, s2 === 'Pending' ? undefined : phaseIdx >= 3 ? milestone[3] : milestone[2], s2 === 'Passed' ? 'Cleared by the accredited medical center.' : s2 === 'In Progress' ? 'Exams booked.' : undefined),
      st(4, s4, s4 === 'Pending' ? undefined : phaseIdx >= 5 ? milestone[5] : milestone[3], s4 === 'Completed' ? 'Departed.' : s4 === 'In Progress' ? 'Visa and clearance in progress.' : undefined, phaseIdx >= 3 ? `FLT-${pad(i, 4)}` : undefined),
    );

    // --- medical history ---
    const examAt = phaseIdx >= 3 ? milestone[3] - int(0, 3) * DAY : phaseIdx === 2 ? milestone[2] : milestone[1];
    const exam = (type: string, status: MedicalResult['status'], at?: number): MedicalResult => ({
      id: `${DEMO_PREFIX}med-${pad(i, 4)}-${type.slice(0, 3).toLowerCase()}`,
      candidate_id: id,
      exam_type: type,
      status,
      exam_date: at ? stamp(at).slice(0, 10) : undefined,
      notes: status === 'Passed' ? 'No findings.' : status === 'Pending' ? 'Awaiting results.' : undefined,
      location: at ? demoMedicalLocationFor(id) : undefined,
    });
    if (phaseIdx < 2) {
      medicals.push(exam('HIV', 'Pending'), exam('Final Agency Medical', 'Pending'));
      if (female && phaseIdx === 1) medicals.push(exam('Pregnancy', 'Pending'));
    } else if (phaseIdx === 2) {
      medicals.push(exam('HIV', rand() < 0.5 ? 'Passed' : 'Pending', examAt), exam('Final Agency Medical', 'Pending'));
      if (female) medicals.push(exam('Pregnancy', 'Pending', examAt));
    } else {
      const finalAt = phaseIdx >= 3 ? milestone[3] - int(1, 6) * DAY : undefined;
      medicals.push(exam('HIV', 'Passed', examAt), exam('Final Agency Medical', phaseIdx >= 3 ? 'Passed' : 'Pending', finalAt));
      if (female) medicals.push(exam('Pregnancy', 'Passed', examAt));
    }

    // --- payments: each completed or active fee-bearing stage is paid ---
    const paidStages: Array<[number, number]> = [];
    if (phaseIdx >= 1) paidStages.push([1, milestone[1]]);
    if (phaseIdx >= 2) paidStages.push([3, milestone[2]]);
    if (phaseIdx >= 3) paidStages.push([2, milestone[3]]);
    if (phaseIdx >= 4) paidStages.push([4, milestone[4]]);
    paidStages.forEach(([stageId, at]) => addPayment(candidate, stageId, at));
    candidate.payment_status = paidStages.length ? (phaseIdx >= 4 ? 'paid' : 'pending_payment') : 'unpaid';
    if (paidStages.length) candidate.last_payment_id = payments[payments.length - 1].id;

    // --- ELMIS, visa, clearance, arrival ---
    if (phaseIdx >= 1) {
      const elmisVerified = rand() < 0.92;
      candidate.elmis = scenario === 'needs-attention' && !elmisVerified
        ? { status: 'pending', checked_at: stamp(milestone[1] + DAY), mode: 'sandbox' }
        : { status: 'verified', registration_id: `ELMIS-${pad(500000 + i * 7, 7)}`, checked_at: stamp(milestone[1] + DAY), mode: 'sandbox' };
    }
    if (phaseIdx >= 3) {
      const generatedVisaExpiry = stamp(milestone[3] + int(70, 160) * DAY).slice(0, 10);
      candidate.visa = {
        visa_number: `VISA-${pad(7000000 + i * 31, 7)}`,
        status: 'validated',
        expiry_date: scenario === 'needs-attention'
          ? generatedVisaExpiry
          : stamp(now + 180 * DAY).slice(0, 10),
        occupation: 'Domestic worker',
        sponsor_name: DEMO_FOREIGN_AGENCIES[foreignIdx].name,
        mode: 'sandbox',
        source: 'lookup',
        checked_at: stamp(milestone[3]),
      };
      const clearance: ClearanceRecord = {};
      const stepAt = milestone[4];
      if (phaseIdx >= 4) clearance.enjaz = { status: 'completed', reference: `ENJ-${pad(i, 5)}`, mode: 'sandbox', updated_at: stamp(stepAt) };
      if (phaseIdx >= 5) {
        clearance.tasheer = { status: 'completed', reference: `TSH-${pad(i, 5)}`, mode: 'sandbox', updated_at: stamp(stepAt + DAY) };
        clearance.cleared_at = stamp(stepAt + DAY);
        clearance.certificate_no = `CLR-${pad(i, 6)}`;
      } else if (phaseIdx === 4 && rand() < 0.5) {
        clearance.tasheer = { status: 'pending', mode: 'sandbox', updated_at: stamp(stepAt) };
      }
      if (phaseIdx === 4 && i % 3 === 0) {
        clearance.tasheer = { status: 'completed', mode: 'sandbox', updated_at: stamp(stepAt) };
        clearance.local_ready_at = stamp(stepAt);
        clearance.local_ready_by = demoAgencyManager(candidate.local_agency_id)?.email;
        clearance.labour_ministry = {
          status: scenario !== 'high-performing' && i % 5 === 0 ? 'rejected' : 'pending',
          mode: 'sandbox', simulated: true,
          message: 'DEMO / simulated ministry review; not an official QR clearance.',
        };
      }
      candidate.clearance = clearance;
    }
    if (phaseIdx >= 6) {
      const arrivalConfirmedBy = rand() < 0.8 ? 'candidate' : 'foreign-agency';
      candidate.arrival = { arrived_at: stamp(milestone[6]), confirmed_by: scenario === 'needs-attention' ? arrivalConfirmedBy : 'candidate', note: null };
      candidate.return_status = 'not-planned';
      if (!isReturned) {
        const remainingDays = 20 + ((i * 37) % 380);
        candidate.contract_start_date = stamp(milestone[6]).slice(0, 10);
        candidate.contract_end_date = stamp(now + remainingDays * DAY).slice(0, 10);
        candidate.expected_return_date = candidate.contract_end_date;
      } else {
        candidate.expected_return_date = stamp(milestone[6] + 700 * DAY).slice(0, 10);
      }
    }

    if (isReapplying || isReturned || isRedeployed) {
      const departedAt = isReturned ? milestone[5] : registered - 800 * DAY;
      const returnedAt = isReturned ? milestone[6] + 700 * DAY : registered - 30 * DAY;
      candidate.employment_history = [{
        home_city: homeCity,
        coc_facility_id: DEMO_COC_CENTERS[cocIdx].id,
        destination_city: destCity,
        destination_country: destCountry,
        departed_at: stamp(departedAt),
        contract_completed_at: stamp(returnedAt - 14 * DAY),
        employer_name: employerFor(i, destCountry, destCity).company,
        contract_reference: `DEMO-CONTRACT-${pad(i, 4)}-1`,
        returned_at: stamp(returnedAt),
        ...(!isReturned ? { reapplied_at: stamp(registered) } : {}),
      }];
      if (isReturned) {
        candidate.return_status = 'returned';
        candidate.actual_return_date = stamp(returnedAt).slice(0, 10);
      }
      if (isRedeployed) {
        candidate.work_contract_record = {
          status: 'received', sent_at: stamp(milestone[2]), sent_by: demoAgencyManager(candidate.foreign_agency_id)?.email,
          received_at: stamp(milestone[2] + DAY), received_by: demoAgencyManager(candidate.local_agency_id)?.email,
          note: 'Simulated demo contract handoff.',
        };
      }
    }

    if (phaseIdx === 4 && i % 4 === 0) {
      const arrivalAirport = airportForCity(destCity);
      if (arrivalAirport) {
        const airborne = i % 16 === 0;
        const departMs = airborne ? now - (1 + (i % 3)) * 3_600_000 : now + (1 + (i % 9)) * DAY + (i % 12) * 3_600_000;
        candidate.flight = { airline: 'Ethiopian Airlines', flight_number: `ET${300 + (i % 600)}`, departure_airport: 'ADD', arrival_airport: arrivalAirport.code, departure_time: stamp(departMs), note: 'Simulated demo flight.' };
      }
    }

    phaseOf.set(id, phase);
    candidates.push(candidate);

    // Blank placeholder files: each stage reached adds the paperwork that belongs to it.
    const files: Array<[number, string, Document['doc_kind'] | undefined, string]> = [
      [0, 'Passport copy', undefined, 'passport'],
      [0, 'Application form', undefined, 'application'],
      [1, 'Medical report', undefined, 'medical'],
      [2, 'CoC training certificate', undefined, 'coc-certificate'],
      [2, 'Work contract', 'work_contract', 'contract'],
      [3, 'Visa', 'visa', 'visa'],
      [4, 'Clearance certificate', undefined, 'clearance'],
      [5, 'Boarding pass', undefined, 'boarding-pass'],
    ];
    files.filter(([minPhase]) => phaseIdx >= minPhase).forEach(([minPhase, title, kind, slug]) => {
      documents.push({
        id: `${DEMO_PREFIX}doc-${pad(i, 4)}-${slug}`,
        candidate_id: id,
        stage_id: minPhase + 1,
        file_name: `${title}.pdf`,
        file_type: 'application/pdf',
        storage_key: `docs/${candidate.tracking_code}/${slug}.pdf`,
        uploaded_at: stamp(milestone[minPhase]),
        public_url: '/placeholder.svg',
        doc_kind: kind,
      });
    });
  }

  addForeignPayments(candidates, payments, phaseOf, now, rand, scenario === 'needs-attention');
  const context = { candidates, stages, medicals, payments, paymentStatuses, phaseOf, rand, int, now, addPayment };
  const logs = scenario === 'needs-attention'
    ? applyAnomalies(context)
    : scenario === 'priority'
      ? applyPriorityFindings(context)
      : [];
  if (scenario === 'needs-attention') addOffTrackCases(candidates, stages, now);
  candidates.filter(candidate => phaseOf.get(candidate.id) === 'registered').slice(0, 9).forEach((candidate, index) =>
    addPayment(candidate, 1, now - DAY, { status: scenario === 'high-performing' ? 'pending' : (['pending', 'failed', 'refunded'] as const)[index % 3], payment_method: 'DEMO / synthetic checkout attempt' }),
  );
  const staffUsers = buildDemoStaff(now);
  const loggedSources = new Set<string>();
  payments.forEach(payment => {
    const initiator = payment.payer_type === 'candidate'
      ? resolveActorIdentity(payment.payer_candidate_id ?? payment.candidate_ids[0], undefined, candidates)
      : demoAgencyManager(payment.payer_foreign_agency_id);
    const recorder = demoAgencyManager(payment.payee_local_agency_id);
    payment.initiated_by = initiator && { id: initiator.id, email: initiator.email };
    payment.recorded_by = recorder && { id: recorder.id, email: recorder.email };
    payment.initiated_at = payment.created_at;
    payment.origin = payment.payer_type === 'candidate' ? 'candidate-checkout' : 'agency-checkout';
    const actor = recorder ?? initiator;
    const date = new Date(payment.created_at);
    const sourceKey = `${payment.payee_local_agency_id}:${payment.payer_type}`;
    if (actor && !loggedSources.has(sourceKey) && date.getDay() > 0 && date.getDay() < 6 && date.getHours() >= 9 && date.getHours() < 18) {
      loggedSources.add(sourceKey);
      logs.push({
      id: `${DEMO_PREFIX}payment-log-${payment.id}`, timestamp: payment.created_at,
      actor_id: actor.id, actor_email: actor.email ?? actor.id, target_type: 'Payment', target_id: payment.id, action: 'Created',
      description: `Recorded ${payment.status} payment ${payment.provider_reference || payment.receipt_number || payment.id} for ${paymentCandidateSummary(payment, candidates)}; ${payment.amount} ${payment.currency}; ${foreignAgencies.find(agency => agency.id === payment.payer_foreign_agency_id)?.name ?? payment.payer_display_name} → ${localAgencies.find(agency => agency.id === payment.payee_local_agency_id)?.name ?? payment.payee_local_agency_id}. Practice / synthetic record, not real bank proof.`,
      });
    }
  });
  const assignedStages = assignUnassignedStageTasks(candidates, stages, staffUsers).map(stage => ({ ...stage, location: demoStageLocationFor(candidates.find(candidate => candidate.id === stage.candidate_id)!, stage, cocFacilities) }));
  return { candidates, stages: assignedStages, medicals, payments, paymentStatuses, logs, cocFacilities, localAgencies, foreignAgencies, documents, staffUsers };
};

// Every agency gets a manager plus working staff so each has someone to give workflow to.
const buildDemoStaff = (now: number): StaffUser[] => {
  const created = new Date(now - 400 * DAY).toISOString();
  const online = (n: number) => new Date(now - (n * 37 % 240) * 60_000).toISOString();
  const users: StaffUser[] = [];
  DEMO_LOCAL_AGENCIES.forEach((agency, index) => {
    const slug = `l${index + 1}`;
    users.push({ id: `${DEMO_PREFIX}usr-${slug}-mgr`, email: demoActorIdentity(`${DEMO_PREFIX}usr-${slug}-mgr`)!.email!, role: 'local-agency', is_approved: true, created_at: created, local_agency_id: agency.id, last_online_at: online(index + 1) });
    [0, 1, 2].forEach(n => users.push({ id: `${DEMO_PREFIX}usr-${slug}-s${n + 1}`, email: demoActorIdentity(`${DEMO_PREFIX}usr-${slug}-s${n + 1}`)!.email!, role: 'staff', is_approved: true, created_at: created, local_agency_id: agency.id, last_online_at: online(index * 3 + n + 5) }));
  });
  DEMO_FOREIGN_AGENCIES.forEach((agency, index) => {
    const slug = `f${index + 1}`;
    users.push({ id: `${DEMO_PREFIX}usr-${slug}-mgr`, email: demoActorIdentity(`${DEMO_PREFIX}usr-${slug}-mgr`)!.email!, role: 'foreign-agency', is_approved: true, created_at: created, foreign_agency_id: agency.id, last_online_at: online(index + 9) });
    [0, 1].forEach(n => users.push({ id: `${DEMO_PREFIX}usr-${slug}-s${n + 1}`, email: demoActorIdentity(`${DEMO_PREFIX}usr-${slug}-s${n + 1}`)!.email!, role: 'foreign-agency-staff', is_approved: true, created_at: created, foreign_agency_id: agency.id, last_online_at: online(index * 2 + n + 13) }));
  });
  return users;
};

// Foreign agencies pay the local agency for each candidate with a work contract, in the contract country's currency.
const addForeignPayments = (candidates: Candidate[], payments: Payment[], phaseOf: Map<string, (typeof PHASES)[number]>, now: number, rand: () => number, includeAnomalies: boolean) => {
  let n = 0;
  candidates.forEach(c => {
    if (PHASES.indexOf(phaseOf.get(c.id) ?? 'registered') < 2) return;
    const country = c.external_status?.destination_country;
    const min = minimumPerCandidate(country);
    const required = currencyForCountry(country);
    if (!min || !required) return;
    n += 1;
    const at = Math.min(now - DAY, new Date(c.created_at).getTime() + 25 * DAY);
    let currency = required;
    let amount = Math.round(min.amount * (1 + rand() * 0.3));
    if (includeAnomalies && n % 47 === 0) amount = Math.round(min.amount * 0.7);
    else if (includeAnomalies && n % 73 === 0) { currency = required === 'USD' ? 'AED' : 'USD'; amount = 900; }
    // Settlement problems that every scenario shows: overdue, stuck and overpaid transfers.
    const phaseIndex = PHASES.indexOf(phaseOf.get(c.id) ?? 'registered');
    if (phaseIndex >= 3 && n % 19 === 0) return;
    if (n % 17 === 0) amount = Math.round(min.amount * 1.5);
    const settled = !(n % 29 === 0 && phaseIndex >= 3);
    payments.push({
      id: `${DEMO_PREFIX}fpay-${c.id.slice(DEMO_PREFIX.length)}`,
      provider: 'manual',
      provider_reference: `SWIFT-${100000 + n * 7}`,
      receipt_number: `FX-${String(n).padStart(6, '0')}`,
      payment_method: 'Bank transfer (SWIFT)',
      payer_display_name: DEMO_FOREIGN_AGENCIES.find(a => a.id === c.foreign_agency_id)?.name,
      payer_type: 'foreign-agency',
      contract_country: country,
      amount,
      currency,
      status: settled ? 'succeeded' : 'pending',
      payer_foreign_agency_id: c.foreign_agency_id ?? '',
      payee_local_agency_id: c.local_agency_id ?? '',
      candidate_ids: [c.id],
      created_at: new Date(at).toISOString(),
      updated_at: new Date(at).toISOString(),
    });
  });
};

interface AnomalyContext {
  candidates: Candidate[];
  stages: CandidateStage[];
  medicals: MedicalResult[];
  payments: Payment[];
  paymentStatuses: PaymentStatus[];
  phaseOf: Map<string, Phase>;
  rand: () => number;
  int: (min: number, max: number) => number;
  now: number;
  addPayment: (c: Candidate, stageId: number, at: number, force?: Partial<Payment>) => Payment;
}

// Seeds a deliberate, repeatable set of integrity red flags (each candidate gets at most one) plus suspicious staff activity.
// Anomalies never reorder or skip stages, so every timeline stays valid.
const applyAnomalies = (ctx: AnomalyContext): ApprovalLog[] => {
  const { candidates, stages, medicals, payments, paymentStatuses, phaseOf, int, now, addPayment } = ctx;
  const used = new Set<string>();
  const phaseIndex = (c: Candidate) => PHASES.indexOf(phaseOf.get(c.id) ?? 'registered');
  const take = (min: number, count: number, max = 6): Candidate[] => {
    const out: Candidate[] = [];
    for (const c of candidates) {
      if (out.length >= count) break;
      if (!used.has(c.id) && phaseIndex(c) >= min && phaseIndex(c) <= max) { used.add(c.id); out.push(c); }
    }
    return out;
  };
  const stagesOf = (c: Candidate) => stages.filter(s => s.candidate_id === c.id);
  const medicalsOf = (c: Candidate) => medicals.filter(m => m.candidate_id === c.id);
  const paymentsOf = (c: Candidate) => payments.filter(p => p.candidate_ids.includes(c.id));
  const stageOf = (c: Candidate, stageId: number) => stages.find(s => s.candidate_id === c.id && s.stage_id === stageId)!;
  const ago = (days: number) => new Date(now - days * DAY).toISOString();

  take(0, 6, 3).forEach((c, i) => { // shared passports and identities
    const twin = candidates[(candidates.indexOf(c) + 40 + i) % candidates.length];
    if (i % 2 === 0) twin.passport_number = c.passport_number;
    else { twin.first_name = c.first_name; twin.last_name = c.last_name; twin.dob = c.dob; }
  });
  take(0, 4, 3).forEach((c, i) => { const twin = candidates[(candidates.indexOf(c) + 77 + i) % candidates.length]; if (i % 2 === 0) twin.phone_number = c.phone_number; else twin.email = c.email; });
  take(0, 3, 2).forEach(c => { c.dob = `${new Date(now).getFullYear() - int(15, 17)}-0${int(1, 9)}-1${int(0, 9)}`; });
  take(0, 3, 2).forEach(c => { c.dob = `${new Date(now).getFullYear() - int(63, 68)}-0${int(1, 9)}-1${int(0, 9)}`; });
  take(0, 3, 6).forEach(c => { c.passport_number = pickFormat(int(0, 2)); });
  take(0, 3, 6).forEach(c => { c.phone_number = undefined; c.email = ''; });
  take(0, 5, 6).forEach(c => { c.emergency_contact = undefined; });
  take(2, 6, 6).forEach(c => { c.employer = undefined; });

  take(2, 6, 6).forEach(c => { // paid stage with no recorded payment
    const gone = paymentsOf(c).find(p => p.stage_id === 2);
    if (gone) { payments.splice(payments.indexOf(gone), 1); const idx = paymentStatuses.findIndex(p => p.candidateId === c.id && p.stageId === 2); if (idx >= 0) paymentStatuses.splice(idx, 1); }
  });
  take(5, 2, 6).forEach(c => { medicalsOf(c).forEach(m => { m.status = 'Failed'; }); }); // deployed with a failed medical
  take(5, 3, 6).forEach(c => { medicalsOf(c).forEach(m => { m.status = 'Pending'; m.exam_date = undefined; }); });
  take(2, 2, 4).forEach(c => { medicalsOf(c).forEach(m => { m.status = 'Failed'; }); });
  take(2, 4, 6).forEach(c => { const m = medicalsOf(c)[0]; m.exam_date = undefined; });
  take(1, 2, 6).forEach(c => { const m = medicalsOf(c)[0]; m.exam_date = ago(-20).slice(0, 10); m.status = 'Pending'; });
  take(1, 4, 1).forEach(c => { const m = medicalsOf(c)[1]; m.status = 'Pending'; m.exam_date = ago(95).slice(0, 10); });
  take(5, 4, 6).forEach(c => { medicalsOf(c).forEach(m => { m.exam_date = new Date(new Date(stageOf(c, 4).date!).getTime() - 230 * DAY).toISOString().slice(0, 10); }); });

  take(1, 8, 6).forEach(c => { c.elmis = { status: 'mismatch', checked_at: ago(8), mode: 'sandbox', mismatches: [pickOne(['date of birth', 'passport number', 'full name'], int(0, 2))] }; });
  take(1, 5, 6).forEach(c => { c.elmis = { status: 'not_found', checked_at: ago(6), mode: 'sandbox' }; });
  take(2, 6, 3).forEach(c => { c.elmis = { status: 'pending', checked_at: ago(15), mode: 'sandbox' }; });
  take(2, 4, 3).forEach(c => { c.coc_facility_id = undefined; });
  take(0, 3, 6).forEach(c => { c.local_agency_id = undefined; });
  take(5, 3, 6).forEach(c => { c.foreign_agency_id = undefined; });
  take(5, 4, 6).forEach(c => { c.visa = { ...(c.visa ?? { visa_number: 'VISA-0', mode: 'sandbox', checked_at: ago(10) }), status: 'pending' } as Candidate['visa']; });
  take(5, 5, 5).forEach(c => { c.clearance = { enjaz: { status: 'completed', mode: 'sandbox', updated_at: ago(12) }, tasheer: { status: 'pending', mode: 'sandbox', updated_at: ago(12) } }; });
  take(3, 4, 3).forEach(c => { c.visa!.expiry_date = ago(-int(5, 25)).slice(0, 10); });
  take(3, 3, 3).forEach(c => { c.visa!.expiry_date = ago(int(5, 40)).slice(0, 10); });
  take(3, 4, 4).forEach(c => { c.visa!.status = 'mismatch'; c.visa!.mismatches = ['passport number']; });
  take(6, 3, 6).forEach(c => { c.arrival = { arrived_at: new Date(new Date(stageOf(c, 4).date!).getTime() - 3 * DAY).toISOString(), confirmed_by: 'candidate', note: null }; });
  take(6, 5, 6).forEach(c => { c.arrival = { ...c.arrival!, confirmed_by: 'admin' }; });
  take(5, 4, 6).forEach(c => { c.passport_image_url = undefined; });
  take(6, 3, 6).forEach(c => { c.expected_return_date = ago(75).slice(0, 10); c.return_status = 'delayed'; });
  take(2, 4, 2).forEach(c => { const s = stageOf(c, 3); s.status = 'In Progress'; s.updated_at = ago(150); });
  take(1, 3, 6).forEach(c => { const s = stageOf(c, 1); s.date = new Date(new Date(c.created_at).getTime() - 120 * DAY).toISOString(); });

  // payments
  const sample = take(2, 20, 6);
  const [dupRef1, dupRef2, dupReceipt1, dupReceipt2, noRef1, noRef2, noRef3, orphan1, orphan2, big1, big2, round1, round2, future1, future2, payer1, payer2, payer3, payee1, payee2] = sample;
  const lastPay = (c: Candidate) => paymentsOf(c)[0];
  if (dupRef1 && dupRef2 && lastPay(dupRef1) && lastPay(dupRef2)) lastPay(dupRef2).provider_reference = lastPay(dupRef1).provider_reference;
  if (dupReceipt1 && dupReceipt2 && lastPay(dupReceipt1) && lastPay(dupReceipt2)) lastPay(dupReceipt2).receipt_number = lastPay(dupReceipt1).receipt_number;
  [noRef1, noRef2, noRef3].forEach(c => { const p = c && lastPay(c); if (p) { p.provider = 'manual'; p.provider_reference = ''; } });
  [orphan1, orphan2].forEach(c => { const p = c && lastPay(c); if (p) p.candidate_ids = []; });
  [big1, big2].forEach(c => { const p = c && lastPay(c); if (p) p.amount = 45000 + int(0, 9000); });
  [round1, round2].forEach(c => { const p = c && lastPay(c); if (p) { p.provider = 'manual'; p.amount = 12000; p.receipt_number = undefined; p.provider_reference = `CASH-${int(100, 999)}`; } });
  [future1, future2].forEach(c => { const p = c && lastPay(c); if (p) { p.created_at = ago(-6); p.updated_at = ago(-6); } });
  [payer1, payer2, payer3].forEach(c => { const p = c && lastPay(c); if (p) { const other = candidates.find(x => x.id !== c.id); if (other) { p.payer_candidate_id = other.id; p.payer_display_name = `${other.first_name} ${other.last_name}`; } } });
  [payee1, payee2].forEach(c => { const p = c && lastPay(c); if (p) p.payee_local_agency_id = DEMO_LOCAL_AGENCIES.find(a => a.id !== c.local_agency_id)!.id; });
  take(2, 3, 6).forEach(c => { const p = lastPay(c); if (p) { p.created_at = new Date(new Date(c.created_at).getTime() - 20 * DAY).toISOString(); } });
  take(2, 4, 6).forEach(c => { const p = lastPay(c); if (p) p.amount = Math.round((p.stage_id ? FEES[p.stage_id] : 1000) * 1.6); });
  take(2, 3, 6).forEach(c => { const p = lastPay(c); if (p) { p.provider = 'chechepay'; p.provider_reference = ''; } });
  take(2, 3, 6).forEach(c => { const p = lastPay(c); if (p) p.status = 'refunded'; });
  take(1, 1, 6).forEach(c => { addPayment(c, 1, now - 2 * DAY, { id: `${DEMO_PREFIX}pay-extra-${c.id.slice(-4)}`, candidate_ids: [] }); paymentStatuses.pop(); });

  // staff activity that an auditor should look at
  const logs: ApprovalLog[] = [];
  const staffActors = [
    { id: 'demo-staff-1', email: demoActorIdentity('demo-staff-1')!.email! },
    { id: 'demo-staff-2', email: demoActorIdentity('demo-staff-2')!.email! },
    { id: 'demo-staff-3', email: demoActorIdentity('demo-staff-3')!.email! },
  ];
  const superActor = { id: 'demo-super-1', email: demoActorIdentity('demo-super-1')!.email! };
  const log = (actor: { id: string; email: string }, targetType: ApprovalLog['target_type'], targetId: string, action: ApprovalLog['action'], description: string, at: number): void => {
    logs.push({ id: `${DEMO_PREFIX}log-${logs.length + 1}`, timestamp: new Date(at).toISOString(), actor_id: actor.id, actor_email: actor.email, target_type: targetType, target_id: targetId, action, description });
  };
  const dayAt = (daysAgo: number, hour: number) => { const d = new Date(now - daysAgo * DAY); d.setHours(hour, int(0, 59), int(0, 59), 0); return d.getTime(); };
  candidates.slice(0, 120).forEach((c, i) => {
    log(staffActors[i % 3], 'Candidate', c.id, 'Updated', `Updated stage for ${c.first_name} ${c.last_name}.`, dayAt(int(1, 120), int(9, 17)));
  });
  for (let i = 0; i < 12; i += 1) log(superActor, 'StaffUser', `demo-user-${i}`, i % 3 === 0 ? 'Approved' : 'Updated', 'Reviewed a staff account.', dayAt(int(1, 90), int(9, 17)));
  for (let i = 0; i < 4; i += 1) log(staffActors[1], 'Candidate', candidates[i].id, 'Updated', 'Updated stage after hours.', dayAt(int(1, 20), 23));
  const burstStart = now - 3 * DAY;
  for (let i = 0; i < 11; i += 1) log(staffActors[2], 'Candidate', candidates[200 + i].id, 'Updated', `Changed stage status in a batch update (${i + 1}).`, burstStart + i * 40_000);
  for (let i = 0; i < 5; i += 1) log(staffActors[0], 'Candidate', `deleted-${i}`, 'Deleted', 'Deleted a candidate record.', dayAt(int(1, 30), 11));
  for (let i = 0; i < 6; i += 1) log(superActor, 'Config', 'config', 'Updated', 'Changed application settings.', dayAt(int(1, 40), 10));
  for (let i = 0; i < 4; i += 1) log(superActor, 'Payment', `demo-pay-${i}`, i % 2 ? 'Deleted' : 'Updated', 'Edited a payment record.', dayAt(int(1, 25), 15));
  for (let i = 0; i < 9; i += 1) log(staffActors[1], 'Candidate', candidates[i + 20].id, 'Updated', 'Weekend update.', (() => { const d = new Date(now - (7 * (i + 1)) * DAY); d.setDate(d.getDate() - d.getDay()); d.setHours(12, i, 0, 0); return d.getTime(); })());
  log({ id: 'demo-staff-4', email: demoActorIdentity('demo-staff-4')!.email! }, 'StaffUser', 'demo-staff-4', 'Approved', 'Approved their own account.', dayAt(12, 14));
  return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
};

const applyPriorityFindings = (ctx: AnomalyContext): ApprovalLog[] => {
  const { candidates, stages, payments, paymentStatuses } = ctx;
  const activeCandidates = candidates.filter(candidate => stages.some(stage => stage.candidate_id === candidate.id && stage.stage_id === 1 && stage.status === 'Passed'));
  const [duplicateA, duplicateB] = activeCandidates;
  if (!duplicateA || !duplicateB) throw new Error('Priority scenario requires at least two progressed candidates.');
  duplicateB.passport_number = duplicateA.passport_number;

  const unpaidCandidate = activeCandidates.find(candidate => payments.some(payment => payment.payer_candidate_id === candidate.id && payment.stage_id === 1));
  if (!unpaidCandidate) throw new Error('Priority scenario requires a recorded stage payment to flag.');
  const paymentIndex = payments.findIndex(payment => payment.payer_candidate_id === unpaidCandidate.id && payment.stage_id === 1);
  const [removedPayment] = payments.splice(paymentIndex, 1);
  const statusIndex = paymentStatuses.findIndex(status => status.candidateId === unpaidCandidate.id && status.stageId === 1);
  if (statusIndex >= 0) paymentStatuses.splice(statusIndex, 1);
  const replacementPayment = payments.find(payment => payment.payer_candidate_id === unpaidCandidate.id);
  unpaidCandidate.last_payment_id = replacementPayment?.id;

  const lowPriorityCandidates = candidates.filter(candidate => ![duplicateA.id, duplicateB.id, unpaidCandidate.id].includes(candidate.id)).slice(0, 2);
  lowPriorityCandidates.forEach(candidate => { candidate.emergency_contact = undefined; });

  if (!removedPayment) throw new Error('Priority scenario could not remove its planned payment.');
  return [];
};

const addOffTrackCases = (candidates: Candidate[], stages: CandidateStage[], now: number): void => {
  candidates.slice(250, 258).forEach(candidate => {
    const laterStage = stages.find(stage => stage.candidate_id === candidate.id && stage.stage_id === 4);
    if (!laterStage) return;
    laterStage.status = 'Completed';
    laterStage.date = new Date(now - 3 * DAY).toISOString();
    laterStage.updated_at = laterStage.date;
    laterStage.notes = 'Scenario: deployment completed before the required earlier stages.';
    stages.filter(stage => stage.candidate_id === candidate.id && stage.stage_id < 4).forEach(stage => {
      stage.status = 'Pending';
      stage.date = undefined;
      stage.updated_at = new Date(now - 3 * DAY).toISOString();
    });
  });
};

const pickOne = <T,>(items: T[], index: number): T => items[index % items.length];
const pickFormat = (n: number) => pickOne(['E1', 'EP-12', 'ETH#00991'], n);

// Replaces any previous demo data, so loading twice never duplicates records.
export const buildMergedStore = <T extends { id: string }>(existing: T[], demo: T[]): T[] => [...existing.filter(item => !item.id.startsWith(DEMO_PREFIX)), ...demo];

export const isDemoLoaded = (candidates: Array<{ id: string }>): boolean => candidates.some(c => c.id.startsWith(DEMO_PREFIX));

export const demoConfigPatch = (config: AppConfig, demo: DemoDataset): AppConfig => {
  const localAgencies = buildMergedStore(config.localAgencies ?? [], demo.localAgencies);
  const foreignAgencies = buildMergedStore(config.foreignAgencies ?? [], demo.foreignAgencies);
  const validLocalIds = new Set(localAgencies.map(agency => agency.id));
  const validForeignIds = new Set(foreignAgencies.map(agency => agency.id));
  const current = (config.agencyPartnerships ?? []).filter(partnership => validLocalIds.has(partnership.local_agency_id) && validForeignIds.has(partnership.foreign_agency_id));
  const pairs = new Set(current.map(partnership => `${partnership.local_agency_id}|${partnership.foreign_agency_id}`));
  const demoPartners: AgencyPartnership[] = demo.localAgencies.flatMap((local, localIndex) => demo.foreignAgencies.map((foreign, foreignIndex) => ({
    local_agency_id: local.id,
    foreign_agency_id: foreign.id,
    status: 'active',
    agreement_reference: `DAWM-DEMO-${localIndex + 1}-${foreignIndex + 1}`,
    started_at: local.created_at,
  }))).filter(partnership => !pairs.has(`${partnership.local_agency_id}|${partnership.foreign_agency_id}`));
  return {
    ...config,
    cocFacilities: buildMergedStore(config.cocFacilities ?? [], demo.cocFacilities),
    localAgencies,
    foreignAgencies,
    agencyPartnerships: [...current, ...demoPartners],
  };
};
