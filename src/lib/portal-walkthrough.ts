import type { UserRole } from './types';

export interface WalkthroughStep { title: string; detail: string; path: string; selector: string; instructions: string[]; instructionTitles?: string[]; instructionSelectors?: string[]; practiceWindow?: boolean; practiceLayout?: boolean; check: string }
export interface WalkthroughState { role: UserRole; index: number; subIndex?: number; active: boolean; completed: boolean; returnTo: string; version?: number }

const KEY = 'dawm_demo_walkthrough';
const VERSION = 2;
export const readWalkthrough = (): WalkthroughState | null => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as WalkthroughState | null;
    return saved && saved.version !== VERSION ? { ...saved, index: 0, subIndex: 0, active: false, completed: false, version: VERSION } : saved;
  } catch { return null; }
};
export const saveWalkthrough = (state: WalkthroughState) => sessionStorage.setItem(KEY, JSON.stringify({ ...state, version: VERSION }));
export const startWalkthrough = (resume: boolean) => window.dispatchEvent(new CustomEvent('start-demo-walkthrough', { detail: { resume } }));

const dashboardSteps = (role: UserRole, path = '/admin'): WalkthroughStep[] => [
  { title: 'Dashboard · Overview', detail: 'Overview answers: how many candidates are progressing, and what needs attention?', path: `${path}?section=overview`, selector: '[data-tour="dashboard-overview"]',
    instructions: ['Overview is open. This is the summary page; the next parts explain its individual cards.',
      'Candidate totals show how many files are active, completed or blocked. Select a total to open the matching records.',
      ...(role !== 'local-agency' ? ['Record check score summarizes missing or conflicting information. Open a warning to see what needs checking. The score belongs to the selected agency; it is not travel permission.'] : []),
      ...(role === 'superadmin' ? ['Journey radar shows the next recorded follow-ups. Tap a stage, use Priority lens for overdue work and holds, then open a candidate portrait to inspect the evidence. Ministry handoff is separate from local stage completion; this radar never changes assignments or approves travel.',
        'Payment issues lists foreign-agency transfers that need review, a reply or a decision. Open a case to read the receipt and history. Candidate fee failures are handled separately in Payments.'] : []),
      'Live roster shows who was recently active. Open a person to view their profile. An online dot does not prove they finished their work.'],
    instructionTitles: ['Overview', 'Candidate totals', ...(role !== 'local-agency' ? ['Record score'] : []), ...(role === 'superadmin' ? ['Journey radar', 'Payment issues'] : []), 'Live roster'],
    instructionSelectors: ['[role="tab"][aria-label="Overview"]', '[data-tour="dash-overview-executive"]',
      ...(role !== 'local-agency' ? ['[data-tour="dash-overview-integrity"]'] : []),
      ...(role === 'superadmin' ? ['[data-tour="dash-overview-journey-radar"]', '[data-tour="dash-overview-resolution"]'] : []), '[data-tour="dash-overview-presence"]'],
    check: 'Next: Workforce explains where candidates are in their journey.' },
  { title: 'Dashboard · Workforce', detail: 'Workforce answers: who is preparing to leave, working abroad or back home?', path: `${path}?section=portfolio`, selector: '[data-tour="dashboard-workforce"]',
    instructions: ['Workforce is open. These charts describe candidate progress. To assign staff work, use My tasks & team instead.',
      'Candidate journeys groups people by Registration, Training, Medical and Deployment. Select a group to see its candidates.',
      'Working abroad shows deployed workers and their destinations. Use their profiles to check contract dates and recorded returns.',
      'Candidate backgrounds groups people by occupation, home city and region. These charts use the agency selected in Dashboard view.',
      ...(role === 'local-agency' ? ['Partner contracts shows your agency’s agreements with foreign partners. Check the agreement before arranging a new contract.'] : [])],
    instructionTitles: ['Workforce', 'Journey stages', 'Working abroad', 'Backgrounds', ...(role === 'local-agency' ? ['Partner contracts'] : [])],
    instructionSelectors: ['[role="tab"][aria-label="Workforce"]', '[data-tour="dash-portfolio-lifecycle"]', '[data-tour="dash-portfolio-workforce"]', '[data-tour="dash-portfolio-mix"]',
      ...(role === 'local-agency' ? ['[data-tour="dash-portfolio-partners"]'] : [])],
    check: 'Next: Payments separates candidate fees from agency transfers.' },
  { title: 'Dashboard · Payments', detail: 'Payments answers: what money was received, and what is still unpaid?', path: `${path}?section=finance`, selector: '[data-tour="dashboard-payments"]',
    instructions: ['Payments is open. The totals belong to the selected agency. Candidate fees and foreign-agency transfers are separate.',
      'Candidate collections shows stage fees received from candidates. Open a receipt to check its amount and status. Failed, timed-out or missing receipts leave the fee unpaid.',
      'Foreign-agency transfers shows money sent to local agencies for contracts. Check the original currency; a USD estimate is only for reporting.',
      'Review foreign agency transfers opens detailed receipts and bank comparisons. There you can check the candidate, transaction ID, amount and currency.'],
    instructionTitles: ['Payments', 'Candidate fees', 'Agency transfers', 'Bank comparison'],
    instructionSelectors: ['[role="tab"][aria-label="Payments"]', '[data-tour="dash-finance-finance"]', '[data-tour="dash-finance-finance"]', '[data-tour="dashboard-transfer-review"]'],
    check: 'Next: Document checks covers contract payments and deadlines.' },
  { title: 'Dashboard · Document checks', detail: 'This page highlights contracts that need a payment or a deadline follow-up. Individual files are in each candidate’s Documents tab.', path: `${path}?section=compliance`, selector: '[data-tour="dashboard-documents"]',
    instructions: ['Document checks is open. Start with the contract-payment card, then check contracts ending soon.',
      'Foreign to local payment compliance checks whether a sent contract has a covering receipt. If no payment is recorded, follow up with the responsible foreign agency.',
      'For a contract-payment gap, check the candidate, sending agency, receiving agency, required amount and currency. This is a contract check, not proof of a bank underpayment.',
      'Contracts ending soon shows workers whose contract dates need attention. Open a profile to check the dates and record the next follow-up.',
      'To inspect a passport, contract or visa file, open the candidate and choose Documents. A missing file or ministry approval must be resolved before departure.'],
    instructionTitles: ['Contract checks', 'Missing payment', 'Payment details', 'Ending contracts', 'Candidate files'],
    instructionSelectors: ['[role="tab"][aria-label="Document checks"]', '[data-tour="dash-compliance-foreign-payment-compliance"]', '[data-tour="dash-compliance-foreign-payment-compliance"]', '[data-tour="dash-compliance-expiring"]', '[data-tour="dashboard-documents"]'],
    check: 'Next: Candidates helps you find and open an individual profile.' },
  { title: 'Dashboard · Candidates', detail: 'Candidates answers: where is the person I need, and what is their next step?', path: `${path}?section=candidates`, selector: '[data-tour="dashboard-candidates"]',
    instructions: ['Candidates is open. Use these existing ministry-managed profiles; do not create another record for the same person.',
      'Search by name, passport number or tracking code. Batch and status filters narrow the list; they do not change a candidate’s record.',
      'Select a status total to show its candidates. Select it again or clear the filter to restore the list. Column headings let you sort the results.',
      'Each row shows a portrait, identity and progress. Open Profile for full details, or View passport to inspect the saved scan.',
      'Check the tracking code before reviewing a document, receipt or chat. Next, My tasks explains your assigned work and follow-ups.'],
    instructionTitles: ['Candidate list', 'Search & filters', 'Status totals', 'Open a profile', 'Correct identity'],
    instructionSelectors: ['[role="tab"][aria-label="Candidates"]', '[data-tour="dash-candidates-filters"]', '[data-tour="dash-candidates-candidates"]', '[data-tour="dash-candidates-candidates"]', '[data-tour="dash-candidates-candidates"]'],
    check: 'You have visited all five dashboard sections. Next: My tasks.' },
];

export const walkthroughSteps = (role: UserRole, trackingCode?: string | null, candidateId = 'demo-cand-0431'): WalkthroughStep[] => {
  const steps = roleWalkthroughSteps(role, trackingCode, candidateId);
  return [{
    title: 'Make the workspace yours', detail: 'Start with window controls. Try them safely without changing a candidate or payment.',
    path: steps[0].path, selector: '[data-tour="walkthrough-window-practice"]', practiceWindow: true,
    instructions: ['We opened a practice popup for you. This is how profile and chat windows work: several can stay open together, and the page behind a popup stays still.',
      'Watch the practice window grow. Drag its bottom-right corner for your preferred size, or use Resize window with arrow keys for precise adjustments.',
      'We minimized the practice window with the yellow minus. It is still in Open windows at the bottom; your note stays intact.',
      'We restored it from the bottom dock. Select any open window there to switch between profiles and chats without losing your place.',
      'We closed the practice window with the red X. Closing ends that window; minimizing keeps it open. No candidate or payment records were changed.'],
    instructionTitles: ['Open a window', 'Resize', 'Minimize', 'Restore', 'Close'],
    instructionSelectors: ['[data-tour="walkthrough-window-practice"]', '[data-tour="walkthrough-window-practice"] [aria-label="Resize window"]',
      '[aria-label="Candidate workspace dock"]', '[data-tour="walkthrough-window-practice"]', '[data-tour="walkthrough-instruction"]'],
    check: 'Next comes your role’s work. The guide opens the right section and follows the feature, without resetting the page to the top.',
  }, ...(['superadmin', 'admin', 'staff', 'local-agency'].includes(role) ? [{
    title: 'Arrange dashboard panels', detail: 'Change the dashboard layout to suit your screen. This affects appearance, not records.',
    path: steps[0].path, selector: '[aria-label="Layout editor"]', practiceLayout: true,
    instructions: ['We opened Edit layout so you can see the panel controls. The guide does not change your saved layout.',
      'Use a panel’s size button to cycle through Full width, Two thirds, Half and One third. Smaller screens keep panels stacked.',
      'Drag a panel to reorder it, or use its left and right arrows. The minus hides a panel; its name in the layout editor brings it back.',
      'We finished editing. Select Edit layout to customize again. Reset layout restores the original arrangement. Preferences you change yourself are saved in this browser.'],
    instructionTitles: ['Edit layout', 'Panel sizes', 'Move & hide', 'Finish & reset'],
    instructionSelectors: ['[aria-label="Layout editor"]', '[aria-label^="Resize "]:not([aria-label="Resize window"])', '[aria-label="Layout editor"]', '[aria-label="Edit layout"]'],
    check: 'You can customize the layout again later. The guide never moves or hides your panels for you.',
  }] : []), ...steps];
};

const roleWalkthroughSteps = (role: UserRole, trackingCode?: string | null, candidateId = 'demo-cand-0431'): WalkthroughStep[] => {
  const profile = `/admin/candidate/${encodeURIComponent(candidateId)}`;
  if (role === 'superadmin' || role === 'admin' || role === 'staff') return [
    { title: 'Choose the dashboard view', detail: 'First choose whose dashboard you are learning.', path: '/admin?section=overview', selector: '[aria-label="Dashboard sections"]',
      instructions: [role === 'superadmin' ? 'Choose a local agency in Dashboard view, or keep All local agencies.' : 'Review the dashboard information available to your account.', 'The dashboard has five menus: Overview, Workforce, Payments, Document checks and Candidates. We will teach each one before My tasks.'],
      instructionSelectors: [role === 'superadmin' ? '[data-tour="dashboard-agency-scope"]' : '[aria-label="Dashboard sections"]', '[aria-label="Dashboard sections"]'],
      instructionTitles: ['Choose an agency', 'Dashboard sections'],
      check: 'The selected agency determines which totals and candidates appear. Next: Overview.' },
    ...dashboardSteps(role),
    { title: 'Start with My tasks', detail: role === 'superadmin' ? 'Understand agency flow, then investigate warnings and agency appeals. Local agency admins balance staff work.' : 'My tasks shows your follow-ups. Team workload shows who owns each candidate’s next stage.', path: '/admin/tasks', selector: '[data-tour="workload-manager"]',
      instructions: role === 'staff' ? ['Read your assigned tasks, due dates and payment blockers.', 'Open the earliest task and check the next required stage.', 'Record a follow-up on the candidate; do not skip an unpaid stage.']
        : role === 'superadmin' ? ['Read the registration-to-deployment flow and each agency’s blockers.', 'Open Review issue in My tasks and check the underlying evidence.', 'Escalate for ministry review or close with a reason. Open agency replies in Payment issues; appeals never lift a pause automatically.']
          : ['Read My tasks for warnings, replies and approvals that your role can review.', 'Review work by staff member in Team workload.', 'Follow up with the local agency manager when a task needs assigning.'],
      check: 'Task ownership does not grant extra permissions or complete a stage. Save the underlying record, not a checkbox in the queue.' },
    { title: 'Understand ministry intake', detail: 'ELMIS is the ministry’s candidate register. Staff use the assigned profile instead of creating another person.', path: '/admin', selector: '[data-tour="registration"]',
      instructions: ['Read the ministry connection status. The official ELMIS connection is not available yet.', 'Open an existing profile and check its local agency and Labor ID.', 'Upload via passport reads a scan and attaches it to one matching profile. It does not add a new candidate.'],
      instructionTitles: ['Ministry register', 'Agency & Labor ID', 'Passport upload'], check: 'Demo identity checks are practice only, not confirmation from the live ministry register.' },
    { title: 'Review the candidate identity', detail: 'Follow one existing practice candidate through the next steps.', path: profile, selector: '[data-tour="candidate-profile"]',
      instructions: ['Read the name, tracking code and passport details.', 'Check the local agency and home city.'], check: 'Use the same candidate and tracking code when checking documents and receipts.' },
    { title: 'Check registration payment', detail: 'Registration must be paid and completed before Training starts.', path: `${profile}?tab=payments`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Find the Registration fee and its receipt.', 'Check the paid amount and payment status.'], check: 'If money is missing or only partly paid, await payment; do not advance Training.' },
    { title: 'Follow ministry stage updates', detail: 'Registration → Training → Medical Check → Deployment.', path: `${profile}?tab=timeline`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Open the current ministry stage record.', 'Read its status, reference, date and location.', 'Follow up on local payment or document issues separately.'], check: 'Stages are read-only. Missing ministry locations remain awaiting an update.' },
    { title: 'Check training documents', detail: 'Keep required evidence linked to the correct candidate and stage.', path: `${profile}?tab=documents`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Review each requested file and its stage.', 'Read any document screening warnings before accepting a file.'], check: 'Missing documents are still requested; a warning is not automatically cleared.' },
    { title: 'Review medical checks', detail: 'All required exams need saved passing results and the medical fee must be paid.', path: `${profile}?tab=medical`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Review HIV and Final Agency Medical; review Pregnancy when required.', 'Check exam dates and any failed or missing result.'], check: 'One passing exam is not enough to complete Medical Check. Failed pregnancy blocks flight booking.' },
    { title: 'Review the contract and visa', detail: 'Travel preparation must not bypass essential records.', path: `${profile}?tab=contract`, selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['Read the employer, destination and contract status.', 'After the contract is sent, check for a successful foreign-to-local receipt.', 'If it is missing or short, follow up with the responsible foreign agency.', 'Check visa details and expiry.'], check: 'No receipt means unpaid. Contract transfers are separate from candidate stage fees.' },
    { title: 'Compare foreign transfers with bank records', detail: 'Contract amounts and bank differences are separate checks.', path: '/admin/payments?tab=discrepancies&source=foreign', selector: '[role="tabpanel"][data-state="active"]',
      instructions: ['The contract check shows what the foreign agency should pay for each candidate.',
        'Bank comparisons show whether the recorded transfer appears in the receiving agency’s uploaded statement.',
        'Open a short, extra or missing payment. Check the current candidate profile, transaction ID, amount and currency side by side.'],
      instructionTitles: ['Contract amount', 'Bank entry', 'Compare fields'], check: 'A suggested amount/date match is not a verified transaction ID. A payment warning still needs review.' },
    { title: 'Follow a payment issue', detail: 'Review → agency reply → recorded decision or appeal.', path: '/admin/payments?tab=resolution', selector: 'main h1',
      instructions: ['Open Payment issues and choose a foreign-to-local transfer case.', 'Match the candidate tracking code, transfer reference, currency and bank credit before confirming an underpayment.', 'Read the foreign agency’s remaining chances. The third distinct verified underpayment in the current cycle pauses new operations.', 'Check the ministry renewal date in the countdown; renewal restores chances but never lifts an active pause.', 'Read the reply deadline, agency appeal and recorded ministry decision. A release preserves used chances until the renewal date.'], check: 'Only authorized reviewers make decisions. Candidate ChechePay failures are payment statuses, not agency discrepancies. The guide never changes a case.' },
    { title: 'Review ministry references', detail: 'Visa and deployment references come from the ministry.', path: '/admin/clearance', selector: 'main h1',
      instructions: ['Find the candidate or search a reference number.', 'Inspect Visa, Enjaz, Tasheer and ministry issuance status.'], check: 'References are read-only. Certificates remain with the ministry.' },
    { title: 'Follow journeys and returns', detail: 'Previous journeys remain available for later applications.', path: '/admin/training-map', selector: '[data-tour="network-map"]',
      instructions: ['Choose a region or CoC center on the map.', 'Open a candidate route to inspect the journey.'], check: 'A new application keeps its own ordered stages; old deployment history does not skip them.' },
    { title: 'Open candidate conversations', detail: 'Chat is available from the floating icon, not the sidebar.', path: '/admin/tasks', selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Choose an existing thread or New chat.', 'Search for a candidate, open the conversation and check the tracking code before sending.'], check: 'Only candidates available to your account appear. Sending a message does not complete a task or stage.' },
  ].filter(step => role === 'superadmin' || step.path !== '/admin/payments?tab=resolution');
  if (role === 'local-agency') return [
    ...dashboardSteps(role, '/local-agency'),
    { title: 'Review My tasks and manage workload', detail: 'Your agency’s follow-ups and staff assignments stay together.', path: '/local-agency/tasks', selector: '[data-tour="workload-manager"]',
      instructions: ['Read My tasks for record warnings, replies and contract receipt checks.', 'Review work by staff member; assign a current task or use Balance agency work.', 'Open a task and record a follow-up on the candidate.'], check: 'Only approved staff from your own agency receive tasks; other agencies and paid stages are unchanged.' },
    { title: 'Check received payments', detail: 'Compare receipts with the receiving bank account.', path: '/local-agency/payments?tab=discrepancies&source=foreign', selector: 'main h1', instructions: ['Choose Foreign → local.', 'Review short, extra and missing bank entries.', 'Check candidate identity and transfer reference.'], check: 'Contract expectations and bank proof are different checks.' },
    { title: 'Review clearance', detail: 'Follow required medical, visa and ministry checks.', path: '/local-agency/clearance', selector: 'main h1', instructions: ['Find a candidate.', 'Read every unfinished clearance requirement.'], check: 'Do not book departure as complete without the required official confirmation.' },
    { title: 'Follow candidate journeys', detail: 'Review training routes and destinations.', path: '/local-agency/training-map', selector: '[data-tour="network-map"]', instructions: ['Choose a region or center.', 'Open a candidate route.'], check: 'The selected journey belongs to your agency.' },
    { title: 'Open candidate conversations', detail: 'Use the floating chat icon on any page.', path: '/local-agency/tasks', selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Choose an existing thread or New chat.', 'Search and open a candidate conversation.'], check: 'Only candidates in your agency appear.' },
  ];
  if (role === 'agency' || role === 'foreign-agency' || role === 'foreign-agency-staff') return [
    { title: 'Find your agency’s candidates', detail: 'Your dashboard shows candidate progress and links to your agency’s work.', path: '/agency', selector: '[data-tour="agency-pipeline"]',
      instructions: ['Candidate totals show active, completed, failed and waiting-for-clearance files. Select a total to filter the candidate list.',
        'The stage chart shows progress through Registration, Training, Medical and Deployment. Open a candidate to check the next unfinished stage.',
        role === 'foreign-agency-staff' ? 'My work opens tasks assigned to you. Start with the earliest follow-up; your manager assigns work.' : 'Staff workload opens My tasks & team. Review follow-ups, choose a staff owner or balance current work.',
        'Worker selection board builds a shortlist by job type and language. Saving a shortlist does not hire a worker, pay fees or advance a stage.'],
      instructionTitles: ['Candidate totals', 'Stage progress', 'My tasks', 'Worker shortlist'],
      instructionSelectors: ['[data-tour="agency-pipeline"]', '[data-tour="agency-pipeline"]', '[data-tour="agency-workload"]', '#worker-selection-board'],
      check: 'Next: My tasks explains follow-ups and staff assignments. Unpaid earlier stages still block progress.' },
    { title: role === 'foreign-agency-staff' ? 'Review your assigned work' : 'Assign agency work', detail: 'Follow current tasks without changing local stage ownership.', path: '/agency/tasks', selector: 'main h1',
      instructions: role === 'foreign-agency-staff' ? ['Read the tasks assigned to you.', 'Open the candidate and follow up on payment blockers and missing details.'] : ['Read My tasks for contract and agency-reply follow-ups.', 'Read Work by staff member.', 'Assign a current task, or use Balance agency work.'], check: 'Only approved staff in this agency receive work; awaiting payment remains a blocker.' },
    { title: 'Review candidate introductions', detail: 'Check introductions before coordinating a contract.', path: '/agency/introductions', selector: 'main h1', instructions: ['Open a candidate introduction.', 'Compare it with the candidate profile.'], check: 'Use the candidate’s tracking code when coordinating the contract.' },
    { title: 'Make payment after the contract is sent', detail: 'The responsible foreign agency pays the receiving local agency next.', path: '/agency/tasks', selector: 'main h1', instructions: ['Find Make contract payment in My tasks.', 'Open the candidate Payments tab.', role === 'foreign-agency-staff' ? 'Ask your agency manager to make the transfer, then follow up on its receipt.' : 'Choose Make payment for this candidate and check the amount, currency and receiving agency.', 'Return to Money sent to check the successful receipt.'], check: 'Missing, pending or short receipts keep payment open. This transfer does not pay the candidate’s stage fees.' },
    { title: 'Review money sent', detail: 'Your outbound receipts only, without bank-audit tools.', path: '/agency/payments?tab=ledger', selector: 'main h1', instructions: ['Open a receipt.', 'Check the receiving local agency, amount, currency and reference.'], check: 'These are your agency’s transfers, not candidate fees or another agency’s receipts.' },
    { title: 'Follow clearance', detail: 'Track requirements without bypassing local processing.', path: '/agency/clearance', selector: 'main h1', instructions: ['Find a candidate.', 'Read outstanding visa and clearance requirements.'], check: 'Only official confirmation can complete the ministry requirement.' },
    { title: 'Open candidate conversations', detail: 'Use the floating chat icon on any page.', path: '/agency/tasks', selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Choose an existing thread or New chat.', 'Search and open a candidate conversation.'], check: 'Check the candidate and tracking code before sending a message.' },
  ];
  if (role === 'candidate' && trackingCode) return [
    { title: 'Review your next step', detail: 'Your own stages and next actions.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="candidate-journey"]', instructions: ['Find your current stage and any payment request.', 'Review required documents and messages.'], check: 'Do not pay against another person’s tracking code or receipt.' },
    { title: 'Read your document reminders', detail: 'Helpful suggestions only, not staff assignments.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="my-tasks"]', instructions: ['Read any document reminder for your current stage.', 'Ask your agency which document is needed.', 'Open documents and upload the requested file to that stage.'], check: 'A document upload needs agency review; it does not complete a stage or confirm payment.' },
    { title: 'Contact your agency', detail: 'Your conversation stays attached to your own profile.', path: `/track/${encodeURIComponent(trackingCode)}`, selector: '[data-tour="chat-launcher"]', instructions: ['Click the bottom-right chat icon.', 'Open your thread or choose New chat.', 'Send your question or tag the document you need help with.'], check: 'You cannot open another candidate’s conversations.' },
  ];
  if (role === 'auditor') return [
    { title: 'Start with My tasks', detail: 'Your read-only review queue.', path: '/auditor/tasks', selector: '[data-tour="my-tasks"]', instructions: ['Start with the highest-priority warning.', 'Open the review record and check its evidence.'], check: 'You can review records but cannot assign staff or make agency decisions.' },
    { title: 'Review recorded warnings', detail: 'Read-only evidence review.', path: '/auditor', selector: 'main h1', instructions: ['Choose an issue and read the supporting records.', 'Review accepted exceptions and their recorded reasons.'], check: 'Warnings call for review; they are not proof of wrongdoing.' },
  ];
  return [
    { title: 'Start with My tasks', detail: 'Read-only tracking follow-up.', path: '/viewer/tasks', selector: '[data-tour="my-tasks"]', instructions: ['Read the tracking follow-up.', 'Use a tracking code shared with you to open public progress.'], check: 'No private records, staff assignments or payment tools are available to a viewer.' },
    { title: 'Track a candidate', detail: 'Open the available public tracking view.', path: '/viewer', selector: 'main h1', instructions: ['Enter a tracking code.', 'Review the public status information.'], check: 'Private candidate and payment details require authorized access.' },
  ];
};