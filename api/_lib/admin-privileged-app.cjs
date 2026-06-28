'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const { ensureSupabaseServerEnv } = require('./supabase-env.cjs');

ensureSupabaseServerEnv();

/**
 * Lazy Express app for privileged admin APIs on Vercel (misc.js dispatch).
 * Mirrors server.cjs adminRouteDeps registration order.
 */
let adminPrivilegedAppPromise = null;

async function getAdminPrivilegedApp() {
  if (adminPrivilegedAppPromise) return adminPrivilegedAppPromise;

  adminPrivilegedAppPromise = (async () => {
    const app = express();
    app.use(cookieParser());
    app.use(express.json({ limit: '2mb' }));
    app.use(express.urlencoded({ extended: true, limit: '2mb' }));

    const { createClient } = await import('@supabase/supabase-js');
    const { url: supabaseUrl, anonKey, serviceRoleKey: serviceKey } = ensureSupabaseServerEnv();

    const supabase =
      supabaseUrl && anonKey
        ? createClient(supabaseUrl, anonKey)
        : null;
    const supabaseService =
      supabaseUrl && serviceKey
        ? createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
        : null;

    const {
      requireAdminAuth,
      requireAdminPermission,
      requireSuperAdmin,
    } = require('./admin-authorization-express.cjs');

    const adminRouteDeps = {
      supabase,
      supabaseService,
      requireAdminAuth,
      requireAdminPermission,
      requireSuperAdmin,
    };

    const { registerAdminSiteContentRoutes } = require('./admin-site-content-routes.cjs');
    const { registerAdminAdminsRoutes } = require('./admin-admins-routes.cjs');
    const { registerAdminSponsorsRoutes } = require('./admin-sponsors-routes.cjs');
    const { registerAdminTeamRoutes } = require('./admin-team-routes.cjs');
    const { registerAdminOrdersRoutes } = require('./admin-orders-routes.cjs');
    const { registerAdminAuditLogsRoutes } = require('./admin-audit-logs-routes.cjs');

    registerAdminSiteContentRoutes(app, adminRouteDeps);
    registerAdminAdminsRoutes(app, adminRouteDeps);
    registerAdminSponsorsRoutes(app, adminRouteDeps);
    registerAdminTeamRoutes(app, adminRouteDeps);
    registerAdminOrdersRoutes(app, {
      ...adminRouteDeps,
      generateTicketsAndSendEmail: null,
    });
    registerAdminAuditLogsRoutes(app, adminRouteDeps);

    const { registerReportsExportRoute } = require('./reports-export-route.cjs');
    registerReportsExportRoute(app, adminRouteDeps);

    return app;
  })();

  return adminPrivilegedAppPromise;
}

function isAdminPrivilegedPath(path) {
  if (!path || typeof path !== 'string') return false;
  return (
    path.startsWith('/api/admin/site-content') ||
    path.startsWith('/api/admin/admins') ||
    path.startsWith('/api/admin/sponsors') ||
    path.startsWith('/api/admin/team-members') ||
    path.startsWith('/api/admin/orders') ||
    path.startsWith('/api/admin/analytics/orders') ||
    path.startsWith('/api/admin/analytics/export-orders') ||
    path.startsWith('/api/admin/analytics/order-summaries') ||
    path === '/api/admin/reports/export' ||
    path.startsWith('/api/admin/order-logs') ||
    path === '/api/admin/audit-log' ||
    path.startsWith('/api/admin/audit-logs')
  );
}

module.exports = { getAdminPrivilegedApp, isAdminPrivilegedPath };
