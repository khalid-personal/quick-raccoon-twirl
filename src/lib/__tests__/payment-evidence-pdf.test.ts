import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildPaymentEvidencePdf, paymentEvidenceComparison, pdfEvidenceText } from '../payment-evidence-pdf';
import { reconcile } from '../bank-reconciliation';
import type { Payment } from '../types';
import type { BankStatement } from '../bank-statement-store';

const payment: Payment = { id: 'pay-unique', receipt_number: 'R-1', provider_reference: 'REF-1', amount: 100, currency: 'ETB',
  status: 'succeeded', provider: 'mock', payer_display_name: 'ሀና 😊', payer_foreign_agency_id: 'foreign', payee_local_agency_id: 'local',
  candidate_ids: ['candidate-1'], created_at: '2026-11-07', updated_at: '2026-11-07' };
const statement: BankStatement = { name: 'DEMO statement', synthetic: true,
  lines: [{ amount: 100, currency: 'ETB', date: '2026-11-07', reference: 'REF-1', description: 'Incoming credit' }] };
const input = (bank = statement, receipt = payment) => ({ payment: receipt, statement: bank, match: reconcile([receipt], bank.lines).matches[0] });
async function parse(bytes: Uint8Array) {
  const document = await getDocument({ data: bytes, useSystemFonts: true, isEvalSupported: false }).promise;
  const pages = [];
  try {
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      pages.push((await page.getTextContent()).items.filter(item => 'str' in item).map(item => 'str' in item ? item.str : '').join(' '));
    }
    return pages;
  } finally { await document.destroy(); }
}
describe('paired evidence PDF', () => {
  it('downloads actual parseable single PDF with side-by-side first page and honest highlighted checks', async () => {
    const bytes = await buildPaymentEvidencePdf(input());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const pages = await parse(bytes);
    expect(pages[0]).toContain('1. Saved portal receipt');
    expect(pages[0]).toContain('2. Imported bank statement');
    const text = pages.join(' ');
    expect(text).toContain('AMOUNT: MATCH');
    expect(text).toContain('CURRENCY: MATCH');
    expect(text).toContain('REFERENCE: MATCH');
    expect(text).toContain('DEMO / SYNTHETIC EVIDENCE');
    expect(text).toContain('not a bank-authenticated statement');
    expect(text).toContain('MISSING PROOF: No full provider confirmation');
    expect(text).toContain('pay-unique');
    expect(text).toContain('candidate-1');
    expect(text).toContain('[U+1200]');
    expect(text).toContain('[U+1F60A]');
  });
  it('does not turn amount/date suggestions, wrong currencies or absent records into matches', () => {
    const wrongReference = { ...statement, lines: [{ ...statement.lines[0], reference: 'OTHER' }] };
    expect(paymentEvidenceComparison(input(wrongReference)).checks.map(check => check.status)).toEqual(['match', 'match', 'mismatch']);
    const wrongCurrency = { ...statement, lines: [{ ...statement.lines[0], amount: 90, currency: 'USD' }] };
    expect(paymentEvidenceComparison(input(wrongCurrency)).checks.map(check => check.status)).toEqual(['mismatch', 'mismatch', 'match']);
    expect(paymentEvidenceComparison({ statement: null }).checks.every(check => check.status === 'missing')).toBe(true);
    expect(paymentEvidenceComparison({ ...input(), statement: { ...statement, lines: [] } }).linkedIndex).toBe(-1);
    expect(paymentEvidenceComparison({ ...input(), payment: { ...payment, id: 'other' } }).linkedIndex).toBe(-1);
  });
  it('keeps all imported rows and long fields through pagination without omitting Unicode facts', async () => {
    const bank: BankStatement = { ...statement, name: 'Long ' + 'ሀ'.repeat(1000),
      lines: Array.from({ length: 140 }, (_, index) => ({ ...statement.lines[0], reference: `REF-${index}`, description: `Unique credit row ${index} ` + 'evidence '.repeat(45) })) };
    const pages = await parse(await buildPaymentEvidencePdf(input(bank)));
    expect(pages.length).toBeGreaterThan(3);
    expect(pages[0]).toContain('1. Saved portal receipt');
    expect(pages[0]).toContain('2. Imported bank statement');
    const text = pages.join(' ');
    for (let index = 0; index < bank.lines.length; index++) expect(text).toContain(`Unique credit row ${index}`);
    expect(text).toContain('Row 140');
    expect(pdfEvidenceText('ሀ 😊 —')).toBe('[U+1200] [U+1F60A] [U+2014]');
  }, 20000);
  it('exports missing-proof warnings when both sources are absent', async () => {
    const pages = await parse(await buildPaymentEvidencePdf({ statement: null }));
    expect(pages.join(' ')).toContain('MISSING PROOF: No payment receipt is recorded.');
    expect(pages.join(' ')).toContain('MISSING PROOF: No bank statement is uploaded.');
  });
});
