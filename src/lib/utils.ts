import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a URL-friendly slug from a string
 * Handles accented characters and special characters properly
 * Returns a non-empty slug, or falls back to event ID
 */
export function generateSlug(text: string): string {
  if (!text || typeof text !== 'string') {
    console.warn('generateSlug: Invalid input', text);
    return '';
  }
  
  // Step 1: Normalize and convert to lowercase
  let slug = text
    .toLowerCase()
    .trim();
  
  if (!slug) {
    console.warn('generateSlug: Empty after trim', text);
    return '';
  }
  
  // Step 2: Normalize accented characters (é -> e, à -> a, etc.)
  slug = slug
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  
  // Step 3: Replace spaces, underscores, and other separators with hyphens
  slug = slug.replace(/[\s_]+/g, '-');
  
  // Step 4: Remove all non-alphanumeric characters except hyphens
  // This is more permissive - keeps letters, numbers, and hyphens
  slug = slug.replace(/[^a-z0-9-]/g, '');
  
  // Step 5: Replace multiple consecutive hyphens with a single hyphen
  slug = slug.replace(/-+/g, '-');
  
  // Step 6: Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  
  // Debug: Log if slug is empty to help identify problematic event names
  if (!slug) {
    console.warn('generateSlug: Result is empty for input:', text);
  }
  
  // If slug is still empty, return empty string (caller should handle fallback)
  return slug || '';
}