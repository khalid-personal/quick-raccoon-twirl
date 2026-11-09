import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, KeyRound, ShieldCheck, UserRound, Workflow, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StaffLoginForm from '@/components/StaffLoginForm';
import CandidateLoginForm from '@/components/CandidateLoginForm';
import { MadeWithDyad } from '@/components/made-with-dyad';
import DevQuickAccess from '@/components/DevQuickAccess';
import DawmBrand from '@/components/DawmBrand';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { enterDemo } from '@/lib/demo-mode';
import { DEMO_CANDIDATE_COUNT } from '@/lib/demo-dataset';
import { CursorGlow, WorkflowIllustration } from '@/components/LandingExperience';

const highlights = [
  { icon: Workflow, title: 'Every step in one place', text: 'Track every candidate from registration to departure.' },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Each agency sees only the candidates it is responsible for.' },
  { icon: Wallet, title: 'Stage payments', text: 'Transparent fees and receipts for every deployment stage.' },
];

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'candidate' ? 'candidate' : 'staff';
  const [tab, setTab] = React.useState(initialTab);
  return (
    <div className="dawm-auth grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      <div className="fixed right-3 top-3 z-40 rounded-full border bg-card/90 shadow-sm backdrop-blur"><ThemeToggle /></div>
      <aside className="auth-story relative hidden overflow-hidden p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <CursorGlow />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="relative">
          <DawmBrand appearance="dark" showOrigin />
        </div>
        <div className="relative max-w-lg space-y-8">
          <div className="space-y-3">
            <p className="auth-story-label">THE WORKFORCE COMMAND CENTER</p>
            <h1 className="auth-story-title font-semibold leading-tight tracking-tight text-white">One connected journey.<br /><span>A confident start abroad.</span></h1>
            <p className="text-base text-sidebar-foreground/80">A trusted workspace for agencies, staff and candidates to manage every step of overseas deployment.</p>
          </div>
          <ul className="space-y-5">
            {highlights.map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="flex gap-4 motion-safe:animate-fade-up" style={{ animationDelay: `${150 + index * 110}ms` }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white"><Icon className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-sm text-sidebar-foreground/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          <WorkflowIllustration />
          <div className="auth-journey-strip" aria-label="Connected journey stages">{['Registration', 'Training', 'Medical', 'Deployment'].map((stage, index) => <span key={stage}><b>0{index + 1}</b>{stage}{index < 3 && <ArrowRight aria-hidden="true" className="h-3 w-3" />}</span>)}</div>
        </div>
        <p className="relative flex items-center gap-2 text-xs text-sidebar-foreground/60"><CheckCircle2 className="h-4 w-4" /> Secured with row-level access control</p>
      </aside>

      <main className="auth-main relative flex min-w-0 flex-col items-center justify-center overflow-hidden p-5 sm:p-8">
        <CursorGlow darkOnly />
        <div className="relative w-full max-w-[600px] space-y-6 motion-safe:animate-fade-up">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} />Back to DAWM</Link>
          <div className="space-y-1.5 text-left">
            <div className="auth-mobile-brand mb-5 flex items-center justify-between rounded-2xl p-5 lg:hidden">
              <DawmBrand compact appearance="dark" />
              <ShieldCheck aria-hidden="true" className="h-7 w-7 shrink-0 text-[#c8f575]" />
            </div>
            <p className="auth-eyebrow">{tab === 'candidate' ? 'YOUR JOURNEY, CONNECTED' : 'YOUR WORKSPACE, CONNECTED'}</p>
            <h2 className="text-4xl font-semibold tracking-tight">{tab === 'candidate' ? 'Your next step starts here.' : 'Your operation. In sync.'}</h2>
            <p className="text-sm text-muted-foreground">{tab === 'candidate' ? 'Track your stages, documents and agency updates.' : 'Sign in to your approved staff or agency workspace.'}</p>
          </div>

          <div className="auth-access-card overflow-hidden rounded-3xl border bg-card p-4 shadow-sm sm:p-7">
            <div className="auth-access-intro mb-5 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-5 w-5 text-primary" />Workspace access</span><span className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">Approved accounts</span></div>
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList aria-label="Login type" className="auth-login-tabs grid w-full grid-cols-2">
                <TabsTrigger value="staff" className="auth-login-tab"><ShieldCheck aria-hidden="true" /><span>Staff Login</span></TabsTrigger>
                <TabsTrigger value="candidate" className="auth-login-tab"><UserRound aria-hidden="true" /><span>Candidate Login</span></TabsTrigger>
              </TabsList>
              <div className="auth-role-guide mt-4 rounded-xl border bg-primary/5 p-4"><p className="text-sm font-semibold">{tab === 'candidate' ? 'For your own candidate journey' : 'For staff, agencies and oversight teams'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tab === 'candidate' ? 'Use your email or tracking code and agency-provided PIN. Follow your documents, fees and updates—not other candidates’ private records.' : 'Use your approved email and PIN. Your agency and assigned role decide which records, reviews and tasks you can access.'}</p></div>
              <TabsContent value="staff" className="pt-5">
                <StaffLoginForm />
              </TabsContent>
              <TabsContent value="candidate" className="pt-5">
                <CandidateLoginForm />
              </TabsContent>
            </Tabs>
            {import.meta.env.DEV && <details className="auth-dev-disclosure mt-5 rounded-xl border px-4"><summary className="cursor-pointer py-3 text-xs font-semibold text-muted-foreground">Developer tools · test accounts only</summary><DevQuickAccess /></details>}
          </div>
          <div className="auth-demo-card rounded-2xl border p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FlaskConical className="h-5 w-5" /></span>
              <div className="space-y-1">
                <h3 className="text-base font-semibold">See the workspace before signing in</h3>
                <p className="text-sm text-muted-foreground">
                  Explore {DEMO_CANDIDATE_COUNT} practice candidates and connected agency workflows. No credentials needed; demo data stays separate from real records.
                </p>
              </div>
            </div>
            <Button className="auth-demo-action mt-4 w-full" variant="secondary" onClick={() => enterDemo()}>Open the demo <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <MadeWithDyad />
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
