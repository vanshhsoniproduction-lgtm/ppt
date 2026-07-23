import { saveDeckToDB } from './db';

export async function processPdfFile(file, username, progressCallback) {
  return new Promise(async (resolve, reject) => {
    try {
      const pdfjsLib = await import('pdfjs-dist/build/pdf');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      const totalPages = pdf.numPages;
      const slides = [];

      for (let i = 1; i <= totalPages; i++) {
        if (progressCallback) {
          progressCallback(i, totalPages);
        }

        const page = await pdf.getPage(i);
        // Calculate optimal scale for max 1920px width for fast socket transmission
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(2.0, 1920 / unscaledViewport.width);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Fill white background for PDF rendering
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        // Compress canvas to JPEG 0.82 quality (90% smaller size for instant socket sync)
        const imageUrl = canvas.toDataURL('image/jpeg', 0.82);

        slides.push({
          id: i,
          type: 'image-slide',
          title: `Slide ${i}`,
          category: 'PDF PRESENTATION',
          image: imageUrl,
          notes: `Speaker notes for slide ${i}. Click 'Edit Notes' on your dashboard to customize.`,
        });
      }

      const deck = {
        id: `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        username: (username || 'guest').toLowerCase(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        subtitle: `Uploaded PDF (${totalPages} Slides)`,
        author: username || 'User',
        uploadDate: new Date().toISOString(),
        slides: slides,
      };

      await saveDeckToDB(deck);
      resolve(deck);
    } catch (err) {
      console.error('PDF parsing error:', err);
      reject(err);
    }
  });
}

export function processImageFiles(files, username) {
  return new Promise((resolve) => {
    const slides = [];
    let processed = 0;

    Array.from(files).forEach((file, index) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1.0, 1920 / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageUrl = canvas.toDataURL('image/jpeg', 0.82);

        slides.push({
          id: index + 1,
          type: 'image-slide',
          title: file.name.replace(/\.[^/.]+$/, ""),
          category: 'IMAGE SLIDE',
          image: imageUrl,
          notes: `Speaker notes for slide ${index + 1}.`,
        });
        processed++;

        if (processed === files.length) {
          slides.sort((a, b) => a.id - b.id);
          const deck = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            username: (username || 'guest').toLowerCase(),
            title: files[0].name.replace(/\.[^/.]+$/, "") + (files.length > 1 ? ` (+${files.length - 1} slides)` : ''),
            subtitle: `Uploaded Images (${slides.length} Slides)`,
            author: username || 'User',
            uploadDate: new Date().toISOString(),
            slides: slides,
          };

          await saveDeckToDB(deck);
          resolve(deck);
        }
      };
      img.src = url;
    });
  });
}
