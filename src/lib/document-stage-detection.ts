import { ALL_STAGES } from './types';
import { fileToDataUrl } from './candidate-images';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const STAGE_KEYWORDS: Record<string, RegExp> = {
  registration: /\b(passport|national.?id|identity|registration|birth.?certificate|personal.?record|application.?form)\b/i,
  training: /\b(training|coc|certificate.?of.?competency|competency|vocational|course|assessment|transcript)\b/i,
  medical: /\b(medical|health|fit.?to.?work|lab.?result|x.?ray|vaccin|pregnan|clinical|blood.?test)\b/i,
  deployment: /\b(deployment|visa|work.?contract|contract|flight|ticket|clearance|ministry.?qr|qr.?code|travel)\b/i,
};

export const detectDocumentStageFromText = (text: string): number | undefined => {
  const normalizedText = text.replace(/[_-]+/g, ' ');
  const matchingSlugs = Object.entries(STAGE_KEYWORDS)
    .filter(([, keywords]) => keywords.test(normalizedText))
    .map(([slug]) => slug);

  if (matchingSlugs.length !== 1) return undefined;
  return ALL_STAGES.find(stage => stage.slug === matchingSlugs[0])?.id;
};

export const detectDocumentStage = (fileName: string): number | undefined => detectDocumentStageFromText(fileName);

const renderPdfPages = async (file: File): Promise<string[]> => {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const images: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 2); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const initialViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1.5, 1400 / Math.max(initialViewport.width, initialViewport.height));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is not available to read this PDF.');
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.8));
      page.cleanup();
    }
  } finally {
    await pdf.destroy();
  }
  return images;
};

export interface DocumentStageDetection {
  stageId?: number;
  source?: 'file name' | 'document text';
}

export const detectDocumentStageFromFile = async (file: File): Promise<DocumentStageDetection> => {
  const fromName = detectDocumentStage(file.name);
  if (fromName !== undefined) return { stageId: fromName, source: 'file name' };

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const pages = isPdf ? await renderPdfPages(file) : [await fileToDataUrl(file, 1400, 0.8)];
  if (!pages.length) return {};

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1);
  try {
    let detectedStageId: number | undefined;
    for (const page of pages) {
      const { data } = await worker.recognize(page);
      const pageStageId = detectDocumentStageFromText(data.text);
      if (pageStageId === undefined) continue;
      if (detectedStageId !== undefined && detectedStageId !== pageStageId) return {};
      detectedStageId = pageStageId;
    }
    return detectedStageId === undefined ? {} : { stageId: detectedStageId, source: 'document text' };
  } finally {
    await worker.terminate();
  }
};
