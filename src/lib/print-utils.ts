import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Enterprise Print Engine
 * Renders a React component into an isolated, hidden Iframe for perfect printing.
 */
export const printIsolatedComponent = async (
  Component: React.ReactElement,
  options: {
    title?: string;
    onComplete?: () => void;
  } = {}
) => {
  // 1. Create a hidden Iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'isolated-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '100%';
  iframe.style.bottom = '100%';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.visibility = 'hidden';
  
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    console.error("Could not initialize print iframe document.");
    return;
  }

  // 2. Set up the document structure
  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${options.title || 'Print Record'}</title>
      </head>
      <body>
        <div id="print-mount-point"></div>
      </body>
    </html>
  `);
  iframeDoc.close();

  // 3. Inject global styles from the main document with high priority
  const mainStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
  mainStyles.forEach(style => {
    const clone = style.cloneNode(true);
    iframeDoc.head.appendChild(clone);
  });

  // 4. Add a dedicated print style to ensure no backgrounds are lost and margins are handled
  const printStyle = iframeDoc.createElement('style');
  printStyle.textContent = `
    body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { margin: 10mm; }
    #print-mount-point { width: 100%; display: flex; justify-content: center; }
  `;
  iframeDoc.head.appendChild(printStyle);

  // Force styles to resolve before mounting
  await new Promise(resolve => setTimeout(resolve, 200));

  // 5. Mount the React component into the iframe
  const mountPoint = iframeDoc.getElementById('print-mount-point');
  if (mountPoint) {
    const root = createRoot(mountPoint);
    root.render(Component);

    // 6. WAIT for Assets: This is the critical fix for "white pages"
    // We wait for all images and stylesheets to fully load before printing
    const waitForAssets = async () => {
      const images = Array.from(iframeDoc.images);
      const imagePromises = images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(r => {
          img.onload = r;
          img.onerror = r;
        });
      });

      // Wait for fonts to be ready
      const fontsPromise = (iframe.contentWindow as any)?.document?.fonts?.ready || Promise.resolve();
      
      await Promise.all([...imagePromises, fontsPromise]);
      // Extra buffer for React to finish paint
      await new Promise(r => setTimeout(r, 500));
    };

    await waitForAssets();

    try {
      // Ensure the iframe is active
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Print execution failed:", err);
    } finally {
      // 7. Cleanup after a delay to ensure print dialog doesn't close prematurely
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        if (options.onComplete) options.onComplete();
      }, 2000);
    }
  }
};
