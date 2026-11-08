import type { UserRole } from './types';

export interface WalkthroughStep { title: string; detail: string; path: string; selector: string }
export interface WalkthroughState { role: UserRole; index: number; active: boolean; completed: boolean; returnTo: string }

const KEY = 'dawm_demo_walkthrough';
export const readWalkthrough = (): WalkthroughState | null => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as WalkthroughState | null; } catch { return null; }
};
export const saveWalkthrough = (state: WalkthroughState) => sessionStorage.setItem(KEY, JSON.stringify(state));
export const startWalkthrough = (resume: boolean) => window.dispatchEvent(new CustomEvent('start-demo-walkthrough', { detail: { resume } }));

export const walkthroughSteps = (role: UserRole, trackingCode?: string | null): WalkthroughStep[] => {
  if (role === 'superadmin' || role === 'admin' || role === 'staff') return [
    { title: 'Register a candidate', detail: 'Start a candidate record here, or use passport upload to prefill details.', path: '/admin', selector: '[data-tour="registration"]' },
    { title: 'Review the profile', detail: 'The candidate profile brings identity, agency, contract and journey information together.', path: '/admin/candidate/demo-cand-0431', selector: '[data-tour="candidate-profile"]' },
    { title: 'Progress through each stage', detail: 'Use the timeline and other tabs to manage documents, medical results, contracts and payments.', path: '/admin/candidate/demo-cand-0431', selector: '[data-tour="candidate-stages"]' },
    { title: 'Training routes', detail: 'Filter home-to-CoC routes by region or center and select a candidate journey.', path: '/admin/training-map', selector: '[data-tour="network-map"]' },
    { title: 'Visa and clearance', detail: 'Review visa validation, local checks and ministry confirmation before departure.', path: '/admin/clearance', selector: 'main h1' },
    { title: 'Deployment', detail: 'Follow candidates by destination and phase, including arrivals and returns.', path: '/admin/training-map', selector: '[data-tour="deployment-map"]' },
    { title: 'Return and reapplication', detail: 'Previous deployment and return history stays visible alongside the new application.', path: '/admin/candidate/demo-cand-0431', selector: '[data-tour="return-history"]' },
  ];
  if (role === 'local-agency') return [
    { title: 'Candidate progress', detail: 'Review your agency’s candidate records and their next stages.', path: '/local-agency', selector: 'main h1' },
    { title: 'Visa and clearance', detail: 'Complete local checks and follow ministry confirmation.', path: '/local-agency/clearance', selector: 'main h1' },
    { title: 'Deployment and returns', detail: 'Follow your candidates’ destinations and return journeys.', path: '/local-agency/training-map', selector: '[data-tour="deployment-map"]' },
    { title: 'Payments', detail: 'Review payment records and compare received payments with bank deposits.', path: '/local-agency/payments', selector: 'main h1' },
  ];
  if (role === 'foreign-agency' || role === 'foreign-agency-staff') return [
    { title: 'Agency candidates', detail: 'Review the candidates linked to your agency.', path: '/agency', selector: '[data-tour="agency-pipeline"]' },
    { title: 'Introductions', detail: 'Review candidate introductions before coordinating a contract.', path: '/agency/introductions', selector: 'main h1' },
    { title: 'Clearance', detail: 'Follow visa and clearance progress for your candidates.', path: '/agency/clearance', selector: 'main h1' },
    { title: 'Deployment and returns', detail: 'Track current destinations and return journeys.', path: '/agency/training-map', selector: '[data-tour="deployment-map"]' },
  ];
  if (role === 'candidate' && trackingCode) return [{ title: 'Your journey', detail: 'Review your stages, documents, journey and messages here.', path: `/track/${trackingCode}`, selector: '[data-tour="candidate-journey"]' }];
  if (role === 'auditor') return [{ title: 'Record review', detail: 'Review warnings and the records behind them.', path: '/auditor', selector: 'main h1' }];
  return [{ title: 'Candidate tracking', detail: 'Use a tracking code to open the available public tracking view.', path: '/viewer', selector: 'main h1' }];
};