export interface Airport { code: string; city: string; name: string; country: string; lat: number; lon: number }

export const AIRPORTS: Record<string, Airport> = Object.fromEntries([
  { code: 'ADD', city: 'Addis Ababa', name: 'Bole International', country: 'Ethiopia', lat: 8.9779, lon: 38.7993 },
  { code: 'RUH', city: 'Riyadh', name: 'King Khalid International', country: 'Saudi Arabia', lat: 24.9576, lon: 46.6988 },
  { code: 'JED', city: 'Jeddah', name: 'King Abdulaziz International', country: 'Saudi Arabia', lat: 21.6796, lon: 39.1565 },
  { code: 'DMM', city: 'Dammam', name: 'King Fahd International', country: 'Saudi Arabia', lat: 26.4712, lon: 49.7979 },
  { code: 'MED', city: 'Medina', name: 'Prince Mohammad bin Abdulaziz', country: 'Saudi Arabia', lat: 24.5534, lon: 39.705 },
  { code: 'KWI', city: 'Kuwait City', name: 'Kuwait International', country: 'Kuwait', lat: 29.2266, lon: 47.9689 },
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'United Arab Emirates', lat: 25.2532, lon: 55.3657 },
  { code: 'AUH', city: 'Abu Dhabi', name: 'Zayed International', country: 'United Arab Emirates', lat: 24.4331, lon: 54.6511 },
  { code: 'DOH', city: 'Doha', name: 'Hamad International', country: 'Qatar', lat: 25.2731, lon: 51.608 },
  { code: 'BAH', city: 'Manama', name: 'Bahrain International', country: 'Bahrain', lat: 26.2708, lon: 50.6336 },
  { code: 'MCT', city: 'Muscat', name: 'Muscat International', country: 'Oman', lat: 23.5933, lon: 58.2844 },
  { code: 'AMM', city: 'Amman', name: 'Queen Alia International', country: 'Jordan', lat: 31.7226, lon: 35.9932 },
  { code: 'BEY', city: 'Beirut', name: 'Rafic Hariri International', country: 'Lebanon', lat: 33.8209, lon: 35.4884 },
  { code: 'CAI', city: 'Cairo', name: 'Cairo International', country: 'Egypt', lat: 30.1219, lon: 31.4056 },
].map(airport => [airport.code, airport]));

export const airportForCity = (city?: string): Airport | undefined =>
  Object.values(AIRPORTS).find(airport => airport.city.toLowerCase() === (city ?? '').trim().toLowerCase());
