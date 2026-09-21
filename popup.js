document.getElementById('downloadCbz').addEventListener('click', () => startDownload('cbz'));
document.getElementById('downloadPdf').addEventListener('click', () => startDownload('pdf'));

function updateStatus(text) {
  document.getElementById('status').innerText = text;
}

async function startDownload(format) {
  updateStatus("Mengambil data halaman...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractBlobImages
  }, async (results) => {
    if (!results || !results[0] || !results[0].result || results[0].result.length === 0) {
      updateStatus("Gagal: Gambar tidak ditemukan / scroll halaman lebih dulu.");
      return;
    }

    const imageUrls = results[0].result;
    updateStatus(`Mendownload ${imageUrls.length} gambar...`);

    try {
      if (format === 'cbz') {
        await processCBZ(imageUrls);
      } else {
        await processPDF(imageUrls);
      }
      updateStatus("Selesai! File sedang diunduh.");
    } catch (err) {
      console.error(err);
      updateStatus("Terjadi kesalahan saat memproses file.");
    }
  });
}

// Skrip yang dijalankan di dalam tab MangaDex
function extractBlobImages() {
  const imgs = Array.from(document.querySelectorAll('img'));
  return imgs
    .map(img => img.src)
    .filter(src => src && (src.startsWith('blob:') || src.includes('mangadex')));
}

// Fungsi konversi ke CBZ (ZIP)
async function processCBZ(urls) {
  const zip = new JSZip();
  const folder = zip.folder("manga_chapter");

  for (let i = 0; i < urls.length; i++) {
    updateStatus(`Memproses gambar ${i + 1}/${urls.length}...`);
    const response = await fetch(urls[i]);
    const blob = await response.blob();
    const filename = `page_${String(i + 1).padStart(3, '0')}.png`;
    folder.file(filename, blob);
  }

  updateStatus("Mengompres menjadi CBZ...");
  const content = await zip.generateAsync({ type: "blob" });
  downloadBlob(content, "MangaDex_Chapter.cbz");
}

// Fungsi konversi ke PDF
async function processPDF(urls) {
  const { jsPDF } = window.jspdf;
  let pdf = null;

  for (let i = 0; i < urls.length; i++) {
    updateStatus(`Memproses halaman ${i + 1}/${urls.length}...`);
    const response = await fetch(urls[i]);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const img = new Image();
    img.src = base64;
    await new Promise(resolve => img.onload = resolve);

    // Sesuaikan ukuran halaman PDF dengan aspek rasio gambar
    if (i === 0) {
      pdf = new jsPDF({
        orientation: img.width > img.height ? 'l' : 'p',
        unit: 'px',
        format: [img.width, img.height]
      });
    } else {
      pdf.addPage([img.width, img.height], img.width > img.height ? 'l' : 'p');
    }

    pdf.addImage(base64, 'PNG', 0, 0, img.width, img.height);
  }

  updateStatus("Menyimpan PDF...");
  pdf.save("MangaDex_Chapter.pdf");
}

function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
