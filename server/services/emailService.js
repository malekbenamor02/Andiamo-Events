/**
 * Email service
 * Business logic for email operations
 */

const { getEmailTransporter, isEmailConfigured, validateEmail: validateEmailFormat } = require('../utils/email');
const { getSupabase, getSupabaseService } = require('../utils/supabase');

/**
 * Send email
 */
async function sendEmail(to, subject, html) {
  if (!isEmailConfigured()) {
    throw new Error('Email service not configured');
  }

  if (!validateEmailFormat(to)) {
    throw new Error(`Invalid email address: ${to}`);
  }

  const transporter = getEmailTransporter();
  
  if (!transporter) {
    throw new Error('Email transporter not initialized');
  }

  await transporter.sendMail({
    from: `Andiamo Events <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });

  return { success: true };
}

/**
 * Create email delivery log
 */
async function createEmailLog(logData) {
  const supabase = getSupabaseService();
  
  if (!supabase) {
    return null; // Don't fail if logging fails
  }

  try {
    const { data, error } = await supabase
      .from('email_delivery_logs')
      .insert(logData)
      .select()
      .single();

    if (error) {
      console.error('Error creating email log:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error creating email log (exception):', error);
    return null;
  }
}

/**
 * Update email log status
 */
async function updateEmailLogStatus(logId, status, errorMessage = null) {
  const supabase = getSupabaseService();
  
  if (!supabase || !logId) {
    return;
  }

  try {
    const updateData = {
      status,
      ...(status === 'sent' && { sent_at: new Date().toISOString() }),
      ...(status === 'failed' && errorMessage && { error_message: errorMessage })
    };

    await supabase
      .from('email_delivery_logs')
      .update(updateData)
      .eq('id', logId);
  } catch (error) {
    console.error('Error updating email log:', error);
  }
}

module.exports = {
  sendEmail,
  createEmailLog,
  updateEmailLogStatus
};

