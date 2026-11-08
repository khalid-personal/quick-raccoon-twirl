import { describe, expect, it } from 'vitest';
import {
  clampTrainingMapRouteIndex,
  ETHIOPIA_MAP_HEIGHT_CLASS,
  filterTrainingMapCandidates,
  nextTrainingMapRouteIndex,
  previousTrainingMapRouteIndex,
  sortTrainingMapCandidates,
  trainingMapOriginColor,
  trainingMapRegionColor,
  trainingMapRegions,
  visibleTrainingMapCandidates,
} from '../training-map';

const candidate = (id: string, first_name: string, last_name: string, extra: Record<string, unknown> = {}) => ({
  id,
  first_name,
  last_name,
  home_city: 'Adama',
  ...extra,
});

describe('training map routes', () => {
  it('sorts route candidates alphabetically by full name with a stable id tie-breaker', () => {
    const candidates = [
      candidate('c', 'Zewdu', 'Abebe'),
      candidate('b', 'Aster', 'Kebede'),
      candidate('a', 'Aster', 'Kebede'),
      candidate('d', 'abebe', 'Tadesse'),
    ];

    expect(sortTrainingMapCandidates(candidates).map(item => item.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('applies region and return-journey filters without mixing journey categories', () => {
    const candidates = [
      candidate('eligible', 'A', 'One', { home_region: 'Oromia', employment_history: [{}] }),
      candidate('reapplying', 'B', 'Two', { home_region: 'Oromia', employment_history: [{ reapplied_at: '2026-01-01' }] }),
      candidate('redeployed', 'C', 'Three', { home_region: 'Oromia', arrival: { date: '2026-02-01' }, employment_history: [{ reapplied_at: '2026-01-01' }] }),
      candidate('new', 'D', 'Four', { home_region: 'Amhara' }),
    ];

    expect(filterTrainingMapCandidates(candidates, { region: 'Oromia', journey: 'returnees' }).map(item => item.id))
      .toEqual(['eligible', 'reapplying', 'redeployed']);
    expect(filterTrainingMapCandidates(candidates, { region: 'Oromia', journey: 'eligible' }).map(item => item.id))
      .toEqual(['eligible']);
    expect(filterTrainingMapCandidates(candidates, { region: 'Oromia', journey: 'reapplying' }).map(item => item.id))
      .toEqual(['reapplying']);
    expect(filterTrainingMapCandidates(candidates, { region: 'Oromia', journey: 'redeployed' }).map(item => item.id))
      .toEqual(['redeployed']);
  });

  it('shows only one unfiltered route at a time and advances continuously through alphabetical candidates', () => {
    const candidates = sortTrainingMapCandidates([
      candidate('2', 'Birtukan', 'A'),
      candidate('1', 'Aster', 'A'),
    ]);

    expect(visibleTrainingMapCandidates(candidates, 0, false).map(item => item.id)).toEqual(['1']);
    expect(visibleTrainingMapCandidates(candidates, 1, false).map(item => item.id)).toEqual(['2']);
    expect(nextTrainingMapRouteIndex(1, 2, false)).toBe(0);
    expect(previousTrainingMapRouteIndex(0, 2, false)).toBe(1);
  });

  it('clamps a remembered route cursor to the current scoped candidate list', () => {
    expect(clampTrainingMapRouteIndex(17, 5)).toBe(2);
    expect(clampTrainingMapRouteIndex(-1, 5)).toBe(4);
    expect(clampTrainingMapRouteIndex(17, 0)).toBe(0);
  });

  it('keeps filtered route pages readable and lets users navigate every page', () => {
    const candidates = Array.from({ length: 19 }, (_, index) => index);
    expect(visibleTrainingMapCandidates(candidates, 0, true)).toHaveLength(8);
    expect(visibleTrainingMapCandidates(candidates, 8, true)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(nextTrainingMapRouteIndex(8, 19, true)).toBe(16);
    expect(visibleTrainingMapCandidates(candidates, 16, true)).toEqual([16, 17, 18]);
    expect(nextTrainingMapRouteIndex(16, 19, true)).toBe(0);
    expect(previousTrainingMapRouteIndex(0, 19, true)).toBe(16);
  });

  it('assigns stable colors by Ethiopian home region and includes unknown origins in the legend', () => {
    const oromia = candidate('a', 'A', 'B', { home_region: 'Oromia' });
    const oromiaAgain = candidate('b', 'C', 'D', { home_city: 'Unknown', home_region: 'Oromia' });
    const unknown = candidate('c', 'E', 'F', { home_city: 'Unknown' });

    expect(trainingMapOriginColor(oromia)).toBe(trainingMapOriginColor(oromiaAgain));
    expect(trainingMapOriginColor(oromia)).not.toBe(trainingMapRegionColor('Amhara'));
    expect(trainingMapOriginColor(unknown)).toBe(trainingMapRegionColor('Region not recorded'));
    expect(trainingMapRegions([unknown, oromia])).toEqual(['Oromia', 'Region not recorded']);
  });

  it('uses a substantially taller Ethiopia map viewport', () => {
    expect(ETHIOPIA_MAP_HEIGHT_CLASS).toMatch(/clamp\(620px,82vh,1050px\)/);
    expect(Number(ETHIOPIA_MAP_HEIGHT_CLASS.match(/clamp\((\d+)px/)?.[1])).toBeGreaterThanOrEqual(620);
  });
});
