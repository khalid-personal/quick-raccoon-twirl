import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, FlaskConical, ShieldCheck, Workflow, Wallet } from 'lucide-react';
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
  { icon: Workflow, title: 'End-to-end pipeline', text: 'Track every candidate from registration to departure.' },
  { icon: ShieldCheck, title: 'Role-based access', text: 'Each agency sees only the candidates it is responsible for.' },
  { icon: Wallet, title: 'Stage payments', text: 'Transparent fees and receipts for every deployment stage.' },
];

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'candidate' ? 'candidate' : 'staff';
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="fixed right-3 top-3 z-40 rounded-full border bg-card/90 shadow-sm backdrop-blur"><ThemeToggle /></div>
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <CursorGlow />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sidebar-primary/10 blur-3xl" />
        <div className="relative">
          <DawmBrand appearance="dark" showOrigin />
        </div>
        <div className="relative max-w-lg space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white">One connected journey.<br />A confident start abroad.</h1>
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
        </div>
        <p className="relative flex items-center gap-2 text-xs text-sidebar-foreground/60"><CheckCircle2 className="h-4 w-4" /> Secured with row-level access control</p>
      </aside>

      <main className="relative flex flex-col items-center justify-center overflow-hidden bg-background p-6">
        <CursorGlow darkOnly />
        <div className="relative w-full max-w-md space-y-6 motion-safe:animate-fade-up">
          <div className="space-y-1.5 text-center lg:text-left">
            <div className="mb-5 flex justify-center lg:hidden">
              <DawmBrand compact />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to access your workspace.</p>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm motion-safe:animate-scale-in [animation-delay:120ms]">
            <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="staff">Staff Login</TabsTrigger>
                <TabsTrigger value="candidate">Candidate Login</TabsTrigger>
              </TabsList>
              <TabsContent value="staff" className="pt-5">
                <StaffLoginForm />
              </TabsContent>
              <TabsContent value="candidate" className="pt-5">
                <CandidateLoginForm />
              </TabsContent>
            </Tabs>
            {import.meta.env.DEV && <DevQuickAccess />}
          </div>
          <div className="rounded-xl border border-dashed bg-muted/40 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FlaskConical className="h-5 w-5" /></span>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Explore the demo</h3>
                <p className="text-sm text-muted-foreground">
                  A full portal with {DEMO_CANDIDATE_COUNT} candidates, 4 CoC centers, local and foreign agencies, and integrity flags at every priority.
                  It is a separate sandbox, so your real data is never touched. Use the eye icon to view it as any agency or candidate.
                </p>
              </div>
              <div className="rounded-xl bg-sidebar p-1 lg:hidden"><WorkflowIllustration /></div>
            </div>
            <Button className="mt-4 w-full" variant="secondary" onClick={() => enterDemo()}>Open the demo</Button>
          </div>
          <MadeWithDyad />
        </div>
      </main>
    </div>
  );
};

export default AuthPage;
