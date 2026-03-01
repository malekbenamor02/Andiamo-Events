import { supabase } from '@/integrations/supabase/client';
import { sanitizeObject } from './sanitize';

export interface FaviconSettings {
  favicon_ico?: string;
  favicon_32x32?: string;
  favicon_16x16?: string;
  apple_touch_icon?: string;
  updated_at?: string; // Timestamp for cache-busting
}

/**
 * Upload favicon to Supabase Storage and update database
 */
export const uploadFavicon = async (
  file: File,
  type: 'favicon_ico' | 'favicon_32x32' | 'favicon_16x16' | 'apple_touch_icon'
): Promise<{ url: string; path: string; error?: string }> => {
  try {
    // Generate filename with timestamp to ensure unique URLs and force browser refresh
    const fileExtension = file.name.split('.').pop();
    const fileTimestamp = Date.now();
    const fileName = `${type}_${fileTimestamp}.${fileExtension}`;
    const filePath = `favicon/${fileName}`;

    // Delete old favicon files of the same type first
    try {
      const { data: oldFiles } = await supabase.storage
        .from('images')
        .list('favicon', {
          search: type
        });

      if (oldFiles && oldFiles.length > 0) {
        const filesToDelete = oldFiles
          .filter(f => f.name.startsWith(`${type}_`))
          .map(f => `favicon/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage
            .from('images')
            .remove(filesToDelete);
        }
      }
    } catch (deleteError) {
      // Continue even if old file deletion fails
      console.warn('Could not delete old favicon files:', deleteError);
    }

    // Upload to Supabase Storage with no cache to force refresh
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '0', // No cache to force browser refresh
        upsert: false // Don't overwrite, use new filename
      });

    if (error) {
      console.error('Favicon upload error:', sanitizeObject(error));
      return {
        url: '',
        path: '',
        error: error.message
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    // Update favicon settings in database
    const { data: existingData } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    const currentSettings = (existingData?.content as FaviconSettings) || {};
    const settingsTimestamp = Date.now().toString();
    const updatedSettings: FaviconSettings = {
      ...currentSettings,
      [type]: urlData.publicUrl,
      updated_at: settingsTimestamp // Store timestamp for cache-busting
    };

    const { error: updateError, data: updateData } = await supabase
      .from('site_content')
      .upsert({
        key: 'favicon_settings',
        content: updatedSettings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (updateError) {
      console.error('Error updating favicon settings:', sanitizeObject(updateError));
      console.error('Update data:', sanitizeObject(updateData));
      console.error('Settings being saved:', sanitizeObject(updatedSettings));
      return {
        url: urlData.publicUrl,
        path: filePath,
        error: updateError.message || 'Failed to save favicon settings to database'
      };
    }

    // Verify the save was successful
    const { data: verifyData, error: verifyError } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    if (verifyError || !verifyData) {
      console.error('Failed to verify favicon settings save:', sanitizeObject(verifyError));
      return {
        url: urlData.publicUrl,
        path: filePath,
        error: 'Uploaded but failed to verify save. Please refresh and check.'
      };
    }

    return {
      url: urlData.publicUrl,
      path: filePath
    };

  } catch (error) {
    console.error('Favicon upload failed:', sanitizeObject(error));
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

/**
 * Delete favicon from storage and database
 */
export const deleteFavicon = async (
  type: 'favicon_ico' | 'favicon_32x32' | 'favicon_16x16' | 'apple_touch_icon',
  currentUrl: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Extract path from URL
    let filePath: string | null = null;
    try {
      const urlParts = currentUrl.split('/');
      const imagesIndex = urlParts.findIndex(part => part === 'images');
      if (imagesIndex !== -1 && urlParts[imagesIndex + 1]) {
        filePath = urlParts.slice(imagesIndex + 1).join('/');
      }
    } catch (e) {
      console.warn('Could not extract file path from URL:', e);
    }

    // Delete from storage if path is available
    if (filePath) {
      const { error: deleteError } = await supabase.storage
        .from('images')
        .remove([filePath]);

      if (deleteError) {
        console.warn('Error deleting favicon from storage (continuing with database update):', deleteError);
      }
    }

    // Update database - remove the favicon URL
    const { data: existingData, error: fetchError } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    // Handle various error cases gracefully
    if (fetchError) {
      // PGRST116 = no rows returned (record doesn't exist)
      // 406 = Not Acceptable
      // 404 = Not Found
      if (fetchError.code === 'PGRST116' || fetchError.code === 'P42P01' || fetchError.message?.includes('406') || fetchError.message?.includes('404')) {
        return { success: true };
      }
      throw new Error(`Failed to fetch favicon settings: ${fetchError.message || JSON.stringify(fetchError)}`);
    }

    const currentSettings = (existingData?.content as FaviconSettings) || {};
    const timestamp = Date.now().toString();
    const updatedSettings: FaviconSettings = {
      ...currentSettings,
      updated_at: timestamp // Update timestamp even when deleting
    };
    delete updatedSettings[type];

    const { error: updateError } = await supabase
      .from('site_content')
      .upsert({
        key: 'favicon_settings',
        content: updatedSettings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message || JSON.stringify(updateError)}`);
    }

    return { success: true };

  } catch (error) {
    console.error('Error deleting favicon:', sanitizeObject(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Fetch favicon settings from database
 */
export const fetchFaviconSettings = async (): Promise<FaviconSettings> => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'favicon_settings')
      .single();

    // Handle various error cases gracefully
    if (error) {
      // PGRST116 = no rows returned (record doesn't exist)
      // 406 = Not Acceptable (might be RLS or format issue)
      // 404 = Not Found
      if (error.code === 'PGRST116' || error.code === 'P42P01' || error.message?.includes('406') || error.message?.includes('404')) {
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
    // Catch any unexpected errors
    console.error('Error fetching favicon settings:', error);
    return {};
  }
};
