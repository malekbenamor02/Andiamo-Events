import { getApiBaseUrl } from '@/lib/api-routes';
import { apiFetch, handleApiResponse } from '@/lib/api-client';

export interface AdminMediaUploadResult {
  url: string;
  path: string;
  bucket?: string;
  thumbUrl?: string;
  midUrl?: string;
  avifUrl?: string;
  error?: string;
}

async function uploadViaAdminMediaApi(
  file: File,
  body: Record<string, string>
): Promise<AdminMediaUploadResult> {
  const fd = new FormData();
  fd.append('file', file);
  for (const [k, v] of Object.entries(body)) {
    fd.append(k, v);
  }
  const res = await apiFetch(`${getApiBaseUrl()}/api/admin/media/upload`, {
    method: 'POST',
    body: fd,
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    return {
      url: '',
      path: '',
      error: (data.error as string) || res.statusText || 'Upload failed',
    };
  }
  return {
    url: String(data.url || ''),
    path: String(data.path || ''),
    bucket: data.bucket ? String(data.bucket) : undefined,
    thumbUrl: data.thumbUrl ? String(data.thumbUrl) : undefined,
    midUrl: data.midUrl ? String(data.midUrl) : undefined,
    avifUrl: data.avifUrl ? String(data.avifUrl) : undefined,
  };
}

export async function uploadImageViaAdminApi(
  file: File,
  folder: string = 'posters'
): Promise<AdminMediaUploadResult> {
  return uploadViaAdminMediaApi(file, { scope: 'images', folder });
}

export async function uploadHeroImageViaAdminApi(file: File): Promise<AdminMediaUploadResult> {
  return uploadViaAdminMediaApi(file, { scope: 'hero' });
}

export async function uploadMarketingEmailAttachmentViaAdminApi(
  file: File
): Promise<AdminMediaUploadResult> {
  return uploadViaAdminMediaApi(file, {
    scope: 'images',
    folder: 'marketing-email-attachments',
  });
}

export async function deleteAdminMediaObject(
  path: string,
  bucket: string = 'images'
): Promise<boolean> {
  const res = await apiFetch(`${getApiBaseUrl()}/api/admin/media/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, bucket }),
  });
  return res.ok;
}
