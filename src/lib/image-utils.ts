/**
 * Image URLs for Events / Home:
 * - R2 + CDN (VITE_PUBLIC_ASSETS_BASE_URL): use stored `_thumb.webp` for small widths.
 * - Legacy Supabase: optional Image Transform when VITE_SUPABASE_IMAGE_TRANSFORM is enabled.
 */

const SUPABASE_OBJECT_PREFIX = '/storage/v1/object/public/';
const SUPABASE_RENDER_PREFIX = '/storage/v1/render/image/public/';

function assetsBase(): string {
  return (import.meta.env.VITE_PUBLIC_ASSETS_BASE_URL || '').replace(/\/$/, '');
}

export function isR2CdnImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const b = assetsBase();
  if (b && url.startsWith(b)) return true;
  try {
    if (!b) return false;
    const host = new URL(b).hostname;
    return url.includes(host);
  } catch {
    return false;
  }
}

/** Full `.webp` → `_thumb.webp` (same directory). */
export function thumbUrlFromFullUrl(fullUrl: string): string | undefined {
  if (!fullUrl || !isR2CdnImageUrl(fullUrl)) return undefined;
  if (!fullUrl.endsWith('.webp')) return undefined;
  return `${fullUrl.slice(0, -5)}_thumb.webp`;
}

/** Same basename, `.avif` instead of `.webp`. */
export function avifVariantUrl(webpUrl: string): string | undefined {
  if (!webpUrl || !webpUrl.endsWith('.webp')) return undefined;
  if (!isR2CdnImageUrl(webpUrl)) return undefined;
  return `${webpUrl.slice(0, -5)}.avif`;
}

const THUMB_MAX_WIDTH = 480;

function isSupabaseStorageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('supabase.co') && url.includes(SUPABASE_OBJECT_PREFIX);
}

function supabaseRenderUrl(
  url: string,
  options: { width: number; height?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' }
): string {
  const renderPath = url.replace(SUPABASE_OBJECT_PREFIX, SUPABASE_RENDER_PREFIX);
  const parsed = new URL(renderPath);
  parsed.searchParams.set('width', String(options.width));
  if (options.height != null) parsed.searchParams.set('height', String(options.height));
  if (options.quality != null) {
    parsed.searchParams.set('quality', String(Math.min(100, Math.max(20, options.quality))));
  }
  if (options.resize) parsed.searchParams.set('resize', options.resize);
  return parsed.toString();
}

/**
 * Prefer thumbnail on R2 for small display widths; optional Supabase transform for legacy URLs.
 */
export function getOptimizedImageUrl(
  url: string,
  options: {
    width: number;
    height?: number;
    quality?: number;
    resize?: 'cover' | 'contain' | 'fill';
  }
): string {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/api/placeholder')) return url;

  if (isR2CdnImageUrl(url)) {
    const thumb = thumbUrlFromFullUrl(url);
    if (thumb && options.width <= THUMB_MAX_WIDTH) return thumb;
    return url;
  }

  const useTransform =
    import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === 'true' ||
    import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === '1';

  if (!useTransform || !isSupabaseStorageUrl(url)) {
    return url;
  }

  try {
    return supabaseRenderUrl(url, options);
  } catch {
    return url;
  }
}

/** CMS hero slide image fields (optional R2 derivatives). */
export type HeroSlideImageFields = {
  src: string;
  thumbUrl?: string;
  midUrl?: string;
};

/**
 * Responsive srcset for hero background images using stored thumb/mid/full URLs.
 * Falls back to a single full `imgSrc` when derivatives are missing (legacy slides).
 */
export function buildHeroImageSrcSet(slide: HeroSlideImageFields): {
  srcSet: string | undefined;
  imgSrc: string;
  sizes: string;
} {
  const imgSrc = getOptimizedImageUrl(slide.src, {
    width: 1920,
    height: 1080,
    quality: 85,
    resize: 'cover',
  });
  const thumb = slide.thumbUrl;
  const mid = slide.midUrl;
  if (thumb && mid) {
    return {
      srcSet: `${thumb} 400w, ${mid} 1280w, ${imgSrc} 1920w`,
      imgSrc,
      sizes: '100vw',
    };
  }
  if (thumb) {
    return {
      srcSet: `${thumb} 400w, ${imgSrc} 1920w`,
      imgSrc,
      sizes: '100vw',
    };
  }
  return { srcSet: undefined, imgSrc, sizes: '100vw' };
}

export function getOptimizedImageSrcSet(
  url: string,
  widths: number[],
  options: { height?: number; quality?: number; resize?: 'cover' | 'contain' | 'fill' }
): string | undefined {
  if (!url) return undefined;

  if (isR2CdnImageUrl(url)) {
    const thumb = thumbUrlFromFullUrl(url);
    if (!thumb || !url.endsWith('.webp')) return undefined;
    return widths
      .map((w) => {
        const u = w <= THUMB_MAX_WIDTH ? thumb : url;
        return `${u} ${w}w`;
      })
      .join(', ');
  }

  const useTransform =
    import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === 'true' ||
    import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === '1';
  if (!useTransform || !isSupabaseStorageUrl(url)) return undefined;

  return widths
    .map((w) => {
      const u = supabaseRenderUrl(url, {
        width: w,
        height: options.height,
        quality: options.quality,
        resize: options.resize,
      });
      return `${u} ${w}w`;
    })
    .join(', ');
}
