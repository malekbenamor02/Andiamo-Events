const nodemailer = require('nodemailer');

// ==============================
// EMAIL CONFIG (UPDATED)
// ==============================
const EMAIL_CONFIG = {
  host: 'mail.routing.net',
  port: 587,
  secure: false, // STARTTLS for 587
  user: 'contact@andiamoevents.com',
  pass: 'btl@btl.com123'
};

// ==============================
// EMAIL CONTENT (UNCHANGED)
// ==============================
const TEST_EMAIL = {
  from: `Andiamo Events <${EMAIL_CONFIG.user}>`,
  to: 'fmalekbenamorf@gmail.com',
  subject: 'Test Email from Andiamo Events',
  html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Email</title>
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
      background: linear-gradient(135deg, #E21836 0%, #c4162f 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
      margin: -30px -30px 30px -30px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .content {
      padding: 20px 0;
    }
    .success-box {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .success-box h3 {
      color: #155724;
      margin-top: 0;
    }
    .info-box {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .info-box p {
      margin: 10px 0;
    }
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
        <h3>🎉 Email Test</h3>
        <p>This is a test email sent from Andiamo Events support email.</p>
        <p>If you received this email, the email configuration is working correctly!</p>
      </div>

      <div class="info-box">
        <h3>📧 Email Details:</h3>
        <p><strong>From:</strong> ${EMAIL_CONFIG.user}</p>
        <p><strong>To:</strong> fmalekbenamorf@gmail.com</p>
        <p><strong>Sent At:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Server:</strong> ${EMAIL_CONFIG.host}:${EMAIL_CONFIG.port}</p>
      </div>

      <p>This is a simple test to verify that the email sending functionality is working properly.</p>

      <p>Best regards,<br>
      <strong>The Andiamo Events Team</strong></p>
    </div>
    <div class="footer">
      <p>© 2024 Andiamo Events. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`
};

// ==============================
// SEND EMAIL
// ==============================
async function sendTestEmail() {
  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.host,
      port: EMAIL_CONFIG.port,
      secure: false,
      auth: {
        user: EMAIL_CONFIG.user,
        pass: EMAIL_CONFIG.pass
      },
      name: 'andiamoevents.com',
      tls: {
        minVersion: 'TLSv1.2'
      }
    });

    console.log('🔍 Verifying SMTP...');
    await transporter.verify();
    console.log('✅ SMTP verified');

    console.log('📤 Sending email...');
    const info = await transporter.sendMail(TEST_EMAIL);

    console.log('✅ Email sent successfully');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ Email failed');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Response:', error.response);
  }
}

sendTestEmail();
