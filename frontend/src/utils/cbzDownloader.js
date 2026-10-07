import JSZip from 'jszip';
import { saveOfflineChapter } from './offlineStorage';
import { proxyImage, API_BASE } from './api';

/**
 * Safely fetches an image blob by routing through the image proxy
 * to prevent browser CORS blocks on third-party manga CDNs.
 */
async function fetchImageBlob(url) {
  if (!url) throw new Error('Missing image URL');
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const res = await fetch(url);
    return await res.blob();
  }

  // Use proxyImage if available, fallback to backend proxy-image
  const proxied = proxyImage(url);
  const target = (proxied && proxied !== url)
    ? proxied
    : `${API_BASE}/api/proxy-image?url=${encodeURIComponent(url)}`;

  try {
    const res = await fetch(target);
    if (res.ok) return await res.blob();
  } catch (err) {
    // If proxied fetch failed, attempt direct fetch as fallback
    try {
      const direct = await fetch(url, { mode: 'cors' });
      if (direct.ok) return await direct.blob();
    } catch {}
    throw err;
  }
  throw new Error(`Failed to load image from proxy (${target})`);
}

/**
 * Downloads chapter images and packages them into a .cbz (Comic Book Zip)
 * directly in the user's browser with $0 server cost, and saves to IndexedDB
 * so it can be viewed directly on the site (like Mihon).
 *
 * @param {string[]} images - Array of image URLs
 * @param {string} mangaTitle - Title of the manga
 * @param {string|number} chapterNum - Chapter number
 * @param {(percent: number, statusText: string) => void} onProgress - Progress callback
 * @param {object} options - Optional manga metadata (mangaId, chapterTitle, cover)
 */
export async function downloadChapterAsCbz(images, mangaTitle, chapterNum, onProgress, options = {}) {
  if (!images || images.length === 0) {
    throw new Error('No images available to download');
  }

  const zip = new JSZip();
  const total = images.length;
  let loadedCount = 0;
  const downloadedBlobs = new Array(total);

  onProgress?.(5, `Starting download of ${total} pages...`);

  // Download images concurrently in small batches to preserve memory
  const BATCH_SIZE = 4;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = images.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (url, batchIdx) => {
        const index = i + batchIdx;
        try {
          const blob = await fetchImageBlob(url);
          downloadedBlobs[index] = blob;

          let ext = 'jpg';
          if (blob.type.includes('webp')) ext = 'webp';
          else if (blob.type.includes('png')) ext = 'png';
          else if (url.includes('.webp')) ext = 'webp';
          else if (url.includes('.png')) ext = 'png';

          const filename = String(index + 1).padStart(3, '0') + '.' + ext;
          zip.file(filename, blob);
        } catch (err) {
          console.warn(`Failed to fetch page ${index + 1}:`, err);
        } finally {
          loadedCount++;
          const progress = Math.min(80, Math.round((loadedCount / total) * 80));
          onProgress?.(progress, `Packaged page ${loadedCount} of ${total}...`);
        }
      })
    );
  }

  onProgress?.(85, 'Creating .cbz comic archive...');

  const content = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'STORE', // STORE is fast and standard for CBZ since images are already compressed
    },
    (metadata) => {
      const p = 85 + Math.round((metadata.percent / 100) * 14);
      onProgress?.(p, 'Building CBZ package...');
    }
  );

  onProgress?.(100, 'Download ready!');

  const cleanTitle = (mangaTitle || 'Manga').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
  const filename = `${cleanTitle}-Ch-${chapterNum}.cbz`;

  // Trigger browser download
  const blobUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Also save to IndexedDB for offline on-site reading (like Mihon)
  if (options.mangaId) {
    // Convert successfully downloaded blobs to Data URLs for seamless offline rendering
    Promise.all(
      downloadedBlobs.map((blob, idx) => {
        if (!blob) return Promise.resolve(images[idx] || '');
        return new Promise((res) => {
          const reader = new FileReader();
          reader.onloadend = () => res(reader.result);
          reader.onerror = () => res(images[idx] || '');
          reader.readAsDataURL(blob);
        });
      })
    ).then((dataUrls) => {
      saveOfflineChapter({
        mangaId: options.mangaId,
        mangaTitle,
        chapterNum,
        chapterTitle: options.chapterTitle || `Chapter ${chapterNum}`,
        images: dataUrls.filter(Boolean),
        cover: options.cover,
      }).catch((err) => {
        console.warn('Could not save to offline IndexedDB:', err);
      });
    });
  }

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    a.remove();
  }, 3000);
}
