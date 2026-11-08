import React, { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

// Counts from the previously shown value to the new one.
const AnimatedNumber: React.FC<{ value: number; duration?: number; className?: string }> = ({ value, duration = 800, className }) => {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const next = Math.round(origin + (value - origin) * easeOutCubic(progress));
      from.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return <span className={className} aria-label={String(value)}>{shown.toLocaleString()}</span>;
};

export default AnimatedNumber;
