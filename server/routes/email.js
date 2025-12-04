/**
 * Email routes
 * All email-related endpoints
 */

const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { emailLimiter } = require('../middleware/rateLimiter');
const { validateRequired, validateEmail } = require('../middleware/validation');

// Send email
router.post('/send', 
  emailLimiter, 
  validateRequired(['to', 'subject', 'html']), 
  validateEmail('to'),
  emailController.sendEmail
);

module.exports = router;

