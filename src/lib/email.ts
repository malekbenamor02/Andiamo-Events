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
  const subject = "🎉 Your Ambassador Application Approved!";
  
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
      <title>Application Approved</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .credentials { background: #e8f5e8; border: 2px solid #4caf50; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .button { display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .highlight { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Congratulations!</h1>
          <h2>Your Ambassador Application Has Been Approved</h2>
        </div>
        
        <div class="content">
          <p>Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <p>We're excited to inform you that your ambassador application has been approved! Welcome to the Andiamo family.</p>
          
          <div class="credentials">
            <h3>🔐 Your Login Credentials:</h3>
            <p><strong>Username (Phone):</strong> ${ambassador.phone}</p>
            <p><strong>Password:</strong> <span style="font-family: monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${ambassador.password}</span></p>
            <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          </div>
          
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">🚀 Login to Dashboard</a>
          </div>
          
          <div class="highlight">
            <h3>🎯 What You Can Do Now:</h3>
            <ul>
              <li>✅ Access your personal ambassador dashboard</li>
              <li>✅ View upcoming events and ticket prices</li>
              <li>✅ Start selling tickets to your network</li>
              <li>✅ Track your sales and commissions</li>
              <li>✅ Earn rewards and exclusive perks</li>
            </ul>
          </div>
          
          <h3>💰 Commission Structure:</h3>
          <ul>
            <li><strong>Standard Tickets:</strong> 10% commission on each sale</li>
            <li><strong>VIP Tickets:</strong> 15% commission on each sale</li>
            <li><strong>Bonus:</strong> Extra rewards for top performers</li>
          </ul>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact us.</p>
          
          <p>Best regards,<br>
          <strong>The Andiamo Team</strong></p>
        </div>
        
        <div class="footer">
          <p>© 2024 Andiamo Events. All rights reserved.</p>
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
  const subject = "Ambassador Application Update";
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Application Update</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #f8f9fa; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Application Update</h1>
        </div>
        
        <div class="content">
          <p>Dear <strong>${ambassador.fullName}</strong>,</p>
          
          <p>Thank you for your interest in becoming an Andiamo ambassador and for taking the time to submit your application.</p>
          
          <p>After careful review of your application, we regret to inform you that we cannot approve your application at this time.</p>
          
          <p>We appreciate your interest in our ambassador program and wish you the best in your future endeavors.</p>
          
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