// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { scanContractFile } from '../contract-extraction';

const mocks = vi.hoisted(() => ({
  content: vi.fn(), getPage: vi.fn(), getDocument: vi.fn(), destroy: vi.fn(), render: vi.fn(),
  recognize: vi.fn(), createWorker: vi.fn(), terminate: vi.fn(),
}));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: mocks.getDocument }));
vi.mock('tesseract.js', () => ({ createWorker: mocks.createWorker }));
const text = 'Employer: Fictional Household\nEmployer phone: +966500000001\nDestination country: Saudi Arabia\n';
const file = () => {
  const original = new File(['%PDF-1.4'], 'original.pdf', { type: 'application/pdf' });
  Object.defineProperty(original, 'arrayBuffer', { value: async () => new TextEncoder().encode('%PDF-1.4').buffer });
  return original;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.content.mockResolvedValue({ items: text.trim().split('\n').map(str => ({ str, hasEOL: true })) });
  mocks.render.mockReturnValue({ promise: Promise.resolve() });
  mocks.destroy.mockResolvedValue(undefined);
  mocks.getPage.mockResolvedValue({ getTextContent: mocks.content, getViewport: () => ({ width: 600, height: 800 }), render: mocks.render, cleanup: vi.fn() });
  mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: mocks.getPage, destroy: mocks.destroy }) });
  mocks.createWorker.mockResolvedValue({ recognize: mocks.recognize, terminate: mocks.terminate });
  mocks.recognize.mockResolvedValue({ data: { text } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,synthetic');
});
afterEach(() => vi.restoreAllMocks());
it('reads embedded PDF contract text without OCR and preserves labeled field boundaries', async () => {
  const result = await scanContractFile(file());
  expect(result.fields).toMatchObject({ employer: 'Fictional Household', employer_phone: '+966500000001', destination_country: 'Saudi Arabia' });
  expect(mocks.createWorker).not.toHaveBeenCalled();
  expect(mocks.destroy).toHaveBeenCalledOnce();
});
it('OCRs image-only PDFs, limits work to four pages and reports truncated documents', async () => {
  mocks.content.mockResolvedValue({ items: [] });
  mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 8, getPage: mocks.getPage, destroy: mocks.destroy }) });
  const result = await scanContractFile(file());
  expect(result.scannedPages).toBe(4);
  expect(result.warnings.join(' ')).toContain('first 4 of 8 pages');
  expect(mocks.recognize).toHaveBeenCalledTimes(4);
  expect(mocks.terminate).toHaveBeenCalledOnce();
  expect(mocks.destroy).toHaveBeenCalledTimes(2);
});
it('terminates OCR and surfaces failures instead of fabricating extraction', async () => {
  mocks.content.mockResolvedValue({ items: [] });
  mocks.recognize.mockRejectedValue(new Error('OCR unavailable'));
  await expect(scanContractFile(file())).rejects.toThrow('OCR unavailable');
  expect(mocks.terminate).toHaveBeenCalledOnce();
});
