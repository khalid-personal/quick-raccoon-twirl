import { WORLD_MAP_HEIGHT, WORLD_MAP_TOP, WORLD_MAP_WIDTH } from './geography-data';

export { WORLD_MAP_HEIGHT, WORLD_MAP_TOP, WORLD_MAP_WIDTH };

const MIN_LON = -180;
const MAX_LON = 180;
const MIN_LAT = -60;
const MAX_LAT = 85;
const DRAW_HEIGHT = WORLD_MAP_HEIGHT - WORLD_MAP_TOP * 2;

export const projectWorldPoint = (lat: number, lon: number): { x: number; y: number } => ({
  x: ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * WORLD_MAP_WIDTH,
  y: WORLD_MAP_TOP + ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * DRAW_HEIGHT,
});

const toVector = (lat: number, lon: number): [number, number, number] => {
  const phi = lat * Math.PI / 180;
  const lambda = lon * Math.PI / 180;
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
};

const toCoordinates = ([x, y, z]: [number, number, number]): [number, number] => [
  Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI,
  Math.atan2(y, x) * 180 / Math.PI,
];

export const greatCirclePoint = (from: { lat: number; lon: number }, to: { lat: number; lon: number }, t: number): { lat: number; lon: number } => {
  const a = toVector(from.lat, from.lon);
  const b = toVector(to.lat, to.lon);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  const scaleA = angle < 1e-8 ? 1 - t : Math.sin((1 - t) * angle) / Math.sin(angle);
  const scaleB = angle < 1e-8 ? t : Math.sin(t * angle) / Math.sin(angle);
  const [lat, lon] = toCoordinates([scaleA * a[0] + scaleB * b[0], scaleA * a[1] + scaleB * b[1], scaleA * a[2] + scaleB * b[2]]);
  return { lat, lon };
};

export const greatCircleKm = (from: { lat: number; lon: number }, to: { lat: number; lon: number }): number => {
  const a = toVector(from.lat, from.lon);
  const b = toVector(to.lat, to.lon);
  return Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 6371;
};

export const greatCirclePath = (from: { lat: number; lon: number }, to: { lat: number; lon: number }): string => {
  const a = toVector(from.lat, from.lon);
  const b = toVector(to.lat, to.lon);
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  const steps = Math.max(12, Math.ceil(angle * 28));
  const paths: string[] = [];
  let segment = '';
  let previousLon: number | null = null;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const scaleA = angle < 1e-8 ? 1 - t : Math.sin((1 - t) * angle) / Math.sin(angle);
    const scaleB = angle < 1e-8 ? t : Math.sin(t * angle) / Math.sin(angle);
    const coords = toCoordinates([
      scaleA * a[0] + scaleB * b[0],
      scaleA * a[1] + scaleB * b[1],
      scaleA * a[2] + scaleB * b[2],
    ]);
    const [lat, lon] = coords;
    if (previousLon !== null && Math.abs(lon - previousLon) > 180) {
      if (segment) paths.push(segment);
      segment = '';
    }
    const point = projectWorldPoint(lat, lon);
    segment += `${segment ? ' L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    previousLon = lon;
  }
  if (segment) paths.push(segment);
  return paths.join(' ');
};
