/**
 * Dynamically loads pdfmake from CDN
 * @return {Promise<void>}
 */
export async function loadPdfMake() {
  if (window.pdfMake) {
    console.log('[PDF] pdfMake already loaded');
    return;
  }
  
  console.log('[PDF] Loading pdfmake from CDN...');
  
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/pdfmake.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load pdfmake'));
    document.head.appendChild(script);
  });
  console.log('[PDF] pdfmake.min.js loaded');
  
  await new Promise((resolve, reject) => {
    const fonts = document.createElement('script');
    fonts.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12/vfs_fonts.js';
    fonts.onload = resolve;
    fonts.onerror = () => reject(new Error('Failed to load pdfmake fonts'));
    document.head.appendChild(fonts);
  });
  console.log('[PDF] vfs_fonts.js loaded');
}
