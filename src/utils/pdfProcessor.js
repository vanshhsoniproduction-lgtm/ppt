// PDF & Image Processor for converting uploaded PDF presentation decks to high-res slide images

export async function processPdfFile(file, progressCallback) {
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
        const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for high resolution projection

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
          notes: `Uploaded PDF Page ${i} of ${totalPages}`,
        });
      }

      const deck = {
        id: `pdf-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        subtitle: `Uploaded PDF (${totalPages} Slides)`,
        author: 'User Upload',
        slides: slides,
      };

      resolve(deck);
    } catch (err) {
      console.error('PDF parsing error:', err);
      reject(err);
    }
  });
}

export function processImageFiles(files) {
  return new Promise((resolve) => {
    const slides = [];
    let processed = 0;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        slides.push({
          id: index + 1,
          type: 'image-slide',
          title: file.name.replace(/\.[^/.]+$/, ""),
          category: 'IMAGE SLIDE',
          image: e.target.result,
          notes: `Uploaded Slide ${index + 1}`,
        });
        processed++;

        if (processed === files.length) {
          // Sort slides by index
          slides.sort((a, b) => a.id - b.id);
          const deck = {
            id: `img-${Date.now()}`,
            title: files[0].name.replace(/\.[^/.]+$/, "") + (files.length > 1 ? ` (+${files.length - 1} slides)` : ''),
            subtitle: `Uploaded Images (${slides.length} Slides)`,
            author: 'User Upload',
            slides: slides,
          };
          resolve(deck);
        }
      };
      reader.readAsDataURL(file);
    });
  });
}
