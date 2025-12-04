/**
 * SMS routes
 * All SMS-related endpoints
 */

const express = require('express');
const router = express.Router();
const smsController = require('../controllers/smsController');
const { smsLimiter } = require('../middleware/rateLimiter');
const { validateRequired } = require('../middleware/validation');

// Check SMS balance
router.get('/balance', smsController.checkBalance);

// Send SMS broadcast
router.post('/send', 
  smsLimiter, 
  validateRequired(['phoneNumbers', 'message']), 
  smsController.sendSMS
);

// Add bulk phone numbers
router.post('/bulk-phones', 
  validateRequired(['phoneNumbers']), 
  smsController.addBulkPhones
);

module.exports = router;

