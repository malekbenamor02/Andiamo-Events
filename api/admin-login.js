// Clean, minimal admin login endpoint for Vercel
// Using ES module syntax because package.json has "type": "module"

import {
  checkAdminLoginIpRateLimit,
  checkAdminLoginEmailRateLimit,
  getAdminLoginClientIp,
} from './_lib/admin-login-rate-limit.js';
import { createRequire } from 'module';
import { checkAdminLoginDistributedLimits } from './_lib/admin-login-upstash.js';

const requireCjs = createRequire(import.meta.url);
const { ensureSupabaseServerEnv } = requireCjs('./_lib/supabase-env.cjs');
ensureSupabaseServerEnv();

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../lib/cors.js');
  }
  return corsUtils;
}

/** Bcrypt hash of "password" — used only to normalize timing when email is unknown. */
const DUMMY_BCRYPT_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

function isVercelProduction() {
  return process.env.VERCEL_ENV === 'production';
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_URL
  );
}

/** Remove invisible chars / accidental quotes from pasted reCAPTCHA tokens (Postman, DevTools). */
function sanitizeRecaptchaTokenForVerify(raw) {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim();
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
  s = s.replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’]+$/g, '');
  return s.trim();
}

export default async (req, res) => {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();

  if (handlePreflight(req, res, { methods: 'POST, OPTIONS', headers: 'Content-Type', credentials: true })) {
    return;
  }

  if (!setCORSHeaders(res, req, { methods: 'POST, OPTIONS', headers: 'Content-Type', credentials: true })) {
    if (req.headers.origin) {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isProduction = isProductionRuntime();

  try {
    let bodyData;

    if (req.body !== undefined && req.body !== null) {
      const raw = req.body;
      if (typeof raw === 'string') {
        try {
          bodyData = raw.trim() ? JSON.parse(raw) : {};
        } catch {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
      } else if (Buffer.isBuffer(raw)) {
        try {
          const t = raw.toString('utf8');
          bodyData = t.trim() ? JSON.parse(t) : {};
        } catch {
          return res.status(400).json({ error: 'Invalid JSON' });
        }
      } else {
        bodyData = raw;
      }
    } else {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      try {
        bodyData = body.trim() ? JSON.parse(body) : {};
      } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }

    const { email, password, recaptchaToken } = bodyData || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const emailNorm = String(email).toLowerCase().trim();

    const recapTrim = sanitizeRecaptchaTokenForVerify(recaptchaToken);

    const clientIp = getAdminLoginClientIp(req);

    const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
    const recaptchaRequired =
      isVercelProduction() || process.env.FORCE_ADMIN_RECAPTCHA === '1';

    if (recaptchaRequired && !RECAPTCHA_SECRET_KEY) {
      console.error('Admin login: RECAPTCHA_SECRET_KEY missing while reCAPTCHA is required');
      return res.status(503).json({ error: 'Login temporarily unavailable' });
    }

    if (RECAPTCHA_SECRET_KEY) {
      if (!recapTrim || recapTrim === '') {
        return res.status(400).json({ error: 'reCAPTCHA verification required' });
      }
      if (recapTrim !== 'localhost-bypass-token') {
        try {
          const params = new URLSearchParams({
            secret: RECAPTCHA_SECRET_KEY,
            response: recapTrim,
          });
          if (
            clientIp &&
            clientIp !== 'unknown' &&
            process.env.RECAPTCHA_OMIT_REMOTEIP !== '1'
          ) {
            params.set('remoteip', clientIp);
          }
          const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
          });
          const verifyData = await verifyResponse.json();
          const diag =
            process.env.RECAPTCHA_RETURN_DIAGNOSTICS === '1'
              ? {
                  errorCodes: verifyData['error-codes'] || null,
                  score: typeof verifyData.score === 'number' ? verifyData.score : null,
                  hostname: verifyData.hostname || null,
                }
              : null;

          if (!verifyData.success) {
            const rawCodes = verifyData['error-codes'];
            const codes = Array.isArray(rawCodes) ? rawCodes : rawCodes ? [rawCodes] : [];
            console.error('Admin login reCAPTCHA rejected', {
              errorCodes: codes,
              score: verifyData.score,
              hostname: verifyData.hostname,
              ...(codes.includes('invalid-input-response')
                ? { responseTokenLength: recapTrim.length }
                : {}),
            });
            return res.status(400).json({
              error: 'reCAPTCHA verification failed',
              ...(diag ? { recaptcha: diag } : {}),
            });
          }
          const minScore = Number.parseFloat(process.env.ADMIN_RECAPTCHA_MIN_SCORE || '0.25');
          if (
            typeof verifyData.score === 'number' &&
            Number.isFinite(minScore) &&
            verifyData.score < minScore
          ) {
            console.error('Admin login reCAPTCHA score too low', {
              score: verifyData.score,
              minScore,
              hostname: verifyData.hostname,
            });
            return res.status(400).json({
              error: 'reCAPTCHA verification failed',
              ...(diag
                ? { recaptcha: { ...diag, minScore } }
                : {}),
            });
          }
        } catch (recaptchaError) {
          console.error('Admin login reCAPTCHA error:', recaptchaError);
          return res.status(500).json({ error: 'reCAPTCHA verification service unavailable' });
        }
      }
    }

    if (!checkAdminLoginIpRateLimit(clientIp)) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }
    if (!checkAdminLoginEmailRateLimit(emailNorm)) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }
    const dist = await checkAdminLoginDistributedLimits(clientIp, emailNorm);
    if (!dist.allowed) {
      return res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
      });
      return res.status(500).json({
        error: 'Server configuration error',
        ...(isProduction
          ? {}
          : {
              details:
                'Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.',
            }),
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', emailNorm)
      .single();

    const bcrypt = await import('bcryptjs');

    if (dbError || !admin) {
      await bcrypt.default.compare(String(password), DUMMY_BCRYPT_HASH);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.default.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';

    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (isProduction) {
        return res.status(500).json({ error: 'Server configuration error' });
      }
    }

    const token = jwt.default.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      jwtSecret,
      { expiresIn: '5h' }
    );

    const cookieParts = [
      `adminToken=${token}`,
      'HttpOnly',
      'Path=/',
      `Max-Age=${18000}`,
      isProduction ? 'Secure' : '',
      'SameSite=Lax',
    ].filter(Boolean);

    if (isProduction && process.env.COOKIE_DOMAIN) {
      cookieParts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
    }

    res.setHeader('Set-Cookie', cookieParts.join('; '));
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    return res.status(500).json({
      error: 'Server error',
      ...(isProduction ? {} : { details: error.message, type: error.name }),
    });
  }
};
