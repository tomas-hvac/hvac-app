import * as pdfjs from 'pdfjs-dist';

// Configure the worker
// In version 6+, the worker can be imported directly or set via CDN
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export type PDFDocumentProxy = pdfjs.PDFDocumentProxy;

/**
 * Loads a PDF document from a Blob.
 */
export async function loadPDFDocument(blob: Blob): Promise<PDFDocumentProxy> {
  const arrayBuffer = await blob.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
}

/**
 * Renders a specific page of a PDF to a Data URL (base64 PNG).
 * This allows the PDF page to be treated as a standard image by the existing UI.
 */
export async function renderPDFPageToDataURL(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  scale: number = 2.0 // High resolution for blueprint quality
): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('Failed to create canvas context');
  }
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    canvas: canvas,
  };
  
  await page.render(renderContext).promise;
  
  return canvas.toDataURL('image/png');
}
