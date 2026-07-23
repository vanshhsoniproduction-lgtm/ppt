// Client-side PDF → JPEG slide conversion
// Results are uploaded to server via REST API, not stored in IndexedDB

export async function processPdfFile(file, username, progressCallback) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const slides = [];

  for (let i = 1; i <= totalPages; i++) {
    if (progressCallback) progressCallback(i, totalPages);

    const page = await pdf.getPage(i);
    const unscaled = page.getViewport({ scale: 1.0 });
    const scale = Math.min(2.0, 1920 / unscaled.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    const imageUrl = canvas.toDataURL('image/jpeg', 0.82);

    slides.push({
      id: i,
      type: 'image-slide',
      title: `Slide ${i}`,
      image: imageUrl,
      notes: '',
    });
  }

  return {
    id: `pdf-${Date.now()}`,
    title: file.name.replace(/\.[^/.]+$/, ''),
    username: (username || 'guest').toLowerCase(),
    slides,
  };
}

export function processImageFiles(files, username) {
  return new Promise((resolve) => {
    const slides = [];
    let processed = 0;

    Array.from(files).forEach((file, index) => {
      const img = new Image();
      img.onload = () => {
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
          title: file.name.replace(/\.[^/.]+$/, ''),
          image: imageUrl,
          notes: '',
        });
        processed++;

        if (processed === files.length) {
          slides.sort((a, b) => a.id - b.id);
          resolve({
            id: `img-${Date.now()}`,
            title: files[0].name.replace(/\.[^/.]+$/, '') + (files.length > 1 ? ` (+${files.length - 1})` : ''),
            username: (username || 'guest').toLowerCase(),
            slides,
          });
        }
      };
      img.src = URL.createObjectURL(file);
    });
  });
}
