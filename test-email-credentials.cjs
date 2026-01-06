const nodemailer = require('nodemailer');
require('dotenv').config();

// Diagnostic script to test email credentials
async function diagnoseEmailCredentials() {
  console.log('🔍 Email Credentials Diagnostic Tool\n');
  console.log('='.repeat(60));

  // Step 1: Check environment variables
  console.log('\n📋 Step 1: Checking Environment Variables');
  console.log('-'.repeat(60));
  
  const emailHost = process.env.EMAIL_HOST;
  const emailPort = process.env.EMAIL_PORT || '587';
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  console.log(`EMAIL_HOST: ${emailHost || '❌ NOT SET'}`);
  console.log(`EMAIL_PORT: ${emailPort}`);
  console.log(`EMAIL_USER: ${emailUser || '❌ NOT SET'}`);
  console.log(`EMAIL_PASS: ${emailPass ? `✅ SET (length: ${emailPass.length})` : '❌ NOT SET'}`);

  if (!emailHost || !emailUser || !emailPass) {
    console.error('\n❌ ERROR: Missing required environment variables!');
    console.log('\nPlease set the following in your .env file:');
    console.log('  EMAIL_HOST=mail.routing.net');
    console.log('  EMAIL_PORT=587');
    console.log('  EMAIL_USER=support@andiamoevents.com');
    console.log('  EMAIL_PASS=your_password_here');
    process.exit(1);
  }

  // Step 2: Check for common issues
  console.log('\n🔍 Step 2: Checking for Common Issues');
  console.log('-'.repeat(60));
  
  const issues = [];
  
  // Check for whitespace
  if (emailUser !== emailUser.trim()) {
    issues.push('⚠️  EMAIL_USER has leading/trailing whitespace');
  }
  if (emailPass !== emailPass.trim() && emailPass.trim().length > 0) {
    issues.push('⚠️  EMAIL_PASS has leading/trailing whitespace (might be intentional)');
  }
  
  // Check password length
  if (emailPass.length < 8) {
    issues.push('⚠️  EMAIL_PASS is very short (less than 8 characters)');
  }
  
  // Check for special characters that might need encoding
  const specialChars = /[!@#$%^&*(),.?":{}|<>]/;
  if (specialChars.test(emailPass)) {
    issues.push('ℹ️  EMAIL_PASS contains special characters (may need URL encoding)');
  }
  
  // Check email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailUser)) {
    issues.push('❌ EMAIL_USER is not a valid email format');
  }

  if (issues.length > 0) {
    console.log('Found potential issues:');
    issues.forEach(issue => console.log(`  ${issue}`));
  } else {
    console.log('✅ No obvious issues found');
  }

  // Step 3: Test different authentication methods
  console.log('\n🧪 Step 3: Testing Authentication Methods');
  console.log('-'.repeat(60));

  const testConfigs = [
    {
      name: 'Method 1: Default (auto-detect)',
      config: {
        host: emailHost,
        port: parseInt(emailPort),
        secure: false,
        requireTLS: true,
        auth: {
          user: emailUser.trim(),
          pass: emailPass
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Method 2: Explicit LOGIN',
      config: {
        host: emailHost,
        port: parseInt(emailPort),
        secure: false,
        requireTLS: true,
        auth: {
          user: emailUser.trim(),
          pass: emailPass,
          method: 'LOGIN'
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    },
    {
      name: 'Method 3: URL-encoded password',
      config: {
        host: emailHost,
        port: parseInt(emailPort),
        secure: false,
        requireTLS: true,
        auth: {
          user: emailUser.trim(),
          pass: encodeURIComponent(emailPass)
        },
        tls: {
          rejectUnauthorized: false
        }
      }
    }
  ];

  for (const testConfig of testConfigs) {
    console.log(`\nTesting: ${testConfig.name}...`);
    try {
      const transporter = nodemailer.createTransport(testConfig.config);
      
      // Try to verify connection
      await transporter.verify();
      console.log(`  ✅ ${testConfig.name} - Connection verified!`);
      
      // Try to send a test email
      const testEmail = {
        from: `Test <${emailUser.trim()}>`,
        to: 'fmalekbenamorf@gmail.com',
        subject: `Test Email - ${testConfig.name}`,
        text: `This is a test email using ${testConfig.name}`
      };
      
      const info = await transporter.sendMail(testEmail);
      console.log(`  ✅ ${testConfig.name} - Test email sent successfully!`);
      console.log(`     Message ID: ${info.messageId}`);
      
      // If we get here, this method works!
      console.log(`\n🎉 SUCCESS! ${testConfig.name} works correctly!`);
      console.log('\nRecommended configuration:');
      console.log(JSON.stringify(testConfig.config, null, 2));
      process.exit(0);
      
    } catch (error) {
      console.log(`  ❌ ${testConfig.name} - Failed`);
      console.log(`     Error: ${error.message}`);
      console.log(`     Code: ${error.code || 'N/A'}`);
      console.log(`     Response: ${error.response || 'N/A'}`);
      console.log(`     ResponseCode: ${error.responseCode || 'N/A'}`);
    }
  }

  // Step 4: Additional diagnostics
  console.log('\n📊 Step 4: Additional Diagnostics');
  console.log('-'.repeat(60));
  console.log('\nPassword analysis:');
  console.log(`  Length: ${emailPass.length} characters`);
  console.log(`  First char: "${emailPass[0]}"`);
  console.log(`  Last char: "${emailPass[emailPass.length - 1]}"`);
  console.log(`  Contains spaces: ${emailPass.includes(' ') ? 'Yes' : 'No'}`);
  console.log(`  Contains quotes: ${emailPass.includes('"') || emailPass.includes("'") ? 'Yes' : 'No'}`);
  
  console.log('\n💡 Troubleshooting Tips:');
  console.log('1. Verify your password is correct (try logging into webmail)');
  console.log('2. Check if your email provider requires an "App Password" instead of regular password');
  console.log('3. Ensure the password hasn\'t expired');
  console.log('4. Check if your account is locked due to too many failed attempts');
  console.log('5. Verify EMAIL_HOST and EMAIL_PORT are correct for your email provider');
  console.log('6. Some special characters in passwords may need to be URL-encoded');
  
  console.log('\n❌ All authentication methods failed. Please check your credentials.');
  process.exit(1);
}

// Run the diagnostic
diagnoseEmailCredentials().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

