import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * LARGE BLUEPRINT PDF RENDERING SERVICE
 * 
 * This service handles on-demand rendering of PDF pages to high-resolution images.
 * It uses dynamic imports to prevent 'DOMMatrix is not defined' errors during 
 * Next.js Server-Side Rendering (SSR).
 */

async function getPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF.js rendering is only available in the browser.');
  }
  
  // Use the legacy build if needed for better compatibility, 
  // but standard build should work with dynamic import.
  const pdfjs = await import('pdfjs-dist');
  
  // Configure the worker
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }
  
  return pdfjs;
}

/**
 * Loads a PDF document from a Blob.
 */
export async function loadPDFDocument(blob: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfJs();
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
  // Ensure we are in the browser
  if (typeof window === 'undefined') {
    throw new Error('PDF rendering is only available in the browser.');
  }

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
