import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import React from 'react';
import { CardTitle } from '@/components/ui/card';

const HELP: Array<{ match: RegExp; text: string }> = [
  { match: /receipt|payment evidence|discrepanc|bank statement|reconciliation/i, text: 'Compare recorded receipts with imported bank credits. Reference matches and amount/date matches are disclosed separately. Currency differences cannot be compared numerically. Record investigation, evidence requests, escalation owners and due dates; local case logs do not send notifications or change settlement status.' },
  { match: /payment|finance|collection/i, text: 'Candidate stage fees and foreign-agency transfers are separate sources. Amounts remain in their recorded currency. A succeeded transaction is not automatically proof of a matching bank deposit. Open receipts and the discrepancy workspace to inspect supporting evidence.' },
  { match: /passport|registration|add new candidate/i, text: 'Create a candidate record manually or prefill it from a passport scan. Review extracted details and upload-screening findings before saving. A scan is not an identity-verification decision.' },
  { match: /integrity|compliance|anti-corruption/i, text: 'Review rule-based flags such as duplicate identity data, missing payments and incomplete checks. Flags need investigation; they are not a finding of fraud. Authorized overrides require a reason and an audit record.' },
  { match: /clearance|visa|enjaz|tasheer|ministry|qr/i, text: 'Check visa, Enjaz and Tasheer readiness before marking local clearance ready. Official printing requires ministry-issued evidence. Demo simulations are labeled and cannot issue an official certificate. Live provider integrations require configuration.' },
  { match: /portfolio|lifecycle|working abroad|workforce|mix/i, text: 'Review where candidates are in their employment journey, including training, deployment, work abroad and return. The selected agency scope applies to these views. Lifecycle categories differ from the four-stage pipeline status.' },
  { match: /dashboard|command|control room|overview|pipeline/i, text: 'Use Command for movement and risk, Portfolio for workforce details, Finance for collections, Compliance for expiring contracts, and Candidates for record search. Local agencies see their own records; Superadmin can select an agency for charts. System-wide integrity remains an administration view.' },
  { match: /contract|expiring/i, text: 'Inspect work-contract handoffs, partner agreements and upcoming expiry dates. Confirm original contract evidence before acting. Reminder links open an external channel; they do not prove a reminder was delivered.' },
  { match: /staff|user management|profile approvals/i, text: 'Manage permitted staff or profile records and approval status. Local agencies manage their own staff; Superadmin manages portal-wide access. Changes to role or approval affect which protected workflows are available.' },
  { match: /candidate introductions|profile|candidate/i, text: 'Search and open candidate records to review their timeline, uploads, contacts, payments and agency assignments. Shared profiles and ownership determine agency visibility. Check the original evidence before updating a stage.' },
  { match: /chat|message|inbox/i, text: 'Open candidate or agency-partner conversations within your permitted scope. Unread counts reflect stored read status. Use the conversation itself to send messages; a local case escalation does not automatically send a chat message.' },
  { match: /attendance|presence|online|roster/i, text: 'Review check-in sessions and recent activity. Online presence is not proof of attendance. In local/demo mode it reflects browser activity; shared live presence depends on Supabase and its policies.' },
  { match: /map|centre|center|training|destination|journey/i, text: 'Inspect candidate origins, training centers and destination routes within your role scope. Flight or route displays are planning information unless backed by a configured live provider.' },
  { match: /task/i, text: 'Review stage tasks assigned to the selected staff member. Completion should follow supporting candidate evidence; task status is separate from payment settlement.' },
  { match: /notification/i, text: 'Review stored notices and mark them read. A read flag is not evidence of delivery through an external email or SMS provider.' },
  { match: /auth code|authorization/i, text: 'Manage staff registration authorization codes, expiry and usage. Only authorized administrators should issue or revoke them; do not share account passwords with a code.' },
  { match: /settings|configuration/i, text: 'Change permitted portal configuration, agency definitions and fee settings. Browser display fees must match server payment configuration before hosted checkout can start.' },
  { match: /public tracking/i, text: 'Look up the public candidate journey by tracking code. Public tracking does not grant permission to edit a candidate record or record a verified payment.' },
  { match: /getting started|guide/i, text: 'Open the role-specific workflow guide. Follow the available routes for your role; simulation and live integrations have different evidence requirements.' },
  { match: /layout/i, text: 'Reorder, resize or hide dashboard tiles for this browser. Layout customization changes the presentation only, not underlying candidate or payment records.' },
];

function featureHelp(title: string) {
  return HELP.find(item => item.match.test(title))?.text ?? 'Review the displayed records within your account permissions. Open the related record for supporting evidence before making changes. Demo/local data does not establish that an external service verified the result.';
}

function headingText(children: React.ReactNode): string {
  return React.Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) return headingText(child.props.children);
    return '';
  }).filter(Boolean).join('').trim();
}

export const FeatureCardTitle = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof CardTitle>>(({ children, ...props }, ref) => {
  const title = headingText(children);
  return <CardTitle ref={ref} {...props} aria-label={props['aria-label'] ?? title}>{children}{title && <FeatureInfo title={title} className="ml-1 align-middle" />}</CardTitle>;
});
FeatureCardTitle.displayName = 'FeatureCardTitle';

export default function FeatureInfo({ title, description, className }: { title: string; description?: string; className?: string }) {
  return <Popover>
    <PopoverTrigger asChild>
      <button type="button" aria-label={`About ${title}`} title={`About ${title}`} className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
        <Info className="h-4 w-4" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="max-w-[calc(100vw-2rem)] text-sm">
      <p className="mb-2 font-semibold">{title}</p>
      {description && <p className="mb-2 text-muted-foreground">{description}</p>}
      <p className="leading-relaxed">{featureHelp(title)}</p>
    </PopoverContent>
  </Popover>;
}