// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { scanPassport } from '../passport-scan';
import { createSyntheticPassportPdf } from './fixtures/passport-pdf';

const mocks = vi.hoisted(() => ({
  content: vi.fn(), render: vi.fn(), cleanup: vi.fn(), destroy: vi.fn(), getPage: vi.fn(), getDocument: vi.fn(),
  createWorker: vi.fn(), recognize: vi.fn(), setParameters: vi.fn(), terminate: vi.fn(),
}));
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: mocks.getDocument }));
vi.mock('tesseract.js', () => ({ createWorker: mocks.createWorker }));
vi.mock('../document-screening', () => ({
  scanDocumentFile: vi.fn(async () => ({ status: 'clear', findings: [], scanned_at: '2026-11-07', fingerprint: 'synthetic' })),
}));
const mrz = 'P<USAERIKSSON<<ANNA<MARIA'.padEnd(44, '<') + '\nL898902C36USA7408122F1204159ZE184226B<<<<<10';
const file = () => {
  const contents = createSyntheticPassportPdf();
  const file = new File([contents], 'synthetic-passport.pdf', { type: 'application/pdf' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new TextEncoder().encode(contents).buffer });
  return file;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.content.mockResolvedValue({ items: [
    { str: mrz.split('\n')[1], transform: [1, 0, 0, 1, 0, 50] },
    { str: mrz.split('\n')[0], transform: [1, 0, 0, 1, 0, 100] },
  ] });
  mocks.render.mockReturnValue({ promise: Promise.resolve() });
  mocks.destroy.mockResolvedValue(undefined);
  mocks.getPage.mockResolvedValue({
    getTextContent: mocks.content,
    getViewport: () => ({ width: 1200, height: 500 }),
    render: mocks.render, cleanup: mocks.cleanup,
  });
  mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: mocks.getPage, destroy: mocks.destroy }) });
  mocks.recognize.mockResolvedValue({ data: { text: mrz } });
  mocks.createWorker.mockResolvedValue({ setParameters: mocks.setParameters, recognize: mocks.recognize, terminate: mocks.terminate });
  const context: Partial<CanvasRenderingContext2D> = { drawImage: vi.fn(), filter: '' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,synthetic');
  vi.stubGlobal('Image', class {
    width = 1800; height = 900; onload?: () => void;
    set src(_value: string) { queueMicrotask(() => this.onload?.()); }
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('PDF MRZ pipeline', () => {
  it('reads embedded text in visual order, renders a preview, and avoids OCR spelling errors', async () => {
    const progress = vi.fn();
    const result = await scanPassport(file(), progress);
    expect(result.data).toMatchObject({
      first_name: 'ANNA MARIA', last_name: 'ERIKSSON', dob: '1974-08-12',
      passport_number: 'L898902C3', gender: 'female', country_of_origin: 'United States',
      passport_issuing_country: 'United States', passport_expiry_date: '2012-04-15', passport_document_type: 'P',
    });
    expect(result.imageUrl).toContain('data:image/');
    expect(mocks.createWorker).not.toHaveBeenCalled();
    expect(mocks.render).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenCalledWith(100);
  });
  it('uses the OCR worker when the PDF only contains scanned images', async () => {
    mocks.content.mockResolvedValue({ items: [] });
    const result = await scanPassport(file());
    expect(result.data.first_name).toBe('ANNA MARIA');
    expect(mocks.createWorker).toHaveBeenCalledOnce();
    expect(mocks.recognize).toHaveBeenCalled();
    expect(mocks.terminate).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
  it('limits image-only scanning to five pages and reports unreadable MRZ explicitly', async () => {
    mocks.content.mockResolvedValue({ items: [] });
    mocks.recognize.mockResolvedValue({ data: { text: '' } });
    mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 8, getPage: mocks.getPage, destroy: mocks.destroy }) });
    await expect(scanPassport(file())).rejects.toThrow('first 5 PDF pages');
    expect(mocks.getPage).toHaveBeenCalledTimes(5);
    expect(mocks.recognize).toHaveBeenCalledTimes(15);
    expect(mocks.terminate).toHaveBeenCalledOnce();
  });
  it('cleans up the PDF when rendering fails instead of returning success', async () => {
    mocks.render.mockImplementation(() => ({ promise: Promise.reject(new Error('Unreadable PDF page')) }));
    await expect(scanPassport(file())).rejects.toThrow('Unreadable PDF page');
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});
