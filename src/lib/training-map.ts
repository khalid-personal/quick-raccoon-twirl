import { REGION_NOT_SET, resolveEthiopianRegion } from './ethiopia-regions';

export const TRAINING_MAP_ROUTE_INTERVAL_MS = 5000;
export const TRAINING_MAP_ROUTE_PAGE_SIZE = 8;
export const ETHIOPIA_MAP_HEIGHT_CLASS = 'h-[clamp(620px,82vh,1050px)]';

export type TrainingMapJourneyFilter = 'all' | 'returnees' | 'eligible' | 'reapplying' | 'redeployed';

export interface TrainingMapCandidate {
  id: string;
  first_name: string;
  last_name: string;
  home_city?: string;
  home_region?: string;
  employment_history?: Array<{ reapplied_at?: string }>;
  arrival?: unknown;
}

export interface TrainingMapFilters {
  region: string;
  journey: TrainingMapJourneyFilter;
}

const REGION_ROUTE_COLORS: Record<string, string> = {
  'Addis Ababa': '#7c3aed',
  Afar: '#c2410c',
  Amhara: '#2563eb',
  'Benishangul-Gumuz': '#0f766e',
  'Central Ethiopia': '#be123c',
  'Dire Dawa': '#a16207',
  Gambela: '#047857',
  Harari: '#9333ea',
  Oromia: '#15803d',
  Sidama: '#0369a1',
  Somali: '#b45309',
  'South Ethiopia': '#c026d3',
  'South West Ethiopia': '#0e7490',
  Tigray: '#4f46e5',
  [REGION_NOT_SET]: '#475569',
};

export const filterTrainingMapCandidates = <T extends TrainingMapCandidate>(
  candidates: T[],
  { region, journey }: TrainingMapFilters,
): T[] => candidates.filter(candidate => {
  const history = candidate.employment_history ?? [];
  const reapplied = history.some(entry => !!entry.reapplied_at);
  return (region === 'all' || resolveEthiopianRegion(candidate.home_city, candidate.home_region) === region)
    && (journey === 'all' || (journey === 'returnees' && history.length > 0)
      || (journey === 'eligible' && history.length > 0 && !reapplied)
      || (journey === 'reapplying' && reapplied && !candidate.arrival)
      || (journey === 'redeployed' && reapplied && !!candidate.arrival));
});

export const sortTrainingMapCandidates = <T extends TrainingMapCandidate>(candidates: T[]): T[] =>
  [...candidates].sort((a, b) =>
    `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, 'en', { sensitivity: 'base' })
      || a.id.localeCompare(b.id),
  );

export const trainingMapOriginColor = (candidate: Pick<TrainingMapCandidate, 'home_city' | 'home_region'>): string => {
  const region = resolveEthiopianRegion(candidate.home_city, candidate.home_region);
  return REGION_ROUTE_COLORS[region] ?? REGION_ROUTE_COLORS[REGION_NOT_SET];
};

export const trainingMapRegionColor = (region: string): string =>
  REGION_ROUTE_COLORS[region] ?? REGION_ROUTE_COLORS[REGION_NOT_SET];

export const trainingMapRegions = (candidates: TrainingMapCandidate[]): string[] =>
  [...new Set(candidates.map(candidate => resolveEthiopianRegion(candidate.home_city, candidate.home_region)))]
    .sort((a, b) => a.localeCompare(b, 'en'));

export const clampTrainingMapRouteIndex = (index: number, total: number): number =>
  total <= 0 ? 0 : ((index % total) + total) % total;

export const visibleTrainingMapCandidates = <T,>(
  candidates: T[],
  index: number,
  showFilteredRoutes: boolean,
): T[] => {
  if (!candidates.length) return [];
  const safeIndex = clampTrainingMapRouteIndex(index, candidates.length);
  if (!showFilteredRoutes) return [candidates[safeIndex]];
  const pageStart = Math.floor(safeIndex / TRAINING_MAP_ROUTE_PAGE_SIZE) * TRAINING_MAP_ROUTE_PAGE_SIZE;
  return candidates.slice(pageStart, pageStart + TRAINING_MAP_ROUTE_PAGE_SIZE);
};

export const nextTrainingMapRouteIndex = (
  index: number,
  total: number,
  showFilteredRoutes: boolean,
): number => {
  if (total <= 0) return 0;
  if (!showFilteredRoutes) return (index + 1) % total;
  const pageCount = Math.ceil(total / TRAINING_MAP_ROUTE_PAGE_SIZE);
  const currentPage = Math.floor(index / TRAINING_MAP_ROUTE_PAGE_SIZE) % pageCount;
  return ((currentPage + 1) % pageCount) * TRAINING_MAP_ROUTE_PAGE_SIZE;
};

export const previousTrainingMapRouteIndex = (
  index: number,
  total: number,
  showFilteredRoutes: boolean,
): number => {
  if (total <= 0) return 0;
  if (!showFilteredRoutes) return (index - 1 + total) % total;
  const pageCount = Math.ceil(total / TRAINING_MAP_ROUTE_PAGE_SIZE);
  const currentPage = Math.floor(index / TRAINING_MAP_ROUTE_PAGE_SIZE) % pageCount;
  return ((currentPage - 1 + pageCount) % pageCount) * TRAINING_MAP_ROUTE_PAGE_SIZE;
};
