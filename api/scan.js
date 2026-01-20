// Scan system API — delegates to Express app in server.cjs
// Handles: scan-system-status, scanner-login, scanner-logout, admin/scan-system-config,
// admin/scanners, admin/scanners/:id, admin/scanners/:id/scans, admin/scanners/:id/statistics,
// admin/scan-history, admin/scan-statistics, scanner/validate-ticket, scanner/events,
// scanner/scans, scanner/statistics

const app = require('../server.cjs');

module.exports = (req, res) => app(req, res);
