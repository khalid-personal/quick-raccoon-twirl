import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUpRight, Blocks, Check, CheckCircle2, Code2, FileCheck2, Fingerprint, Globe2, GraduationCap, HeartPulse, Layers3, LockKeyhole, Plane, ShieldCheck, Sparkles, Users, Wallet, Workflow } from 'lucide-react';
import PublicSiteLayout from '@/components/PublicSiteLayout';
import { enterDemo } from '@/lib/demo-mode';

const journey = [
  { name: 'Registration', icon: Fingerprint, label: 'Start with the right identity.', detail: 'Use the existing ministry-managed profile. Check the candidate identity, agency assignment and registration receipt.' },
  { name: 'Training', icon: GraduationCap, label: 'Build a confident foundation.', detail: 'Coordinate training, required documents and the people responsible for each next step. Registration must be completed and paid first.' },
  { name: 'Medical', icon: HeartPulse, label: 'Put readiness before departure.', detail: 'Review required medical results and payment blockers. Missing or failed checks remain visible, not quietly skipped.' },
  { name: 'Deployment', icon: Plane, label: 'Connect the final moving parts.', detail: 'Bring the contract, visa, flight and clearance requirements together. Official ministry confirmation remains a requirement for departure.' },
];
const features = [
  { icon: Users, tag: 'PEOPLE', title: 'One profile. A shared picture.', text: 'Identity, documents, progress and conversations belong to the same candidate. Each team works within its agency and role.' },
  { icon: Wallet, tag: 'PAYMENTS', title: 'Follow the money. Not a guess.', text: 'Keep candidate stage fees separate from foreign-to-local transfers. Review receipts, unpaid fees and bank differences with the evidence beside them.' },
  { icon: Workflow, tag: 'WORKLOAD', title: 'Make the next step obvious.', text: 'My tasks gives each team an actionable queue. Managers can review ownership and balance work without bypassing payment or document gates.' },
  { icon: FileCheck2, tag: 'RECORDS', title: 'Clarity before clearance.', text: 'Find missing details, screen documents and follow contract deadlines. A record score helps prioritize review; it is never permission to travel.' },
];
const plans = [
  { name: 'Agency', audience: 'One agency. A stronger daily operation.', icon: Layers3, items: ['Candidate journeys and document review', 'Stage receipts and payment visibility', 'Team tasks and partner communication'], featured: false, scope: 'Start with your local team and the candidates it manages.', preparation: 'Confirm staff roles, existing candidate records and receipt sources.' },
  { name: 'Network', audience: 'Connected partners. One shared picture.', icon: Globe2, items: ['Local and foreign agency workflows', 'Contract transfer evidence and follow-ups', 'Agency-scoped reporting and workload'], featured: true, scope: 'Connect local intake teams with foreign destination partners, keeping every agency scoped.', preparation: 'Agree partner responsibilities, contract evidence and statement-upload ownership.' },
  { name: 'Institution', audience: 'Wide oversight. Clear accountability.', icon: ShieldCheck, items: ['Role-specific oversight and review', 'Multi-agency rollout planning', 'Integration and onboarding requirements'], featured: false, scope: 'Plan cross-agency oversight, investigations and future authorized integrations.', preparation: 'Define review permissions, audit ownership and provider integration prerequisites.' },
];

export default function LandingPage() {
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [motion, setMotion] = useState(false);
  const [rollout, setRollout] = useState(1);
  const hero = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = hero.current;
    if (!element) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const update = () => setMotion(!paused && !preference.matches && visible && !document.hidden);
    const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); update(); }, { threshold: .05 });
    observer.observe(element);
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); preference.removeEventListener('change', update); document.removeEventListener('visibilitychange', update); };
  }, [paused]);
  const CurrentIcon = journey[stage].icon;
  return <PublicSiteLayout atmospherePaused={paused}>
    <section ref={hero} className="public-hero" data-motion={motion ? 'active' : 'static'}>
      <div className="public-atmosphere" aria-hidden="true"><span className="public-aurora public-aurora-teal" /><span className="public-aurora public-aurora-lime" /><span className="public-perspective-grid" /></div>
      <div className="public-hero-orbit" aria-hidden="true" />
      <div className="public-container public-hero-grid">
        <div className="public-hero-copy">
          <p className="public-eyebrow"><span className="public-status-dot" /> BUILT IN ETHIOPIA. CONNECTED BEYOND.</p>
          <h1>Great journeys<br />start with<br /><em>everyone in sync.</em></h1>
          <p className="public-lead">From a first registration to a confident departure. DAWM brings candidates, agencies and oversight teams into one connected workforce workspace.</p>
          <div className="public-actions"><button className="public-button public-button-lime" onClick={() => enterDemo()}>Explore the live demo <ArrowUpRight size={19} /></button><a className="public-text-link" href="#platform">Meet the platform <ArrowDown size={17} /></a></div>
          <p className="public-caption"><LockKeyhole size={14} /> Demo records only. Your real data stays separate.</p>
        </div>
        <div className="public-network" aria-label="Illustration of a connected candidate journey"
          onPointerMove={event => {
            if (!motion || event.pointerType === 'touch') return;
            const bounds = event.currentTarget.getBoundingClientRect();
            event.currentTarget.style.setProperty('--network-tilt-x', `${(event.clientY - bounds.top - bounds.height / 2) / bounds.height * -5}deg`);
            event.currentTarget.style.setProperty('--network-tilt-y', `${(event.clientX - bounds.left - bounds.width / 2) / bounds.width * 5}deg`);
          }}
          onPointerLeave={event => { event.currentTarget.style.setProperty('--network-tilt-x', '0deg'); event.currentTarget.style.setProperty('--network-tilt-y', '0deg'); }}>
          <div className="public-network-topline"><span><span className="public-status-dot" /> THE CONNECTED JOURNEY</span><button type="button" className="public-motion-control" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Resume motion' : 'Pause motion'}</button></div>
          <svg className="public-network-lines" viewBox="0 0 520 470" fill="none" aria-hidden="true">
            <circle className="public-network-ring" cx="260" cy="235" r="165" stroke="currentColor" strokeDasharray="3 9" />
            <circle cx="260" cy="235" r="112" stroke="#c8f575" strokeOpacity=".13" />
            <path d="M95 100 Q260 40 425 125 M95 100 Q100 290 150 365 M425 125 Q445 290 375 365 M150 365 Q260 440 375 365" stroke="#c8f575" strokeOpacity=".45" />
            <path className="public-network-signal" d="M95 100 L260 235 L425 125 M260 235 L150 365 M260 235 L375 365" stroke="currentColor" strokeDasharray="6 7" />
            {motion && ['M95 100 L260 235 L425 125', 'M150 365 L260 235 L375 365', 'M425 125 Q445 290 375 365', 'M150 365 Q260 440 375 365'].map((path, index) => <circle key={path} r="3.5" className="public-network-packet" fill={index % 2 ? '#f4f4ed' : '#c8f575'}><animateMotion path={path} dur={`${6 + index}s`} begin={`${-index * 1.6}s`} repeatCount="indefinite" /></circle>)}
          </svg>
          <div className="public-network-center"><span className="public-network-avatar"><Users size={35} /></span><strong>A person.<br />Not a file number.</strong><span>One connected profile</span><span className="public-profile-key"><Fingerprint size={12} /> Identity · Evidence · Journey</span></div>
          <div className="public-network-node public-node-one"><Fingerprint /><span>Local agency<small>Identity & intake</small></span><CheckCircle2 size={15} /></div>
          <div className="public-network-node public-node-two"><Globe2 /><span>Foreign partner<small>Contracts & transfers</small></span></div>
          <div className="public-network-node public-node-three"><GraduationCap /><span>Training center<small>Skills & readiness</small></span></div>
          <div className="public-network-node public-node-four"><ShieldCheck /><span>Oversight<small>Review & clearance</small></span></div>
          <div className="public-network-bottom"><span>REGISTRATION</span><span className="public-network-track" /><Plane size={16} /><span>DEPARTURE</span></div>
          <span className="public-network-disclosure">Product illustration, not live candidate data</span>
        </div>
      </div>
      <div className="public-container public-audience"><span>ONE WORKSPACE, EVERY PERSPECTIVE</span><div><span>Local agencies</span><span>Foreign partners</span><span>Training teams</span><span>Oversight</span><span>Candidates</span></div></div>
    </section>

    <section id="platform" className="public-section public-light">
      <div className="public-container">
        <div className="public-section-heading"><div><p className="public-eyebrow">LESS FRAGMENTATION. MORE FORWARD.</p><h2>Complex work.<br /><span>Beautifully connected.</span></h2></div><p>DAWM is Domestic Agency Workforce Management: a shared operating picture for overseas employment, built around the people making the journey.</p></div>
        <div className="public-feature-grid">{features.map(({ icon: Icon, tag, title, text }) => <article className="public-feature-card" key={tag}><div className="public-feature-top"><span className="public-icon"><Icon size={25} /></span><span>{tag}</span></div><h3>{title}</h3><p>{text}</p><span className="public-feature-line" aria-hidden="true" /></article>)}</div>
      </div>
    </section>

    <section id="journey" className="public-section public-journey-section">
      <div className="public-container public-journey-grid">
        <div><p className="public-eyebrow">A JOURNEY, NOT A JUMP.</p><h2>Every stage.<br /><em>In the right order.</em></h2><p className="public-lead">A clear path forward, with the right checks along the way. Select a stage to explore how it fits.</p><div role="tablist" aria-label="Explore journey stages" className="public-stage-list">{journey.map(({ name, icon: Icon }, index) => <button key={name} id={`journey-tab-${index}`} role="tab" aria-selected={stage === index} aria-controls="journey-panel" tabIndex={stage === index ? 0 : -1} onClick={() => setStage(index)} onKeyDown={event => { if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : 3)) % 4; setStage(next); document.getElementById(`journey-tab-${next}`)?.focus(); } }}><span>0{index + 1}</span><Icon size={20} />{name}<ArrowRight size={17} /></button>)}</div></div>
        <div id="journey-panel" role="tabpanel" aria-labelledby={`journey-tab-${stage}`} className="public-journey-panel"><div className="public-journey-panel-head"><span>JOURNEY BLUEPRINT</span><span>0{stage + 1} / 04</span></div><div className="public-stage-art" aria-hidden="true"><span className="public-stage-orbit" /><CurrentIcon size={65} strokeWidth={1.3} /><span className="public-stage-number">0{stage + 1}</span></div><p className="public-eyebrow">{journey[stage].name.toUpperCase()}</p><h3>{journey[stage].label}</h3><p>{journey[stage].detail}</p><div className="public-stage-note"><ShieldCheck size={18} /> Earlier unpaid stages remain blockers.</div></div>
      </div>
    </section>

    <section className="public-section public-light">
      <div className="public-container public-integration-card"><div><p className="public-eyebrow"><Code2 size={16} /> BUILD THE NEXT CONNECTION</p><h2>A platform today.<br /><span>An integration-ready vision.</span></h2><p>Plan the connections between ministry intake, agency systems and payment providers. Our developer guide makes the current boundaries and future requirements clear.</p><Link to="/developers" className="public-button public-button-dark">Read integration docs <ArrowUpRight size={18} /></Link></div><div className="public-code-preview"><div><span className="public-code-dot" /><span className="public-code-dot" /><span className="public-code-dot" /><span>integration-roadmap</span></div><pre><code>{`candidate identity  ->  ministry register\nagency assignment   ->  scoped workspace\npayment receipt     ->  verified status\njourney milestone   ->  next required step\n\n// Plan first. Connect with an agreed contract.`}</code></pre><p><Blocks size={16} /> Future public API: planning, not yet available</p></div></div>
    </section>

    <section id="pricing" className="public-section public-pricing-section">
      <div className="public-container"><div className="public-centered-heading"><p className="public-eyebrow">PRICING & ROLLOUT</p><h2>Your scale.<br /><em>Your connected start.</em></h2><p>Choose an operational scope to explore what fits. Commercial prices and packages are not published yet; each option is a proposed scope, not a purchasable plan.</p></div>
        <div className="public-rollout-selector" role="group" aria-label="Explore rollout scope">{plans.map((plan, index) => <button type="button" key={plan.name} aria-pressed={rollout === index} aria-controls="rollout-detail" onClick={() => setRollout(index)}><plan.icon size={19} />{plan.name}<span>{index === 0 ? 'Local team' : index === 1 ? 'Partner network' : 'Oversight'}</span></button>)}</div>
        <div className="public-pricing-grid">{plans.map(({ name, audience, icon: Icon, items, featured }, index) => <article key={name} className={`public-pricing-card${rollout === index ? ' public-pricing-featured' : ''}`}><span className="public-plan-label">{featured ? 'CONNECTED OPERATIONS' : 'ROLLOUT OPTION'}</span><Icon className="public-plan-icon" size={28} /><h3>{name}</h3><p>{audience}</p><strong className="public-price">Designed around your operation.</strong><span className="public-caption">Pricing to be confirmed · no checkout</span><ul>{items.map(item => <li key={item}><Check size={17} />{item}</li>)}</ul><button type="button" aria-pressed={rollout === index} aria-controls="rollout-detail" className={`public-button ${rollout === index ? 'public-button-lime' : 'public-button-outline'}`} onClick={() => setRollout(index)}>{rollout === index ? 'Exploring this scope' : 'Explore this scope'} <ArrowDown size={17} /></button></article>)}</div>
        <div id="rollout-detail" className="public-rollout-detail" aria-live="polite"><div><p className="public-eyebrow"><CheckCircle2 size={16} />{plans[rollout].name.toUpperCase()} · ROLLOUT BLUEPRINT</p><h3>{plans[rollout].scope}</h3><p>{plans[rollout].preparation}</p></div><div><p className="public-caption">Next: explore before you commit.</p><div className="public-actions"><button type="button" className="public-button public-button-lime" onClick={() => enterDemo()}>Explore the demo <ArrowUpRight size={17} /></button><Link to="/developers" className="public-text-link">Integration requirements <ArrowRight size={17} /></Link></div><p className="public-caption">The demo shows existing workflows, not purchased plan entitlements.</p></div></div>
        <p className="public-pricing-note">No checkout, subscription or integration entitlement is offered on this page. Explore the demo before planning a rollout.</p>
      </div>
    </section>

    <section className="public-section public-light"><div className="public-container public-faq"><div><p className="public-eyebrow">GOOD QUESTIONS. CLEAR ANSWERS.</p><h2>Before you<br /><span>make the leap.</span></h2></div><div>
      {[
        ['Is the demo connected to live records?', 'No. The demo uses separate practice records. It is for exploring workflows, not confirming real identity, payments or travel clearance.'],
        ['Who is DAWM for?', 'Local and foreign agencies, their staff, oversight reviewers and candidates. Each role has its own workspace and permitted actions.'],
        ['Can I integrate with ELMIS today?', 'Not yet. Live ELMIS synchronization requires the official API contract, authorized credentials and approved identity reconciliation. The developer guide explains the prerequisites.'],
        ['What does a candidate see?', 'Their own journey, payment requests, documents and agency conversations. Candidates do not receive staff management or payment-review tools.'],
      ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
    </div></div></section>
    <section className="public-final-cta"><div className="public-container"><p className="public-eyebrow"><Sparkles size={16} /> FROM SCATTERED TO SYNCHRONIZED</p><h2>The next journey<br />deserves <em>a better start.</em></h2><div className="public-actions"><button className="public-button public-button-lime" onClick={() => enterDemo()}>Take DAWM for a spin <ArrowUpRight size={19} /></button><Link to="/login" className="public-text-link">Already part of the team? Sign in <ArrowRight size={17} /></Link></div></div></section>
  </PublicSiteLayout>;
}
