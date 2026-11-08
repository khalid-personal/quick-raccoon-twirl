import { parse, states } from 'mrz';

export interface PassportData {
  first_name?: string;
  last_name?: string;
  dob?: string;
  passport_number?: string;
  gender?: 'male' | 'female';
  country_of_origin?: string;
  passport_nationality?: string;
  passport_issuing_country?: string;
  passport_expiry_date?: string;
  passport_document_type?: string;
}

const decodeMRZText = (value: string): string =>
  value.replace(/</g, ' ').replace(/\s+/g, ' ').trim();

const formatMrzDate = (value?: string | null, isBirthDate = true): string | undefined => {
  if (!value || !/^\d{6}$/.test(value)) return undefined;
  const year = Number(value.slice(0, 2));
  const month = value.slice(2, 4);
  const day = value.slice(4, 6);
  const currentYear = new Date().getUTCFullYear();
  let fullYear = Math.floor(currentYear / 100) * 100 + year;
  if (isBirthDate && fullYear > currentYear) fullYear -= 100;
  const parsedDate = new Date(`${fullYear}-${month}-${day}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getUTCFullYear() !== fullYear ||
    parsedDate.getUTCMonth() + 1 !== Number(month) ||
    parsedDate.getUTCDate() !== Number(day)
  ) return undefined;
  return `${fullYear}-${month}-${day}`;
};

const countryName = (code?: string | null): string | undefined => {
  if (!code || /^XX|^UN/.test(code)) return undefined;
  if (code === 'USA') return 'United States';
  if (code === 'GBR') return 'United Kingdom';
  if (code.replace(/</g, '') === 'D') return 'Germany';
  return states[code]?.replace(/\s+\(the\)$/, '');
};

const extractMrzLines = (text: string): string[][] => {
  const lines = text
    .toUpperCase()
    .replace(/[«‹〈⟨]/g, '<')
    .split(/\r?\n/)
    .map(line => line.replace(/[^A-Z0-9<]/g, ''))
    .filter(line => line.length >= 25);
  const passportLine = lines.find(line => line.startsWith('P<'));
  if (passportLine && passportLine.length > 44 && passportLine.length <= 48 && /<+$/.test(passportLine)) {
    const index = lines.indexOf(passportLine);
    lines[index] = passportLine.slice(0, 44);
  }
  const formats = new Set([30, 36, 44]);
  const groups: string[][] = [];

  for (let start = 0; start < lines.length; start += 1) {
    for (const count of [2, 3]) {
      const candidate = lines.slice(start, start + count);
      if (candidate.length === count && candidate.every(line => line.length === candidate[0].length && formats.has(line.length))) {
        groups.push(candidate);
      }
    }
  }

  const compact = text.toUpperCase().replace(/[«‹〈⟨]/g, '<').replace(/[^A-Z0-9<]/g, '');
  if (compact.length === 88) groups.push([compact.slice(0, 44), compact.slice(44)]);
  return groups;
};

export const parsePassportMrz = (text: string): PassportData | null => {
  for (const lines of extractMrzLines(text)) {
    try {
      const { fields } = parse(lines.join('\n'));
      if (!fields) continue;

      const firstName = decodeMRZText(fields.firstName ?? '');
      const lastName = decodeMRZText(fields.lastName ?? '');
      const dob = formatMrzDate(fields.birthDate);
      const passportNumber = decodeMRZText(fields.documentNumber ?? '');
      const gender = fields.sex === 'male' ? 'male' : fields.sex === 'female' ? 'female' : undefined;
      const nationality = countryName(fields.nationality);

      if (!firstName && !lastName && !dob && !passportNumber) continue;

      return {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        dob,
        passport_number: passportNumber || undefined,
        gender,
        country_of_origin: nationality,
        passport_nationality: nationality,
        passport_issuing_country: countryName(fields.issuingState),
        passport_expiry_date: formatMrzDate(fields.expirationDate, false),
        passport_document_type: fields.documentCode ?? undefined,
      };
    } catch {
      continue;
    }
  }
  return null;
};