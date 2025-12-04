/**
 * Email routes
 * All email-related endpoints
 */

const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController.cjs');
const { emailLimiter } = require('../middleware/rateLimiter.cjs');
const { validateRequired, validateEmail } = require('../middleware/validation.cjs');

// Send email
router.post('/send', 
  emailLimiter, 
  validateRequired(['to', 'subject', 'html']), 
  validateEmail('to'),
  emailController.sendEmail
);

module.exports = router;

