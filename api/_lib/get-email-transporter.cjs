'use strict';

const nodemailer = require('nodemailer');

/** SMTP transporter for transactional-email fallback (same env as career / misc). */
function getEmailTransporter() {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false,
    auth: { user, pass },
  });
}

module.exports = { getEmailTransporter };
