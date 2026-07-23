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
        const viewport = page.getViewport({ scale: 2.0 }); // High clarity 2x scale

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        const imageUrl = canvas.toDataURL('image/png');

        slides.push({
          id: i,
          type: 'image-slide',
          title: `Slide ${i}`,
          category: 'PDF PRESENTATION',
          image: imageUrl,
          notes: `Speaker notes for slide ${i}. Click 'Edit Notes' to add your custom points.`,
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
      const reader = new FileReader();
      reader.onload = async (e) => {
        slides.push({
          id: index + 1,
          type: 'image-slide',
          title: file.name.replace(/\.[^/.]+$/, ""),
          category: 'IMAGE SLIDE',
          image: e.target.result,
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
      reader.readAsDataURL(file);
    });
  });
}
