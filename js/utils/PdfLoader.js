/**
 * Dynamically loads pdfMake from CDN
 * @return {Promise<void>}
 */
export async function loadPdfMake() {
  if (window.pdfMake) return;
  
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfMake/0.2.7/pdfmake.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load pdfmake'));
    document.head.appendChild(script);
  });
  
  await new Promise((resolve, reject) => {
    const fonts = document.createElement('script');
    fonts.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfMake/0.2.7/vfs_fonts.js';
    fonts.onload = resolve;
    fonts.onerror = () => reject(new Error('Failed to load pdfmake fonts'));
    document.head.appendChild(fonts);
  });
}
