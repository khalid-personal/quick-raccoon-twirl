import React, { useEffect, useRef, useState } from 'react';
import { DEMO_CANDIDATE_COUNT } from '@/lib/demo-dataset';

function CursorGlow({ darkOnly = false }: { darkOnly?: boolean }) {
  const glow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = glow.current;
    const container = element?.parentElement;
    if (!element || !container) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previous: { x: number; y: number } | null = null;
    let next: { x: number; y: number; angle: number; length: number } | null = null;

    const move = (event: PointerEvent) => {
      if (motion.matches || event.pointerType === 'touch') return;
      const bounds = container.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      const dx = previous ? x - previous.x : 0;
      const dy = previous ? y - previous.y : 0;
      next = { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI, length: Math.min(140, Math.hypot(dx, dy) * 3 + 30) };
      previous = { x, y };
      if (!frame) frame = requestAnimationFrame(() => {
        if (next) {
          element.style.setProperty('--glow-x', `${next.x}px`);
          element.style.setProperty('--glow-y', `${next.y}px`);
          element.style.setProperty('--glow-angle', `${next.angle}deg`);
          element.style.setProperty('--glow-length', `${next.length}px`);
          element.classList.add('landing-cursor-visible');
        }
        frame = 0;
      });
    };
    const hide = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previous = null;
      element.classList.remove('landing-cursor-visible');
    };
    container.addEventListener('pointermove', move);
    container.addEventListener('pointerleave', hide);
    motion.addEventListener('change', hide);
    return () => {
      container.removeEventListener('pointermove', move);
      container.removeEventListener('pointerleave', hide);
      motion.removeEventListener('change', hide);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={glow} aria-hidden="true" className={`landing-cursor-glow${darkOnly ? ' landing-cursor-dark-only' : ''}`}>
    <span className="landing-cursor-trail" />
    <span className="landing-cursor-light" />
  </div>;
}

function DemoCount() {
  const [count, setCount] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? DEMO_CANDIDATE_COUNT : 0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (time: number) => {
        const progress = Math.min((time - start) / 1600, 1);
        setCount(Math.round(DEMO_CANDIDATE_COUNT * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      setCount(0);
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.3 });
    const stopMotion = () => {
      if (motion.matches) {
        observer.disconnect();
        cancelAnimationFrame(frame);
        setCount(DEMO_CANDIDATE_COUNT);
      }
    };
    motion.addEventListener('change', stopMotion);
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); motion.removeEventListener('change', stopMotion); };
  }, []);

  return <span ref={ref} aria-label={`${DEMO_CANDIDATE_COUNT} demo candidates`}>{count.toLocaleString()}</span>;
}

function WorkflowIllustration() {
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: no-preference)');
    const update = () => setAnimate(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return <section aria-label="Illustrative data flow" className="landing-workflow rounded-xl border border-white/10 bg-white/[0.04] p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200">Connected workflow</p>
        <p className="mt-1 text-xs text-slate-300">One record, moving through the journey</p>
      </div>
      <div className="text-right">
        <p className="text-xl font-semibold tabular-nums text-white"><DemoCount /></p>
        <p className="text-[10px] text-slate-300">demo candidates</p>
      </div>
    </div>
    <svg viewBox="0 0 480 116" className="mt-3 w-full" aria-hidden="true">
      <defs>
        <linearGradient id="landing-flow-gradient" x1="0" x2="1">
          <stop stopColor="#818cf8" /><stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <path d="M 75 54 H 405" fill="none" stroke="#64748b" strokeOpacity=".35" strokeWidth="1.5" />
      <path className="landing-flow-line" d="M 75 54 H 405" fill="none" stroke="url(#landing-flow-gradient)" strokeWidth="2" />
      {[75, 240, 405].map(x => <g key={x}>
        <rect x={x - 30} y="24" width="60" height="60" rx="14" fill="#172339" stroke="#6574a1" strokeWidth="1" />
        <circle cx={x} cy="54" r="13" fill="none" stroke="#a5b4fc" strokeWidth="1.5" />
        <path d={`M ${x - 5} 54 h 10 M ${x} 49 v 10`} stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" />
      </g>)}
      <text x="75" y="106" textAnchor="middle" fill="#cbd5e1" fontSize="11">CRM</text>
      <text x="240" y="106" textAnchor="middle" fill="#cbd5e1" fontSize="11">Supply chain</text>
      <text x="405" y="106" textAnchor="middle" fill="#cbd5e1" fontSize="11">Accounting</text>
      {animate && <g>
        <rect x="-9" y="-11" width="18" height="22" rx="3" fill="#e0e7ff" stroke="#818cf8" />
        <path d="M -5 -5 H 5 M -5 0 H 5 M -5 5 H 2" stroke="#4f46e5" strokeWidth="1.2" strokeLinecap="round" />
        <animateMotion path="M 75 54 H 405" dur="6s" repeatCount="indefinite" />
      </g>}
    </svg>
    <p className="text-[10px] text-slate-400">Illustration only · not a live transaction</p>
  </section>;
}

export { CursorGlow, WorkflowIllustration };
