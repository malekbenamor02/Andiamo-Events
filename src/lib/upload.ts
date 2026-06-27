import {
  deleteAdminMediaObject,
  uploadHeroImageViaAdminApi,
  uploadImageViaAdminApi,
  uploadMarketingEmailAttachmentViaAdminApi,
} from '@/lib/adminMediaUpload';

/** Short TTL for mutable or non-versioned-looking uploads */
const CACHE_CONTROL_DEFAULT = '3600';
/** Long TTL for versioned public URLs (unique filename per upload). */
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

export const uploadImage = async (file: File, folder: string = 'posters'): Promise<UploadResult> => {
  const result = await uploadImageViaAdminApi(file, folder);
  if (result.error) return { url: '', path: '', error: result.error };
  return {
    url: result.url,
    path: result.path,
    thumbUrl: result.thumbUrl,
    midUrl: result.midUrl,
    avifUrl: result.avifUrl,
  };
};

export const deleteImage = async (path: string, bucket: string = 'images'): Promise<boolean> => {
  return deleteAdminMediaObject(path, bucket);
};

export const uploadHeroImage = async (file: File): Promise<UploadResult> => {
  const result = await uploadHeroImageViaAdminApi(file);
  if (result.error) return { url: '', path: '', error: result.error };
  return {
    url: result.url,
    path: result.path,
    thumbUrl: result.thumbUrl,
    midUrl: result.midUrl,
    avifUrl: result.avifUrl,
  };
};

export const deleteHeroImage = async (path: string): Promise<boolean> => {
  return deleteAdminMediaObject(path, 'hero-images');
};

export const uploadMarketingEmailAttachment = async (file: File): Promise<UploadResult> => {
  const result = await uploadMarketingEmailAttachmentViaAdminApi(file);
  if (result.error) return { url: '', path: '', error: result.error };
  return { url: result.url, path: result.path };
};

export { makeStoragePath, CACHE_CONTROL_DEFAULT, CACHE_CONTROL_IMMUTABLE_PUBLIC };
