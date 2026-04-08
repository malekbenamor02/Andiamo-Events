import { supabase } from '@/integrations/supabase/client';

/** Short TTL for mutable or non-versioned-looking uploads */
const CACHE_CONTROL_DEFAULT = '3600';
/**
 * Long TTL for versioned public URLs (unique filename per upload).
 * Browsers/CDNs may keep the response for up to 1 year; users can still clear cache.
 */
const CACHE_CONTROL_IMMUTABLE_PUBLIC = '31536000';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
  thumbUrl?: string;
  midUrl?: string;
  avifUrl?: string;
}

function makeStoragePath(file: File, prefix = ''): string {
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop() || 'bin';
  const fileName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
  return prefix ? `${prefix}/${fileName}` : fileName;
}

async function uploadToBucket(
  file: File,
  bucket: string,
  path: string,
  cacheControl: string
): Promise<UploadResult> {
  try {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl,
      upsert: false,
    });
    if (error) return { url: '', path: '', error: error.message };

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return { url: urlData.publicUrl, path };
  } catch (error) {
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

async function deleteFromBucket(path: string, bucket: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    return !error;
  } catch {
    return false;
  }
}

export const uploadImage = async (file: File, folder: string = 'posters'): Promise<UploadResult> => {
  const filePath = makeStoragePath(file, folder);
  const longCache = folder === 'posters' || folder === 'gallery';
  return uploadToBucket(
    file,
    'images',
    filePath,
    longCache ? CACHE_CONTROL_IMMUTABLE_PUBLIC : CACHE_CONTROL_DEFAULT
  );
};

export const deleteImage = async (path: string, bucket: string = 'images'): Promise<boolean> => {
  return deleteFromBucket(path, bucket);
};

export const uploadHeroImage = async (file: File): Promise<UploadResult> => {
  const filePath = makeStoragePath(file);
  return uploadToBucket(file, 'hero-images', filePath, CACHE_CONTROL_IMMUTABLE_PUBLIC);
};

export const deleteHeroImage = async (path: string): Promise<boolean> => {
  return deleteFromBucket(path, 'hero-images');
};

/** Upload CV/document for career application. Returns public URL to store in form_data. */
export const uploadCareerDocument = async (file: File): Promise<UploadResult> => {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 80);
  const timestamp = Date.now();
  const filePath = `${timestamp}-${safeName}`;
  return uploadToBucket(file, 'career-documents', filePath, CACHE_CONTROL_DEFAULT);
};
