import { describe, expect, it } from 'vitest';
import { parsePassportMrz } from '../passport-mrz';

describe('passport MRZ parser', () => {
  it('prefills gender from the passport sex field', () => {
    const result = parsePassportMrz('P<USAERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36USA7408122F1204159ZE184226B<<<<<10');

    expect(result?.gender).toBe('female');
  });

  it('extracts passport details from OCR output even when a check digit is misread', () => {
    const result = parsePassportMrz('P<USAERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36USA7408122F1204159ZE184226B<<<<<11');

    expect(result).toEqual({
      first_name: 'ANNA MARIA',
      last_name: 'ERIKSSON',
      dob: '1974-08-12',
      passport_number: 'L898902C3',
      gender: 'female',
      country_of_origin: 'United States',
      passport_nationality: 'United States',
      passport_issuing_country: 'United States',
      passport_expiry_date: '2012-04-15',
      passport_document_type: 'P',
    });
  });

  it('normalizes OCR whitespace and common angle-bracket substitutions', () => {
    const result = parsePassportMrz('P<USA ERIKSSON««ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36USA7408122F1204159ZE184226B<<<<<10');

    expect(result?.first_name).toBe('ANNA MARIA');
    expect(result?.last_name).toBe('ERIKSSON');
  });

  it('trims extra trailing filler characters OCR adds to the name line', () => {
    const result = parsePassportMrz('P<USAERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<<<<\nL898902C36USA7408122F12041597E184226B<<<<<10');

    expect(result?.first_name).toBe('ANNA MARIA');
    expect(result?.last_name).toBe('ERIKSSON');
    expect(result?.passport_number).toBe('L898902C3');
    expect(result?.dob).toBe('1974-08-12');
  });

  it('uses nationality for origin, independently of the issuing country', () => {
    const result = parsePassportMrz('P<ETHERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36USA7408122F1204159ZE184226B<<<<<10');
    expect(result?.country_of_origin).toBe('United States');
    expect(result?.passport_issuing_country).toBe('Ethiopia');
  });

  it('does not invent an origin for unspecified nationality', () => {
    const result = parsePassportMrz('P<USAERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36XXX7408122F1204159ZE184226B<<<<<10');
    expect(result?.country_of_origin).toBeUndefined();
    expect(result?.passport_issuing_country).toBe('United States');
  });
});
