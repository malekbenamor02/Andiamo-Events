/**
 * Career / recruitment API routes.
 * Register with: registerCareerRoutes(app, { supabase, supabaseService, requireAdminAuth, careerApplicationLimiter, getEmailTransporter })
 */
const ExcelJS = require('exceljs');

const CAREER_SETTINGS_KEY = 'career_applications_settings';

function isLocalHostRequest(req) {
  try {
    const headers = (req && req.headers) || {};

    // 1) Check Host header (when API itself is running on localhost)
    const hostHeader = headers['x-forwarded-host'] || headers.host || '';
    const host = String(hostHeader).toLowerCase();
    const hostLooksLocal =
      host &&
      (host.startsWith('localhost') ||
        host.startsWith('127.0.0.1') ||
        host.endsWith('.local'));

    if (hostLooksLocal) return true;

    // 2) If API is on production but frontend is localhost,
    //    Origin / Referer will still contain localhost.
    const origin = String(headers.origin || '').toLowerCase();
    const referer = String(headers.referer || '').toLowerCase();
    const fromLocalFrontend = (value) =>
      value &&
      (value.startsWith('http://localhost') ||
        value.startsWith('https://localhost') ||
        value.includes('127.0.0.1') ||
        value.endsWith('.local/'));

    if (fromLocalFrontend(origin) || fromLocalFrontend(referer)) return true;

    return false;
  } catch {
    return false;
  }
}

// Same template structure and CSS as QR/ticket and ambassador emails in server.cjs (buildTicketEmailHtml / buildOrderConfirmationEmailHtml)
function getBaseEmailHtml(title, subtitle, greeting, message) {
  const supportUrl = process.env.VITE_API_URL || process.env.API_URL || 'https://www.andiamoevents.com';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1A1A1A;
      background: #FFFFFF;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    @media (prefers-color-scheme: dark) {
      body { color: #FFFFFF; background: #1A1A1A; }
    }
    a { color: #E21836 !important; text-decoration: none; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
    @media (prefers-color-scheme: dark) { .email-wrapper { background: #1A1A1A; } }
    .content-card {
      background: #F5F5F5;
      margin: 0 20px 30px;
      border-radius: 12px;
      padding: 50px 40px;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }
    @media (prefers-color-scheme: dark) {
      .content-card { background: #1F1F1F; border: 1px solid rgba(42, 42, 42, 0.5); }
    }
    .title-section {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }
    @media (prefers-color-scheme: dark) {
      .title-section { border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
    }
    .title {
      font-size: 32px;
      font-weight: 700;
      color: #1A1A1A;
      margin-bottom: 12px;
      letter-spacing: -0.5px;
    }
    @media (prefers-color-scheme: dark) { .title { color: #FFFFFF; } }
    .subtitle { font-size: 16px; color: #666666; font-weight: 400; }
    @media (prefers-color-scheme: dark) { .subtitle { color: #B0B0B0; } }
    .greeting {
      font-size: 18px;
      color: #1A1A1A;
      margin-bottom: 30px;
      line-height: 1.7;
    }
    @media (prefers-color-scheme: dark) { .greeting { color: #FFFFFF; } }
    .greeting strong { color: #E21836; font-weight: 600; }
    .message { font-size: 16px; color: #666666; margin-bottom: 25px; line-height: 1.7; }
    @media (prefers-color-scheme: dark) { .message { color: #B0B0B0; } }
    .support-section {
      background: #E8E8E8;
      border-left: 3px solid rgba(226, 24, 54, 0.3);
      padding: 20px 25px;
      margin: 35px 0;
      border-radius: 4px;
    }
    @media (prefers-color-scheme: dark) { .support-section { background: #252525; } }
    .support-text { font-size: 14px; color: #666666; line-height: 1.7; }
    @media (prefers-color-scheme: dark) { .support-text { color: #B0B0B0; } }
    .support-email { color: #E21836 !important; text-decoration: none; font-weight: 500; }
    .closing-section {
      text-align: center;
      margin: 50px 0 40px;
      padding-top: 40px;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }
    @media (prefers-color-scheme: dark) {
      .closing-section { border-top: 1px solid rgba(255, 255, 255, 0.1); }
    }
    .slogan {
      font-size: 24px;
      font-style: italic;
      color: #E21836;
      font-weight: 300;
      letter-spacing: 1px;
      margin-bottom: 30px;
    }
    .signature { font-size: 16px; color: #666666; line-height: 1.7; }
    @media (prefers-color-scheme: dark) { .signature { color: #B0B0B0; } }
    .footer {
      margin-top: 50px;
      padding: 40px 20px 30px;
      text-align: center;
      border-top: 1px solid rgba(0, 0, 0, 0.1);
    }
    @media (prefers-color-scheme: dark) {
      .footer { border-top: 1px solid rgba(255, 255, 255, 0.05); }
    }
    .footer-text { font-size: 12px; color: #999999; margin-bottom: 20px; line-height: 1.6; }
    @media (prefers-color-scheme: dark) { .footer-text { color: #6B6B6B; } }
    .footer-links { margin: 15px auto 0; text-align: center; }
    .footer-link { color: #999999; text-decoration: none; font-size: 13px; margin: 0 8px; }
    @media (prefers-color-scheme: dark) { .footer-link { color: #6B6B6B; } }
    .footer-link:hover { color: #E21836 !important; }
    @media only screen and (max-width: 600px) {
      .content-card { margin: 0 15px 20px; padding: 35px 25px; }
      .title { font-size: 26px; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <h1 class="title">${title}</h1>
        <p class="subtitle">${subtitle}</p>
      </div>
      <p class="greeting">${greeting}</p>
      <p class="message">${message}</p>
      <div class="support-section">
        <p class="support-text">
          Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a> or visit <a href="${supportUrl}/contact" class="support-email">our support page</a>.
        </p>
      </div>
      <div class="closing-section">
        <p class="slogan">We Create Memories</p>
        <p class="signature">
          Best regards,<br>
          The Andiamo Events Team
        </p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
      <div class="footer-links">
        <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
        <span style="color: #999999;">&bull;</span>
        <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildCareerConfirmationEmail(candidateName, domainName, toEmail) {
  const title = 'Application received – Andiamo Events';
  const subtitle = 'Careers';
  const greeting = `Hi <strong>${escapeHtml(candidateName)}</strong>,`;
  const message = `We have received your application for <strong>${escapeHtml(domainName)}</strong>. We will review it and get back to you soon.`;
  return {
    from: '"Andiamo Events" <contact@andiamoevents.com>',
    to: toEmail,
    subject: `We received your application – ${escapeHtml(domainName)} – Andiamo Events`,
    html: getBaseEmailHtml(title, subtitle, greeting, message),
  };
}

function buildCareerApprovalEmail(candidateName, domainName, toEmail) {
  const title = 'Your application has been approved';
  const subtitle = 'Andiamo Events';
  const greeting = `Hi <strong>${escapeHtml(candidateName)}</strong>,`;
  const message = `Great news! Your application for <strong>${escapeHtml(domainName)}</strong> has been approved. We will contact you shortly to discuss the next steps.`;
  return {
    from: '"Andiamo Events" <contact@andiamoevents.com>',
    to: toEmail,
    subject: 'Your application has been approved – Andiamo Events',
    html: getBaseEmailHtml(title, subtitle, greeting, message),
  };
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CAREER_CITY_OPTIONS_KEY = 'career_city_options';
const CAREER_GENDER_OPTIONS_KEY = 'career_gender_options';

async function getCareerSettingsEnabled(supabase) {
  const { data } = await supabase
    .from('site_content')
    .select('content')
    .eq('key', CAREER_SETTINGS_KEY)
    .maybeSingle();
  const content = data?.content || {};
  return content.enabled !== false;
}

async function getCareerCityOptions(supabase) {
  const { data } = await supabase
    .from('site_content')
    .select('content')
    .eq('key', CAREER_CITY_OPTIONS_KEY)
    .maybeSingle();
  const content = data?.content || {};
  const options = Array.isArray(content.options) ? content.options : [];
  const disabledOptions = Array.isArray(content.disabledOptions) ? content.disabledOptions : [];
  return { options, disabledOptions };
}

function isCityField(f) {
  if (!f || f.field_type !== 'select') return false;
  const key = (f.field_key || '').toLowerCase();
  const label = (f.label || '').toLowerCase();
  return key === 'city' || key === 'ville' || label === 'city' || label === 'ville';
}

function injectCityOptionsIntoFields(fields, cityData) {
  if (!cityData || !Array.isArray(fields)) return fields;
  const enabled = (cityData.options || []).filter((o) => !(cityData.disabledOptions || []).includes(o));
  return fields.map((f) => {
    if (isCityField(f)) return { ...f, options: enabled };
    return f;
  });
}

async function getCareerGenderOptions(supabase) {
  const { data } = await supabase
    .from('site_content')
    .select('content')
    .eq('key', CAREER_GENDER_OPTIONS_KEY)
    .maybeSingle();
  const content = data?.content || {};
  const options = Array.isArray(content.options) ? content.options : [];
  const disabledOptions = Array.isArray(content.disabledOptions) ? content.disabledOptions : [];
  return { options, disabledOptions };
}

function isGenderField(f) {
  if (!f || f.field_type !== 'select') return false;
  const key = (f.field_key || '').toLowerCase();
  const label = (f.label || '').toLowerCase();
  return key === 'gender' || key === 'genre' || label === 'gender' || label === 'genre';
}

function injectGenderOptionsIntoFields(fields, genderData) {
  if (!genderData || !Array.isArray(fields)) return fields;
  const enabled = (genderData.options || []).filter((o) => !(genderData.disabledOptions || []).includes(o));
  return fields.map((f) => {
    if (isGenderField(f)) return { ...f, options: enabled };
    return f;
  });
}

function validateFormData(fields, formData) {
  const errors = [];
  const validation = (f) => (f.validation && typeof f.validation === 'object' ? f.validation : {});
  for (const f of fields) {
    const val = formData[f.field_key];
    const str = val != null ? String(val).trim() : '';
    if (f.required && !str) {
      errors.push({ field: f.field_key, message: `${f.label} is required` });
      continue;
    }
    if (!str && !f.required) continue;
    switch (f.field_type) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) errors.push({ field: f.field_key, message: 'Invalid email' });
        break;
      case 'number':
        if (isNaN(Number(str))) errors.push({ field: f.field_key, message: 'Must be a number' });
        break;
      case 'age': {
        const n = Number(str);
        if (isNaN(n)) { errors.push({ field: f.field_key, message: 'Must be a number' }); break; }
        const v = validation(f);
        if (typeof v.min === 'number' && n < v.min) errors.push({ field: f.field_key, message: `Minimum age is ${v.min}` });
        if (typeof v.max === 'number' && n > v.max) errors.push({ field: f.field_key, message: `Maximum age is ${v.max}` });
        break;
      }
      case 'link':
        if (!/^https?:\/\/.+/.test(str)) errors.push({ field: f.field_key, message: 'Must be a valid URL' });
        break;
      case 'phone': {
        const digits = str.replace(/\D/g, '');
        if (!/^[2549]\d{7}$/.test(digits)) {
          errors.push({ field: f.field_key, message: 'Phone number must be 8 digits starting with 2, 5, 4, or 9' });
        }
        break;
      }
      case 'select':
        if (f.options && Array.isArray(f.options) && !f.options.includes(str)) {
          errors.push({ field: f.field_key, message: 'Invalid option' });
        }
        break;
      default:
        break;
    }
  }
  return errors;
}

function sanitizeFormData(fields, formData) {
  const fieldMap = new Map(fields.map((f) => [f.field_key, f]));
  const out = {};
  const keys = new Set(fields.map((f) => f.field_key));
  for (const key of keys) {
    const val = formData[key];
    if (val == null) continue;
    const f = fieldMap.get(key);
    if (f && f.field_type === 'phone' && typeof val === 'string') {
      out[key] = val.trim().replace(/\D/g, '');
    } else if (typeof val === 'string') out[key] = val.trim();
    else if (Array.isArray(val)) out[key] = val;
    else out[key] = val;
  }
  return out;
}

function registerCareerRoutes(app, deps) {
  const {
    supabase,
    supabaseService,
    requireAdminAuth,
    careerApplicationLimiter,
    getEmailTransporter,
  } = deps;

  const db = supabaseService || supabase;

  // —— Public: career page content (Why join us / benefits) ———————————————
  app.get('/api/careers/page-content', async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ error: 'Not configured' });
      const { data, error } = await supabase.from('site_content').select('content').eq('key', 'career_why_join_us').maybeSingle();
      if (error) throw error;
      const content = data?.content || { en: { title: 'Why join us', items: [] }, fr: { title: 'Pourquoi nous rejoindre', items: [] } };
      res.json({ whyJoinUs: content });
    } catch (e) {
      console.error('GET /api/careers/page-content', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Public: list open domains —————————————————————————————————————————
  app.get('/api/careers/domains', async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const enabled = await getCareerSettingsEnabled(supabase);
      if (!enabled && !isLocalHostRequest(req)) return res.json({ domains: [] });
      const { data: domains, error } = await db
        .from('career_domains')
        .select('id, name, slug, description, benefits, job_type, salary, job_details')
        .eq('applications_open', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      res.json({ domains: domains || [] });
    } catch (e) {
      console.error('GET /api/careers/domains', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Public: get domain by slug with fields —————————————————————————————
  app.get('/api/careers/domains/:slug', async (req, res) => {
    try {
      if (!db || !supabase) return res.status(500).json({ error: 'Not configured' });
      const enabled = await getCareerSettingsEnabled(supabase);
      if (!enabled && !isLocalHostRequest(req)) return res.status(404).json({ error: 'Not found' });
      const { data: domain, error: domainError } = await db
        .from('career_domains')
        .select('id, name, slug, description, benefits, job_type, salary, job_details, document_upload_enabled')
        .eq('slug', req.params.slug)
        .eq('applications_open', true)
        .maybeSingle();
      if (domainError || !domain) return res.status(404).json({ error: 'Not found' });
      const { data: fields, error: fieldsError } = await db
        .from('career_application_fields')
        .select('id, field_key, label, field_type, required, sort_order, options, validation, archived_at')
        .eq('career_domain_id', domain.id)
        .order('sort_order', { ascending: true });
      if (fieldsError) throw fieldsError;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(supabase), getCareerGenderOptions(supabase)]);
      let out = injectCityOptionsIntoFields(fields || [], cityData);
      out = injectGenderOptionsIntoFields(out, genderData);
      res.json({ domain, fields: out });
    } catch (e) {
      console.error('GET /api/careers/domains/:slug', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Public: submit application —————————————————————————————————————————
  app.post('/api/career-application', careerApplicationLimiter, async (req, res) => {
    try {
      if (!db || !supabase) return res.status(500).json({ error: 'Not configured' });
      const { domainId, domainSlug, recaptchaToken, ...rawFormData } = req.body || {};

      if (!recaptchaToken) {
        return res.status(400).json({ error: 'reCAPTCHA verification required' });
      }
      if (recaptchaToken !== 'localhost-bypass-token') {
        const secret = process.env.RECAPTCHA_SECRET_KEY;
        if (!secret) return res.status(500).json({ error: 'Server configuration error' });
        const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${secret}&response=${recaptchaToken}`,
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return res.status(400).json({ error: 'reCAPTCHA verification failed', details: verifyData['error-codes'] || [] });
        }
      }

      const enabled = await getCareerSettingsEnabled(supabase);
      if (!enabled && !isLocalHostRequest(req)) {
        return res.status(400).json({ error: 'Career applications are currently closed' });
      }

      let domain;
      if (domainId) {
        const { data: d, error: e } = await db.from('career_domains').select('*').eq('id', domainId).eq('applications_open', true).maybeSingle();
        if (e || !d) return res.status(400).json({ error: 'Invalid or closed domain' });
        domain = d;
      } else if (domainSlug) {
        const { data: d, error: e } = await db.from('career_domains').select('*').eq('slug', domainSlug).eq('applications_open', true).maybeSingle();
        if (e || !d) return res.status(400).json({ error: 'Invalid or closed domain' });
        domain = d;
      } else {
        return res.status(400).json({ error: 'domainId or domainSlug is required' });
      }

      const { data: fields, error: fieldsErr } = await db
        .from('career_application_fields')
        .select('id, field_key, label, field_type, required, sort_order, options, validation, archived_at')
        .eq('career_domain_id', domain.id)
        .order('sort_order', { ascending: true });
      if (fieldsErr) throw fieldsErr;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(supabase), getCareerGenderOptions(supabase)]);
      let fieldList = injectCityOptionsIntoFields(fields || [], cityData);
      fieldList = injectGenderOptionsIntoFields(fieldList, genderData);

      const validationErrors = validateFormData(fieldList, rawFormData);
      if (validationErrors.length) {
        return res.status(400).json({ error: 'Validation failed', details: validationErrors });
      }

      const formData = sanitizeFormData(fieldList, rawFormData);

      // Duplicate detection: one email and one phone per job (derive from field definitions)
      const emailField = fieldList.find((f) => f.field_type === 'email');
      const phoneField = fieldList.find((f) => f.field_type === 'phone');
      const emailVal = (emailField && formData[emailField.field_key]) || formData.email || formData.email_address || null;
      const phoneVal = (phoneField && formData[phoneField.field_key]) || formData.phone || formData.phone_number || null;

      const safeJsonKey = (k) => String(k).replace(/[^a-zA-Z0-9_]/g, '');
      if (emailVal) {
        const emailKey = emailField ? safeJsonKey(emailField.field_key) : null;
        const { data: byEmail } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>email', emailVal).limit(1).maybeSingle();
        const { data: byEmailKey } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>email_address', emailVal).limit(1).maybeSingle();
        let byEmailCustom = null;
        if (emailKey && emailKey !== 'email' && emailKey !== 'email_address') {
          const { data } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>' + emailKey, emailVal).limit(1).maybeSingle();
          byEmailCustom = data;
        }
        if (byEmail || byEmailKey || byEmailCustom) return res.status(400).json({ error: 'An application with this email already exists for this position.' });
      }
      if (phoneVal) {
        const phoneKey = phoneField ? safeJsonKey(phoneField.field_key) : null;
        const { data: byPhone } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>phone', phoneVal).limit(1).maybeSingle();
        const { data: byPhoneKey } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>phone_number', phoneVal).limit(1).maybeSingle();
        let byPhoneCustom = null;
        if (phoneKey && phoneKey !== 'phone' && phoneKey !== 'phone_number') {
          const { data } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>' + phoneKey, phoneVal).limit(1).maybeSingle();
          byPhoneCustom = data;
        }
        if (byPhone || byPhoneKey || byPhoneCustom) return res.status(400).json({ error: 'An application with this phone number already exists for this position.' });
      }

      const { data: inserted, error: insertErr } = await db
        .from('career_applications')
        .insert({
          career_domain_id: domain.id,
          form_data: formData,
          status: 'new',
          ip_address: req.ip || req.connection?.remoteAddress || null,
          user_agent: req.get('user-agent') || null,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;

      // Send personalized confirmation email (plan §6.1: same design as ambassador emails)
      const toEmail = emailVal || formData.email_address || (emailField && formData[emailField.field_key]) || null;
      if (toEmail && getEmailTransporter) {
        const transporter = getEmailTransporter();
        const candidateName = (formData.full_name || formData.name || 'Candidate').split(' ')[0] || 'Candidate';
        const mailOpts = buildCareerConfirmationEmail(candidateName, domain.name, toEmail);
        transporter.sendMail(mailOpts).catch((err) => console.error('Career confirmation email failed:', err));
      }

      res.status(201).json({ id: inserted.id, success: true });
    } catch (e) {
      console.error('POST /api/career-application', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Public: check duplicate email/phone for a job (one per job) ——————————
  app.post('/api/career-application/check-duplicate', careerApplicationLimiter, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { domainSlug, email, phone } = req.body || {};
      if (!domainSlug) return res.status(400).json({ error: 'domainSlug is required' });
      const { data: domain } = await db.from('career_domains').select('id').eq('slug', domainSlug).eq('applications_open', true).maybeSingle();
      if (!domain) return res.status(404).json({ error: 'Domain not found or closed' });
      const { data: fields } = await db.from('career_application_fields').select('field_key, field_type').eq('career_domain_id', domain.id).is('archived_at', null);
      const fieldList = fields || [];
      const emailField = fieldList.find((f) => f.field_type === 'email');
      const phoneField = fieldList.find((f) => f.field_type === 'phone');
      const safeJsonKey = (k) => String(k).replace(/[^a-zA-Z0-9_]/g, '');
      let emailTaken = false;
      let phoneTaken = false;
      const emailVal = typeof email === 'string' && email.trim() ? email.trim() : null;
      const phoneVal = typeof phone === 'string' && phone.trim() ? phone.trim().replace(/\D/g, '') : null;
      if (emailVal) {
        const { data: byEmail } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>email', emailVal).limit(1).maybeSingle();
        const { data: byEmailKey } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>email_address', emailVal).limit(1).maybeSingle();
        let byEmailCustom = null;
        const emailKey = emailField ? safeJsonKey(emailField.field_key) : null;
        if (emailKey && emailKey !== 'email' && emailKey !== 'email_address') {
          const { data } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>' + emailKey, emailVal).limit(1).maybeSingle();
          byEmailCustom = data;
        }
        emailTaken = !!(byEmail || byEmailKey || byEmailCustom);
      }
      if (phoneVal) {
        const { data: byPhone } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>phone', phoneVal).limit(1).maybeSingle();
        const { data: byPhoneKey } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>phone_number', phoneVal).limit(1).maybeSingle();
        let byPhoneCustom = null;
        const phoneKey = phoneField ? safeJsonKey(phoneField.field_key) : null;
        if (phoneKey && phoneKey !== 'phone' && phoneKey !== 'phone_number') {
          const { data } = await db.from('career_applications').select('id').eq('career_domain_id', domain.id).eq('form_data->>' + phoneKey, phoneVal).limit(1).maybeSingle();
          byPhoneCustom = data;
        }
        phoneTaken = !!(byPhone || byPhoneKey || byPhoneCustom);
      }
      res.json({ emailTaken, phoneTaken });
    } catch (e) {
      console.error('POST /api/career-application/check-duplicate', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: settings ————————————————————————————————————————————————————
  app.get('/api/admin/careers/settings', requireAdminAuth, async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ error: 'Not configured' });
      const enabled = await getCareerSettingsEnabled(supabase);
      res.json({ settings: { enabled } });
    } catch (e) {
      console.error('GET /api/admin/careers/settings', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.put('/api/admin/careers/settings', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled must be a boolean' });
      await db.from('site_content').upsert({ key: CAREER_SETTINGS_KEY, content: { enabled }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      res.json({ settings: { enabled } });
    } catch (e) {
      console.error('PUT /api/admin/careers/settings', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: domains list with counts ——————————————————————————————————————
  app.get('/api/admin/careers/domains', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { data: domains, error } = await db.from('career_domains').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      const ids = (domains || []).map((d) => d.id);
      const { data: counts } = await db.from('career_applications').select('career_domain_id').in('career_domain_id', ids);
      const countByDomain = (counts || []).reduce((acc, r) => { acc[r.career_domain_id] = (acc[r.career_domain_id] || 0) + 1; return acc; }, {});
      const withCount = (domains || []).map((d) => ({ ...d, applications_count: countByDomain[d.id] || 0 }));
      res.json({ domains: withCount });
    } catch (e) {
      console.error('GET /api/admin/careers/domains', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.post('/api/admin/careers/domains', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { name, description, benefits, job_type, salary, job_details, applications_open, document_upload_enabled, sort_order } = req.body || {};
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'domain';
      const { data: domain, error } = await db.from('career_domains').insert({
        name: name.trim(),
        slug,
        description: description || null,
        benefits: benefits || null,
        job_type: job_type && typeof job_type === 'string' ? job_type.trim() || null : null,
        salary: salary != null && String(salary).trim() !== '' ? String(salary).trim() : null,
        job_details: job_details != null && String(job_details).trim() !== '' ? String(job_details).trim() : null,
        applications_open: applications_open !== false,
        document_upload_enabled: document_upload_enabled === true,
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
      }).select().single();
      if (error) throw error;
      res.status(201).json({ domain });
    } catch (e) {
      console.error('POST /api/admin/careers/domains', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.get('/api/admin/careers/domains/:id', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { data: domain, error: de } = await db.from('career_domains').select('*').eq('id', req.params.id).maybeSingle();
      if (de || !domain) return res.status(404).json({ error: 'Not found' });
      const { data: fields, error: fe } = await db
        .from('career_application_fields')
        .select('*')
        .eq('career_domain_id', req.params.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (fe) throw fe;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(db), getCareerGenderOptions(db)]);
      let out = injectCityOptionsIntoFields(fields || [], cityData);
      out = injectGenderOptionsIntoFields(out, genderData);
      res.json({ domain, fields: out });
    } catch (e) {
      console.error('GET /api/admin/careers/domains/:id', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.put('/api/admin/careers/domains/:id', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { name, slug, description, benefits, job_type, salary, job_details, applications_open, document_upload_enabled, sort_order } = req.body || {};
      const updates = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (slug !== undefined) updates.slug = slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      if (description !== undefined) updates.description = description;
      if (benefits !== undefined) updates.benefits = benefits;
      if (job_type !== undefined) updates.job_type = job_type && String(job_type).trim() !== '' ? String(job_type).trim() : null;
      if (salary !== undefined) updates.salary = salary != null && String(salary).trim() !== '' ? String(salary).trim() : null;
      if (job_details !== undefined) updates.job_details = job_details != null && String(job_details).trim() !== '' ? String(job_details).trim() : null;
      if (typeof applications_open === 'boolean') updates.applications_open = applications_open;
      if (typeof document_upload_enabled === 'boolean') updates.document_upload_enabled = document_upload_enabled;
      if (typeof sort_order === 'number') updates.sort_order = sort_order;
      const { data: domain, error } = await db.from('career_domains').update(updates).eq('id', req.params.id).select().single();
      if (error) throw error;
      res.json({ domain });
    } catch (e) {
      console.error('PUT /api/admin/careers/domains/:id', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.delete('/api/admin/careers/domains/:id', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      // career_applications.career_domain_id has ON DELETE SET NULL: applications are kept, domain_id set to null
      // career_application_fields has ON DELETE CASCADE: domain's form fields are removed
      const { error } = await db.from('career_domains').delete().eq('id', req.params.id);
      if (error) throw error;
      res.status(204).send();
    } catch (e) {
      console.error('DELETE /api/admin/careers/domains/:id', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: form templates ————————————————————————————————————————————————
  app.get('/api/admin/careers/templates', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { data: templates, error } = await db
        .from('career_form_templates')
        .select('id, name, description, created_at');
      if (error) throw error;
      const ids = (templates || []).map((t) => t.id);
      let countsByTemplate = {};
      if (ids.length) {
        const { data: fields } = await db
          .from('career_form_template_fields')
          .select('template_id')
          .in('template_id', ids);
        countsByTemplate = (fields || []).reduce((acc, row) => {
          acc[row.template_id] = (acc[row.template_id] || 0) + 1;
          return acc;
        }, {});
      }
      const withCount = (templates || []).map((t) => ({
        ...t,
        fields_count: countsByTemplate[t.id] || 0,
      }));
      res.json({ templates: withCount });
    } catch (e) {
      console.error('GET /api/admin/careers/templates', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // Create template from an existing domain's fields
  app.post('/api/admin/careers/templates/from-domain', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { domainId, name, description } = req.body || {};
      if (!domainId || !name) return res.status(400).json({ error: 'domainId and name are required' });
      const { data: domain, error: de } = await db.from('career_domains').select('id, name').eq('id', domainId).maybeSingle();
      if (de || !domain) return res.status(400).json({ error: 'Invalid domainId' });
      const { data: fields, error: fe } = await db
        .from('career_application_fields')
        .select('*')
        .eq('career_domain_id', domainId)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (fe) throw fe;
      if (!fields || !fields.length) return res.status(400).json({ error: 'Domain has no fields to save as template' });

      const { data: template, error: te } = await db
        .from('career_form_templates')
        .insert({
          name: String(name).trim(),
          description: description || null,
        })
        .select('*')
        .single();
      if (te) throw te;

      const rows = fields.map((f, idx) => ({
        template_id: template.id,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        required: f.required,
        sort_order: typeof f.sort_order === 'number' ? f.sort_order : idx,
        options: f.options || [],
        validation: f.validation || {},
      }));
      const { error: fe2 } = await db.from('career_form_template_fields').insert(rows);
      if (fe2) throw fe2;

      res.status(201).json({ template: { ...template, fields_count: rows.length } });
    } catch (e) {
      console.error('POST /api/admin/careers/templates/from-domain', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // Apply template to a domain (replace existing fields with template fields)
  app.post('/api/admin/careers/domains/:id/apply-template', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { templateId } = req.body || {};
      if (!templateId) return res.status(400).json({ error: 'templateId is required' });

      const { data: template, error: te } = await db
        .from('career_form_templates')
        .select('id, name')
        .eq('id', templateId)
        .maybeSingle();
      if (te || !template) return res.status(400).json({ error: 'Invalid templateId' });

      const { data: templateFields, error: fe } = await db
        .from('career_form_template_fields')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true });
      if (fe) throw fe;
      if (!templateFields || !templateFields.length) return res.status(400).json({ error: 'Template has no fields' });

      // Replace all existing fields for this domain
      const domainId = req.params.id;
      const { error: delErr } = await db
        .from('career_application_fields')
        .delete()
        .eq('career_domain_id', domainId);
      if (delErr) throw delErr;

      const rows = templateFields.map((f, idx) => ({
        career_domain_id: domainId,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        required: f.required,
        sort_order: typeof f.sort_order === 'number' ? f.sort_order : idx,
        options: f.options || [],
        validation: f.validation || {},
      }));
      const { data: inserted, error: insErr } = await db
        .from('career_application_fields')
        .insert(rows)
        .select('*')
        .order('sort_order', { ascending: true });
      if (insErr) throw insErr;

      res.json({ fields: inserted || [] });
    } catch (e) {
      console.error('POST /api/admin/careers/domains/:id/apply-template', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Public: city options (for career form dropdown) ——————————————————————
  app.get('/api/careers/city-options', async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ error: 'Not configured' });
      const { options, disabledOptions } = await getCareerCityOptions(supabase);
      const enabled = (options || []).filter((o) => !(disabledOptions || []).includes(o));
      res.json({ options: enabled });
    } catch (e) {
      console.error('GET /api/careers/city-options', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: global city options (shared across all jobs) ———————————————————
  app.get('/api/admin/careers/city-options', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const data = await getCareerCityOptions(db);
      res.json(data);
    } catch (e) {
      console.error('GET /api/admin/careers/city-options', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.put('/api/admin/careers/city-options', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { options, disabledOptions } = req.body || {};
      const payload = {};
      if (Array.isArray(options)) payload.options = options;
      if (Array.isArray(disabledOptions)) payload.disabledOptions = disabledOptions;
      const { data: existing } = await db.from('site_content').select('content').eq('key', CAREER_CITY_OPTIONS_KEY).maybeSingle();
      const current = (existing?.content || { options: [], disabledOptions: [] });
      const next = {
        options: payload.options !== undefined ? payload.options : current.options,
        disabledOptions: payload.disabledOptions !== undefined ? payload.disabledOptions : current.disabledOptions,
      };
      await db.from('site_content').upsert({
        key: CAREER_CITY_OPTIONS_KEY,
        content: next,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
      res.json(next);
    } catch (e) {
      console.error('PUT /api/admin/careers/city-options', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Public: gender options (for career form dropdown) ————————————————————
  app.get('/api/careers/gender-options', async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ error: 'Not configured' });
      const { options, disabledOptions } = await getCareerGenderOptions(supabase);
      const enabled = (options || []).filter((o) => !(disabledOptions || []).includes(o));
      res.json({ options: enabled });
    } catch (e) {
      console.error('GET /api/careers/gender-options', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: global gender options (shared across all jobs) ——————————————
  app.get('/api/admin/careers/gender-options', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const data = await getCareerGenderOptions(db);
      res.json(data);
    } catch (e) {
      console.error('GET /api/admin/careers/gender-options', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.put('/api/admin/careers/gender-options', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { options, disabledOptions } = req.body || {};
      const payload = {};
      if (Array.isArray(options)) payload.options = options;
      if (Array.isArray(disabledOptions)) payload.disabledOptions = disabledOptions;
      const { data: existing } = await db.from('site_content').select('content').eq('key', CAREER_GENDER_OPTIONS_KEY).maybeSingle();
      const current = (existing?.content || { options: [], disabledOptions: [] });
      const next = {
        options: payload.options !== undefined ? payload.options : current.options,
        disabledOptions: payload.disabledOptions !== undefined ? payload.disabledOptions : current.disabledOptions,
      };
      await db.from('site_content').upsert({
        key: CAREER_GENDER_OPTIONS_KEY,
        content: next,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
      res.json(next);
    } catch (e) {
      console.error('PUT /api/admin/careers/gender-options', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: fields ———————————————————————————————————————————————————————
  app.get('/api/admin/careers/domains/:id/fields', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { data: fields, error } = await db
        .from('career_application_fields')
        .select('*')
        .eq('career_domain_id', req.params.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(db), getCareerGenderOptions(db)]);
      let out = injectCityOptionsIntoFields(fields || [], cityData);
      out = injectGenderOptionsIntoFields(out, genderData);
      res.json({ fields: out });
    } catch (e) {
      console.error('GET /api/admin/careers/domains/:id/fields', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  function slugFromLabel(label) {
    return String(label || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'field';
  }

  app.post('/api/admin/careers/domains/:id/fields', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { field_key, label, field_type, required, sort_order, options, validation } = req.body || {};
      const key = (field_key && String(field_key).trim()) || slugFromLabel(label);
      if (!key || !label || !field_type) return res.status(400).json({ error: 'label and field_type required' });
      const isCity = isCityField({ field_key: key, label, field_type });
      const isGender = isGenderField({ field_key: key, label, field_type });
      const { data: field, error } = await db.from('career_application_fields').insert({
        career_domain_id: req.params.id,
        field_key: key,
        label: String(label).trim(),
        field_type,
        required: required === true,
        sort_order: typeof sort_order === 'number' ? sort_order : 0,
        options: (isCity || isGender) ? [] : (Array.isArray(options) ? options : []),
        validation: validation && typeof validation === 'object' ? validation : {},
      }).select().single();
      if (error) throw error;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(db), getCareerGenderOptions(db)]);
      let out = injectCityOptionsIntoFields([field], cityData);
      out = injectGenderOptionsIntoFields(out, genderData);
      res.status(201).json({ field: out[0] });
    } catch (e) {
      console.error('POST /api/admin/careers/domains/:id/fields', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.post('/api/admin/careers/domains/:id/fields/bulk', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { fields: fieldsPayload } = req.body || {};
      if (!Array.isArray(fieldsPayload) || fieldsPayload.length === 0) return res.status(400).json({ error: 'fields array required' });
      const domainId = req.params.id;
      const { data: existingFields } = await db
        .from('career_application_fields')
        .select('sort_order, field_key')
        .eq('career_domain_id', domainId);
      const existingKeys = new Set((existingFields || []).map((f) => f.field_key));
      let nextOrder = 0;
      if (existingFields && existingFields.length > 0) {
        const maxOrder = Math.max(...existingFields.map((f) => f.sort_order ?? 0));
        nextOrder = maxOrder + 1;
      }
      const rows = [];
      const seenKeys = new Set(existingKeys);
      for (const item of fieldsPayload) {
        const label = (item.label || item.name || '').trim();
        if (!label) continue;
        let key = (item.field_key || '').trim() || slugFromLabel(label);
        let keySuffix = 1;
        const baseKey = key;
        while (seenKeys.has(key)) {
          key = baseKey.replace(/_(\d+)$/, '') + '_' + keySuffix++;
        }
        seenKeys.add(key);
        const isCity = isCityField({ field_key: key, label, field_type: item.field_type || 'text' });
        const isGender = isGenderField({ field_key: key, label, field_type: item.field_type || 'text' });
        rows.push({
          career_domain_id: req.params.id,
          field_key: key,
          label,
          field_type: item.field_type || 'text',
          required: item.required === true,
          sort_order: nextOrder++,
          options: (isCity || isGender) ? [] : (Array.isArray(item.options) ? item.options : []),
          validation: item.validation && typeof item.validation === 'object' ? item.validation : {},
        });
      }
      if (rows.length === 0) return res.status(400).json({ error: 'No valid fields' });
      const { data: inserted, error } = await db.from('career_application_fields').insert(rows).select();
      if (error) throw error;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(db), getCareerGenderOptions(db)]);
      let out = injectCityOptionsIntoFields(inserted || [], cityData);
      out = injectGenderOptionsIntoFields(out, genderData);
      res.status(201).json({ fields: out });
    } catch (e) {
      console.error('POST /api/admin/careers/domains/:id/fields/bulk', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.put('/api/admin/careers/domains/:id/fields/reorder', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { order } = req.body || {};
      if (!Array.isArray(order) || order.length === 0) return res.status(400).json({ error: 'order array required (e.g. [{ id, sort_order }])' });
      for (const item of order) {
        if (!item.id || typeof item.sort_order !== 'number') continue;
        await db.from('career_application_fields').update({ sort_order: item.sort_order, updated_at: new Date().toISOString() }).eq('id', item.id).eq('career_domain_id', req.params.id);
      }
      const { data: fields, error } = await db
        .from('career_application_fields')
        .select('*')
        .eq('career_domain_id', req.params.id)
        .is('archived_at', null)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(db), getCareerGenderOptions(db)]);
      let out = injectCityOptionsIntoFields(fields || [], cityData);
      out = injectGenderOptionsIntoFields(out, genderData);
      res.json({ fields: out });
    } catch (e) {
      console.error('PUT /api/admin/careers/domains/:id/fields/reorder', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.put('/api/admin/careers/domains/:domainId/fields/:fieldId', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { data: existing } = await db.from('career_application_fields').select('field_key, label, field_type').eq('id', req.params.fieldId).eq('career_domain_id', req.params.domainId).single();
      if (!existing) return res.status(404).json({ error: 'Not found' });
      const { field_key, label, field_type, required, sort_order, options, validation } = req.body || {};
      const updates = { updated_at: new Date().toISOString() };
      if (field_key !== undefined) updates.field_key = field_key;
      if (label !== undefined) updates.label = label;
      if (field_type !== undefined) updates.field_type = field_type;
      if (typeof required === 'boolean') updates.required = required;
      if (typeof sort_order === 'number') updates.sort_order = sort_order;
      const finalKey = field_key !== undefined ? field_key : existing.field_key;
      const finalLabel = label !== undefined ? label : existing.label;
      const finalType = field_type !== undefined ? field_type : existing.field_type;
      const isCity = isCityField({ field_key: finalKey, label: finalLabel, field_type: finalType });
      const isGender = isGenderField({ field_key: finalKey, label: finalLabel, field_type: finalType });
      if (isCity || isGender) updates.options = [];
      else if (Array.isArray(options)) updates.options = options;
      if (validation && typeof validation === 'object') updates.validation = validation;
      const { data: field, error } = await db.from('career_application_fields').update(updates).eq('id', req.params.fieldId).eq('career_domain_id', req.params.domainId).select().single();
      if (error) throw error;
      const [cityData, genderData] = await Promise.all([getCareerCityOptions(db), getCareerGenderOptions(db)]);
      let out = injectCityOptionsIntoFields([field], cityData);
      out = injectGenderOptionsIntoFields(out, genderData);
      res.json({ field: out[0] });
    } catch (e) {
      console.error('PUT /api/admin/careers/domains/:domainId/fields/:fieldId', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.delete('/api/admin/careers/domains/:domainId/fields/:fieldId', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });

      // Soft-delete (archive) the field so existing applications keep showing their data.
      const { data: field, error: fetchErr } = await db
        .from('career_application_fields')
        .select('id, archived_at')
        .eq('id', req.params.fieldId)
        .eq('career_domain_id', req.params.domainId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!field) return res.status(404).json({ error: 'Not found' });

      // If already archived, allow full delete (cleanup), otherwise archive it.
      if (field.archived_at) {
        const { error: delErr } = await db
          .from('career_application_fields')
          .delete()
          .eq('id', req.params.fieldId)
          .eq('career_domain_id', req.params.domainId);
        if (delErr) throw delErr;
        return res.status(204).send();
      }

      const { error: archiveErr } = await db
        .from('career_application_fields')
        .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', req.params.fieldId)
        .eq('career_domain_id', req.params.domainId);
      if (archiveErr) throw archiveErr;

      res.status(204).send();
    } catch (e) {
      console.error('DELETE career field', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: applications list —————————————————————————————————────────————
  app.get('/api/admin/careers/applications', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { domainId, status, from, to, genderKey, gender, ageKey, ageMin, ageMax, cityKey, city, nameKey, name, phoneKey, phone, page = 1, limit = 50 } = req.query;
      const safeKey = (k) => String(k).replace(/[^a-zA-Z0-9_]/g, '');
      const ageMinNum = ageMin != null ? parseInt(ageMin, 10) : null;
      const ageMaxNum = ageMax != null ? parseInt(ageMax, 10) : null;
      const fullRange = ageMinNum === 15 && ageMaxNum === 60;
      const hasAgeFilter = ageKey && (ageMin != null || ageMax != null) && !fullRange;
      const fromIdx = (Number(page) - 1) * Number(limit);
      const limitNum = Number(limit);

      let q = db.from('career_applications').select('*', { count: hasAgeFilter ? undefined : 'exact' });
      if (domainId) q = q.eq('career_domain_id', domainId);
      if (status) q = q.eq('status', status);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      if (genderKey && gender) q = q.eq('form_data->>' + safeKey(genderKey), gender);
      if (cityKey && city) q = q.eq('form_data->>' + safeKey(cityKey), city);
      if (nameKey && name) q = q.ilike('form_data->>' + safeKey(nameKey), '%' + String(name).replace(/%/g, '\\%') + '%');
      if (phoneKey && phone) q = q.ilike('form_data->>' + safeKey(phoneKey), '%' + String(phone).replace(/%/g, '\\%') + '%');
      q = q.order('created_at', { ascending: false });
      if (hasAgeFilter) {
        q = q.range(0, 999);
      } else {
        q = q.range(fromIdx, fromIdx + limitNum - 1);
      }
      let rawApplications, error, count;
      try {
        const result = await q;
        rawApplications = result.data;
        error = result.error;
        count = result.count;
      } catch (fetchErr) {
        const msg = fetchErr && fetchErr.message ? String(fetchErr.message) : '';
        const isNetwork = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg);
        console.error('GET /api/admin/careers/applications – Supabase request failed:', isNetwork ? msg : fetchErr);
        return res.status(isNetwork ? 503 : 500).json({
          error: isNetwork ? 'Database temporarily unavailable. Check your connection and Supabase configuration.' : (msg || 'Server error'),
        });
      }
      if (error) throw error;

      let applications = rawApplications || [];
      if (hasAgeFilter && applications.length > 0) {
        const key = safeKey(ageKey);
        function getAgeValue(formData) {
          if (!formData || typeof formData !== 'object') return null;
          let raw = formData[key];
          if (raw != null && raw !== '') return raw;
          raw = formData.age ?? formData.Age;
          if (raw != null && raw !== '') return raw;
          const ageKeyLower = key.toLowerCase();
          for (const k of Object.keys(formData)) {
            if (k.toLowerCase() === ageKeyLower) return formData[k];
          }
          return null;
        }
        applications = applications.filter((app) => {
          const raw = getAgeValue(app.form_data);
          if (raw == null || raw === '') return false;
          const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
          if (Number.isNaN(num)) return false;
          if (ageMinNum != null && num < ageMinNum) return false;
          if (ageMaxNum != null && num > ageMaxNum) return false;
          return true;
        });
        const total = applications.length;
        applications = applications.slice(fromIdx, fromIdx + limitNum);
        return res.json({ applications, total });
      }

      res.json({ applications, total: count ?? applications.length });
    } catch (e) {
      console.error('GET /api/admin/careers/applications', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: single application + audit log ———————————————————————————————
  app.get('/api/admin/careers/applications/:id', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const adminId = req.admin?.id ? String(req.admin.id) : null;
      const { data: application, error: ae } = await db.from('career_applications').select('*').eq('id', req.params.id).maybeSingle();
      if (ae || !application) return res.status(404).json({ error: 'Not found' });
      const { data: domain } = await db.from('career_domains').select('*').eq('id', application.career_domain_id).single();
      const { data: fields } = await db
        .from('career_application_fields')
        .select('*')
        .eq('career_domain_id', application.career_domain_id)
        .order('sort_order', { ascending: true });
      await db.from('career_application_logs').insert({ career_application_id: req.params.id, admin_id: adminId, action: 'viewed', details: {} });
      const { data: logs } = await db.from('career_application_logs').select('*').eq('career_application_id', req.params.id).order('created_at', { ascending: false }).limit(50);
      const adminIds = [...new Set((logs || []).map((l) => l.admin_id).filter(Boolean))];
      let adminMap = {};
      if (adminIds.length > 0) {
        const { data: admins } = await db.from('admins').select('id, name').in('id', adminIds);
        adminMap = (admins || []).reduce((acc, a) => { acc[a.id] = a.name || a.id; return acc; }, {});
      }
      const logsWithNames = (logs || []).map((l) => ({ ...l, admin_name: l.admin_id ? (adminMap[l.admin_id] ?? null) : null }));
      res.json({ application, domain: domain || null, fields: fields || [], logs: logsWithNames });
    } catch (e) {
      console.error('GET /api/admin/careers/applications/:id', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.patch('/api/admin/careers/applications/:id', requireAdminAuth, async (req, res) => {
    try {
      if (!db || !getEmailTransporter) return res.status(500).json({ error: 'Not configured' });
      const { status } = req.body || {};
      if (!['new', 'approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      const adminId = req.admin?.id ? String(req.admin.id) : null;

      const { data: application, error: fetchErr } = await db.from('career_applications').select('*').eq('id', req.params.id).maybeSingle();
      if (fetchErr || !application) return res.status(404).json({ error: 'Not found' });
      const previousStatus = application.status;

      const updates = { status };
      if (status === 'approved') updates.approved_at = new Date().toISOString();
      const { data: updated, error: updateErr } = await db.from('career_applications').update(updates).eq('id', req.params.id).select().single();
      if (updateErr) throw updateErr;

      await db.from('career_application_logs').insert({
        career_application_id: req.params.id,
        admin_id: adminId,
        action: 'status_updated',
        details: { previousStatus, newStatus: status },
      });

      if (status === 'approved') {
        const { data: domain } = await db.from('career_domains').select('name').eq('id', application.career_domain_id).single();
        const formData = application.form_data || {};
        const toEmail = formData.email || formData.email_address;
        const candidateName = (formData.full_name || formData.name || 'Candidate').split(' ')[0] || 'Candidate';
        const domainName = domain?.name || 'our team';
        if (toEmail) {
          const transporter = getEmailTransporter();
          const mailOpts = buildCareerApprovalEmail(candidateName, domainName, toEmail);
          transporter.sendMail(mailOpts).catch((err) => console.error('Career approval email failed:', err));
        }
      }

      res.json({ application: updated });
    } catch (e) {
      console.error('PATCH /api/admin/careers/applications/:id', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.get('/api/admin/careers/applications/:id/logs', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { data: logs, error } = await db.from('career_application_logs').select('*').eq('career_application_id', req.params.id).order('created_at', { ascending: false });
      if (error) throw error;
      const adminIds = [...new Set((logs || []).map((l) => l.admin_id).filter(Boolean))];
      let adminMap = {};
      if (adminIds.length > 0) {
        const { data: admins } = await db.from('admins').select('id, name').in('id', adminIds);
        adminMap = (admins || []).reduce((acc, a) => { acc[a.id] = a.name || a.id; return acc; }, {});
      }
      const logsWithNames = (logs || []).map((l) => ({ ...l, admin_name: l.admin_id ? (adminMap[l.admin_id] ?? null) : null }));
      res.json({ logs: logsWithNames });
    } catch (e) {
      console.error('GET career application logs', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: compare ———————————————————————————————————————————————————————
  app.get('/api/admin/careers/applications/compare', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const ids = (req.query.ids || '').split(',').filter(Boolean).slice(0, 3);
      if (ids.length < 2) return res.status(400).json({ error: 'ids query must have 2 or 3 application ids' });
      const { data: applications, error } = await db.from('career_applications').select('*').in('id', ids);
      if (error) throw error;
      const domainIds = [...new Set((applications || []).map((a) => a.career_domain_id))];
      const { data: domains } = await db.from('career_domains').select('*').in('id', domainIds);
      const domainMap = (domains || []).reduce((acc, d) => { acc[d.id] = d; return acc; }, {});
      const withDomain = (applications || []).map((a) => ({ ...a, domain: domainMap[a.career_domain_id] }));
      res.json({ applications: withDomain });
    } catch (e) {
      console.error('GET /api/admin/careers/applications/compare', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  // —— Admin: export Excel/CSV —————————————————————————————————────────————
  app.get('/api/admin/careers/applications/export', requireAdminAuth, async (req, res) => {
    try {
      if (!db) return res.status(500).json({ error: 'Not configured' });
      const { domainId, status, from, to, genderKey, gender, ageKey, ageMin, ageMax, cityKey, city, nameKey, name, phoneKey, phone, format = 'xlsx' } = req.query;
      const safeKey = (k) => String(k).replace(/[^a-zA-Z0-9_]/g, '');
      const ageMinNum = ageMin != null ? parseInt(ageMin, 10) : null;
      const ageMaxNum = ageMax != null ? parseInt(ageMax, 10) : null;
      const fullRange = ageMinNum === 15 && ageMaxNum === 60;
      const hasAgeFilter = ageKey && (ageMin != null || ageMax != null) && !fullRange;

      let q = db.from('career_applications').select('*');
      if (domainId) q = q.eq('career_domain_id', domainId);
      if (status) q = q.eq('status', status);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);
      if (genderKey && gender) q = q.eq('form_data->>' + safeKey(genderKey), gender);
      if (cityKey && city) q = q.eq('form_data->>' + safeKey(cityKey), city);
      if (nameKey && name) q = q.ilike('form_data->>' + safeKey(nameKey), '%' + String(name).replace(/%/g, '\\%') + '%');
      if (phoneKey && phone) q = q.ilike('form_data->>' + safeKey(phoneKey), '%' + String(phone).replace(/%/g, '\\%') + '%');
      q = q.order('created_at', { ascending: false });
      let rawApplications, error;
      try {
        const result = await q;
        rawApplications = result.data;
        error = result.error;
      } catch (fetchErr) {
        const msg = fetchErr && fetchErr.message ? String(fetchErr.message) : '';
        const isNetwork = /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET/i.test(msg);
        console.error('GET /api/admin/careers/applications/export – Supabase request failed:', isNetwork ? msg : fetchErr);
        return res.status(isNetwork ? 503 : 500).json({
          error: isNetwork ? 'Database temporarily unavailable. Check your connection and Supabase configuration.' : (msg || 'Server error'),
        });
      }
      if (error) throw error;

      let list = rawApplications || [];
      if (hasAgeFilter && list.length > 0) {
        const key = safeKey(ageKey);
        function getAgeValue(formData) {
          if (!formData || typeof formData !== 'object') return null;
          let raw = formData[key];
          if (raw != null && raw !== '') return raw;
          raw = formData.age ?? formData.Age;
          if (raw != null && raw !== '') return raw;
          const ageKeyLower = key.toLowerCase();
          for (const k of Object.keys(formData)) {
            if (k.toLowerCase() === ageKeyLower) return formData[k];
          }
          return null;
        }
        list = list.filter((app) => {
          const raw = getAgeValue(app.form_data);
          if (raw == null || raw === '') return false;
          const num = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
          if (Number.isNaN(num)) return false;
          if (ageMinNum != null && num < ageMinNum) return false;
          if (ageMaxNum != null && num > ageMaxNum) return false;
          return true;
        });
      }

      const domainIds = [...new Set(list.map((a) => a.career_domain_id))];
      const { data: domains } = await db.from('career_domains').select('id, name').in('id', domainIds);
      const domainMap = (domains || []).reduce((acc, d) => { acc[d.id] = d; return acc; }, {});

      const allKeys = new Set(['id', 'domain', 'status', 'created_at']);
      list.forEach((a) => Object.keys(a.form_data || {}).forEach((k) => allKeys.add(k)));
      const formKeys = [...allKeys].filter((k) => !['id', 'domain', 'status', 'created_at'].includes(k)).sort();
      const headers = ['id', 'domain', 'status', 'created_at', ...formKeys];

      if (format === 'csv') {
        const rows = [headers.join(',')];
        for (const a of list) {
          const row = [
            a.id,
            (domainMap[a.career_domain_id] || {}).name || '',
            a.status,
            a.created_at,
            ...formKeys.map((k) => {
              const v = (a.form_data || {})[k];
              const s = v != null ? String(v).replace(/"/g, '""') : '';
              return `"${s}"`;
            }),
          ];
          rows.push(row.join(','));
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=career-applications.csv');
        return res.send(rows.join('\n'));
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Andiamo Events';
      const sheet = workbook.addWorksheet('Applications', { views: [{ state: 'frozen', ySplit: 1 }] });
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE21836' } };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 24;
      for (let col = 1; col <= headers.length; col++) {
        sheet.getCell(1, col).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
      for (const a of list) {
        const row = sheet.addRow([
          a.id,
          (domainMap[a.career_domain_id] || {}).name || '',
          a.status,
          a.created_at,
          ...formKeys.map((k) => (a.form_data || {})[k] ?? ''),
        ]);
        row.alignment = { vertical: 'middle', wrapText: true };
        for (let col = 1; col <= headers.length; col++) {
          row.getCell(col).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        }
      }
      sheet.columns = [
        { width: 38 },
        { width: 22 },
        { width: 12 },
        { width: 22 },
        ...formKeys.map(() => ({ width: 18 })),
      ];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=career-applications.xlsx');
      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error('GET /api/admin/careers/applications/export', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });
}

module.exports = { registerCareerRoutes };
