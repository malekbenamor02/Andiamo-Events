/**
 * Request validation middleware
 * Centralized input validation using simple validation functions
 */

/**
 * Validate required fields
 */
function validateRequired(fields) {
  return (req, res, next) => {
    const missing = [];
    
    for (const field of fields) {
      if (!req.body[field] && req.body[field] !== 0 && req.body[field] !== false) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: `Missing fields: ${missing.join(', ')}`
      });
    }

    next();
  };
}

/**
 * Validate email format
 */
function validateEmail(field = 'email') {
  return (req, res, next) => {
    const email = req.body[field] || req.query[field];
    
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email address',
          details: `The email address "${email}" is not valid.`
        });
      }
    }

    next();
  };
}

/**
 * Validate phone number format
 */
function validatePhone(field = 'phone') {
  return (req, res, next) => {
    const phone = req.body[field] || req.query[field];
    
    if (phone) {
      const { isValidPhoneNumber } = require('../utils/phone.cjs');
      if (!isValidPhoneNumber(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number',
          details: `The phone number "${phone}" is not valid.`
        });
      }
    }

    next();
  };
}

/**
 * Validate UUID format
 */
function validateUUID(field = 'id') {
  return (req, res, next) => {
    const uuid = req.params[field] || req.body[field];
    
    if (uuid) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(uuid)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid UUID format',
          details: `The ID "${uuid}" is not a valid UUID.`
        });
      }
    }

    next();
  };
}

module.exports = {
  validateRequired,
  validateEmail,
  validatePhone,
  validateUUID
};

