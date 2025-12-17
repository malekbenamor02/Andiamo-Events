// Email configuration and templates for ambassador notifications
import { API_ROUTES } from './api-routes';
import { handleApiResponse } from './api-client';
import { buildUrlWithParams, sanitizeUrl } from './url-validator';
import { EMAIL_LOGOS } from './email-assets';

interface EmailConfig {
  from: string;
  to: string;
  subject: string;
  html: string;
}

interface AmbassadorData {
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  password?: string;
}

// Email templates
export const createApprovalEmail = (ambassador: AmbassadorData, loginUrl: string, ambassadorId?: string): EmailConfig => {
  const subject = "Welcome to Andiamo Events";
  
  // Get base URL for tracking (logos are now embedded as base64)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.andiamoevents.com';
  const logoBlackUrl = EMAIL_LOGOS.logoBlack;
  const logoWhiteUrl = EMAIL_LOGOS.logoWhite;
  
  // Create tracking pixel URL (only if ambassadorId is valid)
  let trackingPixel = '';
  if (ambassadorId && typeof ambassadorId === 'string' && ambassadorId.trim().length > 0) {
    if (origin) {
      const trackingUrl = buildUrlWithParams(`${origin}/api/track-email`, {
        ambassador_id: ambassadorId,
        email_type: 'approval'
      });
      if (trackingUrl) {
        trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" />`;
      }
    }
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark light">
      <meta name="supported-color-schemes" content="dark light">
      <title>Welcome to Andiamo Events</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Saira:wght@100..900&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-optical-sizing: auto;
          font-style: normal; 
          line-height: 1.6; 
          color: #000000; 
          background: #ffffff;
          padding: 0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        @media (prefers-color-scheme: dark) {
          body {
            background: #1a1a1a;
            color: #ffffff;
          }
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
        }
        @media (prefers-color-scheme: dark) {
          .email-wrapper {
            background: #1a1a1a;
          }
        }
        .logo-container {
          padding: 50px 40px 30px;
          text-align: center;
        }
        .logo {
          max-width: 200px;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        .logo-dark {
          display: block;
        }
        @media (prefers-color-scheme: dark) {
          .logo-dark {
            display: none;
          }
        }
        .logo-light {
          display: none;
        }
        @media (prefers-color-scheme: dark) {
          .logo-light {
            display: block;
          }
        }
        .content {
          padding: 0 40px 50px;
        }
        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #000000;
          margin-bottom: 35px;
          letter-spacing: -0.5px;
        }
        @media (prefers-color-scheme: dark) {
          h1 {
            color: #ffffff;
          }
        }
        .greeting {
          font-size: 16px;
          color: #000000;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .greeting {
            color: #ffffff;
          }
        }
        .greeting strong {
          font-weight: 600;
          color: #000000;
        }
        @media (prefers-color-scheme: dark) {
          .greeting strong {
            color: #ffffff;
          }
        }
        .message-text {
          font-size: 16px;
          color: #333333;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .message-text {
            color: #e0e0e0;
          }
        }
        .credentials-section {
          margin: 40px 0;
          padding: 30px 0;
          border-top: 1px solid #e0e0e0;
          border-bottom: 1px solid #e0e0e0;
        }
        @media (prefers-color-scheme: dark) {
          .credentials-section {
            border-top-color: #333333;
            border-bottom-color: #333333;
          }
        }
        .credential-row {
          margin: 20px 0;
        }
        .credential-label {
          font-size: 12px;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
          font-weight: 600;
        }
        @media (prefers-color-scheme: dark) {
          .credential-label {
            color: #999999;
          }
        }
        .credential-value {
          font-family: 'Courier New', monospace;
          font-size: 16px;
          color: #000000;
          font-weight: 500;
          word-break: break-all;
          letter-spacing: 0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .credential-value {
            color: #ffffff;
          }
        }
        .security-note {
          font-size: 14px;
          color: #666666;
          margin: 35px 0;
          line-height: 1.7;
          font-style: italic;
        }
        @media (prefers-color-scheme: dark) {
          .security-note {
            color: #999999;
          }
        }
        .cta-link {
          display: inline-block;
          color: #000000;
          text-decoration: underline;
          font-weight: 500;
          margin: 30px 0;
        }
        @media (prefers-color-scheme: dark) {
          .cta-link {
            color: #ffffff;
          }
        }
        .signature {
          margin-top: 40px;
          font-size: 16px;
          color: #000000;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .signature {
            color: #ffffff;
          }
        }
        .footer {
          margin-top: 60px;
          padding-top: 40px;
          border-top: 1px solid #e0e0e0;
          text-align: center;
        }
        @media (prefers-color-scheme: dark) {
          .footer {
            border-top-color: #333333;
          }
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin: 8px 0;
          line-height: 1.6;
        }
        .footer-link {
          color: #000000;
          text-decoration: underline;
        }
        @media (prefers-color-scheme: dark) {
          .footer-link {
            color: #ffffff;
          }
        }
        @media only screen and (max-width: 600px) {
          .content {
            padding: 0 25px 40px;
          }
          .logo-container {
            padding: 40px 25px 25px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 30px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="logo-container">
          <img src="${logoBlackUrl}" alt="Andiamo Events" class="logo logo-dark" style="max-width: 200px; height: auto;" />
          <img src="${logoWhiteUrl}" alt="Andiamo Events" class="logo logo-light" style="max-width: 200px; height: auto;" />
        </div>
        
        <div class="content">
          <h1>Approval</h1>
          
          <p class="greeting">Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <p class="message-text">
            We are pleased to inform you that your ambassador application has been accepted.
          </p>
          
          <p class="message-text">
            You are now part of the Andiamo Events community—a curated platform that represents the energy, trust, and cultural essence of Tunisia's premier nightlife experience.
          </p>
          
          <div class="credentials-section">
            <div class="credential-row">
              <div class="credential-label">Phone Number</div>
              <div class="credential-value">${ambassador.phone}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Temporary Password</div>
              <div class="credential-value">${ambassador.password}</div>
            </div>
          </div>
          
          <p class="security-note">
            For your account security, we recommend changing your password after your first login.
          </p>
          
          <p class="message-text">
            <a href="${loginUrl}" class="cta-link">Access Ambassador Dashboard</a>
          </p>
          
          <p class="message-text">
            You are now part of an exclusive community that shapes Tunisia's nightlife landscape. We are committed to supporting your success.
          </p>
          
          <p class="signature">
            Best regards,<br>
            The Andiamo Events Team
          </p>
          
          <div class="footer">
            <p class="footer-text">Developed by Malek Ben Amor</p>
            <p class="footer-text">
              On press, visit <a href="https://www.instagram.com/malek.bamor/" class="footer-link" target="_blank">Instagram</a>
            </p>
          </div>
        </div>
      </div>
      ${trackingPixel}
    </body>
    </html>
  `;

  // Validate that we have an email address
  if (!ambassador.email || !ambassador.email.trim()) {
    throw new Error('Email address is required to send approval email');
  }

  return {
    from: 'Andiamo Events <support@andiamoevents.com>',
    to: ambassador.email,
    subject,
    html
  };
};

export const createRejectionEmail = (ambassador: AmbassadorData): EmailConfig => {
  const subject = "Andiamo Events - Application Update";
  
  // Use embedded base64 logos (no need for origin URL)
  const logoBlackUrl = EMAIL_LOGOS.logoBlack;
  const logoWhiteUrl = EMAIL_LOGOS.logoWhite;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark light">
      <meta name="supported-color-schemes" content="dark light">
      <title>Application Update - Andiamo Events</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Saira:wght@100..900&display=swap" rel="stylesheet">
      <style>
        :root {
          color-scheme: dark light;
          supported-color-schemes: dark light;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-optical-sizing: auto;
          font-style: normal; 
          line-height: 1.6; 
          color: #000000; 
          background: #ffffff;
          padding: 0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        @media (prefers-color-scheme: dark) {
          body {
            background: #1a1a1a;
            color: #ffffff;
          }
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
        }
        @media (prefers-color-scheme: dark) {
          .email-wrapper {
            background: #1a1a1a;
          }
        }
        .logo-container {
          padding: 50px 40px 30px;
          text-align: center;
        }
        .logo {
          max-width: 200px;
          height: auto;
          display: block;
          margin: 0 auto;
        }
        .logo-dark {
          display: block;
        }
        @media (prefers-color-scheme: dark) {
          .logo-dark {
            display: none;
          }
        }
        .logo-light {
          display: none;
        }
        @media (prefers-color-scheme: dark) {
          .logo-light {
            display: block;
          }
        }
        .content {
          padding: 0 40px 50px;
        }
        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #000000;
          margin-bottom: 35px;
          letter-spacing: -0.5px;
        }
        @media (prefers-color-scheme: dark) {
          h1 {
            color: #ffffff;
          }
        }
        .greeting {
          font-size: 16px;
          color: #000000;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .greeting {
            color: #ffffff;
          }
        }
        .greeting strong {
          font-weight: 600;
          color: #000000;
        }
        @media (prefers-color-scheme: dark) {
          .greeting strong {
            color: #ffffff;
          }
        }
        .message-text {
          font-size: 16px;
          color: #333333;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .message-text {
            color: #e0e0e0;
          }
        }
        .section-divider {
          margin: 35px 0;
          padding: 30px 0;
          border-top: 1px solid #e0e0e0;
          border-bottom: 1px solid #e0e0e0;
        }
        @media (prefers-color-scheme: dark) {
          .section-divider {
            border-top-color: #333333;
            border-bottom-color: #333333;
          }
        }
        .signature {
          margin-top: 40px;
          font-size: 16px;
          color: #000000;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .signature {
            color: #ffffff;
          }
        }
        .footer {
          margin-top: 60px;
          padding-top: 40px;
          border-top: 1px solid #e0e0e0;
          text-align: center;
        }
        @media (prefers-color-scheme: dark) {
          .footer {
            border-top-color: #333333;
          }
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin: 8px 0;
          line-height: 1.6;
        }
        .footer-link {
          color: #000000;
          text-decoration: underline;
        }
        @media (prefers-color-scheme: dark) {
          .footer-link {
            color: #ffffff;
          }
        }
        @media only screen and (max-width: 600px) {
          .content {
            padding: 0 25px 40px;
          }
          .logo-container {
            padding: 40px 25px 25px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 30px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="logo-container">
          <img src="${logoBlackUrl}" alt="Andiamo Events" class="logo logo-dark" style="max-width: 200px; height: auto;" />
          <img src="${logoWhiteUrl}" alt="Andiamo Events" class="logo logo-light" style="max-width: 200px; height: auto;" />
        </div>
        
        <div class="content">
          <h1>Application Update</h1>
          
          <p class="greeting">Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <p class="message-text">
            Thank you for your interest in becoming an Andiamo ambassador and for the effort and time you invested in submitting your application.
          </p>
          
          <p class="message-text">
            After careful consideration, we regret to inform you that we are unable to approve your ambassador application at this time. This decision is part of our selective and continuously evolving recruitment process, which considers our current operational needs, regional balance, and capacity requirements—rather than a reflection on your individual qualifications or potential.
          </p>
          
          <p class="message-text">
            We maintain a selective ambassador network to ensure we can provide the best support and resources to each member while maintaining the high standards that define the Andiamo Events experience.
          </p>
          
          <div class="section-divider">
            <p class="message-text" style="margin: 0;">
              You are welcome to submit a new application after a 30-day period. This timeframe allows our ambassador network to evolve and gives us the opportunity to reassess our capacity and needs.
            </p>
          </div>
          
          <p class="message-text">
            We encourage you to stay connected with Andiamo Events and continue experiencing our events as a valued member of our community.
          </p>
          
          <p class="message-text">
            Thank you again for your interest in joining the Andiamo ambassador program. We wish you all the best and hope to continue seeing you as part of our vibrant community.
          </p>
          
          <p class="signature">
            Best regards,<br>
            The Andiamo Events Team
          </p>
          
          <div class="footer">
            <p class="footer-text">Developed by Malek Ben Amor</p>
            <p class="footer-text">
              On press, visit <a href="https://www.instagram.com/malek.bamor/" class="footer-link" target="_blank">Instagram</a>
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from: 'Andiamo Events <support@andiamoevents.com>',
    to: ambassador.email || 'support@andiamoevents.com',
    subject,
    html
  };
};

export const createPasswordResetEmail = (ambassador: AmbassadorData, resetToken: string, resetUrl: string): EmailConfig => {
  const subject = "Password Reset Request";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        
        <div class="content">
          <p>Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <p>We received a request to reset your password for your Andiamo ambassador account.</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}?token=${resetToken}" class="button">Reset Password</a>
          </div>
          
          <div class="warning">
            <p><strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.</p>
            <p>If you didn't request this password reset, please ignore this email.</p>
          </div>
          
          <p>Best regards,<br>
          <strong>The Andiamo Team</strong></p>
        </div>
        
        <div class="footer">
          <p>© 2024 Andiamo Events. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from: 'Andiamo Events <support@andiamoevents.com>',
    to: ambassador.email || 'support@andiamoevents.com',
    subject,
    html
  };
};

// Generate secure password
interface AdminData {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export const createAdminCredentialsEmail = (admin: AdminData, loginUrl: string): EmailConfig => {
  const subject = "Welcome to the Admin Team – Your Login Credentials";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark light">
      <meta name="supported-color-schemes" content="dark light">
      <title>Admin Account - Andiamo Events</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Saira:wght@100..900&display=swap" rel="stylesheet">
      <style>
        :root {
          color-scheme: dark light;
          supported-color-schemes: dark light;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-optical-sizing: auto;
          font-style: normal; 
          line-height: 1.7; 
          color: #e0e0e0; 
          background: linear-gradient(135deg, hsl(218, 23%, 8%) 0%, hsl(218, 23%, 12%) 100%);
          padding: 20px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: hsl(218, 23%, 12%);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(185, 85, 211, 0.1);
        }
        .header {
          background: linear-gradient(135deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 50%, hsl(330, 100%, 65%) 100%);
          padding: 50px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
        }
        .header-content {
          position: relative;
          z-index: 1;
        }
        .logo {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: 3px;
          color: #ffffff;
          margin-bottom: 15px;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(185, 85, 211, 0.3);
        }
        .header h1 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 36px;
          font-weight: 700;
          color: #ffffff;
          margin: 15px 0 10px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        .header-subtitle {
          font-size: 18px;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.95);
          margin-top: 10px;
        }
        .content {
          padding: 40px;
          background: hsl(218, 23%, 12%);
        }
        .greeting {
          font-size: 20px;
          color: #ffffff;
          margin-bottom: 25px;
          font-weight: 500;
        }
        .greeting strong {
          color: hsl(285, 85%, 65%);
          font-weight: 600;
          font-size: 22px;
        }
        .intro-text {
          font-size: 16px;
          color: #d0d0d0;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .credentials-card {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border: 2px solid hsl(285, 85%, 65%, 0.4);
          border-radius: 16px;
          padding: 30px;
          margin: 30px 0;
          box-shadow: 0 0 30px rgba(185, 85, 211, 0.2), inset 0 0 30px rgba(185, 85, 211, 0.05);
          position: relative;
          overflow: hidden;
        }
        .credentials-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 50%, hsl(330, 100%, 65%) 100%);
        }
        .credentials-card h3 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 20px;
          color: hsl(195, 100%, 50%);
          margin-bottom: 25px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-shadow: 0 0 10px rgba(0, 195, 255, 0.3);
        }
        .credential-item {
          margin: 20px 0;
          font-size: 15px;
          color: #e0e0e0;
        }
        .credential-item strong {
          color: #ffffff;
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: hsl(285, 85%, 65%);
        }
        .credential-value {
          background: hsl(218, 23%, 8%);
          padding: 14px 18px;
          border-radius: 10px;
          font-family: 'Courier New', monospace;
          color: hsl(195, 100%, 50%);
          border: 2px solid hsl(195, 100%, 50%, 0.3);
          display: block;
          margin-top: 8px;
          font-size: 16px;
          font-weight: 600;
          word-break: break-all;
          box-shadow: 0 0 15px rgba(0, 195, 255, 0.1);
          text-shadow: 0 0 10px rgba(0, 195, 255, 0.3);
        }
        .copy-hint {
          font-size: 12px;
          color: #888;
          margin-top: 5px;
          font-style: italic;
        }
        .button-container {
          text-align: center;
          margin: 40px 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 100%);
          color: #ffffff;
          padding: 18px 45px;
          text-decoration: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          letter-spacing: 1px;
          box-shadow: 0 6px 25px rgba(185, 85, 211, 0.5), 0 0 40px rgba(0, 195, 255, 0.3);
          text-transform: uppercase;
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          transition: all 0.3s ease;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(185, 85, 211, 0.6), 0 0 50px rgba(0, 195, 255, 0.4);
        }
        .login-info {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-left: 4px solid hsl(195, 100%, 50%);
          border-radius: 12px;
          padding: 20px;
          margin: 30px 0;
          box-shadow: 0 0 20px rgba(0, 195, 255, 0.1);
        }
        .login-info h4 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 16px;
          color: hsl(195, 100%, 50%);
          margin-bottom: 10px;
        }
        .login-info p {
          color: #d0d0d0;
          font-size: 14px;
          line-height: 1.6;
          margin: 5px 0;
        }
        .login-info a {
          color: hsl(285, 85%, 65%);
          text-decoration: none;
          word-break: break-all;
        }
        .security-notice {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-left: 4px solid hsl(330, 100%, 65%);
          border-radius: 12px;
          padding: 20px;
          margin: 30px 0;
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.1);
        }
        .security-notice h3 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 18px;
          color: hsl(330, 100%, 65%);
          margin-bottom: 15px;
        }
        .security-notice p {
          color: #d0d0d0;
          font-size: 14px;
          line-height: 1.6;
        }
        .security-notice ul {
          color: #d0d0d0;
          font-size: 14px;
          line-height: 1.8;
          margin-top: 10px;
          padding-left: 20px;
        }
        .security-notice li {
          margin: 5px 0;
        }
        .closing {
          margin-top: 35px;
          padding-top: 30px;
          border-top: 1px solid hsl(218, 23%, 20%);
          color: #d0d0d0;
          font-size: 15px;
          line-height: 1.8;
        }
        .signature {
          margin-top: 20px;
          color: #ffffff;
          font-weight: 600;
        }
        .signature strong {
          color: hsl(285, 85%, 65%);
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
        }
        .footer {
          background: hsl(218, 23%, 8%);
          padding: 30px 40px;
          text-align: center;
          border-top: 1px solid hsl(218, 23%, 20%);
        }
        .footer-text {
          color: #888;
          font-size: 13px;
          margin: 5px 0;
        }
        .footer-brand {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 16px;
          color: hsl(285, 85%, 65%);
          margin-bottom: 10px;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(185, 85, 211, 0.3);
        }
        @media only screen and (max-width: 600px) {
          .email-wrapper {
            border-radius: 0;
          }
          .header {
            padding: 40px 25px;
          }
          .header h1 {
            font-size: 28px;
          }
          .logo {
            font-size: 24px;
          }
          .content {
            padding: 30px 25px;
          }
          .credentials-card {
            padding: 20px;
          }
          .cta-button {
            padding: 16px 35px;
            font-size: 14px;
          }
        }
      </style>
    </head>
    <body style="background: linear-gradient(135deg, hsl(218, 23%, 8%) 0%, hsl(218, 23%, 12%) 100%) !important; color: #e0e0e0 !important; padding: 20px; margin: 0;">
      <div class="email-wrapper" style="background: hsl(218, 23%, 12%) !important; max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(185, 85, 211, 0.1);">
        <div class="header">
          <div class="header-content">
            <div class="logo">ANDIAMO EVENTS</div>
            <h1>🔐 Admin Account Created</h1>
            <div class="header-subtitle">Your Admin Dashboard Access</div>
          </div>
        </div>
        
        <div class="content" style="background: hsl(218, 23%, 12%) !important; color: #e0e0e0 !important; padding: 40px;">
          <p class="greeting">Hello <strong>${admin.name}</strong>,</p>
          
          <p class="intro-text">
            You have been added as an administrator on the <strong style="color: hsl(285, 85%, 65%);">Andiamo Events</strong> platform by our Super Admin team.
          </p>
          
          <p class="intro-text">
            Your admin account is now ready and you can access the admin dashboard to manage events, ambassadors, applications, orders, and more.
          </p>
          
          <div class="credentials-card">
            <h3>🔑 Your Login Credentials</h3>
            <div class="credential-item">
              <strong>Login Email:</strong>
              <div class="credential-value">${admin.email}</div>
            </div>
            <div class="credential-item">
              <strong>Password:</strong>
              <div class="credential-value">${admin.password}</div>
            </div>
            <div class="credential-item">
              <strong>Admin Dashboard URL:</strong>
              <div class="credential-value" style="font-size: 14px; word-break: break-all;">${loginUrl}</div>
            </div>
            ${admin.phone ? `
            <div class="credential-item">
              <strong>Phone Number:</strong>
              <div class="credential-value">${admin.phone}</div>
            </div>
            ` : ''}
            <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid hsl(285, 85%, 65%, 0.2);">
              <p style="color: hsl(330, 100%, 65%); font-size: 14px; font-weight: 600; margin: 0;">
                ⚠️ WARNING: NEVER share this password with anyone, including other staff members or administrators.
              </p>
            </div>
          </div>
          
          <div class="button-container">
            <a href="${loginUrl}" class="cta-button">🚀 Access Admin Dashboard</a>
          </div>
          
          <div class="security-notice">
            <h3>🔒 Security Instructions</h3>
            <p><strong>Important Security Information:</strong></p>
            <ul>
              <li>Keep your credentials secure and confidential at all times</li>
              <li>Your password is encrypted and not visible to any staff members, including Super Admins</li>
              <li>Never share your login credentials via email, phone, or any other communication method</li>
              <li>Log out when finished, especially on shared or public devices</li>
              <li>If you suspect any security issues or unauthorized access, contact the Super Admin immediately</li>
            </ul>
          </div>
          
          <div class="login-info">
            <h4>💬 Need Help?</h4>
            <p><strong>If you experience any login issues or need assistance:</strong></p>
            <p>Please contact the Super Admin team or reach out to our support at <a href="mailto:support@andiamoevents.com">support@andiamoevents.com</a></p>
          </div>
          
          <div class="closing">
            <p class="signature">
              Best regards,<br>
              <strong>The Andiamo Events Team</strong><br>
              <span style="color: #888; font-size: 14px; font-weight: normal;">Andiamo Events</span>
            </p>
            <p style="margin-top: 15px; color: #888; font-size: 13px;">
              Support Email: <a href="mailto:support@andiamoevents.com" style="color: hsl(285, 85%, 65%); text-decoration: none;">support@andiamoevents.com</a>
            </p>
          </div>
        </div>
        
        <div class="footer" style="background: hsl(218, 23%, 8%) !important; padding: 30px 40px; text-align: center; border-top: 1px solid hsl(218, 23%, 20%);">
          <div class="footer-brand">ANDIAMO EVENTS</div>
          <p class="footer-text" style="color: #888 !important; font-size: 13px; margin: 5px 0;">© 2024 Andiamo Events. All rights reserved.</p>
          <p class="footer-text" style="color: #888 !important; font-size: 13px; margin: 5px 0;">Tunisia's Premier Nightlife Experience</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from: 'Andiamo Events <support@andiamoevents.com>',
    to: admin.email,
    subject,
    html
  };
};

export const generatePassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Order completion email data interface
interface OrderCompletionData {
  customerName: string;
  orderId: string;
  eventName: string;
  ambassadorName: string;
  passes: Array<{
    passType: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  qrCode?: string;
  ticketNumber?: string;
  referenceNumber?: string;
  supportContactUrl?: string;
}

export const createOrderCompletionEmail = (orderData: OrderCompletionData): EmailConfig => {
  const subject = "✅ Order Confirmation - Your Pass Purchase is Complete!";
  
  // Build passes list HTML
  const passesListHtml = orderData.passes.map(pass => `
    <tr style="border-bottom: 1px solid hsl(218, 23%, 20%);">
      <td style="padding: 12px 0; color: #e0e0e0; font-size: 15px;">${pass.passType}</td>
      <td style="padding: 12px 0; color: #e0e0e0; font-size: 15px; text-align: center;">${pass.quantity}</td>
      <td style="padding: 12px 0; color: hsl(195, 100%, 50%); font-size: 15px; text-align: right; font-weight: 600;">${pass.price.toFixed(2)} TND</td>
    </tr>
  `).join('');

  // Build digital ticket section if available
  const digitalTicketSection = (orderData.qrCode || orderData.ticketNumber || orderData.referenceNumber) ? `
    <div class="ticket-card" style="background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%); border: 1px solid hsl(285, 85%, 65%, 0.3); border-radius: 12px; padding: 25px; margin: 30px 0; box-shadow: 0 0 20px rgba(185, 85, 211, 0.1);">
      <h3 style="font-family: 'Josefin Sans', sans-serif; font-optical-sizing: auto; font-style: normal; font-size: 18px; color: hsl(195, 100%, 50%); margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
        🎫 Your Digital Ticket
      </h3>
      ${orderData.qrCode ? `
        <div style="text-align: center; margin: 20px 0;">
          <img src="${orderData.qrCode}" alt="QR Code" style="max-width: 200px; height: auto; border-radius: 8px; border: 2px solid hsl(195, 100%, 50%, 0.3);" />
          <p style="color: #d0d0d0; font-size: 14px; margin-top: 10px;">Scan this QR code at the event entrance</p>
        </div>
      ` : ''}
      ${orderData.ticketNumber ? `
        <div style="margin: 15px 0;">
          <strong style="color: #ffffff; display: block; margin-bottom: 5px; font-weight: 600;">Ticket Number:</strong>
          <span class="credential-value" style="background: hsl(218, 23%, 8%); padding: 10px 15px; border-radius: 8px; font-family: 'Courier New', monospace; color: hsl(195, 100%, 50%); border: 1px solid hsl(195, 100%, 50%, 0.2); display: inline-block; margin-top: 5px;">${orderData.ticketNumber}</span>
        </div>
      ` : ''}
      ${orderData.referenceNumber ? `
        <div style="margin: 15px 0;">
          <strong style="color: #ffffff; display: block; margin-bottom: 5px; font-weight: 600;">Reference Number:</strong>
          <span class="credential-value" style="background: hsl(218, 23%, 8%); padding: 10px 15px; border-radius: 8px; font-family: 'Courier New', monospace; color: hsl(195, 100%, 50%); border: 1px solid hsl(195, 100%, 50%, 0.2); display: inline-block; margin-top: 5px;">${orderData.referenceNumber}</span>
        </div>
      ` : ''}
    </div>
  ` : '';

  const supportUrl = orderData.supportContactUrl || `${window.location.origin}/contact`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark light">
      <meta name="supported-color-schemes" content="dark light">
      <title>Order Confirmation - Andiamo Events</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:ital,wght@0,100..700;1,100..700&family=Saira:wght@100..900&display=swap" rel="stylesheet">
      <style>
        :root {
          color-scheme: dark light;
          supported-color-schemes: dark light;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Josefin Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-optical-sizing: auto;
          font-style: normal; 
          line-height: 1.7; 
          color: #e0e0e0; 
          background: linear-gradient(135deg, hsl(218, 23%, 8%) 0%, hsl(218, 23%, 12%) 100%);
          padding: 20px;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: hsl(218, 23%, 12%);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(185, 85, 211, 0.1);
        }
        .header {
          background: linear-gradient(135deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 50%, hsl(330, 100%, 65%) 100%);
          padding: 50px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          animation: pulse 4s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        .header-content {
          position: relative;
          z-index: 1;
        }
        .logo {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #ffffff;
          margin-bottom: 15px;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }
        .header h1 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 32px;
          font-weight: 700;
          color: #ffffff;
          margin: 15px 0 10px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        .content {
          padding: 40px;
          background: hsl(218, 23%, 12%);
        }
        .greeting {
          font-size: 18px;
          color: #ffffff;
          margin-bottom: 25px;
          font-weight: 500;
        }
        .greeting strong {
          color: hsl(285, 85%, 65%);
          font-weight: 600;
        }
        .intro-text {
          font-size: 16px;
          color: #d0d0d0;
          margin-bottom: 30px;
          line-height: 1.8;
        }
        .order-info-card {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border: 1px solid hsl(285, 85%, 65%, 0.3);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 0 20px rgba(185, 85, 211, 0.1), inset 0 0 20px rgba(185, 85, 211, 0.05);
        }
        .order-info-card h3 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 18px;
          color: hsl(195, 100%, 50%);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .info-item {
          margin: 15px 0;
          font-size: 15px;
          color: #e0e0e0;
        }
        .info-item strong {
          color: #ffffff;
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        .info-value {
          background: hsl(218, 23%, 8%);
          padding: 10px 15px;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          color: hsl(195, 100%, 50%);
          border: 1px solid hsl(195, 100%, 50%, 0.2);
          display: inline-block;
          margin-top: 5px;
        }
        .passes-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .passes-table th {
          text-align: left;
          padding: 12px 0;
          color: hsl(285, 85%, 65%);
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid hsl(285, 85%, 65%, 0.3);
        }
        .passes-table td {
          padding: 12px 0;
          color: #e0e0e0;
          font-size: 15px;
        }
        .total-row {
          border-top: 2px solid hsl(285, 85%, 65%, 0.3);
          margin-top: 10px;
          padding-top: 15px;
        }
        .total-row td {
          font-weight: 700;
          font-size: 18px;
          color: hsl(195, 100%, 50%);
          padding-top: 15px;
        }
        .payment-confirmation {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-left: 4px solid hsl(195, 100%, 50%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 0 20px rgba(0, 195, 255, 0.1);
        }
        .payment-confirmation h3 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 18px;
          color: hsl(195, 100%, 50%);
          margin-bottom: 15px;
        }
        .payment-confirmation p {
          color: #d0d0d0;
          font-size: 15px;
          line-height: 1.8;
          margin: 0;
        }
        .support-section {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          border: 1px solid hsl(285, 85%, 65%, 0.2);
          box-shadow: 0 0 20px rgba(185, 85, 211, 0.05);
        }
        .support-section h3 {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 18px;
          color: hsl(285, 85%, 65%);
          margin-bottom: 15px;
        }
        .support-section p {
          color: #d0d0d0;
          font-size: 15px;
          line-height: 1.8;
          margin: 0 0 15px 0;
        }
        .support-link {
          display: inline-block;
          color: hsl(195, 100%, 50%);
          text-decoration: none;
          font-weight: 600;
          padding: 10px 20px;
          border: 1px solid hsl(195, 100%, 50%, 0.3);
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        .support-link:hover {
          background: hsl(195, 100%, 50%, 0.1);
          border-color: hsl(195, 100%, 50%);
        }
        .closing {
          margin-top: 35px;
          padding-top: 30px;
          border-top: 1px solid hsl(218, 23%, 20%);
          color: #d0d0d0;
          font-size: 15px;
          line-height: 1.8;
        }
        .signature {
          margin-top: 20px;
          color: #ffffff;
          font-weight: 600;
        }
        .signature strong {
          color: hsl(285, 85%, 65%);
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
        }
        .footer {
          background: hsl(218, 23%, 8%);
          padding: 30px 40px;
          text-align: center;
          border-top: 1px solid hsl(218, 23%, 20%);
        }
        .footer-text {
          color: #888;
          font-size: 13px;
          margin: 0;
        }
        .footer-brand {
          font-family: 'Josefin Sans', sans-serif;
          font-optical-sizing: auto;
          font-style: normal;
          font-size: 14px;
          color: hsl(285, 85%, 65%);
          margin-bottom: 10px;
          letter-spacing: 1px;
        }
        @media only screen and (max-width: 600px) {
          .email-wrapper {
            border-radius: 0;
          }
          .header {
            padding: 40px 25px;
          }
          .header h1 {
            font-size: 24px;
          }
          .content {
            padding: 30px 25px;
          }
          .logo {
            font-size: 22px;
          }
        }
      </style>
    </head>
    <body style="background: linear-gradient(135deg, hsl(218, 23%, 8%) 0%, hsl(218, 23%, 12%) 100%) !important; color: #e0e0e0 !important; padding: 20px; margin: 0; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      <div class="email-wrapper" style="background: hsl(218, 23%, 12%) !important; max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(185, 85, 211, 0.1);">
        <div class="header">
          <div class="header-content">
            <div class="logo">ANDIAMO EVENTS</div>
            <h1>✅ Order Confirmed!</h1>
            <h2 style="font-size: 18px; font-weight: 400; color: rgba(255, 255, 255, 0.95); margin-top: 10px;">Your Pass Purchase is Complete</h2>
          </div>
        </div>
        
        <div class="content" style="background: hsl(218, 23%, 12%) !important; color: #e0e0e0 !important; padding: 40px;">
          <p class="greeting">Dear <strong>${orderData.customerName}</strong>,</p>
          
          <p class="intro-text">
            We're excited to confirm that your pass purchase has been successfully processed! Your payment has been received in cash by our ambassador, and your order is now fully validated.
          </p>
          
          <div class="order-info-card">
            <h3>📋 Order Details</h3>
            <div class="info-item">
              <strong>Order ID:</strong>
              <span class="info-value">${orderData.orderId}</span>
            </div>
            <div class="info-item">
              <strong>Event:</strong>
              <span style="color: hsl(195, 100%, 50%); font-weight: 600;">${orderData.eventName}</span>
            </div>
            <div class="info-item">
              <strong>Delivered by:</strong>
              <span style="color: hsl(285, 85%, 65%); font-weight: 600;">${orderData.ambassadorName}</span>
            </div>
          </div>

          <div class="order-info-card">
            <h3>🎫 Passes Purchased</h3>
            <table class="passes-table">
              <thead>
                <tr>
                  <th>Pass Type</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${passesListHtml}
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; padding-right: 20px;"><strong>Total Amount Paid:</strong></td>
                  <td style="text-align: right;"><strong>${orderData.totalAmount.toFixed(2)} TND</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          ${digitalTicketSection}

          <div class="payment-confirmation">
            <h3>💳 Payment Confirmation</h3>
            <p>
              Your payment of <strong style="color: hsl(195, 100%, 50%);">${orderData.totalAmount.toFixed(2)} TND</strong> has been successfully received in cash by our ambassador <strong>${orderData.ambassadorName}</strong>. Your order is now fully validated and confirmed.
            </p>
          </div>

          <div class="support-section">
            <h3>💬 Need Help?</h3>
            <p>
              If you have any questions about your order, need to verify your purchase, or require assistance, please don't hesitate to contact our support team.
            </p>
            <a href="${supportUrl}" class="support-link">Contact Support</a>
          </div>
          
          <div class="closing">
            <p>Thank you for choosing Andiamo Events! We look forward to seeing you at the event.</p>
            
            <p class="signature">
              Best regards,<br>
              <strong>The Andiamo Team</strong>
            </p>
          </div>
        </div>
        
        <div class="footer" style="background: hsl(218, 23%, 8%) !important; padding: 30px 40px; text-align: center; border-top: 1px solid hsl(218, 23%, 20%);">
          <div class="footer-brand">ANDIAMO EVENTS</div>
          <p class="footer-text" style="color: #888 !important; font-size: 13px; margin: 0;">© 2024 Andiamo Events. All rights reserved.</p>
          <p class="footer-text" style="color: #888 !important; font-size: 13px; margin: 0;">Tunisia's Premier Nightlife Experience</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from: 'Andiamo Events <support@andiamoevents.com>',
    to: '', // Will be set by the caller
    subject,
    html
  };
};


// Email sending result type
export interface EmailResult {
  success: boolean;
  error?: string;
}

// Email sending function with SMTP implementation
export const sendEmail = async (emailConfig: EmailConfig): Promise<boolean> => {
  try {
    // For client-side, you'll need to use a service like EmailJS or a backend API
    // Here's how to implement it with a backend API endpoint
    
    const response = await fetch(API_ROUTES.SEND_EMAIL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailConfig),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Server returned an error:', errorData);
      throw new Error(`Failed to send email: ${errorData.details || errorData.error || response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

// Email sending function that returns detailed result
export const sendEmailWithDetails = async (emailConfig: EmailConfig): Promise<EmailResult> => {
  try {
    const response = await fetch(API_ROUTES.SEND_EMAIL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailConfig),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server returned an error:', errorData);
      const errorMessage = errorData.details || errorData.error || response.statusText || 'Unknown error occurred';
      return {
        success: false,
        error: errorMessage
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Email sending failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      error: errorMessage
    };
  }
}; 