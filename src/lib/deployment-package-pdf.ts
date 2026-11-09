import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { CandidateDetail } from './types';
import { candidatePackageFields, candidatePackageSummary, packageMinistryBrand, safeDocumentUrl, type PackageDocument } from './deployment-package';
import { isDemoMode } from './demo-mode';

type Row = { text: string; heading?: boolean };
export interface ProfilePdfResult {
  bytes: Uint8Array;
  appendixRequired: boolean;
  photoIncluded: boolean;
  orientation: 'landscape' | 'portrait';
  layout: { fontSize: number; lowestTextY: number; widestLine: number; columnWidth: number };
}

const plain = (text: string, font: PDFFont): string => Array.from(text.replace(/\s+/g, ' ').trim()).map(char => {
  try { font.encodeText(char); return char; } catch { return '[see HTML]'; }
}).join('');

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
    if (line) { lines.push(line); line = ''; }
    if (font.widthOfTextAtSize(word, size) <= width) { line = word; continue; }
    let lineWidth = 0;
    for (const char of word) {
      const charWidth = font.widthOfTextAtSize(char, size);
      if (line && lineWidth + charWidth > width) { lines.push(line); line = ''; lineWidth = 0; }
      line += char;
      lineWidth += charWidth;
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines.length ? lines : ['Not recorded'];
}

export async function buildCandidateProfilePdf(candidate: CandidateDetail, documents: PackageDocument[]): Promise<ProfilePdfResult> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const summary = candidatePackageSummary(candidate);
  let appendixRequired = false;
  const normalize = (text: string) => {
    const result = plain(text, font);
    if (result !== text.replace(/\s+/g, ' ').trim()) appendixRequired = true;
    return result;
  };
  const rows: Row[] = [
    { text: 'Candidate profile', heading: true },
    { text: `Name: ${summary.name}` },
    ...candidatePackageFields(candidate).map(([label, value]) => ({ text: `${label}: ${value || 'Not recorded'}` })),
    { text: 'Four-stage details (status only; no medical results)', heading: true },
    ...summary.stages.map(stage => ({ text: `${stage.title}: ${stage.status}; Date: ${stage.date || 'Not recorded'}; Reference: ${stage.reference || 'Not recorded'}; Updated: ${stage.updatedAt || 'Not recorded'}` })),
    { text: 'Document availability index', heading: true },
    { text: `${documents.length} items: ${documents.filter(doc => safeDocumentUrl(doc.url) && doc.local).length} embedded in HTML; ${documents.filter(doc => safeDocumentUrl(doc.url) && !doc.local).length} online only; ${documents.filter(doc => !safeDocumentUrl(doc.url)).length} missing originals.` },
    ...documents.map(doc => ({ text: `${doc.stage} / ${doc.title}: ${safeDocumentUrl(doc.url) ? doc.local ? 'Embedded in separate HTML bundle' : 'Online only - NOT embedded' : 'Missing original - ask agency to upload'}; Updated: ${doc.updatedAt || 'Not recorded'}` })),
  ].map(row => ({ ...row, text: normalize(row.text) }));
  const formats = [
    { orientation: 'portrait' as const, width: 595.28, height: 841.89, columns: 2 },
    { orientation: 'landscape' as const, width: 841.89, height: 595.28, columns: 3 },
  ];
  const measure = (format: typeof formats[number], size: number, source: Row[]) => {
    const columnWidth = (format.width - 64 - (format.columns - 1) * 16) / format.columns;
    const top = format.height - 132;
    const bottom = 80;
    let column = 0, y = top, widestLine = 0;
    const placed: { row: Row; lines: string[]; column: number; y: number }[] = [];
    for (const row of source) {
      const lines = wrap(row.text, row.heading ? bold : font, size, columnWidth);
      const height = lines.length * (size + 3) + (row.heading ? 8 : 5);
      if (y - height < bottom) { column++; y = top; }
      if (column >= format.columns || y - height < bottom) return undefined;
      placed.push({ row, lines, column, y });
      for (const line of lines) widestLine = Math.max(widestLine, (row.heading ? bold : font).widthOfTextAtSize(line, size));
      y -= height;
    }
    return { format, size, columnWidth, placed, lowestTextY: Math.min(...placed.map(item => item.y - (item.lines.length - 1) * (size + 3))), widestLine };
  };
  const choose = (source: Row[]) => {
    for (const size of [10, 9, 8]) {
      for (const format of formats) { const result = measure(format, size, source); if (result) return result; }
    }
  };
  let layout = choose(rows);
  if (!layout) {
    appendixRequired = true;
    // Every field and all four stages remain indexed; full values stay in the HTML appendix.
    const compact = rows.map(row => row.text.length > 120 && !row.text.startsWith('Submission window:') ? { ...row, text: `${row.text.slice(0, 80)}... [full details in HTML appendix]` } : row);
    while (!(layout = choose(compact))) {
      const documentHeading = compact.findIndex(row => row.text === 'Document availability index');
      if (compact.length > documentHeading + 3) {
        compact.pop();
        const last = compact[compact.length - 1];
        if (!last.heading) last.text = 'Additional document entries: see full HTML availability index.';
      } else {
        for (const row of compact) if (!row.heading && row.text.length > 75 && !row.text.startsWith('Submission window:')) row.text = `${row.text.split(':')[0]}: [full details in HTML appendix]`;
        layout = choose(compact);
        if (!layout) throw new Error('Profile overview could not fit safely on one page.');
      }
    }
  }
  const page = pdf.addPage([layout.format.width, layout.format.height]);
  const ink = rgb(18 / 255, 40 / 255, 42 / 255);
  const teal = rgb(50 / 255, 128 / 255, 120 / 255);
  const ivory = rgb(244 / 255, 244 / 255, 237 / 255);
  const lime = rgb(200 / 255, 245 / 255, 117 / 255);
  const text = (value: string, x: number, y: number, size = 9, heading = false) => page.drawText(value, { x, y, size, font: heading ? bold : font, color: ink });
  // Trusted DAWM mark: vector geometry from the existing DawmBrand component, not a ministry seal.
  page.drawRectangle({ x: 32, y: page.getHeight() - 65, width: 38, height: 38, color: teal });
  page.drawSvgPath('M46 42 H78 C104 42 122 59 122 80 C122 101 104 118 78 118 H46 Z', { x: 32, y: page.getHeight() - 27, scale: 38 / 160, borderColor: ivory, borderWidth: 14 });
  page.drawSvgPath('M64 98 L79 84 L94 70', { x: 32, y: page.getHeight() - 27, scale: 38 / 160, borderColor: lime, borderWidth: 4 });
  for (const [x, y, radius] of [[64, 98, 5], [79, 84, 5], [94, 70, 6]]) page.drawCircle({ x: 32 + x * 38 / 160, y: page.getHeight() - 27 - y * 38 / 160, size: radius * 38 / 160, color: x === 94 ? lime : ivory });
  text('DAWM Portal', 80, page.getHeight() - 40, 13, true);
  text('Candidate profile overview', 80, page.getHeight() - 56);
  const ministryX = page.getWidth() / 2;
  text(packageMinistryBrand, ministryX, page.getHeight() - 40, 10, true);
  text('Logo not configured - no official endorsement', ministryX, page.getHeight() - 56, 8);
  text(isDemoMode() || candidate.clearance?.labour_ministry?.simulated ? 'DEMO - NOT OFFICIAL: PERSONAL CANDIDATE PROFILE' : 'PERSONAL RECORD - NOT AN OFFICIAL CLEARANCE CERTIFICATE', 32, page.getHeight() - 84, 9, true);
  text(`Snapshot: ${new Date().toISOString()} | Fresh download required after updates`, 32, page.getHeight() - 99, 8);
  let photoIncluded = false;
  const photo = safeDocumentUrl(candidate.profile_image_url);
  if (photo?.startsWith('data:image/')) {
    try {
      const image = photo.startsWith('data:image/png;') ? await pdf.embedPng(photo) : photo.startsWith('data:image/jpeg;') ? await pdf.embedJpg(photo) : undefined;
      if (image) {
        const box = image.scaleToFit(42, 42);
        page.drawImage(image, { x: page.getWidth() - 32 - box.width, y: page.getHeight() - 121, ...box });
        photoIncluded = true;
      }
    } catch { /* Invalid image bytes must not prevent downloading the safe profile. */ }
  }
  text(photoIncluded ? 'Saved profile photo included' : 'Photo not embedded (missing, online or unsupported)', 32, page.getHeight() - 114, 8);
  for (const item of layout.placed) item.lines.forEach((line, index) => text(line, 32 + item.column * (layout.columnWidth + 16), item.y - index * (layout.size + 3), layout.size, item.row.heading));
  const footer = [
    appendixRequired ? 'OVERVIEW ONLY: some long / non-Latin values or document entries require the full HTML appendix.' : 'All safe summary fields and document entries shown. Original attachments are NOT inside this PDF.',
    'Download the separate HTML document bundle for full details, embedded files and the missing-original checklist.',
    'Private notes, chats, audit data, medical result details and bank statements excluded. Keep this personal file secure.',
  ];
  footer.forEach((line, index) => wrap(line, font, 8, page.getWidth() - 64).forEach((part, sub) => text(part, 32, 61 - index * 16 - sub * 9, 8)));
  pdf.setTitle('DAWM candidate profile overview');
  pdf.setSubject('Personal snapshot, not an official clearance certificate');
  return { bytes: await pdf.save(), appendixRequired, photoIncluded, orientation: layout.format.orientation, layout: { fontSize: layout.size, lowestTextY: layout.lowestTextY, widestLine: layout.widestLine, columnWidth: layout.columnWidth } };
}
