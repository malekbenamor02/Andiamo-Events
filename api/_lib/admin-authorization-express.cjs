'use strict';

const { hasPermission } = require('../../shared/admin/permissions.cjs');
const { verifyAdminSession } = require('./admin-authorization.cjs');

function sendAuthFailure(res, result) {
  const status = result.statusCode || 401;
  return res.status(status).json({
    error: result.error || 'Authentication failed',
    reason: result.reason || result.details || 'Authentication failed',
    valid: false,
  });
}

function sendForbidden(res, details) {
  return res.status(403).json({
    error: 'Forbidden',
    details: details || 'Insufficient permissions',
    valid: false,
  });
}

/** DB-backed admin auth — do not trust JWT payload alone. */
function requireAdminAuth(req, res, next) {
  verifyAdminSession(req, { res })
    .then((result) => {
      if (!result.valid) {
        return sendAuthFailure(res, result);
      }
      req.admin = {
        id: result.admin.id,
        email: result.admin.email,
        name: result.admin.name,
        role: result.admin.role,
        exp: result.exp,
      };
      req.adminPermissions = result.permissions || [];
      req.adminAllowedTabs = result.allowedTabs || [];
      next();
    })
    .catch((err) => {
      console.error('requireAdminAuth error:', err);
      res.status(500).json({
        error: 'Authentication error',
        details: 'An unexpected error occurred during authentication',
        valid: false,
      });
    });
}

/** Requires verified super_admin from DB (must run after requireAdminAuth). */
function requireSuperAdmin(req, res, next) {
  if (!req.admin) {
    return res.status(401).json({
      error: 'Not authenticated',
      valid: false,
    });
  }
  if (req.admin.role !== 'super_admin') {
    return sendForbidden(res, 'This endpoint requires super admin privileges');
  }
  next();
}

/** @param {Array<'admin'|'super_admin'>} roles */
function requireAdminRole(roles) {
  return function requireAdminRoleMiddleware(req, res, next) {
    if (!req.admin) {
      return res.status(401).json({ error: 'Not authenticated', valid: false });
    }
    if (!roles.includes(req.admin.role)) {
      return sendForbidden(res, `Required role: ${roles.join(' or ')}`);
    }
    next();
  };
}

/** @param {string} permissionKey */
function requireAdminPermission(permissionKey) {
  return function requireAdminPermissionMiddleware(req, res, next) {
    if (!req.admin) {
      return res.status(401).json({ error: 'Not authenticated', valid: false });
    }
    if (!hasPermission(req.admin.role, permissionKey)) {
      return sendForbidden(res, `Permission required: ${permissionKey}`);
    }
    next();
  };
}

module.exports = {
  verifyAdminSession,
  hasPermission,
  requireAdminAuth,
  requireSuperAdmin,
  requireAdminRole,
  requireAdminPermission,
};
