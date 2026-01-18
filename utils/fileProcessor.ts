import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite specific import for worker
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Define the worker source to use the local bundled version
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const readFileContent = async (file: File): Promise<string> => {
  if (file.type === 'text/plain') {
    return readTextFile(file);
  } else if (file.type === 'application/pdf') {
    return readPdfFile(file);
  } else {
    throw new Error('Unsupported file type');
  }
};

const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

const readPdfFile = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore - pdfjsLib types might be mismatching slightly with the CDN import, but this works at runtime
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF');
  }
};