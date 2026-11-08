import React from 'react';
import { ETHIOPIAN_CITIES } from '@/lib/ethiopia';
import { projectWorldPoint } from '@/lib/world-map';
import InteractiveMap, { MapMarker } from './InteractiveMap';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';
import { ETHIOPIA_MAP_HEIGHT_CLASS } from '@/lib/training-map';

export interface MapPoint { lat: number; lon: number; label: string }
export interface MapLink { id: string; from: MapPoint; to: MapPoint; label?: string; count?: number; color?: string }

interface EthiopiaMapProps {
  facilities: MapPoint[];
  links?: MapLink[];
  showCities?: boolean;
  youAreHere?: MapPoint;
  onLinkClick?: (linkId: string) => void;
  animateRoutes?: boolean;
}

const EthiopiaMap: React.FC<EthiopiaMapProps> = ({ facilities, links = [], showCities = true, youAreHere, onLinkClick, animateRoutes = true }) => {
  const reduced = usePrefersReducedMotion();
  return (
  <InteractiveMap preset="ethiopia" ariaLabel="Map of Ethiopia with training facilities and candidate routes" heightClassName={ETHIOPIA_MAP_HEIGHT_CLASS}>
    {({ u, w }) => {
      const dots = w > 100 ? 0 : w > 60 ? 40 : w > 35 ? 120 : 350;
      const labels = w > 60 ? 0 : w > 35 ? 18 : w > 20 ? 60 : 150;
      return (
        <>
          {showCities && ETHIOPIAN_CITIES.slice(0, dots).map((city, index) => {
            const { x, y } = projectWorldPoint(city.lat, city.lon);
            return (
              <MapMarker key={city.name} x={x} y={y} u={u}>
                <title>{`${city.name}${city.population ? ` · population ${city.population.toLocaleString()}` : ''}`}</title>
                <circle r={index < 30 ? 3 : 2} className="fill-slate-600 dark:fill-slate-300" opacity={0.75} />
                {index < labels && <text x={5} y={3} fontSize={9} className="fill-slate-800 dark:fill-slate-100 stroke-card"  strokeWidth={2.5} paintOrder="stroke">{city.name}</text>}
              </MapMarker>
            );
          })}
          {links.map((link, index) => {
            const color = link.color ?? '#059669';
            const markerId = `ethiopia-network-arrow-${index}`;
            const singleRoute = links.length === 1;
            const width = singleRoute ? 3.2 : 2.3;
            const a = projectWorldPoint(link.from.lat, link.from.lon);
            const b = projectWorldPoint(link.to.lat, link.to.lon);
            const cx = (a.x + b.x) / 2;
            const cy = Math.min(a.y, b.y) - Math.hypot(b.x - a.x, b.y - a.y) * 0.25;
            return (
              <g key={link.id}>
                <defs>
                  <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" markerUnits="strokeWidth" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                  </marker>
                </defs>
                <title>{link.label ?? `${link.from.label} → ${link.to.label}`}</title>
                <path d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} fill="none" stroke="#064e3b" strokeWidth={width + 3} opacity={0.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                <path d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} fill="none" stroke={color} strokeWidth={width} strokeDasharray={singleRoute ? '8 6' : undefined} strokeLinecap="round" markerEnd={`url(#${markerId})`} opacity={singleRoute ? 1 : 0.82} vectorEffect="non-scaling-stroke">
                  {singleRoute && animateRoutes && !reduced && <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1.5s" repeatCount="indefinite" />}
                </path>
                <MapMarker x={a.x} y={a.y} u={u}>
                  <circle r={5} fill={color} stroke="white" strokeWidth={1.5} />
                </MapMarker>
                {onLinkClick && <path d={`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`} fill="none" stroke="transparent" strokeWidth={16} className="cursor-pointer" pointerEvents="stroke" vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={`Open ${link.label ?? `${link.from.label} to ${link.to.label}`}`} onClick={() => onLinkClick(link.id)} onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onLinkClick(link.id);
                  }
                }} />}
                <MapMarker x={b.x} y={b.y} u={u}>
                  <circle r={singleRoute ? 6 : 4} fill={color} className="stroke-card" strokeWidth={2} />
                  {link.count && link.count > 1 && <text x={7} y={-5} fontSize={9} fontWeight={700} className="fill-foreground stroke-card" strokeWidth={2.5} paintOrder="stroke">{link.count}</text>}
                </MapMarker>
              </g>
            );
          })}
          {facilities.map(f => {
            const { x, y } = projectWorldPoint(f.lat, f.lon);
            return (
              <MapMarker key={`${f.label}-${f.lat}-${f.lon}`} x={x} y={y} u={u}>
                <title>{f.label}</title>
                <circle r={7} className="fill-indigo-600 stroke-card" strokeWidth={2} />
                <text x={10} y={-8} fontSize={11} fontWeight={700} className="fill-indigo-900 dark:fill-indigo-200 stroke-card" strokeWidth={3} paintOrder="stroke">{f.label}</text>
              </MapMarker>
            );
          })}
          {youAreHere && (() => {
            const { x, y } = projectWorldPoint(youAreHere.lat, youAreHere.lon);
            return (
              <MapMarker x={x} y={y} u={u}>
                <circle r={7} className="fill-rose-600 stroke-card" strokeWidth={2} />
                <text x={11} y={15} fontSize={12} fontWeight={700} className="fill-rose-700 dark:fill-rose-200 stroke-card" strokeWidth={3} paintOrder="stroke">You are here · {youAreHere.label}</text>
              </MapMarker>
            );
          })()}
        </>
      );
    }}
  </InteractiveMap>
  );
};

export default EthiopiaMap;
