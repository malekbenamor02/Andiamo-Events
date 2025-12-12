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
    // List all files and filter for current.* files
    try {
      const { data: allFiles } = await supabase.storage
        .from('images')
        .list('og-image');

      if (allFiles && allFiles.length > 0) {
        const filesToDelete = allFiles
          .filter(f => f.name.startsWith('current.'))
          .map(f => `og-image/${f.name}`);
        
        if (filesToDelete.length > 0) {
          await supabase.storage
            .from('images')
            .remove(filesToDelete);
          // Wait a moment for deletion to propagate
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (deleteError) {
      // Continue even if old file deletion fails - upsert will handle overwrite
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

/**
 * Delete OG image from Supabase Storage
 * Removes all current.* files from og-image folder
 */
export const deleteOGImage = async (): Promise<OGImageUploadResult> => {
  try {
    // List ALL files in og-image folder (search parameter doesn't work reliably)
    const { data: allFiles, error: listError } = await supabase.storage
      .from('images')
      .list('og-image');

    if (listError) {
      console.error('Error listing OG image files:', listError);
      return {
        success: false,
        error: listError.message
      };
    }

    if (!allFiles || allFiles.length === 0) {
      // No files in folder - already deleted or never existed
      return {
        success: true // Return success since there's nothing to delete
      };
    }

    // Filter for files that start with "current."
    const filesToDelete = allFiles
      .filter(f => f.name.startsWith('current.'))
      .map(f => `og-image/${f.name}`);
    
    if (filesToDelete.length === 0) {
      // No current.* files found
      return {
        success: true // Return success since there's nothing to delete
      };
    }

    // Delete all current.* files
    const { error: deleteError } = await supabase.storage
      .from('images')
      .remove(filesToDelete);

    if (deleteError) {
      console.error('Error deleting OG image:', deleteError);
      return {
        success: false,
        error: deleteError.message
      };
    }

    // Verify deletion by checking if files still exist
    // Wait a moment for deletion to propagate
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Double-check by trying to download one of the files
    const verifyDelete = await supabase.storage
      .from('images')
      .download(filesToDelete[0]);
    
    if (verifyDelete.data) {
      // File still exists - deletion might have failed
      console.warn('OG image deletion verification failed - file still exists');
    }

    return {
      success: true
    };

  } catch (error) {
    console.error('OG image deletion failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deletion failed'
    };
  }
};

