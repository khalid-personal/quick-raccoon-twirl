import type { CocFacility } from './types';
import { ETHIOPIAN_PLACES, ETHIOPIA_BORDER_PATHS, WORLD_CITIES, WORLD_COUNTRY_CENTERS } from './geography-data';
export { ETHIOPIA_BORDER_PATHS };

export interface EthiopianCity {
  name: string;
  lat: number;
  lon: number;
  population?: number;
}

const LEGACY_ETHIOPIAN_CITIES: EthiopianCity[] = [
  { name: 'Addis Ababa', lat: 9.03, lon: 38.74 },
  { name: 'Adama', lat: 8.54, lon: 39.27 },
  { name: 'Arba Minch', lat: 6.03, lon: 37.55 },
  { name: 'Axum', lat: 14.12, lon: 38.73 },
  { name: 'Bale Robe', lat: 7.12, lon: 40.0 },
  { name: 'Goba', lat: 7.01, lon: 39.98 },
  { name: 'Dilla', lat: 6.41, lon: 38.31 },
  { name: 'Hosaena', lat: 7.55, lon: 37.85 },
  { name: 'Kombolcha', lat: 11.08, lon: 39.74 },
  { name: 'Lalibela', lat: 12.03, lon: 39.04 },
  { name: 'Moyale', lat: 3.52, lon: 39.05 },
  { name: 'Negele Borana', lat: 5.33, lon: 39.58 },
  { name: 'Shire', lat: 14.1, lon: 38.28 },
  { name: 'Woldiya', lat: 11.83, lon: 39.6 },
  { name: 'Yabelo', lat: 4.88, lon: 38.08 },
  { name: 'Asosa', lat: 10.07, lon: 34.53 },
  { name: 'Bahir Dar', lat: 11.59, lon: 37.39 },
  { name: 'Bishoftu', lat: 8.75, lon: 38.98 },
  { name: 'Debre Birhan', lat: 9.68, lon: 39.53 },
  { name: 'Debre Markos', lat: 10.33, lon: 37.72 },
  { name: 'Dessie', lat: 11.13, lon: 39.64 },
  { name: 'Dire Dawa', lat: 9.6, lon: 41.86 },
  { name: 'Gambela', lat: 8.25, lon: 34.59 },
  { name: 'Gondar', lat: 12.6, lon: 37.47 },
  { name: 'Harar', lat: 9.31, lon: 42.12 },
  { name: 'Hawassa', lat: 7.06, lon: 38.48 },
  { name: 'Jijiga', lat: 9.35, lon: 42.8 },
  { name: 'Jimma', lat: 7.67, lon: 36.83 },
  { name: 'Mekelle', lat: 13.5, lon: 39.47 },
  { name: 'Nekemte', lat: 9.09, lon: 36.55 },
  { name: 'Semera', lat: 11.79, lon: 41.0 },
  { name: 'Shashemene', lat: 7.2, lon: 38.6 },
  { name: 'Sodo', lat: 6.86, lon: 37.75 },
];

const normalizePlaceName = (name: string): string => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’‘`]/g, "'")
  .trim()
  .toLocaleLowerCase();

const ethiopianPlaceMap = new Map<string, EthiopianCity>(
  ETHIOPIAN_PLACES.map(place => [
    normalizePlaceName(place.name),
    { name: place.name, lat: place.lat, lon: place.lon, population: place.population },
  ]),
);
for (const city of LEGACY_ETHIOPIAN_CITIES) {
  const key = normalizePlaceName(city.name);
  if (!ethiopianPlaceMap.has(key)) ethiopianPlaceMap.set(key, city);
}
export const ETHIOPIAN_CITIES: EthiopianCity[] = [...ethiopianPlaceMap.values()];

export const MAP_WIDTH = 600;
export const MAP_HEIGHT = 520;
const BOUNDS = { minLon: 33.5, maxLon: 48.5, minLat: 3, maxLat: 15.2 };
export const projectPoint = (lat: number, lon: number): { x: number; y: number } => ({
  x: ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * MAP_WIDTH,
  y: ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * MAP_HEIGHT,
});

export const findCity = (name?: string): EthiopianCity | undefined =>
  name ? ethiopianPlaceMap.get(normalizePlaceName(name)) : undefined;

export const facilityCoordinates = (facility: Pick<CocFacility, 'latitude' | 'longitude' | 'city'>): { lat: number; lon: number } | null => {
  if (typeof facility.latitude === 'number' && typeof facility.longitude === 'number') {
    return { lat: facility.latitude, lon: facility.longitude };
  }
  const city = findCity(facility.city);
  return city ? { lat: city.lat, lon: city.lon } : null;
};

export const facilityMapsUrl = (facility: Pick<CocFacility, 'gps_url' | 'latitude' | 'longitude' | 'name' | 'city'>): string | null => {
  if (facility.gps_url) return facility.gps_url;
  const coords = facilityCoordinates(facility);
  return coords ? `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lon}` : null;
};

export interface Destination { name: string; country: string; lat: number; lon: number; country_code?: string; population?: number }

const LEGACY_DESTINATIONS: Destination[] = [
  { name: 'Riyadh', country: 'Saudi Arabia', lat: 24.71, lon: 46.68 },
  { name: 'Jeddah', country: 'Saudi Arabia', lat: 21.49, lon: 39.19 },
  { name: 'Dammam', country: 'Saudi Arabia', lat: 26.43, lon: 50.1 },
  { name: 'Medina', country: 'Saudi Arabia', lat: 24.47, lon: 39.61 },
  { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2, lon: 55.27 },
  { name: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.45, lon: 54.38 },
  { name: 'Doha', country: 'Qatar', lat: 25.29, lon: 51.53 },
  { name: 'Kuwait City', country: 'Kuwait', lat: 29.38, lon: 47.99 },
  { name: 'Muscat', country: 'Oman', lat: 23.59, lon: 58.41 },
  { name: 'Manama', country: 'Bahrain', lat: 26.22, lon: 50.59 },
  { name: 'Amman', country: 'Jordan', lat: 31.95, lon: 35.93 },
  { name: 'Beirut', country: 'Lebanon', lat: 33.89, lon: 35.5 },
  { name: 'Cairo', country: 'Egypt', lat: 30.04, lon: 31.24 },
];

const normalizeDestination = (name: string): string => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
const normalizeCountry = (name: string): string => normalizeDestination(name.replace(/\s*\([A-Za-z]{2,3}\)\s*$/, ''));
export const DESTINATION_CITIES: Destination[] = WORLD_CITIES.map(place => ({
  name: place.name,
  country: place.country ?? place.country_code ?? '',
  country_code: place.country_code,
  lat: place.lat,
  lon: place.lon,
  population: place.population,
}));
for (const city of LEGACY_DESTINATIONS) {
  if (!DESTINATION_CITIES.some(d => normalizeDestination(d.name) === normalizeDestination(city.name)
    && normalizeDestination(d.country) === normalizeDestination(city.country))) DESTINATION_CITIES.push(city);
}

const COUNTRY_CENTERS: Record<string, { lat: number; lon: number }> = {
  'saudi arabia': { lat: 24, lon: 45 }, 'united arab emirates': { lat: 24.3, lon: 54.4 }, uae: { lat: 24.3, lon: 54.4 },
  qatar: { lat: 25.3, lon: 51.2 }, kuwait: { lat: 29.3, lon: 47.7 }, oman: { lat: 21.5, lon: 56 },
  bahrain: { lat: 26.1, lon: 50.55 }, jordan: { lat: 31, lon: 36.5 }, lebanon: { lat: 33.9, lon: 35.9 }, egypt: { lat: 27, lon: 30 },
};
const COUNTRY_ALIASES: Record<string, string> = {
  'united states': 'united states of america',
  usa: 'united states of america',
  uk: 'united kingdom',
};

const getCityAndCountry = (city?: string, country?: string): { cityName?: string; countryName?: string } => {
  const cityValue = city?.trim();
  if (!cityValue) return { countryName: country?.trim() };
  const direct = DESTINATION_CITIES.find(d => normalizeDestination(`${d.name}, ${d.country}`) === normalizeDestination(cityValue));
  if (direct) return { cityName: direct.name, countryName: direct.country };
  if (cityValue.includes(',')) {
    const splitAt = cityValue.lastIndexOf(',');
    return { cityName: cityValue.slice(0, splitAt).trim(), countryName: country?.trim() || cityValue.slice(splitAt + 1).trim() };
  }
  return { cityName: cityValue, countryName: country?.trim() };
};

export const findDestination = (city?: string, country?: string): { lat: number; lon: number; label: string } | null => {
  const query = getCityAndCountry(city, country);
  const cityMatches = query.cityName
    ? DESTINATION_CITIES.filter(d => normalizeDestination(d.name) === normalizeDestination(query.cityName!))
    : [];
  const countryCode = query.countryName?.match(/\(([A-Za-z]{2,3})\)\s*$/)?.[1] ?? query.countryName;
  const countryMatch = query.countryName
    ? cityMatches.find(d => normalizeCountry(d.country) === normalizeCountry(query.countryName!)
      || d.country_code?.toLocaleLowerCase() === countryCode?.toLocaleLowerCase())
    : undefined;
  const city_ = countryMatch ?? (!query.countryName && cityMatches.length === 1 ? cityMatches[0] : undefined);
  if (city_) return { lat: city_.lat, lon: city_.lon, label: `${city_.name}, ${city_.country}` };
  const key = query.countryName?.replace(/\s*\([A-Za-z]{2,3}\)\s*$/, '').trim().toLowerCase();
  const centerKey = key ? COUNTRY_ALIASES[key] ?? key : undefined;
  const center = centerKey ? COUNTRY_CENTERS[centerKey] ?? WORLD_COUNTRY_CENTERS[centerKey] : undefined;
  return center ? { ...center, label: [query.cityName, query.countryName].filter(Boolean).join(', ') } : null;
};

export const resolveCandidateDestination = (
  external: { destination_city?: string; destination_country?: string } | undefined,
  extracted: { destination_city?: string; destination_country?: string } | undefined,
) => findDestination(extracted?.destination_city || external?.destination_city, extracted?.destination_country || external?.destination_country);
