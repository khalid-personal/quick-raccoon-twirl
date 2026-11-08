import { findCity } from './ethiopia';

export const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Central Ethiopia',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'South Ethiopia',
  'South West Ethiopia',
  'Tigray',
] as const;

export type EthiopianRegion = typeof ETHIOPIAN_REGIONS[number];
export const REGION_NOT_SET = 'Region not recorded';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘`]/g, "'").trim().toLowerCase();
const CITY_REGIONS: Record<string, EthiopianRegion> = {
  'addis ababa': 'Addis Ababa',
  'adama': 'Oromia', 'nazret': 'Oromia', 'bishoftu': 'Oromia', 'debremarkos': 'Amhara',
  'bahir dar': 'Amhara', 'gondar': 'Amhara', 'gonder': 'Amhara', 'dessie': 'Amhara', 'kombolcha': 'Amhara', 'lalibela': 'Amhara', 'debire birhan': 'Amhara',
  'dire dawa': 'Dire Dawa',
  'semara': 'Afar', 'semera': 'Afar',
  'asosa': 'Benishangul-Gumuz',
  'gambela': 'Gambela',
  'harar': 'Harari',
  'mekelle': 'Tigray', "mek'ele": 'Tigray', 'axum': 'Tigray', 'shire': 'Tigray',
  'hawassa': 'Sidama', 'awasa': 'Sidama', 'dilla': 'South Ethiopia',
  'arba minch': 'South Ethiopia', 'sodo': 'South Ethiopia', 'wolaita sodo': 'South Ethiopia',
  'hosaina': 'Central Ethiopia', "hosa'ina": 'Central Ethiopia',
  'jimma': 'Oromia', 'nekemte': 'Oromia', "nek'emtē": 'Oromia', 'bale robe': 'Oromia', 'goba': 'Oromia', 'shashemene': 'Oromia', 'shashamane': 'Oromia', 'yabelo': 'Oromia', 'negele borana': 'Oromia',
  'jijiga': 'Somali', 'warder': 'Somali',
  'debre birhan': 'Amhara', 'debre markos': 'Amhara', 'debre tabor': 'Amhara',
  'aksum': 'Tigray', 'nekemtē': 'Oromia',
  'bonga': 'South West Ethiopia', 'hosanna': 'Central Ethiopia',
};

const normalizedCityRegions = Object.fromEntries(Object.entries(CITY_REGIONS).map(([city, region]) => [normalize(city), region]));
const REGION_ANCHORS: Array<[EthiopianRegion, string]> = [
  ['Addis Ababa', 'Addis Ababa'],
  ['Afar', 'Semera'], ['Afar', 'Asaita'], ['Afar', 'Dubti'],
  ['Amhara', 'Bahir Dar'], ['Amhara', 'Gondar'], ['Amhara', 'Dessie'], ['Amhara', 'Lalibela'],
  ['Benishangul-Gumuz', 'Asosa'], ['Benishangul-Gumuz', 'Mendi'],
  ['Central Ethiopia', 'Hosaena'], ['Central Ethiopia', 'Butajira'], ['Central Ethiopia', 'Wolkite'],
  ['Dire Dawa', 'Dire Dawa'],
  ['Gambela', 'Gambela'],
  ['Harari', 'Harar'],
  ['Oromia', 'Adama'], ['Oromia', 'Jimma'], ['Oromia', 'Nekemte'], ['Oromia', 'Bale Robe'],
  ['Oromia', 'Goba'], ['Oromia', 'Shashemene'], ['Oromia', 'Negele Borana'], ['Oromia', 'Moyale'],
  ['Sidama', 'Hawassa'], ['Sidama', 'Yirga Alem'],
  ['Somali', 'Jijiga'], ['Somali', 'Gode'], ['Somali', 'Warder'],
  ['South Ethiopia', 'Arba Minch'], ['South Ethiopia', 'Sodo'], ['South Ethiopia', 'Dilla'],
  ['South West Ethiopia', 'Bonga'], ['South West Ethiopia', 'Mizan Teferi'], ['South West Ethiopia', 'Tepi'],
  ['Tigray', 'Mekelle'], ['Tigray', 'Axum'], ['Tigray', 'Shire'], ['Tigray', 'Adigrat'],
].flatMap(([region, city]) => {
  const place = findCity(city);
  return place ? [{ region, lat: place.lat, lon: place.lon }] : [];
});

const regionFromCityCoordinates = (homeCity: string): EthiopianRegion | undefined => {
  const city = findCity(homeCity);
  if (!city || REGION_ANCHORS.length === 0) return undefined;
  const latitudeScale = 111;
  const longitudeScale = latitudeScale * Math.cos(city.lat * Math.PI / 180);
  const nearest = REGION_ANCHORS.reduce((closest, anchor) => {
    const latDistance = (city.lat - anchor.lat) * latitudeScale;
    const lonDistance = (city.lon - anchor.lon) * longitudeScale;
    const distance = latDistance ** 2 + lonDistance ** 2;
    return distance < closest.distance ? { region: anchor.region as EthiopianRegion, distance } : closest;
  }, { region: REGION_ANCHORS[0].region as EthiopianRegion, distance: Number.POSITIVE_INFINITY });
  return nearest.region;
};

export const resolveEthiopianRegion = (homeCity?: string, explicitRegion?: string): string => {
  if (explicitRegion && (ETHIOPIAN_REGIONS as readonly string[]).includes(explicitRegion)) return explicitRegion;
  if (!homeCity) return REGION_NOT_SET;
  return normalizedCityRegions[normalize(homeCity)] ?? regionFromCityCoordinates(homeCity) ?? REGION_NOT_SET;
};

export const prefillCandidateRegion = <T extends { home_city?: string; home_region?: string; country_of_origin?: string }>(candidate: T): T => {
  if (candidate.home_region && (ETHIOPIAN_REGIONS as readonly string[]).includes(candidate.home_region)) return candidate;
  if (candidate.country_of_origin && !['ethiopia', 'et', 'eth'].includes(normalize(candidate.country_of_origin))) return candidate;
  const region = resolveEthiopianRegion(candidate.home_city);
  return region === REGION_NOT_SET ? candidate : { ...candidate, home_region: region };
};
