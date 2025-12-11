import { supabase } from '@/integrations/supabase/client';

export interface OGImageUploadResult {
  success: boolean;
  error?: string;
}

/**
 * Validates OG image dimensions
 * Must be at least 1200x630px
 */
export const validateOGImage = (file: File): Promise<{ valid: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const width = img.width;
      const height = img.height;

      if (width < 200 || height < 200) {
        resolve({
          valid: false,
          error: 'Image must be at least 200x200 pixels'
        });
        return;
      }

      if (width < 1200 || height < 630) {
        resolve({
          valid: false,
          error: 'Image must be at least 1200x630 pixels for optimal quality. Current size: ' + width + 'x' + height
        });
        return;
      }

      resolve({ valid: true });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        error: 'Invalid image file'
      });
    };

    img.src = url;
  });
};

/**
 * Upload OG image to Supabase Storage at fixed path
 * Always overwrites the file at: images/og-image/current.png
 */
export const uploadOGImage = async (file: File): Promise<OGImageUploadResult> => {
  try {
    // Validate image dimensions
    const validation = await validateOGImage(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Image validation failed'
      };
    }

    // Determine file extension and ensure it's PNG or JPG
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'png' && fileExtension !== 'jpg' && fileExtension !== 'jpeg') {
      return {
        success: false,
        error: 'Image must be PNG or JPG format'
      };
    }

    // Fixed path - always the same filename
    const filePath = `og-image/current.${fileExtension === 'jpeg' ? 'jpg' : fileExtension}`;

    // Delete old file if it exists (in case format changed)
    try {
      const { data: existingFiles } = await supabase.storage
        .from('images')
        .list('og-image', {
          search: 'current'
        });

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles
          .filter(f => f.name.startsWith('current.'))
          .map(f => `og-image/${f.name}`);
        
        if (filesToDelete.length > 0) {
          await supabase.storage
            .from('images')
            .remove(filesToDelete);
        }
      }
    } catch (deleteError) {
      // Continue even if old file deletion fails
      console.warn('Could not delete old OG image:', deleteError);
    }

    // Upload new file (upsert: true to overwrite if exists)
    const { data, error } = await supabase.storage
      .from('images')
      .upload(filePath, file, {
        cacheControl: '0', // No cache to ensure fresh image
        upsert: true // Overwrite existing file
      });

    if (error) {
      console.error('OG image upload error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true
    };

  } catch (error) {
    console.error('OG image upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

/**
 * Get current OG image URL (if exists)
 * Returns the API endpoint URL which serves the image
 */
export const getOGImageUrl = async (): Promise<string | null> => {
  try {
    // Check if file exists by trying to download it
    const extensions = ['png', 'jpg'];
    
    for (const ext of extensions) {
      const filePath = `og-image/current.${ext}`;
      
      try {
        const { data, error } = await supabase.storage
          .from('images')
          .download(filePath);
        
        if (!error && data) {
          // File exists - return the API endpoint URL
          // The API endpoint always serves from the fixed path
          return '/api/og-image';
        }
      } catch (err) {
        // Continue to next extension
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting OG image URL:', error);
    return null;
  }
};

