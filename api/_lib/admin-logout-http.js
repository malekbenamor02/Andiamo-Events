/**
 * POST /api/admin-logout — clear cookie and invalidate all JWTs for this admin.
 * Bumping session_version logs out every browser/device, not only the current one.
 */
import { verifyAdminSession } from './admin-authorization.mjs';
import { applyClearAdminTokenCookie } from './clear-admin-token-cookie.js';
import { createServiceRoleClient } from './service-role-client.js';

/**
 * Bump session_version for logout — invalidates all JWTs for this admin on all devices.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} adminId
 */
export async function bumpAdminSessionVersionOnLogout(db, adminId) {
  const { data: row, error: loadError } = await db
    .from('admins')
    .select('session_version')
    .eq('id', adminId)
    .single();

  if (loadError || !row) {
    if (loadError) console.error('Admin logout session_version load failed:', loadError);
    return false;
  }

  const nextVersion = (row.session_version ?? 1) + 1;
  const { error: updateError } = await db
    .from('admins')
    .update({
      session_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminId);

  if (updateError) {
    console.error('Admin logout session_version bump failed:', updateError);
    return false;
  }
  return true;
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleAdminLogout(req, res) {
  try {
    const authResult = await verifyAdminSession(req);

    if (authResult.valid && authResult.admin?.id) {
      try {
        const db = await createServiceRoleClient();
        await bumpAdminSessionVersionOnLogout(db, authResult.admin.id);
      } catch (dbErr) {
        console.error('Admin logout DB error:', dbErr);
      }
    }

    applyClearAdminTokenCookie(res);
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully. Please re-enter your credentials to continue.',
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    applyClearAdminTokenCookie(res);
    if (!res.headersSent) {
      const isProduction =
        process.env.NODE_ENV === 'production' ||
        process.env.VERCEL === '1' ||
        !!process.env.VERCEL_URL;
      return res.status(500).json({
        error: 'Server error',
        ...(isProduction ? {} : { details: error.message }),
      });
    }
  }
}
