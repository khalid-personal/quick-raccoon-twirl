import React, { useId } from 'react';
import { WORLD_CITIES } from '@/lib/geography-data';
import { greatCirclePath, projectWorldPoint } from '@/lib/world-map';
import InteractiveMap, { cityLod, MapMarker } from './InteractiveMap';
import type { MapPoint } from './EthiopiaMap';
import { usePrefersReducedMotion } from '@/hooks/use-reduced-motion';

const RouteMap: React.FC<{ origin: MapPoint; destination: MapPoint; waypoints?: MapPoint[]; compact?: boolean; showReturn?: boolean; heightClassName?: string }> = ({ origin, destination, waypoints = [], compact = false, showReturn = false, heightClassName }) => {
  const markerId = `route-arrow-${useId().replace(/:/g, '')}`;
  const reduced = usePrefersReducedMotion();
  const points = [origin, ...waypoints, destination];
  const routes = points.slice(1).map((point, index) => greatCirclePath(points[index], point));

  return (
    <InteractiveMap preset="region" ariaLabel={`Map route from ${origin.label} to ${destination.label}`} heightClassName={heightClassName ?? (compact ? 'h-[280px]' : undefined)}>
      {({ u }) => {
        const lod = cityLod(120);
        return (
          <>
            <defs>
              <marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="strokeWidth" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#047857" />
              </marker>
              <marker id={`${markerId}-return`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" markerUnits="strokeWidth" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#b45309" />
              </marker>
            </defs>
            {WORLD_CITIES.slice(0, lod.dots).map((city, index) => {
              const p = projectWorldPoint(city.lat, city.lon);
              return (
                <MapMarker key={city.geoname_id} x={p.x} y={p.y} u={u}>
                  <title>{`${city.name}, ${city.country} · population ${city.population.toLocaleString()}`}</title>
                  <circle r={index < 30 ? 2.5 : 1.8} className="fill-slate-600 dark:fill-slate-300" opacity={0.75} />
                  {index < lod.labels && <text x={5} y={3} fontSize={9} className="fill-slate-800 dark:fill-slate-100 stroke-card"  strokeWidth={2.5} paintOrder="stroke">{city.name}</text>}
                </MapMarker>
              );
            })}
            {routes.map((route, index) => (
              <g key={`${markerId}-route-${index}`}>
                <path d={route} fill="none" stroke="#064e3b" strokeWidth={3.5} strokeLinecap="round" opacity={0.24} vectorEffect="non-scaling-stroke" />
                <path d={route} fill="none" stroke="#059669" strokeWidth={2.4} strokeLinecap="round" markerEnd={`url(#${markerId})`} vectorEffect="non-scaling-stroke" />
                <path d={route} fill="none" stroke="#a7f3d0" strokeWidth={1} strokeDasharray="4 8" strokeLinecap="round" vectorEffect="non-scaling-stroke">
                  {!reduced && <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1.7s" repeatCount="indefinite" />}
                </path>
              </g>
            ))}
            {showReturn && <path d={greatCirclePath(destination, origin)} fill="none" stroke="#d97706" strokeWidth={2.5} strokeDasharray="5 5" markerEnd={`url(#${markerId}-return)`} vectorEffect="non-scaling-stroke">
              {!reduced && <animate attributeName="stroke-dashoffset" from="20" to="0" dur="2s" repeatCount="indefinite" />}
            </path>}
            {points.map((point, index) => {
              const { x, y } = projectWorldPoint(point.lat, point.lon);
              const isStart = index === 0;
              const isEnd = index === points.length - 1;
              const fill = isStart ? '#2563eb' : isEnd ? '#059669' : '#7c3aed';
              return (
                <MapMarker key={`${markerId}-point-${index}`} x={x} y={y} u={u}>
                  <title>{`${isStart ? 'Home' : isEnd ? 'Destination' : 'CoC center'}: ${point.label}`}</title>
                  <circle r={isStart || isEnd ? 7 : 6} fill={fill} stroke="#fff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                  <text x={10} y={isStart ? 15 : -9} fontSize={11} fontWeight={700} fill={fill} stroke="#fff" strokeWidth={3} paintOrder="stroke">{point.label}</text>
                </MapMarker>
              );
            })}
          </>
        );
      }}
    </InteractiveMap>
  );
};

export default RouteMap;
