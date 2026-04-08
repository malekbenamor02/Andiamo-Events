import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type ImageVariant = {
  file: File;
  edge: number;
};

const IMAGE_QUALITY = 0.82;
const IMAGE_FULL_EDGE = 1920;
const IMAGE_MID_EDGE = 1280;
const IMAGE_THUMB_EDGE = 400;

const FFMPEG_CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
const VIDEO_MAX_EDGE = 1920;
const VIDEO_CRF = '28';
const VIDEO_PRESET = 'veryfast';

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

function fileBaseName(file: File): string {
  return file.name.replace(/\.[^/.]+$/, '') || `media-${Date.now()}`;
}

export async function optimizeImageToWebp(
  file: File,
  options?: { maxEdge?: number; quality?: number; suffix?: string }
): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported image format');
  }
  const img = await createImageFromFile(file);
  const baseName = fileBaseName(file);
  const maxEdge = options?.maxEdge ?? IMAGE_FULL_EDGE;
  const quality = options?.quality ?? IMAGE_QUALITY;
  const suffix = options?.suffix ?? '';

  const d = resizeWithinEdge(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = d.width;
  canvas.height = d.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');
  ctx.drawImage(img, 0, 0, d.width, d.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', quality);
  });
  if (!blob) throw new Error('Failed to encode WebP');

  return new File([blob], `${baseName}${suffix}.webp`, { type: 'image/webp' });
}

function createImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image'));
    };
    img.src = objectUrl;
  });
}

function resizeWithinEdge(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= maxEdge) return { width, height };
  const scale = maxEdge / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function encodeImageVariant(
  img: HTMLImageElement,
  baseName: string,
  maxEdge: number,
  suffix: string
): Promise<ImageVariant> {
  const d = resizeWithinEdge(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = d.width;
  canvas.height = d.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');
  ctx.drawImage(img, 0, 0, d.width, d.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', IMAGE_QUALITY);
  });
  if (!blob) throw new Error('Failed to encode WebP');

  return {
    file: new File([blob], `${baseName}${suffix}.webp`, { type: 'image/webp' }),
    edge: maxEdge,
  };
}

export async function preprocessHeroImageVariants(file: File): Promise<{
  full: File;
  mid: File;
  thumb: File;
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported image format');
  }
  const img = await createImageFromFile(file);
  const baseName = fileBaseName(file);

  const [full, mid, thumb] = await Promise.all([
    encodeImageVariant(img, baseName, IMAGE_FULL_EDGE, ''),
    encodeImageVariant(img, baseName, IMAGE_MID_EDGE, '_mid'),
    encodeImageVariant(img, baseName, IMAGE_THUMB_EDGE, '_thumb'),
  ]);

  return {
    full: full.file,
    mid: mid.file,
    thumb: thumb.file,
  };
}

async function getFfmpeg(): Promise<FFmpeg> {
  if (ffmpegSingleton) return ffmpegSingleton;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg();
    const coreURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm');
    await ffmpeg.load({ coreURL, wasmURL });
    ffmpegSingleton = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoading;
  } finally {
    ffmpegLoading = null;
  }
}

export async function transcodeHeroVideoToMp4(file: File): Promise<File> {
  if (!file.type.startsWith('video/')) {
    throw new Error('Unsupported video format');
  }

  const ffmpeg = await getFfmpeg();
  const inputExt = file.name.split('.').pop() || 'bin';
  const inputName = `input.${inputExt}`;
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec([
    '-i',
    inputName,
    '-vf',
    `scale='min(${VIDEO_MAX_EDGE},iw)':-2`,
    '-c:v',
    'libx264',
    '-preset',
    VIDEO_PRESET,
    '-crf',
    VIDEO_CRF,
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-c:a',
    'aac',
    '-b:a',
    '96k',
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  const u8 = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  const outBlob = new Blob([u8], { type: 'video/mp4' });
  const baseName = fileBaseName(file);
  return new File([outBlob], `${baseName}.mp4`, { type: 'video/mp4' });
}
