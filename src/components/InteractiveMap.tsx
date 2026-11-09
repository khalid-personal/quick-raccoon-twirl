import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Box, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { WORLD_COUNTRY_PATHS } from '@/lib/geography-data';
import { projectWorldPoint, WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from '@/lib/world-map';

export type MapPreset = 'region' | 'ethiopia' | 'world';

const TERRAIN_LABELS: Record<string, string> = {
  base: 'Savanna & scrub', steppe: 'Plains & steppe', plateau: 'Plateau', desert: 'Desert',
  forest: 'Tropical forest', mountain: 'Mountains', highland: 'Green highlands', wetland: 'Wetlands & deltas',
};

const TERRAIN_FILL = {
  light: { base: '#e6e9f0', steppe: '#dde5ea', plateau: '#e4e2e6', desert: '#efeae0', forest: '#c3d8cf', mountain: '#cfd0dc', highland: '#cfe0d6', wetland: '#c4dde6' },
  dark: { base: '#1d2740', steppe: '#1f2e44', plateau: '#27304a', desert: '#2d3249', forest: '#1c3a3f', mountain: '#363c57', highland: '#21404a', wetland: '#1c4150' },
};

const MAP_THEME = {
  light: {
    sea: ['#dcebe3', '#b5d4c8'], plainLand: '#f4f4ed', border: '#779d8e', hoverBorder: '#285f59', hoverFill: '#d8e9bd',
    region: '#e4edda', lake: '#b5d4c8', lakeStroke: '#779d8e', label: '#285f59', frame: 'from-[#dcebe3] via-[#f4f4ed] to-[#b5d4c8]',
  },
  dark: {
    sea: ['#0e2225', '#173a39'], plainLand: '#24514b', border: '#518076', hoverBorder: '#c8f575', hoverFill: '#496e4b',
    region: '#173a39', lake: '#173a39', lakeStroke: '#518076', label: '#c8f575', frame: 'from-[#0e2225] via-[#173a39] to-[#24514b]',
  },
};

export const TERRAIN_STYLE: Record<string, { fill: string; label: string }> = Object.fromEntries(
  Object.entries(TERRAIN_LABELS).map(([kind, label]) => [kind, { fill: TERRAIN_FILL.light[kind as keyof typeof TERRAIN_FILL.light], label }]),
);

const CONTROL = 'h-8 w-8 rounded-md border bg-card/90 text-foreground shadow-sm backdrop-blur flex items-center justify-center hover:bg-accent';

const DEFAULT_ASPECT = 1.25;
const TILT_DEG = 24;
const TILT_SCALE = 1.08;
const TILT_COS = Math.cos((TILT_DEG * Math.PI) / 180);
const TILT_ORIGIN_Y = 0.58;
const MIN_W = 8;
const MAX_W = WORLD_MAP_WIDTH;

interface View { x: number; y: number; w: number }

const presetView = (preset: MapPreset, aspect: number): View => {
  if (preset === 'world') return { x: 0, y: (WORLD_MAP_HEIGHT - WORLD_MAP_WIDTH / aspect) / 2, w: WORLD_MAP_WIDTH };
  const bounds = preset === 'ethiopia' ? { lon0: 32.5, lon1: 48.5, lat: 9.1 } : { lon0: 26, lon1: 70, lat: 15.5 };
  const w = ((bounds.lon1 - bounds.lon0) / 360) * WORLD_MAP_WIDTH;
  const center = projectWorldPoint(bounds.lat, (bounds.lon0 + bounds.lon1) / 2);
  return { x: center.x - w / 2, y: center.y - w / aspect / 2, w };
};

const clampView = (v: View, aspect: number): View => {
  const w = Math.min(MAX_W, Math.max(MIN_W, v.w));
  const h = w / aspect;
  const x = w >= WORLD_MAP_WIDTH ? 0 : Math.min(WORLD_MAP_WIDTH - w, Math.max(0, v.x));
  const y = h >= WORLD_MAP_HEIGHT ? (WORLD_MAP_HEIGHT - h) / 2 : Math.min(WORLD_MAP_HEIGHT - h, Math.max(0, v.y));
  return { x, y, w };
};

export interface MapContext {
  u: number;
  w: number;
}

export const cityLod = (w: number): { dots: number; labels: number } => {
  if (w > 600) return { dots: 25, labels: 0 };
  if (w > 250) return { dots: 60, labels: 10 };
  if (w > 120) return { dots: 150, labels: 30 };
  if (w > 60) return { dots: 350, labels: 80 };
  return { dots: 350, labels: 200 };
};

export const MapMarker: React.FC<{ x: number; y: number; u: number; children: React.ReactNode }> = ({ x, y, u, children }) => (
  <g transform={`translate(${x},${y}) scale(${u})`}>{children}</g>
);

interface Props {
  preset?: MapPreset;
  ariaLabel: string;
  className?: string;
  heightClassName?: string;
  children?: (ctx: MapContext) => React.ReactNode;
  focusPoints?: Array<{ lat: number; lon: number }>;
}

const InteractiveMap: React.FC<Props> = ({ preset = 'region', ariaLabel, className = '', heightClassName = 'h-[clamp(460px,72vh,900px)]', children, focusPoints }) => {
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const aspectRef = useRef(DEFAULT_ASPECT);
  const [tilted, setTilted] = useState(false);
  const tiltedRef = useRef(false);
  const seaId = `sea-${useId().replace(/:/g, '')}`;
  tiltedRef.current = tilted;
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<View>(() => presetView(preset, DEFAULT_ASPECT));
  const [hovered, setHovered] = useState<string | null>(null);
  const [pixelWidth, setPixelWidth] = useState(800);
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; pinch: number } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => { setView(presetView(preset, aspectRef.current)); }, [preset]);
  const focusKey = focusPoints?.map(point => `${point.lat},${point.lon}`).join('|');
  useEffect(() => {
    if (!focusKey) return;
    const points = focusKey.split('|').map(pair => { const [lat, lon] = pair.split(',').map(Number); return projectWorldPoint(lat, lon); });
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const width = Math.max(12, (Math.max(...xs) - Math.min(...xs)) * 1.6, (Math.max(...ys) - Math.min(...ys)) * aspectRef.current * 1.6);
    setView(clampView({ x: (Math.min(...xs) + Math.max(...xs) - width) / 2, y: (Math.min(...ys) + Math.max(...ys) - width / aspectRef.current) / 2, w: width }, aspectRef.current));
  }, [focusKey]);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setPixelWidth(element.clientWidth || 800));
    observer.observe(element);
    setPixelWidth(element.clientWidth || 800);
    return () => observer.disconnect();
  }, []);

  const zoomAt = useCallback((factor: number, fx: number, fy: number) => {
    setView(current => {
      const w = Math.min(MAX_W, Math.max(MIN_W, current.w / factor));
      const h = w / aspectRef.current;
      const currentH = current.w / aspectRef.current;
      return clampView({ x: current.x + fx * (current.w - w), y: current.y + fy * (currentH - h), w }, aspectRef.current);
    });
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0018), (event.clientX - rect.left) / rect.width, anchorY((event.clientY - rect.top) / rect.height));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const anchorY = (fy: number) => (tiltedRef.current
    ? Math.min(1, Math.max(0, 0.5 + (fy - TILT_ORIGIN_Y) / (TILT_SCALE * TILT_COS)))
    : fy);

  const onPointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag.current = { moved: false, pinch: 0 };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !frame.current) return;
    const rect = frame.current.getBoundingClientRect();
    const next = { x: event.clientX, y: event.clientY };
    if (pointers.current.size >= 2) {
      const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId).map(([, p]) => p);
      const other = others[0];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(next.x - other.x, next.y - other.y);
      pointers.current.set(event.pointerId, next);
      if (before > 0 && after > 0) {
        zoomAt(after / before, ((next.x + other.x) / 2 - rect.left) / rect.width, anchorY(((next.y + other.y) / 2 - rect.top) / rect.height));
      }
      if (drag.current) drag.current.moved = true;
      return;
    }
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    if (!drag.current) return;
    if (!drag.current.moved && Math.hypot(dx, dy) < 3) return;
    if (!drag.current.moved) frame.current.setPointerCapture(event.pointerId);
    drag.current.moved = true;
    pointers.current.set(event.pointerId, next);
    const scale = viewRef.current.w / rect.width;
    const kx = tiltedRef.current ? scale / TILT_SCALE : scale;
    const ky = tiltedRef.current ? scale / (TILT_SCALE * TILT_COS) : scale;
    setView(current => clampView({ ...current, x: current.x - dx * kx, y: current.y - dy * ky }, aspectRef.current));
  };

  const onPointerEnd = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) drag.current = null;
  };

  const u = view.w / pixelWidth;
  const h = view.w / aspect;
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light';
  const palette = MAP_THEME[mode];
  const worldPaths = useMemo(() => WORLD_COUNTRY_PATHS, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width < 50 || height < 50) return;
      const next = width / height;
      if (Math.abs(next - aspectRef.current) < 0.01) return;
      aspectRef.current = next;
      setAspect(next);
      setView(current => clampView(current, next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <div className={`journey-control-map ${expanded ? 'fixed inset-0 z-50 rounded-none' : 'relative rounded-2xl shadow-sm'} overflow-hidden border bg-gradient-to-b ${palette.frame} select-none ${expanded ? '' : className}`}>
      <div
        ref={frame}
        className={`touch-none cursor-grab active:cursor-grabbing ${expanded ? 'h-full' : heightClassName}`}
        style={{ perspective: tilted ? '1200px' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onDoubleClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          zoomAt(2, (event.clientX - rect.left) / rect.width, anchorY((event.clientY - rect.top) / rect.height));
        }}
      >
        <div
          className="h-full w-full"
          style={tilted ? { transform: `rotateX(${TILT_DEG}deg) scale(${TILT_SCALE})`, transformOrigin: `50% ${TILT_ORIGIN_Y * 100}%`, transition: 'transform 0.5s ease' } : { transition: 'transform 0.5s ease' }}
        >
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${h}`}
          className="block h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
        >
          <defs>
            <linearGradient id={seaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={palette.sea[0]} />
              <stop offset="1" stopColor={palette.sea[1]} />
            </linearGradient>
          </defs>
          <rect x={-200} y={-400} width={WORLD_MAP_WIDTH + 400} height={WORLD_MAP_HEIGHT + 800} fill={`url(#${seaId})`} />
          {worldPaths.map(country => (
            <path key={country.name} d={country.d} fill={hovered === country.name ? palette.hoverFill : palette.plainLand} stroke={hovered === country.name ? palette.hoverBorder : palette.border} strokeWidth={0.8} vectorEffect="non-scaling-stroke" fillRule="evenodd" onMouseEnter={() => setHovered(country.name)} onMouseLeave={() => setHovered(current => current === country.name ? null : current)} />
          ))}
          {children?.({ u, w: view.w })}
        </svg>
        </div>
      </div>

      {hovered && (
        <div className="pointer-events-none absolute left-2 top-2 rounded-md border bg-card/90 px-2 py-1 text-xs font-medium text-foreground shadow-sm backdrop-blur">{hovered}</div>
      )}

      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button type="button" aria-label="Zoom in" className={CONTROL} onClick={() => zoomAt(1.6, 0.5, 0.5)}><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Zoom out" className={CONTROL} onClick={() => zoomAt(1 / 1.6, 0.5, 0.5)}><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="Toggle 3D bird's-eye view" aria-pressed={tilted} className={`${CONTROL} ${tilted ? 'border-primary/40 text-primary' : ''}`} onClick={() => setTilted(value => !value)}><Box className="h-4 w-4" /></button>
        <button type="button" aria-label={expanded ? 'Exit full screen' : 'Full screen'} className={CONTROL} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
      </div>

      <div className="absolute left-2 bottom-2 flex gap-1 text-xs">
        {([['region', 'Horn & Middle East'], ['ethiopia', 'Ethiopia'], ['world', 'World']] as Array<[MapPreset, string]>).map(([key, label]) => (
          <button key={key} type="button" className="rounded-md border bg-card/90 px-2 py-1 text-foreground shadow-sm backdrop-blur hover:bg-accent" onClick={() => setView(presetView(key, aspectRef.current))}>{label}</button>
        ))}
      </div>

    </div>
  );
};

export default InteractiveMap;
