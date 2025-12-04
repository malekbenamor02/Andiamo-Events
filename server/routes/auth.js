/**
 * Authentication routes
 * All authentication-related endpoints
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAdminAuth, requireAmbassadorAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validateRequired } = require('../middleware/validation');

// Admin routes
router.post('/admin/login', authLimiter, validateRequired(['email', 'password']), authController.adminLogin);
router.post('/admin/logout', authController.adminLogout);
router.get('/admin/verify', requireAdminAuth, authController.verifyAdmin);

// Ambassador routes
router.post('/ambassador/login', authLimiter, validateRequired(['phone', 'password']), authController.ambassadorLogin);
router.post('/ambassador/logout', authController.ambassadorLogout);
router.get('/ambassador/verify', requireAmbassadorAuth, authController.verifyAmbassador);

// reCAPTCHA verification
router.post('/recaptcha/verify', validateRequired(['recaptchaToken']), authController.verifyRecaptcha);

module.exports = router;

