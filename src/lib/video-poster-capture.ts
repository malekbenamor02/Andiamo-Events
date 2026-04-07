/**
 * Capture a single frame from a local video file for use as <video poster> (admin upload).
 */

const DEFAULT_TIME_SEC = 0.1;
const METADATA_TIMEOUT_MS = 12_000;
const SEEK_TIMEOUT_MS = 4_000;
const POSTER_JPEG_QUALITY = 0.88;
const MAX_POSTER_EDGE = 1280;

function pickSeekTimeSec(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return DEFAULT_TIME_SEC;
  if (duration < DEFAULT_TIME_SEC) return Math.max(0, duration / 2);
  return Math.min(DEFAULT_TIME_SEC, Math.max(0.04, duration * 0.05));
}

function waitForVideoDimensions(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('metadata timeout'));
    }, timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('loadedmetadata', onReady);
      video.removeEventListener('error', onErr);
    };

    const onReady = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };

    const onErr = () => {
      cleanup();
      reject(new Error('video load error'));
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('loadedmetadata', onReady);
    video.addEventListener('error', onErr);

    try {
      video.load();
    } catch {
      cleanup();
      reject(new Error('video load error'));
    }

    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      cleanup();
      resolve();
    }
  });
}

function seekVideoTo(video: HTMLVideoElement, seekTo: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(seekTo) || seekTo < 0) {
      reject(new Error('invalid seek'));
      return;
    }

    // If we're already at the target, `seeked` often never fires.
    if (Math.abs(video.currentTime - seekTo) < 0.03) {
      resolve();
      return;
    }

    const onSeeked = () => {
      window.clearTimeout(timer);
      video.removeEventListener('error', onErr);
      resolve();
    };

    const onErr = () => {
      window.clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      reject(new Error('seek failed'));
    };

    const timer = window.setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
      resolve();
    }, SEEK_TIMEOUT_MS);

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onErr, { once: true });

    try {
      video.currentTime = seekTo;
    } catch {
      window.clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onErr);
      reject(new Error('seek failed'));
    }
  });
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

    await waitForVideoDimensions(video, METADATA_TIMEOUT_MS);

    const duration = video.duration;
    const seekTo = pickSeekTimeSec(duration);

    try {
      await seekVideoTo(video, seekTo);
    } catch {
      try {
        await seekVideoTo(video, 0);
      } catch {
        /* draw at current frame */
      }
    }

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
