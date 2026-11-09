import type { ExtractedDocumentFields } from './types';
import { readDocumentTextFromFile } from './document-stage-detection';

export const CONTRACT_FIELD_LABELS = {
  employer: 'Employer / company',
  employer_contact_name: 'Employer contact person',
  employer_phone: 'Employer phone',
  employer_email: 'Employer email',
  employer_address: 'Employer address',
  destination_country: 'Contract destination country',
  destination_city: 'Contract destination city',
  job_title: 'Job title',
  salary: 'Salary and currency (as written)',
  start_date: 'Contract start date (YYYY-MM-DD)',
  expiry_date: 'Contract end date (YYYY-MM-DD)',
  document_number: 'Contract reference',
} satisfies Partial<Record<keyof ExtractedDocumentFields, string>>;
export type ContractField = keyof typeof CONTRACT_FIELD_LABELS;

const patterns: Record<ContractField, string> = {
  employer: '(?:employer(?: name)?|company(?: name)?|sponsor(?: name)?)',
  employer_contact_name: '(?:employer contact(?: name| person)?|contact person|sponsor contact)',
  employer_phone: '(?:employer (?:phone|telephone|mobile)|company (?:phone|telephone)|contact (?:phone|telephone))',
  employer_email: '(?:employer e-?mail|company e-?mail|contact e-?mail)',
  employer_address: '(?:employer address|company address|workplace address)',
  destination_country: '(?:destination country|country of employment|work country)',
  destination_city: '(?:destination city|city of employment|work city)',
  job_title: '(?:job title|position|occupation)',
  salary: '(?:monthly salary|basic salary|salary|monthly wage)',
  start_date: '(?:contract start date|start date|commencement date)',
  expiry_date: '(?:contract end date|end date|expiry date|expiration date)',
  document_number: '(?:contract (?:reference|number|no\\.?|id)|agreement (?:reference|number))',
};

export const normalizeContractFields = (input: ExtractedDocumentFields): ExtractedDocumentFields => {
  const output: ExtractedDocumentFields = {};
  for (const key of Object.keys(CONTRACT_FIELD_LABELS) as ContractField[]) {
    const value = input[key]?.trim();
    if (!value) continue;
    if (value.length > 500 || [...value].some(character => character.charCodeAt(0) < 32)) throw new Error(`${CONTRACT_FIELD_LABELS[key]} contains invalid or overly long text.`);
    if (key === 'employer_email' && !/^[^\s@?#&]+@[a-z\d.-]+\.[a-z]{2,}$/i.test(value)) throw new Error('Check the employer email address.');
    if (key === 'employer_phone' && (!/^\+?[\d ()-]{6,30}$/.test(value) || value.replace(/\D/g, '').length < 6)) throw new Error('Check the employer phone number.');
    if (key === 'start_date' || key === 'expiry_date') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
        throw new Error('Contract dates must be valid YYYY-MM-DD dates. Leave uncertain dates empty.');
      }
    }
    output[key] = value;
  }
  if (output.start_date && output.expiry_date && output.expiry_date < output.start_date) throw new Error('Contract end date cannot be before its start date.');
  return output;
};

export const extractContractFields = (text: string): { fields: ExtractedDocumentFields; warnings: string[] } => {
  const fields: ExtractedDocumentFields = {};
  const warnings: string[] = [];
  for (const key of Object.keys(patterns) as ContractField[]) {
    const expression = new RegExp(`^\\s*${patterns[key]}\\s*[:：]\\s*(.+?)\\s*$`, 'gim');
    const values = [...new Set([...text.matchAll(expression)].map(match => match[1].trim()))];
    if (values.length > 1) { warnings.push(`${CONTRACT_FIELD_LABELS[key]} has conflicting values; check the original.`); continue; }
    if (!values.length) continue;
    try { Object.assign(fields, normalizeContractFields({ [key]: values[0] })); }
    catch (error) { warnings.push(error instanceof Error ? error.message : `Check ${CONTRACT_FIELD_LABELS[key]} against the original.`); }
  }
  if (!fields.employer) warnings.push('Employer name was not confidently detected. No employer will be invented.');
  if (!fields.employer_phone && !fields.employer_email) warnings.push('No labeled employer phone or email detected. Candidate contacts are never substituted.');
  return { fields, warnings };
};

export const scanContractFile = async (file: File) => {
  const result = await readDocumentTextFromFile(file);
  const extracted = extractContractFields(result.text);
  return {
    ...extracted, scannedPages: result.scannedPages,
    warnings: [...extracted.warnings,
      ...(result.totalPages > result.scannedPages ? [`Read the first ${result.scannedPages} of ${result.totalPages} pages; review the remaining pages manually.`] : []),
      'Automatic extraction reads labeled English fields. Other languages and layouts require review against the original.'],
  };
};
