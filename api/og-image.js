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
    // Bucket is "images", path within bucket is "og-image/og-image-123.jpg"
    let filePath = null;
    try {
      const url = new URL(ogImageUrl);
      const pathParts = url.pathname.split('/').filter(part => part);
      
      // Find the index of "images" bucket in the path
      // URL structure: /storage/v1/object/public/images/og-image/file.jpg
      const imagesIndex = pathParts.findIndex(part => part === 'images');
      if (imagesIndex !== -1 && pathParts[imagesIndex + 1]) {
        // Everything after "images" is the file path within the bucket
        // Format: images/og-image/file.jpg -> og-image/file.jpg
        filePath = pathParts.slice(imagesIndex + 1).join('/');
        // Remove query parameters if any
        filePath = filePath.split('?')[0];
      }
    } catch (e) {
      console.error('Error parsing OG image URL:', e, 'URL:', ogImageUrl);
      // Fallback: try simple string extraction
      try {
        const urlParts = ogImageUrl.split('/');
        const imagesIndex = urlParts.findIndex(part => part === 'images');
        if (imagesIndex !== -1 && urlParts[imagesIndex + 1]) {
          filePath = urlParts.slice(imagesIndex + 1).join('/');
          // Remove query parameters if any
          filePath = filePath.split('?')[0];
        }
      } catch (e2) {
        console.error('Fallback URL parsing also failed:', e2);
      }
    }
    
    console.log('Extracted file path:', filePath, 'from URL:', ogImageUrl);

    // If we can extract the path, fetch the image from Supabase Storage
    if (filePath) {
      try {
        console.log('Attempting to download from bucket "images" with path:', filePath);
        
        // Download the image from Supabase Storage
        const { data: imageData, error: downloadError } = await supabase.storage
          .from('images')
          .download(filePath);

        if (downloadError || !imageData) {
          console.error('Error downloading OG image from storage:', {
            error: downloadError,
            filePath: filePath,
            hasImageData: !!imageData
          });
          
          // Try alternative: fetch directly from the public URL using node-fetch
          try {
            const fetch = (await import('node-fetch')).default;
            const imageResponse = await fetch(ogImageUrl);
            
            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              const imageBuffer = Buffer.from(arrayBuffer);
              const contentType = imageResponse.headers.get('content-type') || 
                                (filePath.endsWith('.png') ? 'image/png' :
                                 filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') ? 'image/jpeg' :
                                 filePath.endsWith('.gif') ? 'image/gif' :
                                 filePath.endsWith('.webp') ? 'image/webp' :
                                 'image/jpeg');
              
              res.setHeader('Content-Type', contentType);
              res.setHeader('Content-Length', imageBuffer.length);
              res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
              res.setHeader('X-Content-Type-Options', 'nosniff');
              
              if (settings.updated_at) {
                res.setHeader('ETag', `"${settings.updated_at}"`);
              }
              
              console.log('Successfully fetched image via HTTP, serving directly');
              return res.send(imageBuffer);
            } else {
              console.error('HTTP fetch also failed:', imageResponse.status, imageResponse.statusText);
            }
          } catch (fetchError) {
            console.error('Error fetching image via HTTP:', fetchError);
          }
          
          // Fallback to redirect if all methods fail
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
        console.log('Successfully downloaded image from storage, serving directly');
        return res.send(buffer);
      } catch (storageError) {
        console.error('Error serving OG image from storage:', storageError);
        
        // Try alternative: fetch directly from the public URL using node-fetch
        try {
          const fetch = (await import('node-fetch')).default;
          const imageResponse = await fetch(ogImageUrl);
          
          if (imageResponse.ok) {
            const arrayBuffer = await imageResponse.arrayBuffer();
            const imageBuffer = Buffer.from(arrayBuffer);
            const contentType = imageResponse.headers.get('content-type') || 
                              (filePath && filePath.endsWith('.png') ? 'image/png' :
                               filePath && (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) ? 'image/jpeg' :
                               filePath && filePath.endsWith('.gif') ? 'image/gif' :
                               filePath && filePath.endsWith('.webp') ? 'image/webp' :
                               'image/jpeg');
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', imageBuffer.length);
            res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            
            if (settings.updated_at) {
              res.setHeader('ETag', `"${settings.updated_at}"`);
            }
            
            console.log('Successfully fetched image via HTTP fallback, serving directly');
            return res.send(imageBuffer);
          }
        } catch (fetchError) {
          console.error('HTTP fetch fallback also failed:', fetchError);
        }
        
        // Fallback to redirect if all methods fail
        const finalUrl = settings.updated_at 
          ? `${ogImageUrl}${ogImageUrl.includes('?') ? '&' : '?'}v=${settings.updated_at}`
          : ogImageUrl;
        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
        res.setHeader('Location', finalUrl);
        return res.redirect(302, finalUrl);
      }
    } else {
      // If we can't extract the path, try fetching directly from the public URL
      try {
        console.log('Could not extract file path, trying direct HTTP fetch from:', ogImageUrl);
        const fetch = (await import('node-fetch')).default;
        const imageResponse = await fetch(ogImageUrl);
        
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          const imageBuffer = Buffer.from(arrayBuffer);
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
          
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Length', imageBuffer.length);
          res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          
          if (settings.updated_at) {
            res.setHeader('ETag', `"${settings.updated_at}"`);
          }
          
          console.log('Successfully fetched image via direct HTTP, serving directly');
          return res.send(imageBuffer);
        } else {
          console.error('Direct HTTP fetch failed:', imageResponse.status, imageResponse.statusText);
        }
      } catch (fetchError) {
        console.error('Error fetching image via direct HTTP:', fetchError);
      }
      
      // Final fallback: redirect if all methods fail
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

