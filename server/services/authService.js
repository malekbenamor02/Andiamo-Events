/**
 * Authentication service
 * Business logic for authentication operations
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSupabase } = require('../utils/supabase');

/**
 * Verify reCAPTCHA token
 */
async function verifyRecaptcha(recaptchaToken) {
  // Bypass for localhost development
  if (recaptchaToken === 'localhost-bypass-token' || !process.env.RECAPTCHA_SECRET_KEY) {
    return { success: true, bypassed: true };
  }

  try {
    const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
    });

    const verifyData = await verifyResponse.json();
    return verifyData;
  } catch (error) {
    throw new Error('reCAPTCHA verification service unavailable');
  }
}

/**
 * Authenticate admin
 */
async function authenticateAdmin(email, password) {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: admin, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (error || !admin) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  if (!admin.is_active) {
    throw new Error('Account is inactive');
  }

  return admin;
}

/**
 * Authenticate ambassador
 */
async function authenticateAmbassador(phone, password) {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: ambassador, error } = await supabase
    .from('ambassadors')
    .select('*')
    .eq('phone', phone.trim())
    .single();

  if (error || !ambassador) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await bcrypt.compare(password, ambassador.password);
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  if (ambassador.status === 'pending') {
    throw new Error('Application is under review');
  }

  if (ambassador.status === 'rejected') {
    throw new Error('Application was not approved');
  }

  return ambassador;
}

/**
 * Generate JWT token
 */
function generateToken(payload, expiresIn = '1h') {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is required in production');
    }
    console.warn('WARNING: JWT_SECRET not set! Using fallback for development only.');
  }

  if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
  }

  return jwt.sign(payload, jwtSecret || 'fallback-secret-dev-only', { expiresIn });
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
  return jwt.verify(token, jwtSecret);
}

/**
 * Get admin by ID
 */
async function getAdminById(adminId) {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: admin, error } = await supabase
    .from('admins')
    .select('id, email, name, role, is_active')
    .eq('id', adminId)
    .eq('is_active', true)
    .single();

  if (error || !admin) {
    throw new Error('Admin not found');
  }

  return admin;
}

/**
 * Get ambassador by ID
 */
async function getAmbassadorById(ambassadorId) {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data: ambassador, error } = await supabase
    .from('ambassadors')
    .select('id, full_name, phone, email, city, ville, status')
    .eq('id', ambassadorId)
    .in('status', ['approved', 'active'])
    .single();

  if (error || !ambassador) {
    throw new Error('Ambassador not found');
  }

  return ambassador;
}

module.exports = {
  verifyRecaptcha,
  authenticateAdmin,
  authenticateAmbassador,
  generateToken,
  verifyToken,
  getAdminById,
  getAmbassadorById
};

