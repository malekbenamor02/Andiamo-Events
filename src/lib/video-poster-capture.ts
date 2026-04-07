/**
 * Capture a single frame from a local video file for use as <video poster> (admin upload).
 */

const DEFAULT_TIME_SEC = 0.1;
const TIMEOUT_MS = 20_000;
const POSTER_JPEG_QUALITY = 0.88;
const MAX_POSTER_EDGE = 1280;

function pickSeekTimeSec(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return DEFAULT_TIME_SEC;
  return Math.min(DEFAULT_TIME_SEC, Math.max(0.04, duration * 0.05));
}

/**
 * Returns a JPEG blob scaled down to at most MAX_POSTER_EDGE on the long edge, or null on failure.
 */
export async function captureVideoPosterFromFile(file: File): Promise<Blob | null> {
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm)$/i.test(file.name)) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', 'true');
    video.preload = 'auto';
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('metadata timeout')), TIMEOUT_MS);
      const done = () => {
        window.clearTimeout(timer);
      };
      video.onerror = () => {
        done();
        reject(new Error('video load error'));
      };
      video.onloadedmetadata = () => {
        done();
        resolve();
      };
    });

    const seekTo = pickSeekTimeSec(video.duration);

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('seek timeout')), TIMEOUT_MS);
      video.onseeked = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('seek failed'));
      };
      try {
        video.currentTime = seekTo;
      } catch {
        window.clearTimeout(timer);
        reject(new Error('seek failed'));
      }
    });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const canvas = document.createElement('canvas');
    let cw = vw;
    let ch = vh;
    const long = Math.max(vw, vh);
    if (long > MAX_POSTER_EDGE) {
      const s = MAX_POSTER_EDGE / long;
      cw = Math.round(vw * s);
      ch = Math.round(vh * s);
    }
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, cw, ch);

    return await new Promise<Blob | null>((res) => {
      canvas.toBlob((b) => res(b), 'image/jpeg', POSTER_JPEG_QUALITY);
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
