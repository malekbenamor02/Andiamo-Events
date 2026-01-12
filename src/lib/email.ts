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
  const subject = "Welcome to Andiamo Events - Ambassador Approved";
  
  // Get base URL for tracking
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.andiamoevents.com';
  
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
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Ambassador Approved - Andiamo Events</title>
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
          body {
            color: #FFFFFF;
            background: #1A1A1A;
          }
        }
        a {
          color: #E21836 !important;
          text-decoration: none;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
        }
        @media (prefers-color-scheme: dark) {
          .email-wrapper {
            background: #1A1A1A;
          }
        }
        .content-card {
          background: #F5F5F5;
          margin: 0 20px 30px;
          border-radius: 12px;
          padding: 50px 40px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .content-card {
            background: #1F1F1F;
            border: 1px solid rgba(42, 42, 42, 0.5);
          }
        }
        .title-section {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .title-section {
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #1A1A1A;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .title {
            color: #FFFFFF;
          }
        }
        .subtitle {
          font-size: 16px;
          color: #666666;
          font-weight: 400;
        }
        @media (prefers-color-scheme: dark) {
          .subtitle {
            color: #B0B0B0;
          }
        }
        .greeting {
          font-size: 18px;
          color: #1A1A1A;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .greeting {
            color: #FFFFFF;
          }
        }
        .greeting strong {
          color: #E21836;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #666666;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .message {
            color: #B0B0B0;
          }
        }
        .credentials-block {
          background: #E8E8E8;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        @media (prefers-color-scheme: dark) {
          .credentials-block {
            background: #252525;
            border: 1px solid rgba(42, 42, 42, 0.8);
          }
        }
        .credential-row {
          margin-bottom: 25px;
        }
        .credential-row:last-child {
          margin-bottom: 0;
        }
        .credential-label {
          font-size: 11px;
          color: #999999;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        @media (prefers-color-scheme: dark) {
          .credential-label {
            color: #6B6B6B;
          }
        }
        .credential-value {
          font-family: 'Courier New', 'Monaco', monospace;
          font-size: 18px;
          color: #1A1A1A;
          font-weight: 500;
          word-break: break-all;
          letter-spacing: 0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .credential-value {
            color: #FFFFFF;
          }
        }
        .cta-button {
          display: block;
          width: 100%;
          max-width: 320px;
          margin: 40px auto;
          padding: 16px 32px;
          background: #E21836;
          color: #FFFFFF !important;
          text-decoration: none;
          text-align: center;
          font-size: 16px;
          font-weight: 600;
          border-radius: 8px;
          transition: background 0.3s ease;
        }
        .cta-button:hover {
          background: #C81430;
        }
        .support-section {
          background: #E8E8E8;
          border-left: 3px solid rgba(226, 24, 54, 0.3);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .support-section {
            background: #252525;
          }
        }
        .support-text {
          font-size: 14px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .support-text {
            color: #B0B0B0;
          }
        }
        .support-email {
          color: #E21836 !important;
          text-decoration: none;
          font-weight: 500;
        }
        .closing-section {
          text-align: center;
          margin: 50px 0 40px;
          padding-top: 40px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .closing-section {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .slogan {
          font-size: 24px;
          font-style: italic;
          color: #E21836;
          font-weight: 300;
          letter-spacing: 1px;
          margin-bottom: 30px;
        }
        .signature {
          font-size: 16px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .signature {
            color: #B0B0B0;
          }
        }
        .footer {
          margin-top: 50px;
          padding: 40px 20px 30px;
          text-align: center;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .footer {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        @media (prefers-color-scheme: dark) {
          .footer-text {
            color: #6B6B6B;
          }
        }
        .footer-links {
          margin: 15px auto 0;
          text-align: center;
        }
        .footer-link {
          color: #999999;
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        @media (prefers-color-scheme: dark) {
          .footer-link {
            color: #6B6B6B;
          }
        }
        .footer-link:hover {
          color: #E21836 !important;
        }
        @media only screen and (max-width: 600px) {
          .content-card {
            margin: 0 15px 20px;
            padding: 35px 25px;
          }
          .title {
            font-size: 26px;
          }
          .credentials-block {
            padding: 25px 20px;
          }
          .cta-button {
            max-width: 100%;
            margin: 30px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- Main Content Card -->
        <div class="content-card">
          <!-- Title Section -->
          <div class="title-section">
            <h1 class="title">Approval Confirmed</h1>
            <p class="subtitle">Welcome to the Andiamo Events Ambassador Program</p>
          </div>
          
          <!-- Greeting -->
          <p class="greeting">Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <!-- Message -->
          <p class="message">
            Thank you for filling out the form and for your interest in working with Andiamo.
          </p>
          
          <p class="message">
            We are pleased to inform you that you have been selected to collaborate with us.
          </p>
          
          <p class="message">
            You will soon be added to a private Instagram group where we will share further details and discuss the upcoming event.
          </p>
          
          <!-- Credentials Section -->
          <div class="credentials-block">
            <div class="credential-row">
              <div class="credential-label">Phone Number</div>
              <div class="credential-value">${ambassador.phone}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Temporary Password</div>
              <div class="credential-value">${ambassador.password}</div>
            </div>
          </div>
          
          <!-- CTA Button -->
          <a href="${loginUrl}" class="cta-button">Access Ambassador Dashboard</a>
          
          <!-- Support Section -->
          <div class="support-section">
            <p class="support-text">
              Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>
            </p>
          </div>
          
          <!-- Closing Section -->
          <div class="closing-section">
            <p class="slogan">We Create Memories</p>
            <p class="signature">
              Best regards,<br>
              The Andiamo Events Team
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
          <div class="footer-links">
            <a href="https://www.instagram.com/malek.bamor/" target="_blank" class="footer-link">Instagram</a>
            <span style="color: #999999;">•</span>
            <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
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
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Application Update - Andiamo Events</title>
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
          body {
            color: #FFFFFF;
            background: #1A1A1A;
          }
        }
        a {
          color: #E21836 !important;
          text-decoration: none;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
        }
        @media (prefers-color-scheme: dark) {
          .email-wrapper {
            background: #1A1A1A;
          }
        }
        .content-card {
          background: #F5F5F5;
          margin: 0 20px 30px;
          border-radius: 12px;
          padding: 50px 40px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .content-card {
            background: #1F1F1F;
            border: 1px solid rgba(42, 42, 42, 0.5);
          }
        }
        .title-section {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .title-section {
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #1A1A1A;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .title {
            color: #FFFFFF;
          }
        }
        .subtitle {
          font-size: 16px;
          color: #666666;
          font-weight: 400;
        }
        @media (prefers-color-scheme: dark) {
          .subtitle {
            color: #B0B0B0;
          }
        }
        .greeting {
          font-size: 18px;
          color: #1A1A1A;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .greeting {
            color: #FFFFFF;
          }
        }
        .greeting strong {
          color: #E21836;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #666666;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .message {
            color: #B0B0B0;
          }
        }
        .section-divider {
          background: #E8E8E8;
          border-left: 3px solid rgba(226, 24, 54, 0.3);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .section-divider {
            background: #252525;
          }
        }
        .support-section {
          background: #E8E8E8;
          border-left: 3px solid rgba(226, 24, 54, 0.3);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .support-section {
            background: #252525;
          }
        }
        .support-text {
          font-size: 14px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .support-text {
            color: #B0B0B0;
          }
        }
        .support-email {
          color: #E21836 !important;
          text-decoration: none;
          font-weight: 500;
        }
        .closing-section {
          text-align: center;
          margin: 50px 0 40px;
          padding-top: 40px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .closing-section {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .slogan {
          font-size: 24px;
          font-style: italic;
          color: #E21836;
          font-weight: 300;
          letter-spacing: 1px;
          margin-bottom: 30px;
        }
        .signature {
          font-size: 16px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .signature {
            color: #B0B0B0;
          }
        }
        .footer {
          margin-top: 50px;
          padding: 40px 20px 30px;
          text-align: center;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .footer {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        @media (prefers-color-scheme: dark) {
          .footer-text {
            color: #6B6B6B;
          }
        }
        .footer-links {
          margin: 15px auto 0;
          text-align: center;
        }
        .footer-link {
          color: #999999;
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        @media (prefers-color-scheme: dark) {
          .footer-link {
            color: #6B6B6B;
          }
        }
        .footer-link:hover {
          color: #E21836 !important;
        }
        @media only screen and (max-width: 600px) {
          .content-card {
            margin: 0 15px 20px;
            padding: 35px 25px;
          }
          .title {
            font-size: 26px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- Main Content Card -->
        <div class="content-card">
          <!-- Title Section -->
          <div class="title-section">
            <h1 class="title">Application Update</h1>
            <p class="subtitle">Andiamo Events Ambassador Program</p>
          </div>
          
          <!-- Greeting -->
          <p class="greeting">Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <!-- Message -->
          <p class="message">
            Thank you for filling out the form and for your interest in our event.
          </p>
          
          <p class="message">
            Unfortunately, we are unable to accept your participation this time.
          </p>
          
          <p class="message">
            Your details are registered in our database, and we may contact you to collaborate on a future event. We hope to see you soon.
          </p>
          
          <!-- Support Section -->
          <div class="support-section">
            <p class="support-text">
              Questions? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>
            </p>
          </div>
          
          <!-- Closing Section -->
          <div class="closing-section">
            <p class="slogan">We Create Memories</p>
            <p class="signature">
              Best regards,<br>
              The Andiamo Events Team
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
          <div class="footer-links">
            <a href="https://www.instagram.com/malek.bamor/" target="_blank" class="footer-link">Instagram</a>
            <span style="color: #999999;">•</span>
            <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
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
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Admin Account - Andiamo Events</title>
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
          body {
            color: #FFFFFF;
            background: #1A1A1A;
          }
        }
        a {
          color: #E21836 !important;
          text-decoration: none;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
        }
        @media (prefers-color-scheme: dark) {
          .email-wrapper {
            background: #1A1A1A;
          }
        }
        .content-card {
          background: #F5F5F5;
          margin: 0 20px 30px;
          border-radius: 12px;
          padding: 50px 40px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .content-card {
            background: #1F1F1F;
            border: 1px solid rgba(42, 42, 42, 0.5);
          }
        }
        .title-section {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .title-section {
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #1A1A1A;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .title {
            color: #FFFFFF;
          }
        }
        .subtitle {
          font-size: 16px;
          color: #666666;
          font-weight: 400;
        }
        @media (prefers-color-scheme: dark) {
          .subtitle {
            color: #B0B0B0;
          }
        }
        .greeting {
          font-size: 18px;
          color: #1A1A1A;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .greeting {
            color: #FFFFFF;
          }
        }
        .greeting strong {
          color: #E21836;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #666666;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .message {
            color: #B0B0B0;
          }
        }
        .credentials-block {
          background: #E8E8E8;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        @media (prefers-color-scheme: dark) {
          .credentials-block {
            background: #252525;
            border: 1px solid rgba(42, 42, 42, 0.8);
          }
        }
        .credential-row {
          margin-bottom: 25px;
        }
        .credential-row:last-child {
          margin-bottom: 0;
        }
        .credential-label {
          font-size: 11px;
          color: #999999;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        @media (prefers-color-scheme: dark) {
          .credential-label {
            color: #6B6B6B;
          }
        }
        .credential-value {
          font-family: 'Courier New', 'Monaco', monospace;
          font-size: 18px;
          color: #1A1A1A;
          font-weight: 500;
          word-break: break-all;
          letter-spacing: 0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .credential-value {
            color: #FFFFFF;
          }
        }
        .cta-button {
          display: block;
          width: 100%;
          max-width: 320px;
          margin: 40px auto;
          padding: 16px 32px;
          background: #E21836;
          color: #FFFFFF !important;
          text-decoration: none;
          text-align: center;
          font-size: 16px;
          font-weight: 600;
          border-radius: 8px;
          transition: background 0.3s ease;
        }
        .cta-button:hover {
          background: #C81430;
        }
        .support-section {
          background: #E8E8E8;
          border-left: 3px solid rgba(226, 24, 54, 0.3);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .support-section {
            background: #252525;
          }
        }
        .support-text {
          font-size: 14px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .support-text {
            color: #B0B0B0;
          }
        }
        .support-email {
          color: #E21836 !important;
          text-decoration: none;
          font-weight: 500;
        }
        .security-notice {
          background: #E8E8E8;
          border-left: 3px solid rgba(226, 24, 54, 0.5);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .security-notice {
            background: #252525;
          }
        }
        .security-notice-title {
          font-size: 16px;
          color: #E21836;
          font-weight: 600;
          margin-bottom: 12px;
        }
        .security-notice ul {
          font-size: 14px;
          color: #666666;
          line-height: 1.8;
          margin-top: 10px;
          padding-left: 20px;
        }
        @media (prefers-color-scheme: dark) {
          .security-notice ul {
            color: #B0B0B0;
          }
        }
        .security-notice li {
          margin: 5px 0;
        }
        .closing-section {
          text-align: center;
          margin: 50px 0 40px;
          padding-top: 40px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .closing-section {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .slogan {
          font-size: 24px;
          font-style: italic;
          color: #E21836;
          font-weight: 300;
          letter-spacing: 1px;
          margin-bottom: 30px;
        }
        .signature {
          font-size: 16px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .signature {
            color: #B0B0B0;
          }
        }
        .footer {
          margin-top: 50px;
          padding: 40px 20px 30px;
          text-align: center;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .footer {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        @media (prefers-color-scheme: dark) {
          .footer-text {
            color: #6B6B6B;
          }
        }
        .footer-links {
          margin: 15px auto 0;
          text-align: center;
        }
        .footer-link {
          color: #999999;
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        @media (prefers-color-scheme: dark) {
          .footer-link {
            color: #6B6B6B;
          }
        }
        .footer-link:hover {
          color: #E21836 !important;
        }
        @media only screen and (max-width: 600px) {
          .content-card {
            margin: 0 15px 20px;
            padding: 35px 25px;
          }
          .title {
            font-size: 26px;
          }
          .credentials-block {
            padding: 25px 20px;
          }
          .cta-button {
            max-width: 100%;
            margin: 30px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- Main Content Card -->
        <div class="content-card">
          <!-- Title Section -->
          <div class="title-section">
            <h1 class="title">Admin Account Created</h1>
            <p class="subtitle">Welcome to the Andiamo Events Admin Team</p>
          </div>
          
          <!-- Greeting -->
          <p class="greeting">Hello <strong>${admin.name}</strong>,</p>
          
          <!-- Message -->
          <p class="message">
            You have been added as an administrator on the Andiamo Events platform by our Super Admin team. Your admin account is now ready and you can access the admin dashboard to manage events, ambassadors, applications, orders, and more.
          </p>
          
          <!-- Credentials Section -->
          <div class="credentials-block">
            <div class="credential-row">
              <div class="credential-label">Login Email</div>
              <div class="credential-value">${admin.email}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Password</div>
              <div class="credential-value">${admin.password}</div>
            </div>
            
            <div class="credential-row">
              <div class="credential-label">Admin Dashboard URL</div>
              <div class="credential-value" style="font-size: 14px;">${loginUrl}</div>
            </div>
            
            ${admin.phone ? `
            <div class="credential-row">
              <div class="credential-label">Phone Number</div>
              <div class="credential-value">${admin.phone}</div>
            </div>
            ` : ''}
          </div>
          
          <!-- CTA Button -->
          <a href="${loginUrl}" class="cta-button">Access Admin Dashboard</a>
          
          <!-- Security Notice -->
          <div class="security-notice">
            <div class="security-notice-title">Security Instructions</div>
            <ul>
              <li>Keep your credentials secure and confidential at all times</li>
              <li>Your password is encrypted and not visible to any staff members, including Super Admins</li>
              <li>Never share your login credentials via email, phone, or any other communication method</li>
              <li>Log out when finished, especially on shared or public devices</li>
              <li>If you suspect any security issues or unauthorized access, contact the Super Admin immediately</li>
            </ul>
          </div>
          
          <!-- Support Section -->
          <div class="support-section">
            <p class="support-text">
              Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>
            </p>
          </div>
          
          <!-- Closing Section -->
          <div class="closing-section">
            <p class="slogan">We Create Memories</p>
            <p class="signature">
              Best regards,<br>
              The Andiamo Events Team
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
          <div class="footer-links">
            <a href="https://www.instagram.com/malek.bamor/" target="_blank" class="footer-link">Instagram</a>
            <span style="color: #999999;">•</span>
            <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
          </div>
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
  orderNumber?: string | number | null; // Order number used in SMS (e.g., 257283)
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
  eventTime?: string; // Formatted event time (e.g., "Saturday · 22 March 2026 · 22:00")
  venueName?: string; // Event venue name
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
      <h3 style="font-family: 'Montserrat', sans-serif; font-style: normal; font-size: 18px; color: hsl(195, 100%, 50%); margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
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
          font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
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
          font-family: 'Montserrat', sans-serif;
          font-style: normal;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #ffffff;
          margin-bottom: 15px;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }
        .header h1 {
          font-family: 'Montserrat', sans-serif;
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
          font-family: 'Montserrat', sans-serif;
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
        .support-section {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          border: 1px solid hsl(285, 85%, 65%, 0.2);
          box-shadow: 0 0 20px rgba(185, 85, 211, 0.05);
        }
        .support-section h3 {
          font-family: 'Montserrat', sans-serif;
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
          font-family: 'Montserrat', sans-serif;
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
          font-family: 'Montserrat', sans-serif;
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
              <strong>ORDER NUMBER</strong>
              <span class="info-value">${orderData.orderNumber !== null && orderData.orderNumber !== undefined ? `#${orderData.orderNumber}` : orderData.orderId.substring(0, 8).toUpperCase()}</span>
            </div>
            <div class="info-item">
              <strong>EVENT</strong>
              <span style="color: hsl(195, 100%, 50%); font-weight: 600;">${orderData.eventName}</span>
            </div>
            <div class="info-item">
              <strong>EVENT TIME</strong>
              <span style="color: hsl(195, 100%, 50%); font-weight: 600;">${orderData.eventTime || 'TBA'}</span>
            </div>
            <div class="info-item">
              <strong>VENUE</strong>
              <span style="color: #e0e0e0; font-weight: 500;">${orderData.venueName || 'Venue to be announced'}</span>
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

// QR Code Email Data Interface
interface QRCodeEmailData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  orderNumber?: string | number | null; // Order number used in SMS (e.g., 257283)
  eventName: string;
  eventTime?: string; // Formatted event time (e.g., "Saturday · 22 March 2026 · 22:00")
  venueName?: string; // Event venue name
  totalAmount: number;
  ambassadorName?: string;
  passes: Array<{
    passType: string;
    quantity: number;
    price: number;
  }>;
  tickets: Array<{
    id: string;
    passType: string;
    qrCodeUrl: string;
    secureToken: string;
  }>;
  supportContactUrl?: string;
}

/**
 * Create QR code email template matching ambassador email style
 */
export const createQRCodeEmail = (orderData: QRCodeEmailData): EmailConfig => {
  const subject = "Your Digital Tickets Are Ready - Andiamo Events";
  
  // Group tickets by pass type
  const ticketsByPassType = new Map<string, typeof orderData.tickets>();
  orderData.tickets.forEach(ticket => {
    if (!ticketsByPassType.has(ticket.passType)) {
      ticketsByPassType.set(ticket.passType, []);
    }
    ticketsByPassType.get(ticket.passType)!.push(ticket);
  });

  // Build tickets HTML
  const ticketsHtml = Array.from(ticketsByPassType.entries())
    .map(([passType, passTickets]) => {
      const ticketsList = passTickets
        .map((ticket, index) => {
          return `
            <div style="margin: 20px 0; padding: 20px; background: #E8E8E8; border-radius: 8px; text-align: center; border: 1px solid rgba(0, 0, 0, 0.1);">
              <h4 style="margin: 0 0 15px 0; color: #E21836; font-size: 16px; font-weight: 600;">${passType} - Ticket ${index + 1}</h4>
              <img src="${ticket.qrCodeUrl}" alt="QR Code for ${passType}" style="max-width: 250px; height: auto; border-radius: 8px; border: 2px solid rgba(226, 24, 54, 0.3); display: block; margin: 0 auto;" />
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #666666; font-family: 'Courier New', monospace;">Token: ${ticket.secureToken.substring(0, 8)}...</p>
            </div>
          `;
        })
        .join('');

      return `
        <div style="margin: 30px 0;">
          <h3 style="color: #E21836; margin-bottom: 15px; font-size: 18px; font-weight: 600;">${passType} Tickets (${passTickets.length})</h3>
          ${ticketsList}
        </div>
      `;
    })
    .join('');

  // Build passes summary
  const passesSummary = orderData.passes.map(p => `
    <tr style="border-bottom: 1px solid rgba(226, 24, 54, 0.15);">
      <td class="pass-text" style="padding: 12px 0; font-size: 15px; background-color: transparent !important; color: #000000 !important;">${p.passType}</td>
      <td style="padding: 12px 0; color: #666666; font-size: 15px; text-align: center; background-color: transparent !important;">${p.quantity}</td>
      <td class="pass-text" style="padding: 12px 0; font-size: 15px; text-align: right; background-color: transparent !important; color: #000000 !important;">${p.price.toFixed(2)} TND</td>
    </tr>
  `).join('');

  const supportUrl = orderData.supportContactUrl || (typeof window !== 'undefined' ? `${window.location.origin}/contact` : 'https://andiamo-events.tn/contact');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <title>Your Digital Tickets - Andiamo Events</title>
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
          body {
            color: #FFFFFF;
            background: #1A1A1A;
          }
        }
        a {
          color: #E21836 !important;
          text-decoration: none;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #FFFFFF;
        }
        @media (prefers-color-scheme: dark) {
          .email-wrapper {
            background: #1A1A1A;
          }
        }
        .content-card {
          background: #F5F5F5;
          margin: 0 20px 30px;
          border-radius: 12px;
          padding: 50px 40px;
          border: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .content-card {
            background: #1F1F1F;
            border: 1px solid rgba(42, 42, 42, 0.5);
          }
        }
        .title-section {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .title-section {
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #1A1A1A;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .title {
            color: #FFFFFF;
          }
        }
        .subtitle {
          font-size: 16px;
          color: #666666;
          font-weight: 400;
        }
        @media (prefers-color-scheme: dark) {
          .subtitle {
            color: #B0B0B0;
          }
        }
        .greeting {
          font-size: 18px;
          color: #1A1A1A;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .greeting {
            color: #FFFFFF;
          }
        }
        .greeting strong {
          color: #E21836;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #666666;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .message {
            color: #B0B0B0;
          }
        }
        .order-info-block {
          background: #E8E8E8;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        @media (prefers-color-scheme: dark) {
          .order-info-block {
            background: #252525;
            border: 1px solid rgba(42, 42, 42, 0.8);
          }
        }
        .passes-container {
          background: transparent !important;
          border: none !important;
          padding: 0;
          margin: 40px 0;
        }
        @media (prefers-color-scheme: dark) {
          .passes-container {
            background: transparent !important;
          }
        }
        .info-row {
          margin-bottom: 20px;
        }
        .info-row:last-child {
          margin-bottom: 0;
        }
        .info-label {
          font-size: 11px;
          color: #999999;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        @media (prefers-color-scheme: dark) {
          .info-label {
            color: #6B6B6B;
          }
        }
        .info-value {
          font-family: 'Courier New', 'Monaco', monospace;
          font-size: 18px;
          color: #1A1A1A;
          font-weight: 500;
          word-break: break-all;
          letter-spacing: 0.5px;
        }
        @media (prefers-color-scheme: dark) {
          .info-value {
            color: #FFFFFF;
          }
        }
        .passes-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          background: transparent !important;
        }
        .passes-table th {
          text-align: left;
          padding: 12px 0;
          color: #E21836;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid rgba(226, 24, 54, 0.3);
          background: transparent !important;
        }
        .passes-table td {
          padding: 12px 0;
          color: #1A1A1A;
          font-size: 15px;
          background: transparent !important;
        }
        @media (prefers-color-scheme: dark) {
          .passes-table td {
            color: #B0B0B0;
            background: transparent !important;
          }
          .passes-table th {
            background: transparent !important;
          }
          tr[style*="border-bottom"] {
            border-bottom-color: rgba(255, 255, 255, 0.1) !important;
          }
        }
        .pass-text {
          color: #000000 !important;
          background-color: transparent !important;
        }
        @media (prefers-color-scheme: dark) {
          .pass-text {
            color: #FFFFFF !important;
            background-color: transparent !important;
          }
        }
        .total-row {
          border-top: 2px solid rgba(226, 24, 54, 0.3);
          margin-top: 10px;
          padding-top: 15px;
        }
        .total-row td {
          font-weight: 700;
          font-size: 18px;
          color: #E21836;
          padding-top: 15px;
        }
        .tickets-section {
          background: #E8E8E8;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        @media (prefers-color-scheme: dark) {
          .tickets-section {
            background: #252525;
            border: 1px solid rgba(42, 42, 42, 0.8);
          }
        }
        .support-section {
          background: #E8E8E8;
          border-left: 3px solid rgba(226, 24, 54, 0.3);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        @media (prefers-color-scheme: dark) {
          .support-section {
            background: #252525;
          }
        }
        .support-text {
          font-size: 14px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .support-text {
            color: #B0B0B0;
          }
        }
        .support-email {
          color: #E21836 !important;
          text-decoration: none;
          font-weight: 500;
        }
        .closing-section {
          text-align: center;
          margin: 50px 0 40px;
          padding-top: 40px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .closing-section {
            border-top: 1px solid rgba(255, 255, 255, 0.1);
          }
        }
        .slogan {
          font-size: 24px;
          font-style: italic;
          color: #E21836;
          font-weight: 300;
          letter-spacing: 1px;
          margin-bottom: 30px;
        }
        .signature {
          font-size: 16px;
          color: #666666;
          line-height: 1.7;
        }
        @media (prefers-color-scheme: dark) {
          .signature {
            color: #B0B0B0;
          }
        }
        .footer {
          margin-top: 50px;
          padding: 40px 20px 30px;
          text-align: center;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }
        @media (prefers-color-scheme: dark) {
          .footer {
            border-top: 1px solid rgba(255, 255, 255, 0.05);
          }
        }
        .footer-text {
          font-size: 12px;
          color: #999999;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        @media (prefers-color-scheme: dark) {
          .footer-text {
            color: #6B6B6B;
          }
        }
        .footer-links {
          margin: 15px auto 0;
          text-align: center;
        }
        .footer-link {
          color: #999999;
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        @media (prefers-color-scheme: dark) {
          .footer-link {
            color: #6B6B6B;
          }
        }
        .footer-link:hover {
          color: #E21836 !important;
        }
        @media only screen and (max-width: 600px) {
          .content-card {
            margin: 0 15px 20px;
            padding: 35px 25px;
          }
          .title {
            font-size: 26px;
          }
          .order-info-block {
            padding: 25px 20px;
          }
          .tickets-section {
            padding: 25px 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <!-- Main Content Card -->
        <div class="content-card">
          <!-- Title Section -->
          <div class="title-section">
            <h1 class="title">Your Tickets Are Ready</h1>
            <p class="subtitle">Order Confirmation - Andiamo Events</p>
          </div>
          
          <!-- Greeting -->
          <p class="greeting">Dear <strong>${orderData.customerName}</strong>,</p>
          
          <!-- Message -->
          <p class="message">
            We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are ready and attached below.
          </p>
          
          <!-- Order Info Section -->
          <div class="order-info-block">
            <div class="info-row">
              <div class="info-label">Order Number</div>
              <div class="info-value">${orderData.orderNumber != null ? `#${orderData.orderNumber}` : orderData.orderId.substring(0, 8).toUpperCase()}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Event</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${orderData.eventName}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Event Time</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${orderData.eventTime || 'TBA'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Venue</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${orderData.venueName || 'Venue to be announced'}</div>
            </div>
            ${orderData.ambassadorName ? `
            <div class="info-row">
              <div class="info-label">Delivered by</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${orderData.ambassadorName}</div>
            </div>
            ` : ''}
          </div>

          <!-- Passes Summary -->
          <div class="passes-container">
            <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Passes Purchased</h3>
            <table class="passes-table">
              <thead>
                <tr>
                  <th>Pass Type</th>
                  <th style="text-align: center;">Quantity</th>
                  <th style="text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${passesSummary}
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; padding-right: 20px; background-color: transparent !important;"><strong>Total Amount Paid:</strong></td>
                  <td style="text-align: right; background-color: transparent !important;"><strong>${orderData.totalAmount.toFixed(2)} TND</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Tickets Section -->
          <div class="tickets-section">
            <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Your Digital Tickets</h3>
            <p class="message" style="margin-bottom: 25px;">
              Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.
            </p>
            ${ticketsHtml}
          </div>
          
          <!-- Support Section -->
          <div class="support-section">
            <p class="support-text">
              Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a> or visit <a href="${supportUrl}" class="support-email">our support page</a>.
            </p>
          </div>
          
          <!-- Closing Section -->
          <div class="closing-section">
            <p class="slogan">We Create Memories</p>
            <p class="signature">
              Best regards,<br>
              The Andiamo Events Team
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
          <div class="footer-links">
            <a href="https://www.instagram.com/malek.bamor/" target="_blank" class="footer-link">Instagram</a>
            <span style="color: #999999;">•</span>
            <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from: 'Andiamo Events <support@andiamoevents.com>',
    to: orderData.customerEmail,
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