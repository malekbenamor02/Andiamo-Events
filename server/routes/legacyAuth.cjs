/**
 * Legacy authentication routes
 * Backward compatibility for old route paths
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController.cjs');
const { requireAdminAuth, requireAmbassadorAuth } = require('../middleware/auth.cjs');
const { authLimiter } = require('../middleware/rateLimiter.cjs');
const { validateRequired } = require('../middleware/validation.cjs');

// Legacy admin routes - map to v1 routes
router.post('/admin-login', authLimiter, validateRequired(['email', 'password']), authController.adminLogin);
router.post('/admin-logout', authController.adminLogout);
router.get('/verify-admin', requireAdminAuth, authController.verifyAdmin);

// Legacy ambassador routes - map to v1 routes
router.post('/ambassador-login', authLimiter, validateRequired(['phone', 'password']), authController.ambassadorLogin);
router.post('/ambassador-logout', authController.ambassadorLogout);
router.get('/verify-ambassador', requireAmbassadorAuth, authController.verifyAmbassador);

// Legacy reCAPTCHA route
router.post('/verify-recaptcha', validateRequired(['recaptchaToken']), authController.verifyRecaptcha);

module.exports = router;

