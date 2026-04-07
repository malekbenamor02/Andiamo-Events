import { supabase } from '@/integrations/supabase/client';
import { getApiBaseUrl } from '@/lib/api-routes';

export interface UploadResult {
  url: string;
  path: string;
  error?: string;
  thumbUrl?: string;
  midUrl?: string;
  avifUrl?: string;
}

type ApiUploadResult =
  | { ok: true; url: string; path: string; thumbUrl?: string; midUrl?: string; avifUrl?: string }
  | { ok: false; fallback: boolean; error?: string };

type ApiUploadFailure = Extract<ApiUploadResult, { ok: false }>;

const MEDIA_UPLOAD_TIMEOUT_MS = 110_000;

async function postMediaUpload(formData: FormData): Promise<ApiUploadResult> {
  const base = getApiBaseUrl();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MEDIA_UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${base}/api/media/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof DOMException && e.name === 'AbortError') {
      return {
        ok: false,
        fallback: false,
        error:
          'Upload timed out. Try a smaller file, or check your connection. Large images can take a minute.',
      };
    }
    if (msg === 'The user aborted a request.') {
      return {
        ok: false,
        fallback: false,
        error:
          'Upload timed out. Try a smaller file, or check your connection. Large images can take a minute.',
      };
    }
    return { ok: false, fallback: false, error: msg || 'Upload failed' };
  } finally {
    window.clearTimeout(timer);
  }

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (res.ok) {
    return {
      ok: true,
      url: String(data.url || ''),
      path: String(data.path || ''),
      thumbUrl: data.thumbUrl ? String(data.thumbUrl) : undefined,
      midUrl: data.midUrl ? String(data.midUrl) : undefined,
      avifUrl: data.avifUrl ? String(data.avifUrl) : undefined,
    };
  }
  const code = data.code as string | undefined;
  const fallback = (res.status === 503 && code === 'R2_DISABLED') || res.status === 404;
  return {
    ok: false,
    fallback,
    error: (data.error as string) || res.statusText,
  };
}

async function postMediaDelete(pathKey: string): Promise<{ ok: boolean; fallback: boolean }> {
  const key = pathKey;
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/media/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ path: key }),
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (res.ok) return { ok: true, fallback: false };
  const code = data.code as string | undefined;
  const fallback = (res.status === 503 && code === 'R2_DISABLED') || res.status === 404;
  return { ok: false, fallback };
}

export const uploadImage = async (file: File, folder: string = 'posters'): Promise<UploadResult> => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('scope', 'images');
  fd.append('folder', folder);
  const api = await postMediaUpload(fd);
  if (api.ok) {
    return {
      url: api.url,
      path: api.path,
      thumbUrl: api.thumbUrl,
      midUrl: api.midUrl,
      avifUrl: api.avifUrl,
    };
  }
  const fail = api as ApiUploadFailure;
  if (!fail.fallback) {
    return { url: '', path: '', error: fail.error || 'Upload failed' };
  }
  try {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
    const filePath = `${folder}/${fileName}`;
    const { error } = await supabase.storage.from('images').upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) return { url: '', path: '', error: error.message };
    const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
    return { url: urlData.publicUrl, path: filePath };
  } catch (error) {
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
};

export const deleteImage = async (path: string, bucket: string = 'images'): Promise<boolean> => {
  const del = await postMediaDelete(path);
  if (del.ok) return true;
  if (!del.fallback) return false;
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    return !error;
  } catch {
    return false;
  }
};

export const uploadHeroImage = async (file: File): Promise<UploadResult> => {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('scope', 'hero');
  const api = await postMediaUpload(fd);
  if (api.ok) {
    return {
      url: api.url,
      path: api.path,
      thumbUrl: api.thumbUrl,
      midUrl: api.midUrl,
      avifUrl: api.avifUrl,
    };
  }
  const fail = api as ApiUploadFailure;
  if (!fail.fallback) {
    return { url: '', path: '', error: fail.error || 'Upload failed' };
  }

  try {
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
    const filePath = fileName;
    const { error } = await supabase.storage.from('hero-images').upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) return { url: '', path: '', error: error.message };
    const { data: urlData } = supabase.storage.from('hero-images').getPublicUrl(filePath);
    return { url: urlData.publicUrl, path: filePath };
  } catch (error) {
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
};

export const deleteHeroImage = async (path: string): Promise<boolean> => {
  const del = await postMediaDelete(path);
  if (del.ok) return true;
  if (!del.fallback) return false;
  try {
    const { error } = await supabase.storage.from('hero-images').remove([path]);
    return !error;
  } catch {
    return false;
  }
};

/** Upload CV/document for career application. Returns public URL to store in form_data. */
export const uploadCareerDocument = async (file: File): Promise<UploadResult> => {
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 80);
  const fd = new FormData();
  fd.append('file', file);
  fd.append('scope', 'career');
  fd.append('safeName', safeName);
  const api = await postMediaUpload(fd);
  if (api.ok) {
    return { url: api.url, path: api.path };
  }
  const fail = api as ApiUploadFailure;
  if (!fail.fallback) {
    return { url: '', path: '', error: fail.error || 'Upload failed' };
  }

  try {
    const timestamp = Date.now();
    const fileName = `${timestamp}-${safeName}`;
    const filePath = fileName;
    const { error } = await supabase.storage
      .from('career-documents')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (error) return { url: '', path: '', error: error.message };
    const { data: urlData } = supabase.storage.from('career-documents').getPublicUrl(filePath);
    return { url: urlData.publicUrl, path: filePath };
  } catch (err) {
    return {
      url: '',
      path: '',
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
};
