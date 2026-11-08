import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { BankStatement } from './bank-statement-store';
import type { PaymentMatch, BankLine } from './bank-reconciliation';
import type { Payment } from './types';
import { paymentReferences } from './bank-reconciliation';

export interface PaymentEvidenceComparisonInput {
  payment?: Payment;
  statement: BankStatement | null;
  match?: PaymentMatch;
}
export interface EvidenceCheck {
  label: string;
  status: 'match' | 'mismatch' | 'missing';
  detail: string;
}

const sameLine = (a: BankLine, b: BankLine) => a.date === b.date && a.reference === b.reference
  && a.description === b.description && a.amount === b.amount && a.currency === b.currency;
const present = (value?: string) => !!value?.trim();
const normalize = (value: string) => value.trim().toLowerCase();
const fieldLabel = (key: string) => key.replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());
const recordRows = (record: object): [string, string][] => Object.entries(record).flatMap(([key, value]) => {
  if (value === undefined) return [];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return recordRows(value).map(([label, text]) => [`${fieldLabel(key)} / ${label}`, text] as [string, string]);
  }
  return [[fieldLabel(key), Array.isArray(value) ? JSON.stringify(value) : String(value)]];
});

export function paymentEvidenceComparison({ payment, statement, match }: PaymentEvidenceComparisonInput) {
  const linkedIndex = payment && statement && match?.payment.id === payment.id && match.line
    ? statement.lines.findIndex(line => sameLine(line, match.line!)) : -1;
  const line = linkedIndex >= 0 ? statement!.lines[linkedIndex] : undefined;
  const references = payment ? paymentReferences(payment) : [];
  const bankReference = line?.reference || '';
  const referenceMatch = line && references.some(reference => present(bankReference)
    ? normalize(reference) === normalize(bankReference)
    : line.description.toLowerCase().split(/\s+/).includes(normalize(reference)));
  const comparableAmount = payment && line && Number.isFinite(payment.amount) && Number.isFinite(line.amount);
  const comparableCurrency = present(payment?.currency) && present(line?.currency);
  const checks: EvidenceCheck[] = [
    { label: 'Amount', status: !comparableAmount ? 'missing' : Math.round(payment!.amount * 100) === Math.round(line!.amount * 100) ? 'match' : 'mismatch',
      detail: `Receipt: ${payment ? payment.amount : 'Not recorded'}; bank credit: ${line ? line.amount : 'Not linked'}. Numeric comparison at two-decimal precision only; amounts across different currencies are not comparable.` },
    { label: 'Currency', status: !comparableCurrency ? 'missing' : normalize(payment!.currency) === normalize(line!.currency) ? 'match' : 'mismatch',
      detail: `Receipt: ${payment?.currency || 'Not recorded'}; bank credit: ${line?.currency || 'Not supplied'}. No conversion is assumed.` },
    { label: 'Reference', status: !line || !references.length || (!present(bankReference) && !referenceMatch) ? 'missing' : referenceMatch ? 'match' : 'mismatch',
      detail: `Receipt references: ${references.join(' / ') || 'Not recorded'}; bank reference: ${bankReference || 'Not supplied'}${referenceMatch && !present(bankReference) ? ' (receipt reference found as a full description token)' : ''}.` },
  ];
  const warnings = [
    'Portal receipt generated from the saved transaction record, not a provider-issued original PDF.',
    ...(statement?.synthetic && statement.demo_original?.complete ? ['Complete fictional demo statement: all generated credits are included, with zero simulated debits and per-currency opening/closing balances. Not bank-authenticated.'] : ['Bank data is an imported credit-row extract, not a bank-authenticated statement or original PDF. Original debits and omitted source rows are not available here.']),
    'Matching fields do not prove bank authenticity, settlement, or the cause of any discrepancy.',
    ...(!payment ? ['MISSING PROOF: No payment receipt is recorded. Request it; do not invent one.'] : []),
    ...(!statement ? ['MISSING PROOF: No bank statement is uploaded.'] : []),
    ...(!line ? ['MISSING PROOF: No linked deposit exists in this statement for this payment.'] : []),
    ...(payment && !payment.chechepay_receipt && !payment.demo_evidence ? ['MISSING PROOF: No full provider confirmation snapshot is stored.'] : []),
    ...(payment?.demo_evidence ? [`DEMO confirmation and identity snapshot: ${payment.demo_evidence.bank_name}. Fictional practice evidence, not a fraud-free identity certification.`] : []),
    ...(payment?.status !== 'succeeded' && payment ? [`Recorded payment status is ${payment.status}; it is not a succeeded payment.`] : []),
    ...(statement?.synthetic || payment?.provider === 'mock' ? ['DEMO / SYNTHETIC EVIDENCE: This comparison includes synthetic evidence, not real-bank proof.'] : []),
    ...(match && payment && match.payment.id === payment.id ? [`Saved reconciliation: ${match.status}; basis: ${match.matchBasis}. ${match.explanation}`] : []),
  ];
  return { checks, warnings, linkedIndex, receiptRows: payment ? recordRows(payment) : [],
    statementRows: statement ? recordRows({ ...statement, lines: undefined }) : [] };
}

// Standard PDF fonts cannot encode all scripts. Escape unsupported code points instead of silently dropping facts.
export function pdfEvidenceText(value: string): string {
  return Array.from(value).map(character => {
    const code = character.codePointAt(0)!;
    if (character === '\n') return '\n';
    if (code >= 32 && code <= 126) return character;
    return `[U+${code.toString(16).toUpperCase().padStart(4, '0')}]`;
  }).join('');
}

export async function buildPaymentEvidencePdf(input: PaymentEvidenceComparisonInput): Promise<Uint8Array> {
  const comparison = paymentEvidenceComparison(input);
  const document = await PDFDocument.create();
  document.setTitle('Receipt and bank statement comparison');
  document.setSubject('Browser-local saved evidence comparison; not bank-authenticated proof');
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const width = 842, height = 595, margin = 32;
  let page: PDFPage;
  let y = 0;
  const addPage = () => {
    page = document.addPage([width, height]); y = height - margin;
    page.drawText('Receipt and bank statement comparison', { x: margin, y, font: bold, size: 15 });
    y -= 26;
  };
  const wrap = (text: string, available: number, size: number, selectedFont: PDFFont) => {
    const lines: string[] = [];
    for (const paragraph of pdfEvidenceText(text).split('\n')) {
      let current = '';
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (selectedFont.widthOfTextAtSize(candidate, size) <= available) {
          current = candidate;
          continue;
        }
        if (current) { lines.push(current); current = ''; }
        let wordWidth = 0;
        for (const character of word) {
          const characterWidth = selectedFont.widthOfTextAtSize(character, size);
          if (wordWidth + characterWidth > available && current) {
            lines.push(current); current = ''; wordWidth = 0;
          }
          current += character; wordWidth += characterWidth;
        }
      }
      lines.push(current);
    }
    return lines;
  };
  const text = (value: string, x: number, available: number, size = 9, strong = false) => {
    for (const line of wrap(value, available, size, strong ? bold : font)) {
      if (y < 48) addPage();
      page.drawText(line, { x, y, font: strong ? bold : font, size }); y -= size + 4;
    }
    y -= 4;
  };
  addPage();
  text('Unicode outside ASCII is preserved as [U+XXXX] code-point escapes. All pages belong to this single comparison PDF.', margin, width - 2 * margin, 8);
  const columnWidth = (width - 2 * margin - 24) / 2;
  const summary = (value: string) => {
    const safe = pdfEvidenceText(value);
    return safe.length > 600 ? `${safe.slice(0, 600)}\n[Continued in full saved fields below]` : safe;
  };
  const top = y;
  text('1. Saved portal receipt', margin, columnWidth, 12, true);
  text(summary(input.payment ? `${input.payment.amount} ${input.payment.currency}\nReceipt: ${input.payment.receipt_number || input.payment.id}\nPayment ID: ${input.payment.id}\nTransfer reference: ${input.payment.provider_reference || 'Not recorded'}\nStatus: ${input.payment.status}` : 'MISSING PROOF: No receipt recorded.'), margin, columnWidth);
  const leftEnd = y; y = top;
  text('2. Imported bank statement', margin + columnWidth + 24, columnWidth, 12, true);
  const linked = input.statement?.lines[comparison.linkedIndex];
  text(summary(input.statement ? `${input.statement.name}\nSaved credit rows: ${input.statement.lines.length}\n${input.statement.synthetic ? 'DEMO / SYNTHETIC EVIDENCE\n' : ''}${linked ? `Linked credit: ${linked.amount} ${linked.currency}\nDate: ${linked.date}\nReference: ${linked.reference || 'Not supplied'}\nDescription: ${linked.description}` : 'MISSING PROOF: No linked credit.'}` : 'MISSING PROOF: No bank statement.'), margin + columnWidth + 24, columnWidth);
  y = Math.min(leftEnd, y) - 8;
  for (const check of comparison.checks) {
    const lines = wrap(`${check.label.toUpperCase()}: ${check.status.toUpperCase()} - ${check.detail}`, width - 2 * margin - 16, 9, font);
    let offset = 0;
    while (offset < lines.length) {
      if (y < 75) addPage();
      const count = Math.min(lines.length - offset, Math.floor((y - 48) / 13));
      const boxHeight = count * 13 + 8;
      const color = check.status === 'match' ? rgb(0.86, 0.96, 0.89) : check.status === 'mismatch' ? rgb(1, 0.87, 0.87) : rgb(1, 0.94, 0.78);
      page.drawRectangle({ x: margin, y: y - boxHeight + 10, width: width - 2 * margin, height: boxHeight, color });
      for (const line of lines.slice(offset, offset + count)) {
        page.drawText(line, { x: margin + 8, y, size: 9, font }); y -= 13;
      }
      y -= 12; offset += count;
    }
  }
  for (const warning of comparison.warnings) text(warning, margin, width - 2 * margin, 9);
  text('Full saved receipt fields', margin, width - 2 * margin, 12, true);
  for (const [label, value] of comparison.receiptRows) text(`${label}: ${value}`, margin, width - 2 * margin);
  text('Full saved statement metadata', margin, width - 2 * margin, 12, true);
  for (const [label, value] of comparison.statementRows) text(`${label}: ${value}`, margin, width - 2 * margin);
  text('All imported statement credit rows (not the original source document)', margin, width - 2 * margin, 12, true);
  for (const [index, row] of (input.statement?.lines || []).entries()) {
    text(`Row ${index + 1}${index === comparison.linkedIndex ? ' [LINKED COMPARISON ROW]' : ''}: Date: ${row.date} | Amount: ${row.amount} ${row.currency} | Reference: ${row.reference || 'Not supplied'} | Description: ${row.description}`, margin, width - 2 * margin, 9, index === comparison.linkedIndex);
  }
  document.getPages().forEach((item, index, pages) => item.drawText(`Page ${index + 1} of ${pages.length} - Saved evidence comparison, not original bank proof`, { x: margin, y: 22, size: 8, font }));
  return document.save();
}
