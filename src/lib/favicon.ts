import { supabase } from '@/integrations/supabase/client';
import { sanitizeObject } from './sanitize';
import { getApiBaseUrl } from '@/lib/api-routes';
import { upsertSiteContentViaApi } from '@/lib/adminSiteContent';

export interface FaviconSettings {
  favicon_ico?: string;
  favicon_32x32?: string;
  favicon_16x16?: string;
  apple_touch_icon?: string;
  updated_at?: string;
}

function extractKeyFromFaviconUrl(url: string): string | null {
  const base = (import.meta.env.VITE_PUBLIC_ASSETS_BASE_URL || '').replace(/\/$/, '');
  if (base && url.startsWith(base)) {
    const path = url.slice(base.length).replace(/^\//, '');
    return path || null;
  }
  try {
    const urlParts = url.split('/');
    const imagesIndex = urlParts.findIndex((part) => part === 'images');
    if (imagesIndex !== -1 && urlParts[imagesIndex + 1]) {
      return urlParts.slice(imagesIndex + 1).join('/');
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Upload favicon to R2 (or Supabase fallback) and update database
 */
export const uploadFavicon = async (
  file: File,
  type: 'favicon_ico' | 'favicon_32x32' | 'favicon_16x16' | 'apple_touch_icon'
): Promise<{ url: string; path: string; error?: string }> => {
  const apiBase = getApiBaseUrl();

  const tryR2 = async (): Promise<{ url: string; path: string; error?: string } | null> => {
    try {
      await fetch(`${apiBase}/api/media/favicon/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ faviconType: type }),
      });

      const fd = new FormData();
      fd.append('file', file);
      fd.append('scope', 'favicon');
      fd.append('faviconType', type);
      const res = await fetch(`${apiBase}/api/media/upload`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const code = data.code as string | undefined;
        if (res.status === 503 && code === 'R2_DISABLED') return null;
        if (res.status === 404) return null;
        return {
          url: '',
          path: '',
          error: (data.error as string) || res.statusText,
        };
      }
      return {
        url: String(data.url || ''),
        path: String(data.path || ''),
      };
    } catch {
      return null;
    }
  };

  try {
    const r2 = await tryR2();
    let urlDataPublicUrl: string;
    let filePath: string;

    if (r2 && r2.url && !r2.error) {
      urlDataPublicUrl = r2.url;
      filePath = r2.path;
    } else {
      if (r2?.error) return { url: '', path: '', error: r2.error };

      const fileExtension = file.name.split('.').pop();
      const fileTimestamp = Date.now();
      const fileName = `${type}_${fileTimestamp}.${fileExtension}`;
      filePath = `favicon/${fileName}`;

      try {
        const { data: oldFiles } = await supabase.storage.from('images').list('favicon', {
          search: type,
        });
        if (oldFiles && oldFiles.length > 0) {
          const filesToDelete = oldFiles
            .filter((f) => f.name.startsWith(`${type}_`))
            .map((f) => `favicon/${f.name}`);
          if (filesToDelete.length > 0) {
            await supabase.storage.from('images').remove(filesToDelete);
          }
        }
      } catch {
        /* continue */
      }

      const { error } = await supabase.storage.from('images').upload(filePath, file, {
        cacheControl: '0',
        upsert: false,
      });
      if (error) {
        return { url: '', path: '', error: error.message };
      }
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
      urlDataPublicUrl = urlData.publicUrl;
    }

    const { data: existingData } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    const currentSettings = (existingData?.content as FaviconSettings) || {};
    const settingsTimestamp = Date.now().toString();
    const updatedSettings: FaviconSettings = {
      ...currentSettings,
      [type]: urlDataPublicUrl,
      updated_at: settingsTimestamp,
    };

    await upsertSiteContentViaApi('favicon_settings', updatedSettings as Record<string, unknown>);

    const { data: verifyData, error: verifyError } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    if (verifyError || !verifyData) {
      return {
        url: urlDataPublicUrl,
        path: filePath,
        error: 'Uploaded but failed to verify save. Please refresh and check.',
      };
    }

    return { url: urlDataPublicUrl, path: filePath };
  } catch (error) {
    console.error('Favicon upload failed:', sanitizeObject(error));
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
};

export const deleteFavicon = async (
  type: 'favicon_ico' | 'favicon_32x32' | 'favicon_16x16' | 'apple_touch_icon',
  currentUrl: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const filePath = extractKeyFromFaviconUrl(currentUrl);

    if (filePath) {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/media/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ path: filePath }),
      });
      let data: Record<string, unknown> = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      const code = data.code as string | undefined;
      const useSupabaseFallback =
        !res.ok && ((res.status === 503 && code === 'R2_DISABLED') || res.status === 404);
      if (!res.ok && useSupabaseFallback) {
        await supabase.storage.from('images').remove([filePath]).catch(() => {});
      }
    }

    const { data: existingData, error: fetchError } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    if (fetchError) {
      if (
        fetchError.code === 'PGRST116' ||
        fetchError.code === 'P42P01' ||
        fetchError.message?.includes('406') ||
        fetchError.message?.includes('404')
      ) {
        return { success: true };
      }
      throw new Error(`Failed to fetch favicon settings: ${fetchError.message || JSON.stringify(fetchError)}`);
    }

    const currentSettings = (existingData?.content as FaviconSettings) || {};
    const timestamp = Date.now().toString();
    const updatedSettings: FaviconSettings = {
      ...currentSettings,
      updated_at: timestamp,
    };
    delete updatedSettings[type];

    await upsertSiteContentViaApi('favicon_settings', updatedSettings as Record<string, unknown>);

    return { success: true };
  } catch (error) {
    console.error('Error deleting favicon:', sanitizeObject(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const fetchFaviconSettings = async (): Promise<FaviconSettings> => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    if (error) {
      if (
        error.code === 'PGRST116' ||
        error.code === 'P42P01' ||
        error.message?.includes('406') ||
        error.message?.includes('404')
      ) {
        return {};
      }
      console.error('Error fetching favicon settings:', sanitizeObject(error));
      return {};
    }

    if (data && data.content) {
      return data.content as FaviconSettings;
    }

    return {};
  } catch (error) {
    console.error('Error fetching favicon settings:', error);
    return {};
  }
};
