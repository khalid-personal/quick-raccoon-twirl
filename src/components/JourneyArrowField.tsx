import { useEffect, useRef, type CSSProperties } from 'react';

export default function JourneyArrowField({ paused = false, compact = false }: { paused?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let frame = 0;
    const activity = () => { element.dataset.motion = !paused && !preference.matches && visible && !document.hidden ? 'scroll' : 'static'; };
    const scroll = () => {
      if (paused || preference.matches || compact || !visible || document.hidden || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        element.querySelectorAll<HTMLElement>('.journey-shooting-arrow').forEach((arrow, index) => {
          const position = window.scrollY * .0012 + index * .37;
          const cycle = Math.floor(position);
          const phase = position - cycle;
          arrow.style.setProperty('--arrow-left', `${(index * 29 + cycle * 43 + 7) % 96}%`);
          arrow.style.setProperty('--arrow-top', `${(index * 37 + cycle * 23 + 11) % 94}%`);
          arrow.style.setProperty('--arrow-shift-x', `${-phase * 100}px`);
          arrow.style.setProperty('--arrow-shift-y', `${phase * 70}px`);
          arrow.style.setProperty('--arrow-fade', `${Math.sin(phase * Math.PI) * (.18 + index % 4 * .06)}`);
        });
      });
    };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); activity(); }) : null;
    observer?.observe(element);
    preference.addEventListener('change', activity);
    document.addEventListener('visibilitychange', activity);
    window.addEventListener('scroll', scroll, { passive: true });
    activity(); scroll();
    return () => {
      observer?.disconnect(); cancelAnimationFrame(frame);
      preference.removeEventListener('change', activity);
      document.removeEventListener('visibilitychange', activity);
      window.removeEventListener('scroll', scroll);
    };
  }, [paused, compact]);
  return <div ref={ref} aria-hidden="true" className={`journey-arrow-field ${compact ? 'journey-arrow-field-compact' : ''}`} data-motion="static">
    <div className="journey-arrow-parallax">
      {Array.from({ length: compact ? 8 : 24 }, (_, index) => <span key={index} className="journey-shooting-arrow" style={{
        '--arrow-left': `${(index * 29 + 7) % 120 - 10}%`,
        '--arrow-top': `${(index * 37 + 11) % 130 - 15}%`,
        '--arrow-size': `${12 + index % 4 * 4}px`,
        '--arrow-opacity': .16 + index % 4 * .08,
      } as CSSProperties}>
        <svg viewBox="0 0 180 60" fill="none">
          <path d="M4 35H126" className="journey-arrow-trail" strokeWidth="1" />
          <path d="M50 35H128" className="journey-arrow-trail" strokeWidth="3" />
          <path d="M111 17L153 17L153 49L143 55L143 27L111 27Z" className="journey-arrow-side" />
          <path d="M110 8H160V48H149V26L125 50L117 42L141 18H110Z" className="journey-arrow-face" />
          <path d="M110 8H160L153 17H111M160 8V48L153 49" className="journey-arrow-edge" strokeWidth="1.5" />
        </svg>
      </span>)}
    </div>
  </div>;
}