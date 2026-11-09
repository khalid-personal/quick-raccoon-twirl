import { useId } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';

export default function MapRouteSignal({ path, color = '#285f59', u, running = true, selected = false }: {
  path: string; color?: string; u: number; running?: boolean; selected?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const id = `route-signal-${useId().replace(/:/g, '')}`;
  const animate = running && !reduced;
  return <g className="map-route-signal" data-motion={animate ? 'active' : 'static'}>
    <defs><linearGradient id={id}><stop stopColor={color} stopOpacity=".1" /><stop offset="1" stopColor="#c8f575" /></linearGradient></defs>
    <path d={path} fill="none" stroke={color} strokeWidth={selected ? 9 : 6} strokeOpacity=".13" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    <path d={path} fill="none" stroke={color} strokeWidth={selected ? 2.8 : 1.8} strokeOpacity=".65" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    {animate && <>
      <path d={path} fill="none" stroke={`url(#${id})`} strokeWidth="4" pathLength="100" strokeDasharray="9 91" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <animate attributeName="stroke-dashoffset" values="100;0" dur="9s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.88;1" dur="9s" repeatCount="indefinite" />
      </path>
      <g>
        <animateMotion path={path} dur="9s" rotate="auto" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.88;1" dur="9s" repeatCount="indefinite" />
        <g transform={`scale(${u})`}>
          <path d="M-10,-5 L1,-5 L9,0 L1,5 L-10,5 L-4,0Z" fill="#c8f575" stroke={color} strokeWidth="1.4" />
          <path d="M-25,0H-13" stroke={color} strokeWidth="2" strokeLinecap="round" opacity=".4" />
        </g>
      </g>
    </>}
  </g>;
}
