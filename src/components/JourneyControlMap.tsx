import { projectWorldPoint, greatCirclePath } from '@/lib/world-map';
import type { JourneyControlEvent } from '@/lib/journey-control';
import InteractiveMap, { MapMarker } from './InteractiveMap';
import MapRouteSignal from './MapRouteSignal';
import { ETHIOPIAN_CITIES } from '@/lib/ethiopia';

export default function JourneyControlMap({ events, selectedEvent, onSelect, running }: {
  events: JourneyControlEvent[]; selectedEvent?: string; onSelect: (event: JourneyControlEvent) => void; running: boolean;
}) {
  const points = new Map<string, { event: JourneyControlEvent; count: number }>();
  for (const event of events.filter(event => event.point)) {
    const key = `${event.point!.lat}:${event.point!.lon}`;
    const current = points.get(key);
    points.set(key, { event: current && current.event.id === selectedEvent ? current.event : event, count: (current?.count ?? 0) + 1 });
  }
  const located = [...points.values()];
  return <InteractiveMap preset="ethiopia" ariaLabel="Journey Control: recorded candidate locations and evidence sequences" heightClassName="h-[clamp(420px,65vh,780px)]" focusPoints={located.map(({ event }) => event.point!)}>
    {({ u, w }) => <>
      {ETHIOPIAN_CITIES.slice(0, w < 60 ? 35 : 10).map(city => {
        const point = projectWorldPoint(city.lat, city.lon);
        return <MapMarker key={city.name} x={point.x} y={point.y} u={u}><circle r="2" className="fill-primary" opacity=".35" />{w < 60 && <text x="4" y="3" fontSize="9" className="fill-muted-foreground stroke-card" strokeWidth="2" paintOrder="stroke">{city.name}</text>}</MapMarker>;
      })}
      {events.slice(1).map((event, index) => {
        const previous = events[index];
        if (!event.point || !previous.point || event.candidateId !== previous.candidateId || !event.at || !previous.at || ['document', 'contract', 'flight'].includes(event.kind) || ['document', 'contract', 'flight'].includes(previous.kind)) return null;
        if (event.point.lat === previous.point.lat && event.point.lon === previous.point.lon) return null;
        return <g key={`${previous.id}:${event.id}`}><title>Recorded evidence sequence, not a GPS travel path</title><MapRouteSignal path={greatCirclePath(previous.point, event.point)} u={u} running={running} selected={event.id === selectedEvent} /></g>;
      })}
      {located.map(({ event, count }, index) => {
        const point = projectWorldPoint(event.point!.lat, event.point!.lon);
        const selected = event.id === selectedEvent;
        const failed = event.status === 'Failed';
        return <MapMarker key={event.id} x={point.x} y={point.y} u={u}>
          <g role="button" tabIndex={0} aria-label={`${event.title}, ${event.point!.label}, ${event.precision === 'exact' ? 'recorded coordinates' : 'approximate city'}`} className="cursor-pointer" onClick={() => onSelect(event)} onKeyDown={key => { if (key.key === 'Enter' || key.key === ' ') { key.preventDefault(); onSelect(event); } }}>
            <title>{event.title} · {event.point!.label}</title>
            <circle r={selected ? 19 : 13} fill={failed ? '#e66d73' : '#c8f575'} opacity=".18" />
            <circle r={selected ? 10 : 7} fill={failed ? '#be324b' : selected ? '#c8f575' : '#285f59'} stroke="#f4f4ed" strokeWidth="2" />
            {count > 1 && <text x="10" y="18" fontSize="9" fontWeight="600" className="fill-foreground stroke-card" strokeWidth="2" paintOrder="stroke">{count} {event.current ? 'candidates' : 'events'}</text>}
            {selected && <path d="M-3,0H3M0,-3V3" stroke="#102f31" strokeWidth="1.5" />}
            {(selected || index === located.length - 1) && <text x="14" y="-12" fontSize="11" fontWeight="600" className="fill-foreground stroke-card" strokeWidth="3" paintOrder="stroke">{event.point!.label}</text>}
          </g>
        </MapMarker>;
      })}
    </>}
  </InteractiveMap>;
}
