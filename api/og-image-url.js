// API endpoint that returns the current OG image URL from database
// Used by frontend to get the latest OG image URL with version parameter

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

    // Fetch OG image settings from database - get the newest one
    const { data, error } = await supabase
      .from('site_content')
      .select('content, updated_at')
      .eq('key', 'og_image_settings')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data || !data.content) {
      return res.status(404).json({ error: 'OG image not found' });
    }

    const settings = data.content;
    const ogImageUrl = settings.og_image;

    if (!ogImageUrl) {
      return res.status(404).json({ error: 'OG image not found' });
    }

    // Add version parameter for cache-busting
    const version = settings.updated_at || Date.now().toString();
    const separator = ogImageUrl.includes('?') ? '&' : '?';
    const finalUrl = `${ogImageUrl}${separator}v=${version}`;

    // Return the URL with version parameter
    return res.status(200).json({
      url: finalUrl,
      originalUrl: ogImageUrl,
      version: version,
      updatedAt: data.updated_at
    });
  } catch (error) {
    console.error('Error fetching OG image URL:', error);
    return res.status(500).json({ error: 'Error loading OG image URL' });
  }
};

