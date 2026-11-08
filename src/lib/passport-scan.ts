import { fileToDataUrl } from './candidate-images';
import { parsePassportMrz, type PassportData } from './passport-mrz';
import { scanDocumentFile } from './document-screening';
import type { UploadScanReport } from './types';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

export interface PassportScan {
  data: PassportData;
  imageUrl: string;
  screeningReport: UploadScanReport;
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be decoded.'));
    img.src = src;
  });

// The machine readable zone sits at the bottom of the data page, so a tight crop reads much more reliably.
const cropBottom = async (src: string, fraction: number): Promise<string> => {
  const img = await loadImage(src);
  const height = Math.round(img.height * fraction);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(img, 0, img.height - height, img.width, height, 0, 0, img.width, height);
  return canvas.toDataURL('image/png');
};

export const MAX_PASSPORT_SCAN_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES_TO_SCAN = 5;

export const validatePassportScanFile = (file: File): void => {
  if (file.size > MAX_PASSPORT_SCAN_BYTES) {
    throw new Error('Passport files must be 15 MB or smaller.');
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf && !file.type.startsWith('image/')) {
    throw new Error('Choose a passport image or PDF file.');
  }
};

const pdfPagesAsImages = async (file: File): Promise<{ imageUrl: string; data: PassportData | null }[]> => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES_TO_SCAN);
  const images: { imageUrl: string; data: PassportData | null }[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = Math.round(item.transform[5]);
        rows.set(y, [...(rows.get(y) ?? []), { x: item.transform[4], text: item.str }]);
      }
      const text = [...rows.entries()].sort(([a], [b]) => b - a)
        .map(([, row]) => row.sort((a, b) => a.x - b.x).map(item => item.text).join('')).join('\n');
      const parsed = parsePassportMrz(text);
      const initialViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1800 / Math.max(initialViewport.width, initialViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is not available to render the PDF.');
      await page.render({ canvasContext: context, viewport }).promise;
      images.push({ imageUrl: canvas.toDataURL('image/jpeg', 0.9), data: parsed });
      page.cleanup();
      if (parsed) break;
    }
  } finally {
    await pdf.destroy();
  }

  if (!images.length) throw new Error('The PDF does not contain any pages.');
  return images;
};

export const scanPassport = async (file: File, onProgress?: (percent: number) => void): Promise<PassportScan> => {
  validatePassportScanFile(file);
  const screeningReport = await scanDocumentFile(file);
  if (screeningReport.status === 'blocked') throw new Error(screeningReport.findings.join(' '));
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const pages = isPdf ? await pdfPagesAsImages(file) : [{ imageUrl: await fileToDataUrl(file, 1800, 0.85), data: null }];
  const nativeMrz = pages.find(page => page.data);
  if (nativeMrz?.data) {
    onProgress?.(100);
    return { data: nativeMrz.data, imageUrl: nativeMrz.imageUrl, screeningReport };
  }
  const pageImages = pages.map(page => page.imageUrl);
  const { createWorker } = await import('tesseract.js');
  let currentProgress = 0;
  const worker = await createWorker('eng', 1, {
    workerPath: tesseractWorkerUrl,
    workerBlobURL: false,
    logger: message => {
      if (message.status === 'recognizing text') onProgress?.(currentProgress + Math.round(message.progress * 100 / (pageImages.length * 3)));
    },
  });
  try {
    await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<' });
    for (const [pageIndex, imageUrl] of pageImages.entries()) {
      for (const [cropIndex, fraction] of [0.45, 0.3, 1].entries()) {
        currentProgress = Math.round(((pageIndex * 3 + cropIndex) * 100) / (pageImages.length * 3));
        const { data } = await worker.recognize(await cropBottom(imageUrl, fraction));
        const parsed = parsePassportMrz(data.text);
        if (parsed) return { data: parsed, imageUrl, screeningReport };
      }
    }
  } finally {
    await worker.terminate();
  }
  throw new Error(isPdf
    ? `No machine readable zone was found in the first ${pageImages.length} PDF page${pageImages.length === 1 ? '' : 's'}. Include a clear passport bio page with the two lines of < characters at the bottom.`
    : 'No machine readable zone was found. Use a sharp, well-lit photo of the passport photo page, including the two lines of < characters at the bottom.');
};
