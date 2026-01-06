const nodemailer = require('nodemailer');
require('dotenv').config();

// Test email configuration
async function testEmail() {
  console.log('📧 Testing email configuration...\n');

  // Check environment variables
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Error: EMAIL_USER or EMAIL_PASS not set in environment variables');
    console.log('\nPlease set the following environment variables:');
    console.log('  EMAIL_HOST (e.g., smtp.gmail.com)');
    console.log('  EMAIL_PORT (e.g., 587)');
    console.log('  EMAIL_USER (your email address)');
    console.log('  EMAIL_PASS (your email password or app password)');
    process.exit(1);
  }

  console.log('✅ Email configuration found:');
  console.log(`   Host: ${process.env.EMAIL_HOST || 'not set (will use default)'}`);
  console.log(`   Port: ${process.env.EMAIL_PORT || '587 (default)'}`);
  console.log(`   User: ${process.env.EMAIL_USER}`);
  console.log(`   Pass: ${process.env.EMAIL_PASS ? '***' : 'not set'}\n`);

  // Create transporter configured for mail.routing.net
  // Try different configurations - some mail servers need specific settings
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const isSecure = port === 465;
  
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    secure: isSecure, // true for 465 (SSL), false for 587 (STARTTLS)
    requireTLS: !isSecure, // Require TLS for non-SSL ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false
    },
    connectionTimeout: 15000, // 15 seconds
    greetingTimeout: 15000,
    socketTimeout: 15000
  });

  // Verify connection (skip if it fails, try sending directly)
  console.log('🔍 Verifying SMTP connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!\n');
  } catch (error) {
    console.warn('⚠️  SMTP verification failed:', error.message);
    console.log('   Continuing anyway - will try to send email directly...\n');
    // Don't exit - some servers fail verify but allow sending
  }

  // Send test email
  const testEmailTo = 'fmalekbenamorf@gmail.com';
  console.log(`📤 Sending test email to: ${testEmailTo}...`);

  const mailOptions = {
    from: `Andiamo Events <${process.env.EMAIL_USER}>`,
    to: testEmailTo,
    subject: '✅ Test Email - Andiamo Events Email Configuration',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Email - Andiamo Events</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f4f4f4; 
            padding: 20px; 
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 0 10px rgba(0,0,0,0.1); 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 10px 10px 0 0; 
            margin: -30px -30px 30px -30px; 
          }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 20px 0; }
          .success-box { 
            background: #d4edda; 
            border: 1px solid #c3e6cb; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
          }
          .success-box h3 { color: #155724; margin-top: 0; }
          .info-box { 
            background: #f9f9f9; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
          }
          .info-box p { margin: 10px 0; }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
            color: #666; 
            font-size: 14px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Test Email Successful!</h1>
          </div>
          <div class="content">
            <p>Dear User,</p>
            
            <div class="success-box">
              <h3>🎉 Email Configuration Test</h3>
              <p>This is a test email to verify that your email configuration is working correctly.</p>
              <p><strong>If you received this email, your email service is properly configured!</strong></p>
            </div>

            <div class="info-box">
              <h3>📋 Test Details</h3>
              <p><strong>Sent from:</strong> ${process.env.EMAIL_USER}</p>
              <p><strong>Sent to:</strong> ${testEmailTo}</p>
              <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Server:</strong> ${process.env.EMAIL_HOST || 'default'}:${process.env.EMAIL_PORT || '587'}</p>
            </div>

            <p>This test email confirms that:</p>
            <ul>
              <li>✅ SMTP connection is working</li>
              <li>✅ Email authentication is successful</li>
              <li>✅ Email sending functionality is operational</li>
            </ul>

            <p>Your Andiamo Events email service is ready to use!</p>
          </div>
          <div class="footer">
            <p>© 2024 Andiamo Events. All rights reserved.</p>
            <p>Tunisia's Premier Nightlife Experience</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Test Email - Andiamo Events Email Configuration

Dear User,

This is a test email to verify that your email configuration is working correctly.

If you received this email, your email service is properly configured!

Test Details:
- Sent from: ${process.env.EMAIL_USER}
- Sent to: ${testEmailTo}
- Sent at: ${new Date().toLocaleString()}
- Server: ${process.env.EMAIL_HOST || 'default'}:${process.env.EMAIL_PORT || '587'}

This test email confirms that:
- SMTP connection is working
- Email authentication is successful
- Email sending functionality is operational

Your Andiamo Events email service is ready to use!

© 2024 Andiamo Events. All rights reserved.
Tunisia's Premier Nightlife Experience
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    console.log(`\n📧 Check the inbox of ${testEmailTo} for the test email.`);
    console.log('   (Also check spam/junk folder if not found)');
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    console.error('\nError details:', error);
    
    if (error.code === 'EAUTH') {
      console.error('\n💡 Authentication failed. Common solutions:');
      console.error('   - For Gmail: Use an App Password instead of your regular password');
      console.error('   - Enable "Less secure app access" (not recommended)');
      console.error('   - Check if 2FA is enabled and use App Password');
    } else if (error.code === 'ECONNECTION') {
      console.error('\n💡 Connection failed. Check:');
      console.error('   - EMAIL_HOST is correct');
      console.error('   - EMAIL_PORT is correct');
      console.error('   - Firewall/network settings');
    }
    
    process.exit(1);
  }
}

// Run the test
testEmail().catch(console.error);

