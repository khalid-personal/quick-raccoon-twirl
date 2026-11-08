import React, { useId } from 'react';
import { WORLD_CITIES } from '@/lib/geography-data';
import { PHASE_META, TravelEntry, TravelPhase } from '@/lib/travel-phase';
import { greatCirclePath, projectWorldPoint } from '@/lib/world-map';
import InteractiveMap, { cityLod, MapMarker } from './InteractiveMap';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';

interface Props {
  entries: TravelEntry[];
  selectedLabel?: string;
  onSelect?: (label: string | null) => void;
}

const origin = { lat: 9.03, lon: 38.74 };
const phaseOrder: TravelPhase[] = ['failed', 'transit', 'visa', 'contract', 'arrived', 'returned'];

const TravelOverviewMap: React.FC<Props> = ({ entries, selectedLabel, onSelect }) => {
  const returnArrowId = `return-arrow-${useId().replace(/:/g, '')}`;
  const reduced = usePrefersReducedMotion();
  const originPoint = projectWorldPoint(origin.lat, origin.lon);
  const groups = new Map<string, { dest: TravelEntry['destination']; from?: TravelEntry['returnOrigin']; byPhase: Partial<Record<TravelPhase, number>>; total: number }>();
  for (const entry of entries) {
    const key = entry.returnOrigin ? `${entry.returnOrigin.label} → ${entry.destination.label}` : entry.destination.label;
    const group = groups.get(key) ?? { dest: entry.destination, from: entry.returnOrigin, byPhase: {}, total: 0 };
    group.byPhase[entry.phase] = (group.byPhase[entry.phase] ?? 0) + 1;
    group.total += 1;
    groups.set(key, group);
  }

  return (
    <InteractiveMap preset="region" ariaLabel="Map of candidate destinations">
      {({ u, w }) => {
        const lod = cityLod(w);
        return (
          <>
            <defs><marker id={returnArrowId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="strokeWidth" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b45309" /></marker></defs>
            {WORLD_CITIES.slice(0, lod.dots).map((city, index) => {
              const p = projectWorldPoint(city.lat, city.lon);
              return (
                <MapMarker key={city.geoname_id} x={p.x} y={p.y} u={u}>
                  <title>{`${city.name}, ${city.country} · population ${city.population.toLocaleString()}`}</title>
                  <circle r={index < 30 ? 2.5 : 1.8} className="fill-slate-600 dark:fill-slate-300" opacity={0.6} />
                  {index < lod.labels && <text x={5} y={3} fontSize={9} className="fill-slate-800 dark:fill-slate-100 stroke-card"  strokeWidth={2.5} paintOrder="stroke">{city.name}</text>}
                </MapMarker>
              );
            })}
            {[...groups.entries()].map(([key, { dest, from, byPhase, total }]) => {
              const point = projectWorldPoint(dest.lat, dest.lon);
              const phase = phaseOrder.find(key => byPhase[key]) ?? 'contract';
              const color = PHASE_META[phase].color;
              const active = selectedLabel === dest.label;
              const dimmed = !!selectedLabel && !active;
              return (
                <g
                  key={key}
                  opacity={dimmed ? 0.3 : 1}
                  className="cursor-pointer transition-opacity duration-300"
                  onClick={() => onSelect?.(active ? null : dest.label)}
                  role="button"
                  aria-label={`${dest.label}: ${total} candidate${total === 1 ? '' : 's'}`}
                >
                  <path
                    d={greatCirclePath(from ?? origin, dest)}
                    fill="none"
                    stroke={color}
                    strokeWidth={active ? 3 : 1.8}
                    strokeDasharray="7 5"
                    strokeLinecap="round"
                    markerEnd={from ? `url(#${returnArrowId})` : undefined}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.85}
                  >
                    {phase !== 'arrived' && !reduced && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.4s" repeatCount="indefinite" />}
                  </path>
                  <MapMarker x={point.x} y={point.y} u={u}>
                    <circle r={8} fill={color} className="stroke-card" strokeWidth={2} />
                    <text y={3} fontSize={9} fontWeight={700} textAnchor="middle" fill="white">{total}</text>
                    <text x={11} y={-9} fontSize={11} fontWeight={700} className="fill-slate-800 dark:fill-slate-100 stroke-card"  strokeWidth={3} paintOrder="stroke">{dest.label}</text>
                    <title>{`${dest.label}: ${total} candidate(s)`}</title>
                  </MapMarker>
                </g>
              );
            })}
            <MapMarker x={originPoint.x} y={originPoint.y} u={u}>
              <circle r={6} className="fill-indigo-600 stroke-card" strokeWidth={2} />
              <text x={9} y={14} fontSize={11} fontWeight={700} className="fill-indigo-900 dark:fill-indigo-200 stroke-card" strokeWidth={3} paintOrder="stroke">Ethiopia</text>
            </MapMarker>
          </>
        );
      }}
    </InteractiveMap>
  );
};

export default TravelOverviewMap;
