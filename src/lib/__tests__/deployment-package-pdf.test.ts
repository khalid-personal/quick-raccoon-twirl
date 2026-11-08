import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { buildCandidateProfilePdf } from '../deployment-package-pdf';
import { candidatePackageFields, deploymentPackageHtml, type PackageDocument } from '../deployment-package';
import { generateDemoDataset } from '../demo-dataset';
import type { CandidateDetail } from '../types';
import { getConfig } from '../data-store';

vi.mock('../data-store', () => ({ getConfig: vi.fn(() => ({})), saveConfig: vi.fn() }));
beforeEach(() => { vi.mocked(getConfig).mockReturnValue({} as ReturnType<typeof getConfig>); });

const demo = generateDemoDataset(Date.parse('2026-11-07'));
const candidate: CandidateDetail = {
  ...demo.candidates[0], first_name: 'Aster', last_name: 'Tesfaye',
  stages: demo.stages.filter(stage => stage.candidate_id === demo.candidates[0].id).map(stage => ({ ...stage, notes: 'PRIVATE-STAFF-NOTE' })),
  documents: [], medical_results: [], chat_messages: [],
};
const documents: PackageDocument[] = [
  { id: 'passport', title: 'Passport', stage: 'Registration', updatedAt: '', filename: 'passport.pdf', local: false },
  { id: 'contract', title: 'Work contract', stage: 'Deployment', updatedAt: '2026-11-07', filename: 'contract.pdf', local: true, url: 'data:application/pdf;base64,YQ==' },
  { id: 'other', title: 'Visa', stage: 'Deployment', updatedAt: '', filename: 'visa.pdf', local: false, url: 'https://example.test/visa.pdf' },
];

async function readPdf(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const contents = pdf.getPage(0).node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map(ref => pdf.context.lookup(ref)) : [contents];
  const text = streams.filter((stream): stream is PDFRawStream => stream instanceof PDFRawStream).flatMap(stream => {
    const content = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
    return [...content.matchAll(/<([0-9a-f]+)>\s*Tj/gi)].map(match => Buffer.from(match[1], 'hex').toString('latin1'));
  }).join(' ');
  return { pdf, text };
}

describe('one-page candidate profile PDF', () => {
  it('creates a measured real A4 page with all safe fields, stages and honest availability', async () => {
    const result = await buildCandidateProfilePdf(candidate, documents);
    const { pdf, text } = await readPdf(result.bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(Buffer.from(result.bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const dimensions = [pdf.getPage(0).getWidth(), pdf.getPage(0).getHeight()].sort((a, b) => a - b);
    expect(dimensions[0]).toBeCloseTo(595.28, 1);
    expect(dimensions[1]).toBeCloseTo(841.89, 1);
    expect(result.appendixRequired).toBe(false);
    expect(result.layout.lowestTextY).toBeGreaterThanOrEqual(80);
    expect(result.layout.widestLine).toBeLessThanOrEqual(result.layout.columnWidth);
    const joined = text.replace(/\s+/g, ' ');
    for (const [label] of candidatePackageFields(candidate)) expect(joined).toContain(label);
    for (const stage of ['Registration', 'Training', 'Medical Check', 'Deployment']) expect(joined).toContain(stage);
    expect(joined).toContain('Aster Tesfaye');
    expect(joined).toContain('Missing original');
    expect(joined).toContain('Online only');
    expect(joined).toContain('HTML');
    expect(joined).toContain('Logo not configured');
    expect(joined).toContain('NOT AN OFFICIAL');
    expect(joined).not.toContain('PRIVATE-STAFF-NOTE');
  });
  it('keeps huge profiles on one page and explicitly sends full values and document index to HTML', async () => {
    const longCandidate = { ...candidate, professional_summary: 'Full professional introduction '.repeat(400), skills: ['Extensive skills '.repeat(200)] };
    const manyDocuments = Array.from({ length: 150 }, (_, index) => ({ ...documents[0], id: `doc-${index}`, title: `Original document ${index}` }));
    const result = await buildCandidateProfilePdf(longCandidate, manyDocuments);
    const { pdf, text } = await readPdf(result.bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(result.appendixRequired).toBe(true);
    expect(text).toContain('OVERVIEW ONLY');
    expect(text).toContain('150 items');
    expect(text).toContain('full HTML availability index');
    expect(deploymentPackageHtml(longCandidate, manyDocuments)).toContain(longCandidate.professional_summary);
    expect(deploymentPackageHtml(longCandidate, manyDocuments)).toContain('Original document 149');
  });
  it('does not silently discard unsupported non-Latin text', async () => {
    const result = await buildCandidateProfilePdf({ ...candidate, first_name: 'አስቴር' }, documents);
    const { text } = await readPdf(result.bytes);
    expect(result.appendixRequired).toBe(true);
    expect(text).toContain('[see HTML]');
    expect(text).toContain('OVERVIEW ONLY');
    expect(deploymentPackageHtml({ ...candidate, first_name: 'አስቴር' }, documents)).toContain('አስቴር');
  });
  it('embeds saved PNG profile bytes without fetching any remote personal photo', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';
    const result = await buildCandidateProfilePdf({ ...candidate, profile_image_url: png }, documents);
    expect(result.photoIncluded).toBe(true);
    expect((await readPdf(result.bytes)).pdf.getPageCount()).toBe(1);
    expect((await buildCandidateProfilePdf({ ...candidate, profile_image_url: 'https://example.test/private-photo.png' }, documents)).photoIncluded).toBe(false);
    expect((await buildCandidateProfilePdf({ ...candidate, profile_image_url: 'data:image/png;base64,YQ==' }, documents)).photoIncluded).toBe(false);
  });
  it('labels simulated ministry state and never attaches original documents to the PDF', async () => {
    const result = await buildCandidateProfilePdf({ ...candidate, clearance: { labour_ministry: { status: 'cleared', simulated: true } } }, documents);
    const { pdf, text } = await readPdf(result.bytes);
    expect(text).toContain('Simulated - not official');
    expect(text).toContain('DEMO - NOT OFFICIAL');
    expect(text).toContain('Original attachments are NOT inside this PDF');
    expect(pdf.catalog.get(PDFName.of('Names'))).toBeUndefined();
  });
  it('records the configured expired submission deadline in both exports without dropping it on a long profile', async () => {
    vi.mocked(getConfig).mockReturnValue({ ministrySubmissionWindow: { startsOn: '2020-01-01', endsOn: '2020-01-08' } } as ReturnType<typeof getConfig>);
    const long = { ...candidate, professional_summary: 'Long introduction '.repeat(500) };
    const result = await buildCandidateProfilePdf(long, documents);
    const { pdf, text } = await readPdf(result.bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(text).toContain('2020-01-08');
    expect(text).toContain('expired - deadline passed');
    expect(text).toContain('configured ministry window');
    const html = deploymentPackageHtml(long, documents);
    expect(html).toContain('Submission window');
    expect(html).toContain('Deadline: 2020-01-08');
    expect(html).toContain('expired - deadline passed');
    expect(result.layout.lowestTextY).toBeGreaterThanOrEqual(80);
  });
  it('labels the resolver default and invalid configurations honestly', async () => {
    expect(deploymentPackageHtml(candidate, documents)).toContain('default seven-day window (not ministry-issued)');
    vi.mocked(getConfig).mockReturnValue({ ministrySubmissionWindow: { startsOn: 'invalid', endsOn: '2020-01-08' } } as ReturnType<typeof getConfig>);
    const { text } = await readPdf((await buildCandidateProfilePdf(candidate, documents)).bytes);
    expect(text).toContain('No valid deadline confirmed');
    expect(deploymentPackageHtml(candidate, documents)).toContain('No valid deadline confirmed');
  });
});
