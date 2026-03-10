/**
 * Image optimization for Events and Home pages.
 * Uses the same approach as large platforms: serve resized/optimized images instead of full originals.
 *
 * 1. Supabase Pro: use Storage Image Transform (render URL with width/height/quality).
 *    Set VITE_SUPABASE_IMAGE_TRANSFORM=true in .env when on Pro plan.
 * 2. Otherwise: origin URL is returned (no change). You can add Cloudinary/imgix later.
 */

const SUPABASE_OBJECT_PREFIX = "/storage/v1/object/public/";
const SUPABASE_RENDER_PREFIX = "/storage/v1/render/image/public/";

function isSupabaseStorageUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  return url.includes("supabase.co") && url.includes(SUPABASE_OBJECT_PREFIX);
}

/**
 * Convert Supabase public URL to the render (transform) URL with size and quality.
 * Pro plan only. Falls back to original URL if not Supabase or transform disabled.
 */
export function getOptimizedImageUrl(
  url: string,
  options: { width: number; height?: number; quality?: number; resize?: "cover" | "contain" | "fill" }
): string {
  if (!url || typeof url !== "string") return url;

  const useTransform =
    import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === "true" || import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === "1";

  if (!useTransform || !isSupabaseStorageUrl(url)) {
    return url;
  }

  try {
    const renderPath = url.replace(SUPABASE_OBJECT_PREFIX, SUPABASE_RENDER_PREFIX);
    const parsed = new URL(renderPath);
    parsed.searchParams.set("width", String(options.width));
    if (options.height != null) parsed.searchParams.set("height", String(options.height));
    if (options.quality != null) parsed.searchParams.set("quality", String(Math.min(100, Math.max(20, options.quality))));
    if (options.resize) parsed.searchParams.set("resize", options.resize);
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Build srcset for responsive images (e.g. 400w, 800w) so mobile gets smaller files.
 * Returns a string for the srcset attribute, or undefined to skip.
 */
export function getOptimizedImageSrcSet(
  url: string,
  widths: number[],
  options: { height?: number; quality?: number; resize?: "cover" | "contain" | "fill" }
): string | undefined {
  if (!url || !isSupabaseStorageUrl(url)) return undefined;
  const useTransform =
    import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === "true" || import.meta.env.VITE_SUPABASE_IMAGE_TRANSFORM === "1";
  if (!useTransform) return undefined;

  return widths
    .map((w) => {
      const u = getOptimizedImageUrl(url, { width: w, height: options.height, quality: options.quality, resize: options.resize });
      return `${u} ${w}w`;
    })
    .join(", ");
}
