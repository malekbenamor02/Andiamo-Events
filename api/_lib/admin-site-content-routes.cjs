'use strict';

/**
 * PUT /api/admin/site-content/:key — super_admin site configuration writes (service role).
 */
const SITE_CONTENT_KEYS = new Set([
  'sales_settings',
  'maintenance_settings',
  'hero_section',
  'ambassador_application_settings',
  'ambassador_selection_settings',
  'countdown_banner',
  'countdown_banner_settings',
  'favicon_settings',
  'site_theme',
  'about_section',
  'about_us',
  'contact_info',
  'homepage_hero',
]);

function registerAdminSiteContentRoutes(app, deps) {
  const { supabaseService, requireAdminAuth, requireAdminPermission } = deps;

  app.put(
    '/api/admin/site-content/:key',
    requireAdminAuth,
    requireAdminPermission('settings:manage'),
    async (req, res) => {
      try {
        if (!supabaseService) {
          return res.status(500).json({ error: 'Supabase service client not configured' });
        }
        const key = String(req.params.key || '').trim();
        if (!SITE_CONTENT_KEYS.has(key)) {
          return res.status(400).json({ error: 'Invalid or disallowed site content key' });
        }
        const { content } = req.body || {};
        if (content == null || typeof content !== 'object') {
          return res.status(400).json({ error: 'content object is required' });
        }
        const { data, error } = await supabaseService
          .from('site_content')
          .upsert(
            {
              key,
              content,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'key' }
          )
          .select()
          .single();
        if (error) {
          return res.status(500).json({ error: 'Failed to update site content', details: error.message });
        }
        return res.json({ success: true, data });
      } catch (err) {
        console.error('PUT /api/admin/site-content:', err);
        return res.status(500).json({ error: 'Internal server error', details: err.message });
      }
    }
  );
}

module.exports = { registerAdminSiteContentRoutes, SITE_CONTENT_KEYS };
