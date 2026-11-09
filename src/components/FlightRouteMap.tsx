import React, { useId } from 'react';
import { WORLD_CITIES } from '@/lib/geography-data';
import { greatCirclePath, greatCirclePoint, projectWorldPoint } from '@/lib/world-map';
import InteractiveMap, { cityLod, MapMarker } from './InteractiveMap';
import type { MapPoint } from './EthiopiaMap';

export interface FlightMapProps {
  home?: MapPoint;
  center?: MapPoint;
  departure: MapPoint;
  arrival: MapPoint;
  position: { lat: number; lon: number };
  progress: number;
}

// Static markers only: the plane sits at the current position and the route behind it is drawn solid.
const FlightRouteMap: React.FC<FlightMapProps> = ({ home, center, departure, arrival, position, progress }) => {
  const markerId = useId().replace(/:/g, '');
  const ground = [home, center, departure].filter((point): point is MapPoint => !!point);
  const plane = projectWorldPoint(position.lat, position.lon);
  const before = greatCirclePoint(departure, arrival, Math.max(0, progress - 0.02));
  const after = greatCirclePoint(departure, arrival, Math.min(1, progress + 0.02));
  const from = projectWorldPoint(before.lat, before.lon);
  const to = projectWorldPoint(after.lat, after.lon);
  const heading = Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  const flown = progress > 0 ? greatCirclePath(departure, position) : '';

  return (
    <InteractiveMap preset="region" ariaLabel={`Flight from ${departure.label} to ${arrival.label}`} heightClassName="h-[360px]">
      {({ u }) => {
        const lod = cityLod(120);
        return (
          <>
            <defs>
              <marker id={`${markerId}-ground`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" markerUnits="strokeWidth" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#438379" /></marker>
            </defs>
            {WORLD_CITIES.slice(0, lod.dots).map((city, index) => {
              const p = projectWorldPoint(city.lat, city.lon);
              return (
                <MapMarker key={city.geoname_id} x={p.x} y={p.y} u={u}>
                  <circle r={index < 30 ? 2.5 : 1.8} className="fill-slate-600 dark:fill-slate-300" opacity={0.6} />
                  {index < lod.labels && <text x={5} y={3} fontSize={9} className="fill-slate-800 dark:fill-slate-100 stroke-card" strokeWidth={2.5} paintOrder="stroke">{city.name}</text>}
                </MapMarker>
              );
            })}
            {ground.slice(1).map((point, index) => (
              <path key={`ground-${index}`} d={greatCirclePath(ground[index], point)} fill="none" stroke="#438379" strokeWidth={2} strokeLinecap="round" markerEnd={`url(#${markerId}-ground)`} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={greatCirclePath(departure, arrival)} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {flown && <path d={flown} fill="none" stroke="#059669" strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
            {[[home, '#285f59', 'Home', 14], [center, '#438379', 'CoC center', 14], [departure, '#d97706', 'Departs', 14], [arrival, '#6b893a', 'Arrives', -9]].map(([point, color, role, dy]) => {
              if (!point) return null;
              const p = point as MapPoint;
              const { x, y } = projectWorldPoint(p.lat, p.lon);
              return (
                <MapMarker key={role as string} x={x} y={y} u={u}>
                  <title>{`${role as string}: ${p.label}`}</title>
                  <circle r={6} fill={color as string} stroke="#fff" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                  <text x={9} y={dy as number} fontSize={11} fontWeight={700} fill={color as string} stroke="#fff" strokeWidth={3} paintOrder="stroke">{p.label}</text>
                </MapMarker>
              );
            })}
            <MapMarker x={plane.x} y={plane.y} u={u}>
              <title>Aircraft position</title>
              <g transform={`rotate(${heading})`}><path d="M 13 0 L -4 -9 L -1 0 L -4 9 Z" fill="#0f172a" stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" /></g>
            </MapMarker>
          </>
        );
      }}
    </InteractiveMap>
  );
};

export default FlightRouteMap;
