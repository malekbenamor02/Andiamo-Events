// Admin consultation inquiries endpoint (B2B leads)
// Read-only, admin-only access via adminToken cookie

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../../lib/cors.js');
  }
  return corsUtils;
}

async function verifyAdminAuth(req) {
  try {
    const cookies = req.headers.cookie || '';
    const cookieMatch = cookies.match(/adminToken=([^;]+)/);
    const token = cookieMatch ? cookieMatch[1] : null;

    if (!token) {
      return { valid: false, error: 'No authentication token provided', statusCode: 401 };
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || !!process.env.VERCEL_URL;

    if ((!jwtSecret || jwtSecret === 'fallback-secret-dev-only') && isProduction) {
      return { valid: false, error: 'Server configuration error: JWT_SECRET not set', statusCode: 500 };
    }

    let decoded;
    try {
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      return {
        valid: false,
        error: 'Invalid or expired token',
        reason: jwtError.name === 'TokenExpiredError' ? 'Token expired - session ended' : jwtError.message,
        statusCode: 401,
      };
    }

    if (!decoded.id || !decoded.email || !decoded.role) {
      return { valid: false, error: 'Invalid token payload', statusCode: 401 };
    }
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return { valid: false, error: 'Invalid admin role', statusCode: 403 };
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return { valid: false, error: 'Supabase not configured', statusCode: 500 };
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('id, email, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();

    if (dbError || !admin) {
      return { valid: false, error: 'Admin not found or inactive', statusCode: 401 };
    }

    return { valid: true, admin: { id: admin.id, email: admin.email, role: admin.role } };
  } catch (error) {
    return { valid: false, error: 'Authentication error', details: error.message, statusCode: 500 };
  }
}

export default async (req, res) => {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    return;
  }

  if (!setCORSHeaders(res, req, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    if (req.headers.origin) {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authResult = await verifyAdminAuth(req);
  if (!authResult.valid) {
    return res.status(authResult.statusCode || 401).json({
      error: authResult.error,
      details: authResult.details || authResult.reason,
    });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      error: 'Server misconfiguration',
      details: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required',
    });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const dbClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const limitRaw = Number(req.query.limit ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;

    const { data, error } = await dbClient
      .from('consultation_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch consultation inquiries', details: error.message });
    }

    return res.status(200).json({ success: true, data: data || [] });
  } catch (error) {
    return res.status(500).json({ error: 'Server error', details: error.message });
  }
};
