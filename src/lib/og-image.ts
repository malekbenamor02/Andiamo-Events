import { supabase } from '@/integrations/supabase/client';

export interface OGImageSettings {
  og_image?: string;
  updated_at?: string; // Timestamp for cache-busting
}

const OG_IMAGE_FOLDER = 'og-image';

/**
 * Upload OG image to Supabase Storage and update database
 */
export const uploadOGImage = async (
  file: File
): Promise<{ url: string; path: string; error?: string }> => {
  try {
    // Generate filename
    const fileExtension = file.name.split('.').pop();
    const fileName = `og-image.${fileExtension}`;
    const filePath = `${OG_IMAGE_FOLDER}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '31536000', // Cache for 1 year
        upsert: true // Allow overwriting
      });

    if (error) {
      console.error('OG image upload error:', error);
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

    // Update OG image settings in database
    const { data: existingData } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'og_image_settings')
      .single();

    const currentSettings = (existingData?.content as OGImageSettings) || {};
    const timestamp = Date.now().toString();
    const updatedSettings: OGImageSettings = {
      ...currentSettings,
      og_image: urlData.publicUrl,
      updated_at: timestamp // Store timestamp for cache-busting
    };

    const { error: updateError } = await supabase
      .from('site_content')
      .upsert({
        key: 'og_image_settings',
        content: updatedSettings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      });

    if (updateError) {
      console.error('Error updating OG image settings:', updateError);
      return {
        url: urlData.publicUrl,
        path: filePath,
        error: updateError.message
      };
    }

    return {
      url: urlData.publicUrl,
      path: filePath
    };

  } catch (error) {
    console.error('OG image upload failed:', error);
    return {
      url: '',
      path: '',
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

/**
 * Delete OG image from storage and database
 */
export const deleteOGImage = async (
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
        console.warn('Error deleting OG image from storage (continuing with database update):', deleteError);
      }
    }

    // Update database - remove the OG image URL
    const { data: existingData, error: fetchError } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'og_image_settings')
      .single();

    // Handle various error cases gracefully
    if (fetchError) {
      // PGRST116 = no rows returned (record doesn't exist)
      // 406 = Not Acceptable
      // 404 = Not Found
      if (fetchError.code === 'PGRST116' || fetchError.code === 'P42P01' || fetchError.message?.includes('406') || fetchError.message?.includes('404')) {
        console.log('OG image settings not found, nothing to delete');
        return { success: true };
      }
      throw new Error(`Failed to fetch OG image settings: ${fetchError.message || JSON.stringify(fetchError)}`);
    }

    const currentSettings = (existingData?.content as OGImageSettings) || {};
    const updatedSettings: OGImageSettings = { ...currentSettings };
    delete updatedSettings.og_image;

    const { error: updateError } = await supabase
      .from('site_content')
      .upsert({
        key: 'og_image_settings',
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
    console.error('Error deleting OG image:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Fetch OG image settings from database
 */
export const fetchOGImageSettings = async (): Promise<OGImageSettings> => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'og_image_settings')
      .single();

    // Handle various error cases gracefully
    if (error) {
      // PGRST116 = no rows returned (record doesn't exist)
      // 406 = Not Acceptable (might be RLS or format issue)
      // 404 = Not Found
      if (error.code === 'PGRST116' || error.code === 'P42P01' || error.message?.includes('406') || error.message?.includes('404')) {
        console.log('OG image settings not found, returning empty settings');
        return {};
      }
      console.error('Error fetching OG image settings:', error);
      return {};
    }

    if (data && data.content) {
      return data.content as OGImageSettings;
    }

    return {};
  } catch (error) {
    // Catch any unexpected errors
    console.error('Error fetching OG image settings:', error);
    return {};
  }
};


