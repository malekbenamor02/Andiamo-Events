/**
 * Email service configuration
 * Centralized email transporter setup
 */

const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Initialize email transporter
 */
function initializeEmail() {
  if (!transporter && process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

/**
 * Get email transporter
 */
function getEmailTransporter() {
  if (!transporter) {
    initializeEmail();
  }
  return transporter;
}

/**
 * Check if email is configured
 */
function isEmailConfigured() {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_HOST);
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = {
  initializeEmail,
  getEmailTransporter,
  isEmailConfigured,
  validateEmail
};

