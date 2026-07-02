/**
 * Display helpers for order activity logs (admin Order Details).
 */

export type OrderActivityLanguage = 'en' | 'fr';

export interface AdminReassignedLogDetails {
  old_ambassador_name?: string | null;
  new_ambassador_name?: string | null;
  reason?: string | null;
  admin_name?: string | null;
  notify_ambassador?: boolean;
  notify_customer?: boolean;
  notification_status?:
    | 'pending'
    | 'skipped'
    | 'sent'
    | 'partial_failed'
    | 'failed'
    | 'completed'
    | 'partial'
    | 'unknown'
    | string;
  ambassador_email_sent?: boolean | null;
  ambassador_sms_sent?: boolean | null;
  ambassador_email_error?: string | null;
  ambassador_sms_error?: string | null;
  customer_email_sent?: boolean | null;
  customer_sms_sent?: boolean | null;
  customer_email_error?: string | null;
  customer_sms_error?: string | null;
  customer_email_skipped_reason?: string | null;
  customer_sms_skipped_reason?: string | null;
  // Legacy ambassador-only fields
  email_sent?: boolean | null;
  sms_sent?: boolean | null;
  email_error?: string | null;
  sms_error?: string | null;
}

export function formatOrderActivityDateTime(
  iso: string | undefined | null,
  language: OrderActivityLanguage
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const time = d.toLocaleTimeString(language === 'en' ? 'en-GB' : 'fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day}/${month}/${year} ${time}`;
}

function formatChannelResult(
  details: AdminReassignedLogDetails,
  language: OrderActivityLanguage,
  channel: 'ambassador' | 'customer'
): string {
  const en = language === 'en';
  const notifyKey = channel === 'ambassador' ? 'notify_ambassador' : 'notify_customer';
  const emailSentKey = channel === 'ambassador' ? 'ambassador_email_sent' : 'customer_email_sent';
  const smsSentKey = channel === 'ambassador' ? 'ambassador_sms_sent' : 'customer_sms_sent';
  const emailSkippedKey =
    channel === 'ambassador' ? undefined : 'customer_email_skipped_reason';
  const smsSkippedKey = channel === 'ambassador' ? undefined : 'customer_sms_skipped_reason';

  if (details[notifyKey] === false) {
    return en ? 'Notifications skipped' : 'Notifications ignorées';
  }

  const emailSent =
    details[emailSentKey] === true ||
    (channel === 'ambassador' && details.email_sent === true);
  const smsSent =
    details[smsSentKey] === true || (channel === 'ambassador' && details.sms_sent === true);
  const emailSkipped = emailSkippedKey ? details[emailSkippedKey] : null;
  const smsSkipped = smsSkippedKey ? details[smsSkippedKey] : null;

  if (emailSkipped === 'no_email') {
    if (smsSent) {
      return en ? 'Email skipped (no address), SMS sent' : 'Email ignoré (pas d’adresse), SMS envoyé';
    }
    return en ? 'Email skipped (no address)' : 'Email ignoré (pas d’adresse)';
  }
  if (smsSkipped === 'no_phone') {
    if (emailSent) {
      return en ? 'SMS skipped (no phone), email sent' : 'SMS ignoré (pas de téléphone), email envoyé';
    }
    return en ? 'SMS skipped (no phone)' : 'SMS ignoré (pas de téléphone)';
  }

  if (details.notification_status === 'pending') {
    return en ? 'Notification pending' : 'Notification en attente';
  }

  if (emailSent && smsSent) {
    return channel === 'customer'
      ? en
        ? 'Customer notified by email and SMS with updated ambassador contact'
        : 'Client notifié par email et SMS avec le nouveau contact ambassadeur'
      : en
        ? 'New ambassador notified by email and SMS'
        : 'Nouvel ambassadeur notifié par email et SMS';
  }
  if (emailSent && !smsSent) {
    return en ? 'Email sent, SMS failed' : 'Email envoyé, SMS échoué';
  }
  if (!emailSent && smsSent) {
    return en ? 'SMS sent, email failed' : 'SMS envoyé, email échoué';
  }
  return en ? 'Notification failed' : 'Échec des notifications';
}

export function formatAdminReassignedAmbassadorNotificationResult(
  details: AdminReassignedLogDetails | null | undefined,
  language: OrderActivityLanguage
): string {
  if (!details) return '—';
  const en = language === 'en';
  const label = en ? 'New ambassador notification' : 'Notification nouvel ambassadeur';
  return `${label}: ${formatChannelResult(details, language, 'ambassador')}`;
}

export function formatAdminReassignedCustomerNotificationResult(
  details: AdminReassignedLogDetails | null | undefined,
  language: OrderActivityLanguage
): string {
  if (!details) return '—';
  const en = language === 'en';
  const label = en ? 'Customer notification' : 'Notification client';
  return `${label}: ${formatChannelResult(details, language, 'customer')}`;
}

/** @deprecated Use formatAdminReassignedAmbassadorNotificationResult */
export function formatAdminReassignedNotificationResult(
  details: AdminReassignedLogDetails | null | undefined,
  language: OrderActivityLanguage
): string {
  return formatAdminReassignedAmbassadorNotificationResult(details, language);
}

export function canShowChangeAmbassadorAction(order: {
  payment_method?: unknown;
  source?: unknown;
  status?: unknown;
}): boolean {
  const paymentMethod = String(order.payment_method ?? '');
  const source = String(order.source ?? '');
  const status = String(order.status ?? '');
  const isCod =
    paymentMethod === 'ambassador_cash' &&
    (source === 'platform_cod' || source === 'ambassador_manual');
  return isCod && (status === 'PENDING_CASH' || status === 'PENDING_ADMIN_APPROVAL');
}
