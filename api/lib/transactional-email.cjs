/**
 * Prefer Brevo REST API when BREVO_API_KEY is set so From stays on the verified
 * domain (e.g. contact@andiamoevents.com). Falls back to nodemailer SMTP.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function parseFrom(from) {
  if (from == null) return { name: '', email: '' };
  if (typeof from === 'object' && from.address) {
    return { name: (from.name || '').trim(), email: String(from.address).trim() };
  }
  const s = String(from).trim();
  const m = s.match(/^(?:"([^"]*)"|([^<]+?))\s*<([^>]+)>$/);
  if (m) {
    return { name: (m[1] || m[2] || '').trim(), email: m[3].trim() };
  }
  if (s.includes('@')) return { name: '', email: s };
  return { name: '', email: s };
}

function normalizeRecipients(to) {
  if (!to) return [];
  if (Array.isArray(to)) {
    return to.flatMap((x) => normalizeRecipients(x));
  }
  if (typeof to === 'object' && to.address) {
    return [{ email: String(to.address).trim(), name: (to.name || '').trim() || undefined }];
  }
  const e = String(to).trim();
  return e ? [{ email: e }] : [];
}

function parseReplyTo(replyTo) {
  if (!replyTo) return null;
  const { name, email } = parseFrom(replyTo);
  if (!email) return null;
  return { name: name || undefined, email };
}

function isBrevoSmtpHost() {
  const h = (process.env.EMAIL_HOST || '').toLowerCase();
  return h.includes('brevo.com') || h.includes('sendinblue.com');
}

function brevoSmtpExtraHeaders() {
  if (!isBrevoSmtpHost()) return {};
  return {
    'X-Sib-TrackOpens': '0',
    'X-Sib-TrackClicks': '0',
  };
}

function attachmentToBrevo(att) {
  const filename = att.filename || att.fileName || att.name || 'attachment';
  let buf;
  if (Buffer.isBuffer(att.content)) buf = att.content;
  else if (typeof att.content === 'string') {
    buf = Buffer.from(att.content, att.encoding === 'base64' ? 'base64' : 'utf8');
  } else {
    return null;
  }
  return { name: filename, content: buf.toString('base64') };
}

function postJson(url, apiKey, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const https = require('https');
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          Accept: 'application/json',
        },
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => {
          chunks += c;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(chunks ? JSON.parse(chunks) : {});
            } catch {
              resolve({});
            }
          } else {
            const err = new Error(`Brevo API ${res.statusCode}: ${chunks || res.statusMessage}`);
            err.statusCode = res.statusCode;
            err.body = chunks;
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function sendViaBrevoApi(mailOptions) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('BREVO_API_KEY not set');

  const { name: fromName, email: fromEmail } = parseFrom(mailOptions.from);
  if (!fromEmail) throw new Error('Invalid from address');

  const to = normalizeRecipients(mailOptions.to);
  if (!to.length) throw new Error('No recipients');

  const customHeaders =
    mailOptions.headers && typeof mailOptions.headers === 'object' && !Array.isArray(mailOptions.headers)
      ? mailOptions.headers
      : {};
  const body = {
    sender: { name: fromName || 'Andiamo Events', email: fromEmail },
    to,
    subject: mailOptions.subject || '',
    headers: {
      ...customHeaders,
      'X-Sib-TrackOpens': '0',
      'X-Sib-TrackClicks': '0',
    },
  };

  if (mailOptions.html) body.htmlContent = mailOptions.html;
  if (mailOptions.text) body.textContent = mailOptions.text;

  const rt = parseReplyTo(mailOptions.replyTo);
  if (rt) body.replyTo = rt;

  if (Array.isArray(mailOptions.attachments) && mailOptions.attachments.length) {
    const attachment = [];
    for (const att of mailOptions.attachments) {
      const b = attachmentToBrevo(att);
      if (b) attachment.push(b);
    }
    if (attachment.length) body.attachment = attachment;
  }

  return postJson(BREVO_API_URL, apiKey, body);
}

/**
 * @param {{ getEmailTransporter?: () => unknown }} deps
 * @param {object} mailOptions nodemailer-compatible sendMail options
 */
async function sendTransactionalEmail(deps, mailOptions) {
  const apiKey = process.env.BREVO_API_KEY;
  if (apiKey) {
    try {
      const apiRes = await sendViaBrevoApi(mailOptions);
      return { via: 'brevo-api', messageId: apiRes.messageId };
    } catch (e) {
      console.error('[transactional-email] Brevo API failed, using SMTP:', e.message || e);
    }
  }

  const getT = deps && deps.getEmailTransporter;
  if (typeof getT !== 'function') {
    throw new Error('getEmailTransporter is required when Brevo API is unavailable');
  }
  const transporter = getT();
  if (!transporter || typeof transporter.sendMail !== 'function') {
    throw new Error('Email transporter not available');
  }

  const extra = brevoSmtpExtraHeaders();
  const merged = {
    ...mailOptions,
    headers: {
      ...extra,
      ...(mailOptions.headers || {}),
    },
  };
  const info = await transporter.sendMail(merged);
  return { via: 'smtp', info, messageId: info && info.messageId };
}

module.exports = {
  sendTransactionalEmail,
  sendViaBrevoApi,
  brevoSmtpExtraHeaders,
  isBrevoSmtpHost,
};
