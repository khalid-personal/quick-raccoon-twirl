import { describe, expect, it } from 'vitest';
import { extractContractFields, normalizeContractFields } from '../contract-extraction';

describe('conservative employment contract extraction', () => {
  it('extracts labeled employer/contract fields without borrowing worker or emergency contacts', () => {
    const { fields, warnings } = extractContractFields(`Employment contract
Candidate name: Fictional Worker
Phone: +251900000000
Emergency contact: Another Person
Employer: Fictional Household
Employer contact: Fictional Contact
Employer phone: +966 500 000 001
Employer email: contact@example.test
Employer address: Fictional Street
Destination country: Saudi Arabia
Destination city: Riyadh
Job title: Household worker
Monthly salary: 1,500 SAR
Start date: 2026-11-01
End date: 2028-11-01
Contract reference: FX-481`);
    expect(fields).toEqual({ employer: 'Fictional Household', employer_contact_name: 'Fictional Contact', employer_phone: '+966 500 000 001', employer_email: 'contact@example.test', employer_address: 'Fictional Street', destination_country: 'Saudi Arabia', destination_city: 'Riyadh', job_title: 'Household worker', salary: '1,500 SAR', start_date: '2026-11-01', expiry_date: '2028-11-01', document_number: 'FX-481' });
    expect(warnings).toEqual([]);
  });
  it('leaves missing, conflicting and invalid OCR values empty and reports them', () => {
    const result = extractContractFields('Employer: First\nEmployer: Second\nEmployer phone: call me\nEmployer email: bad address\nStart date: 11/12/2026\nEnd date: 2026-02-30');
    expect(result.fields).toEqual({});
    expect(result.warnings.length).toBeGreaterThanOrEqual(5);
    expect(result.warnings.join(' ')).toContain('conflicting');
    expect(extractContractFields('Worker phone: +251900000000\nEmail: worker@example.test').fields).toEqual({});
  });
  it('normalizes reviewed values, rejects ambiguous/reversed dates and unsafe contacts', () => {
    expect(normalizeContractFields({ employer: '  Household  ', employer_phone: '', job_title: ' Worker ' })).toEqual({ employer: 'Household', job_title: 'Worker' });
    expect(() => normalizeContractFields({ employer_phone: 'javascript:alert(1)' })).toThrow('phone');
    expect(() => normalizeContractFields({ employer_email: 'mail@example.test?body=spam' })).toThrow('email');
    expect(() => normalizeContractFields({ start_date: '2028-01-01', expiry_date: '2027-01-01' })).toThrow('before');
    expect(() => normalizeContractFields({ employer: 'x'.repeat(501) })).toThrow('overly long');
  });
});
