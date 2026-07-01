/**
 * POST /api/admin-ambassador-application-resend-email
 * applications:manage — resend trusted ambassador approval email for an approved application.
 */
import { gateAdminPermission } from './admin-permission-gate-http.js';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import nodePath from 'path';

const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
const requireFromRoot = createRequire(import.meta.url);
const { sendAmbassadorApplicationApprovalEmail } = requireFromRoot(
  nodePath.join(__dirname, 'ambassador-application-approval-email.cjs')
);

const FORBIDDEN_CLIENT_EMAIL_FIELDS = ['to', 'subject', 'html', 'from', 'emailBody', 'campaignTemplate'];

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {{ parseBody: (req: import('http').IncomingMessage) => Promise<Record<string, unknown>> }} deps
 */
export async function handleAmbassadorApplicationResendEmail(req, res, deps) {
  try {
    const authResult = await gateAdminPermission(req, res, 'applications:manage');
    if (!authResult) return;

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({
        error: 'Server configuration error',
        details: 'SUPABASE_SERVICE_ROLE_KEY is required.',
      });
    }

    const bodyData = await deps.parseBody(req);
    for (const field of FORBIDDEN_CLIENT_EMAIL_FIELDS) {
      if (bodyData[field] != null && bodyData[field] !== '') {
        return res.status(400).json({
          error: 'Invalid request',
          details: `Field "${field}" is not accepted. Only applicationId is required.`,
        });
      }
    }

    const applicationId = bodyData.applicationId;
    if (!applicationId || typeof applicationId !== 'string' || !applicationId.trim()) {
      return res.status(400).json({
        error: 'Missing required field',
        details: 'applicationId is required',
      });
    }

    const regeneratePassword =
      bodyData.regeneratePassword === true ||
      bodyData.regeneratePassword === 'true' ||
      bodyData.regeneratePassword === 1;

    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: application, error: loadError } = await db
      .from('ambassador_applications')
      .select('id, status, full_name, phone_number, email, city, ville')
      .eq('id', applicationId.trim())
      .single();

    if (loadError || !application) {
      return res.status(404).json({
        error: 'Application not found',
        details: loadError?.message || `No application found with id: ${applicationId}`,
      });
    }

    try {
      await sendAmbassadorApplicationApprovalEmail({
        db,
        application,
        plainPassword: null,
        req,
        regeneratePassword: regeneratePassword || true,
      });
    } catch (emailErr) {
      const statusCode = emailErr.statusCode || 500;
      if (res.headersSent) return;
      return res.status(statusCode).json({
        error: emailErr.message || 'Failed to send approval email',
        details: emailErr.details || undefined,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('handleAmbassadorApplicationResendEmail:', error);
    if (res.headersSent) return;
    return res.status(500).json({
      error: 'Internal server error',
      details: error?.message || 'unknown error',
    });
  }
}
