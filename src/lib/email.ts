// Email configuration and templates for ambassador notifications

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
  const subject = "🎉 Welcome to Andiamo Events - Your Application Has Been Approved!";
  
  // Create tracking pixel URL
  const trackingPixel = ambassadorId 
    ? `<img src="${window.location.origin}/api/track-email?ambassador_id=${ambassadorId}&email_type=approval" width="1" height="1" style="display:none;" />`
    : '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Andiamo Events</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
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
          font-family: 'Orbitron', sans-serif;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 2px;
          color: #ffffff;
          margin-bottom: 15px;
          text-shadow: 0 0 20px rgba(255, 255, 255, 0.5);
        }
        .header h1 {
          font-family: 'Orbitron', sans-serif;
          font-size: 32px;
          font-weight: 700;
          color: #ffffff;
          margin: 15px 0 10px;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        }
        .header h2 {
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
        .credentials-card {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border: 1px solid hsl(285, 85%, 65%, 0.3);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 0 20px rgba(185, 85, 211, 0.1), inset 0 0 20px rgba(185, 85, 211, 0.05);
        }
        .credentials-card h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 18px;
          color: hsl(195, 100%, 50%);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .credential-item {
          margin: 15px 0;
          font-size: 15px;
          color: #e0e0e0;
        }
        .credential-item strong {
          color: #ffffff;
          display: block;
          margin-bottom: 5px;
          font-weight: 600;
        }
        .credential-value {
          background: hsl(218, 23%, 8%);
          padding: 10px 15px;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          color: hsl(195, 100%, 50%);
          border: 1px solid hsl(195, 100%, 50%, 0.2);
          display: inline-block;
          margin-top: 5px;
        }
        .button-container {
          text-align: center;
          margin: 35px 0;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 100%);
          color: #ffffff;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 16px;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 20px rgba(185, 85, 211, 0.4), 0 0 30px rgba(0, 195, 255, 0.2);
          transition: all 0.3s ease;
          text-transform: uppercase;
          font-family: 'Orbitron', sans-serif;
        }
        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(185, 85, 211, 0.6), 0 0 40px rgba(0, 195, 255, 0.3);
        }
        .features-card {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-left: 4px solid hsl(285, 85%, 65%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 0 20px rgba(185, 85, 211, 0.1);
        }
        .features-card h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 20px;
          color: hsl(285, 85%, 65%);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .features-list {
          list-style: none;
          padding: 0;
        }
        .features-list li {
          padding: 12px 0;
          color: #d0d0d0;
          font-size: 15px;
          border-bottom: 1px solid hsl(218, 23%, 20%);
        }
        .features-list li:last-child {
          border-bottom: none;
        }
        .features-list li::before {
          content: '✓';
          color: hsl(195, 100%, 50%);
          font-weight: bold;
          margin-right: 12px;
          font-size: 18px;
        }
        .commission-section {
          margin: 30px 0;
        }
        .commission-section h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 20px;
          color: hsl(330, 100%, 65%);
          margin-bottom: 20px;
        }
        .commission-list {
          list-style: none;
          padding: 0;
        }
        .commission-list li {
          padding: 12px 0;
          color: #d0d0d0;
          font-size: 15px;
          border-bottom: 1px solid hsl(218, 23%, 20%);
        }
        .commission-list li:last-child {
          border-bottom: none;
        }
        .commission-list li strong {
          color: hsl(330, 100%, 65%);
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
          font-family: 'Orbitron', sans-serif;
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
          font-family: 'Orbitron', sans-serif;
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
    <body>
      <div class="email-wrapper">
        <div class="header">
          <div class="header-content">
            <div class="logo">ANDIAMO EVENTS</div>
          <h1>🎉 Congratulations!</h1>
          <h2>Your Ambassador Application Has Been Approved</h2>
          </div>
        </div>
        
        <div class="content">
          <p class="greeting">Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <p class="intro-text">
            We're thrilled to welcome you to the Andiamo family! After careful review, we're excited to inform you that your ambassador application has been approved. You're now part of Tunisia's premier nightlife community.
          </p>
          
          <div class="credentials-card">
            <h3>🔐 Your Login Credentials</h3>
            <div class="credential-item">
              <strong>Username (Phone):</strong>
              <span class="credential-value">${ambassador.phone}</span>
            </div>
            <div class="credential-item">
              <strong>Password:</strong>
              <span class="credential-value">${ambassador.password}</span>
            </div>
            <div class="credential-item">
              <strong>Login URL:</strong>
              <a href="${loginUrl}" style="color: hsl(195, 100%, 50%); text-decoration: none; word-break: break-all;">${loginUrl}</a>
            </div>
          </div>
          
          <div class="button-container">
            <a href="${loginUrl}" class="cta-button">Access Your Dashboard</a>
          </div>
          
          <div class="features-card">
            <h3>🎯 What You Can Do Now</h3>
            <ul class="features-list">
              <li>Access your personal ambassador dashboard</li>
              <li>View upcoming events and ticket prices</li>
              <li>Start selling tickets to your network</li>
              <li>Track your sales and commissions in real-time</li>
              <li>Earn rewards and exclusive perks</li>
            </ul>
          </div>
          
          <div class="commission-section">
            <h3>💰 Commission Structure</h3>
            <ul class="commission-list">
            <li><strong>Standard Tickets:</strong> 10% commission on each sale</li>
            <li><strong>VIP Tickets:</strong> 15% commission on each sale</li>
            <li><strong>Bonus:</strong> Extra rewards for top performers</li>
          </ul>
          </div>
          
          <div class="closing">
            <p>If you have any questions or need assistance, please don't hesitate to contact us. We're here to support your success every step of the way.</p>
            
            <p class="signature">
              Best regards,<br>
              <strong>The Andiamo Team</strong>
            </p>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-brand">ANDIAMO EVENTS</div>
          <p class="footer-text">© 2024 Andiamo Events. All rights reserved.</p>
          <p class="footer-text">Tunisia's Premier Nightlife Experience</p>
        </div>
      </div>
      ${trackingPixel}
    </body>
    </html>
  `;

  return {
    from: import.meta.env.VITE_GMAIL_FROM || 'Andiamo Events <noreply@andiamo.com>',
    to: ambassador.email || 'noreply@andiamo.com',
    subject,
    html
  };
};

export const createRejectionEmail = (ambassador: AmbassadorData): EmailConfig => {
  const subject = "Andiamo Events - Ambassador Application Update";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Application Update - Andiamo Events</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
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
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          padding: 50px 40px;
          text-align: center;
          position: relative;
          border-bottom: 2px solid hsl(218, 23%, 20%);
        }
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, hsl(285, 85%, 65%) 0%, hsl(195, 100%, 50%) 50%, hsl(330, 100%, 65%) 100%);
        }
        .header-content {
          position: relative;
          z-index: 1;
        }
        .logo {
          font-family: 'Orbitron', sans-serif;
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 2px;
          color: hsl(285, 85%, 65%);
          margin-bottom: 15px;
        }
        .header h1 {
          font-family: 'Orbitron', sans-serif;
          font-size: 26px;
          font-weight: 600;
          color: #ffffff;
          margin: 15px 0 10px;
        }
        .header-icon {
          font-size: 48px;
          margin-bottom: 15px;
          opacity: 0.8;
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
        .message-text {
          font-size: 16px;
          color: #d0d0d0;
          margin-bottom: 25px;
          line-height: 1.8;
        }
        .appreciation-card {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-left: 4px solid hsl(195, 100%, 50%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          box-shadow: 0 0 20px rgba(0, 195, 255, 0.1);
        }
        .appreciation-card p {
          color: #d0d0d0;
          font-size: 15px;
          line-height: 1.8;
          margin: 0;
        }
        .future-opportunity {
          background: linear-gradient(135deg, hsl(218, 23%, 15%) 0%, hsl(218, 23%, 18%) 100%);
          border-radius: 12px;
          padding: 25px;
          margin: 30px 0;
          border: 1px solid hsl(285, 85%, 65%, 0.2);
          box-shadow: 0 0 20px rgba(185, 85, 211, 0.05);
        }
        .future-opportunity h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 18px;
          color: hsl(285, 85%, 65%);
          margin-bottom: 15px;
        }
        .future-opportunity p {
          color: #d0d0d0;
          font-size: 15px;
          line-height: 1.8;
          margin: 0;
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
          font-family: 'Orbitron', sans-serif;
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
          font-family: 'Orbitron', sans-serif;
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
            font-size: 22px;
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
    <body>
      <div class="email-wrapper">
        <div class="header">
          <div class="header-content">
            <div class="logo">ANDIAMO EVENTS</div>
            <div class="header-icon">📋</div>
          <h1>Application Update</h1>
          </div>
        </div>
        
        <div class="content">
          <p class="greeting">Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <p class="message-text">
            Thank you for your interest in becoming an Andiamo ambassador and for taking the time to submit your application. We truly appreciate your enthusiasm and the effort you put into your submission.
          </p>
          
          <div class="appreciation-card">
            <p>
              After careful review of your application, we regret to inform you that we cannot approve your application at this time. This decision was not made lightly, and we reviewed each application thoroughly.
            </p>
          </div>
          
          <p class="message-text">
            We want you to know that we value your interest in our ambassador program and the passion you've shown for the Andiamo community.
          </p>
          
          <div class="future-opportunity">
            <h3>💫 Future Opportunities</h3>
            <p>
              Our ambassador program continues to evolve, and we encourage you to stay connected with us. We may have opportunities that align better with your profile in the future. Keep an eye on our events and social media channels for updates.
            </p>
          </div>
          
          <div class="closing">
            <p>We wish you the very best in your future endeavors and hope to see you at our events soon.</p>
            
            <p class="signature">
              Best regards,<br>
              <strong>The Andiamo Team</strong>
            </p>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-brand">ANDIAMO EVENTS</div>
          <p class="footer-text">© 2024 Andiamo Events. All rights reserved.</p>
          <p class="footer-text">Tunisia's Premier Nightlife Experience</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return {
    from: import.meta.env.VITE_GMAIL_FROM || 'Andiamo Events <noreply@andiamo.com>',
    to: ambassador.email || 'noreply@andiamo.com',
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
    from: import.meta.env.VITE_GMAIL_FROM || 'Andiamo Events <noreply@andiamo.com>',
    to: ambassador.email || 'noreply@andiamo.com',
    subject,
    html
  };
};

// Generate secure password
export const generatePassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Email sending function with Gmail SMTP implementation
export const sendEmail = async (emailConfig: EmailConfig): Promise<boolean> => {
  try {
    // For client-side, you'll need to use a service like EmailJS or a backend API
    // Here's how to implement it with a backend API endpoint
    
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailConfig),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server returned an error:', errorData);
      throw new Error(`Failed to send email: ${errorData.details || response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}; 