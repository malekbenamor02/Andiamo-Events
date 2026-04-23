'use strict';

/**
 * Test-send an investor email via SMTP or Brevo API.
 *
 * Usage:
 *   node scripts/send-brevo-smtp-test.cjs --to you@gmail.com
 *   node scripts/send-brevo-smtp-test.cjs --to you@gmail.com --via api
 *   node scripts/send-brevo-smtp-test.cjs --to you@gmail.com --subject "SMTP test" --from "Andiamo Events <investors@andiamoevents.com>"
 *
 * SMTP mode env required:
 *   EMAIL_HOST (default: smtp-relay.brevo.com)
 *   EMAIL_PORT (default: 587)
 *   EMAIL_USER
 *   EMAIL_PASS (SMTP key, usually starts with xsmtp...)
 *
 * API mode env required:
 *   BREVO_API_KEY_INVESTORS (preferred)
 *   or BREVO_API_KEY
 *
 * Optional env:
 *   EMAIL_SECURE=true|false (default false)
 *   SMTP_TEST_FROM
 *   SMTP_TEST_REPLY_TO
 */

const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const { sendViaBrevoApi } = require('../api/lib/transactional-email.cjs');

dotenv.config({ path: path.join(process.cwd(), '.env') });

function parseArg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const val = process.argv[idx + 1];
  if (!val || val.startsWith('--')) return fallback;
  return String(val).trim();
}

function firstPositionalArg() {
  for (let i = 2; i < process.argv.length; i += 1) {
    const v = String(process.argv[i] || '').trim();
    if (!v) continue;
    if (v.startsWith('--')) {
      i += 1;
      continue;
    }
    if (v.includes('@')) return v;
  }
  return null;
}

function isTruthy(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function printHelpAndExit(code = 0) {
  console.log(
    [
      'Test sender (Brevo SMTP or API).',
      '',
      'Examples:',
      '  node scripts/send-brevo-smtp-test.cjs --to you@gmail.com',
      '  node scripts/send-brevo-smtp-test.cjs --to you@gmail.com --via api',
      '  node scripts/send-brevo-smtp-test.cjs --to you@gmail.com --subject "SMTP verification"',
      '',
      'Options:',
      '  --to        Recipient email (required)',
      '  --via       smtp | api (default: smtp)',
      '  --subject   Optional custom subject',
      '  --from      Optional custom From',
      '  --replyTo   Optional custom Reply-To',
    ].join('\n')
  );
  process.exit(code);
}

function maskSecret(value) {
  const s = String(value || '');
  if (s.length <= 8) return '***';
  return `${s.slice(0, 4)}...${s.slice(-4)}`;
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printHelpAndExit(0);
}

const to = parseArg('to') || firstPositionalArg();
if (!to) {
  console.error('Missing required --to argument.');
  printHelpAndExit(1);
}
const via = (parseArg('via', 'smtp') || 'smtp').toLowerCase();

const host = process.env.EMAIL_HOST || 'smtp-relay.brevo.com';
const port = Number(process.env.EMAIL_PORT || 587);
const secure = isTruthy(process.env.EMAIL_SECURE) || port === 465;
// Investor-first SMTP creds for isolated testing (override with --smtpUser/--smtpPass).
const user = (
  parseArg('smtpUser') ||
  process.env.BREVO_INVESTOR_SMTP_USER ||
  'a8db7a001@smtp-brevo.com' ||
  process.env.EMAIL_USER
).trim();
const pass = (
  parseArg('smtpPass') ||
  process.env.BREVO_INVESTOR_SMTP_PASS ||
  '6gZSvTDPbmdL7fkt' ||
  process.env.EMAIL_PASS
).trim();

if (via === 'smtp' && (!user || !pass)) {
  console.error('Missing SMTP credentials. Set EMAIL_USER and EMAIL_PASS in .env');
  process.exit(1);
}

if (via === 'smtp' && pass.startsWith('xkeysib-')) {
  console.warn(
    'Warning: EMAIL_PASS looks like a Brevo API key (xkeysib). SMTP usually requires an SMTP key (xsmtp...).'
  );
}

const from =
  parseArg('from') ||
  (process.env.SMTP_TEST_FROM || '"Andiamo Events" <investors@andiamoevents.com>').trim();
const replyTo = parseArg('replyTo') || (process.env.SMTP_TEST_REPLY_TO || from).trim();
const subject = parseArg('subject') || 'Brevo SMTP verification test (investor sender)';
const now = new Date().toISOString();

const text = [
  'Hello,',
  '',
  'This is a forced SMTP test email from Andiamo Events.',
  `Timestamp: ${now}`,
  '',
  'If you received this, SMTP path works.',
].join('\n');

const html = `
<p>Hello,</p>
<p>This is a <strong>forced SMTP test</strong> email from Andiamo Events.</p>
<p><strong>Timestamp:</strong> ${now}</p>
<p>If you received this, SMTP path works.</p>
`;

async function main() {
  if (via === 'api') {
    const investorKey = (process.env.BREVO_API_KEY_INVESTORS || '').trim();
    const defaultKey = (process.env.BREVO_API_KEY || '').trim();
    const explicitKey = (parseArg('apiKey') || '').trim();
    const apiKey = explicitKey || investorKey || defaultKey;
    if (!apiKey) {
      console.error('Missing BREVO_API_KEY_INVESTORS (or BREVO_API_KEY) for --via api mode.');
      process.exit(1);
    }
    const keySource = explicitKey ? 'cli --apiKey' : investorKey ? 'BREVO_API_KEY_INVESTORS' : 'BREVO_API_KEY';
    console.log(`[api] using key source: ${keySource} (${maskSecret(apiKey)})`);
    const apiRes = await sendViaBrevoApi(
      {
        from,
        replyTo,
        to,
        subject,
        text,
        html,
        suppressListUnsubscribe: true,
      },
      apiKey
    );
    console.log('API send OK');
    console.log(`Message ID: ${apiRes && apiRes.messageId ? apiRes.messageId : 'n/a'}`);
    return;
  }

  if (via !== 'smtp') {
    console.error(`Unsupported --via value: ${via}. Use "smtp" or "api".`);
    process.exit(1);
  }

  console.log(`[smtp] host=${host}:${port} secure=${secure ? 'true' : 'false'} user=${user}`);
  if (!/smtp-brevo\.com$/i.test(user)) {
    console.warn('[smtp] warning: SMTP login does not look like a Brevo SMTP user.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from,
    replyTo,
    to,
    subject,
    text,
    html,
    headers: {
      // Disable Brevo tracking explicitly on SMTP path
      'X-Sib-TrackOpens': '0',
      'X-Sib-TrackClicks': '0',
    },
  });

  console.log('SMTP send OK');
  console.log(`Message ID: ${info.messageId || 'n/a'}`);
  console.log(`Accepted: ${JSON.stringify(info.accepted || [])}`);
  console.log(`Rejected: ${JSON.stringify(info.rejected || [])}`);
  if (info.response) console.log(`Response: ${info.response}`);
}

main().catch((err) => {
  console.error('SMTP send failed:', err && err.message ? err.message : err);
  process.exit(1);
});

