// OG Image endpoint for Vercel serverless function
// Fetches OG image from database and serves it directly for Facebook/Instagram crawlers

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(404).json({ error: 'OG image not configured' });
    }

    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Fetch OG image settings from database
    const { data, error } = await supabase
      .from('site_content')
      .select('content')
      .eq('key', 'og_image_settings')
      .single();

    if (error || !data || !data.content) {
      return res.status(404).json({ error: 'OG image not found' });
    }

    const settings = data.content;
    const ogImageUrl = settings.og_image;

    if (!ogImageUrl) {
      return res.status(404).json({ error: 'OG image not found' });
    }

    // Extract the file path from the Supabase Storage URL
    // Example: https://xxx.supabase.co/storage/v1/object/public/images/og-image/og-image-123.jpg
    // Path after "public" is: images/og-image/og-image-123.jpg
    let filePath = null;
    try {
      const url = new URL(ogImageUrl);
      const pathParts = url.pathname.split('/').filter(part => part);
      
      // Find the index of "public" in the path
      const publicIndex = pathParts.findIndex(part => part === 'public');
      if (publicIndex !== -1 && pathParts[publicIndex + 1]) {
        // Everything after "public" is the bucket/path
        // Format: public/bucket/folder/file.jpg -> bucket/folder/file.jpg
        filePath = pathParts.slice(publicIndex + 1).join('/');
      } else {
        // Fallback: try to find "images" in the path
        const imagesIndex = pathParts.findIndex(part => part === 'images');
        if (imagesIndex !== -1) {
          filePath = pathParts.slice(imagesIndex).join('/');
        }
      }
    } catch (e) {
      console.error('Error parsing OG image URL:', e);
      // Fallback: try simple string extraction
      try {
        const urlParts = ogImageUrl.split('/');
        const imagesIndex = urlParts.findIndex(part => part === 'images');
        if (imagesIndex !== -1) {
          filePath = urlParts.slice(imagesIndex).join('/');
        }
      } catch (e2) {
        console.error('Fallback URL parsing also failed:', e2);
      }
    }

    // If we can extract the path, fetch the image from Supabase Storage
    if (filePath) {
      try {
        // Download the image from Supabase Storage
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('images')
          .download(filePath);

        if (downloadError || !imageData) {
          console.error('Error downloading OG image from storage:', downloadError);
          // Fallback to redirect if download fails
          const finalUrl = settings.updated_at 
            ? `${ogImageUrl}${ogImageUrl.includes('?') ? '&' : '?'}v=${settings.updated_at}`
            : ogImageUrl;
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
          res.setHeader('Location', finalUrl);
          return res.redirect(302, finalUrl);
        }

        // Convert blob to buffer
        const arrayBuffer = await imageData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine content type from file extension
        const contentType = filePath.endsWith('.png') ? 'image/png' :
                          filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg' :
                          filePath.endsWith('.gif') ? 'image/gif' :
                          filePath.endsWith('.webp') ? 'image/webp' :
                          'image/jpeg'; // Default to JPEG

        // Set proper headers for image serving
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Add version parameter to ETag for cache-busting
        if (settings.updated_at) {
          res.setHeader('ETag', `"${settings.updated_at}"`);
        }

        // Send the image directly
        return res.send(buffer);
      } catch (storageError) {
        console.error('Error serving OG image from storage:', storageError);
        // Fallback to redirect if serving fails
        const finalUrl = settings.updated_at 
          ? `${ogImageUrl}${ogImageUrl.includes('?') ? '&' : '?'}v=${settings.updated_at}`
          : ogImageUrl;
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        res.setHeader('Location', finalUrl);
        return res.redirect(302, finalUrl);
      }
    } else {
      // If we can't extract the path, fallback to redirect
      const finalUrl = settings.updated_at 
        ? `${ogImageUrl}${ogImageUrl.includes('?') ? '&' : '?'}v=${settings.updated_at}`
        : ogImageUrl;
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      res.setHeader('Location', finalUrl);
      return res.redirect(302, finalUrl);
    }
  } catch (error) {
    console.error('Error fetching OG image:', error);
    return res.status(500).json({ error: 'Error loading OG image' });
  }
};

