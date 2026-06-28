'use strict';

const { buildReportsExcelBuffer } = require('./reports-excel-export.cjs');
const { loadReportsExportPayload } = require('./reports-export-data.cjs');
const { writeAdminMutationAudit } = require('./admin-mutation-audit.js');

function registerReportsExportRoute(app, deps) {
  const { supabaseService, requireAdminAuth, requireAdminPermission } = deps;

  function requireServiceDb(res) {
    if (!supabaseService) {
      res.status(503).json({ error: 'Server configuration error' });
      return null;
    }
    return supabaseService;
  }

  app.get(
    '/api/admin/reports/export',
    requireAdminAuth,
    requireAdminPermission('reports:view'),
    async (req, res) => {
      const db = requireServiceDb(res);
      if (!db) return;

      const eventId = typeof req.query.event_id === 'string' && req.query.event_id ? req.query.event_id : null;
      const eventName =
        typeof req.query.event_name === 'string' && req.query.event_name.trim()
          ? req.query.event_name.trim().slice(0, 200)
          : null;
      const dateRange =
        req.query.date_range === 'LAST_7_DAYS' || req.query.date_range === 'LAST_30_DAYS'
          ? req.query.date_range
          : 'ALL_TIME';
      const language = req.query.language === 'fr' ? 'fr' : 'en';

      const auditBase = {
        report_type: 'sales_excel',
        event_id: eventId,
        date_range: dateRange,
        language,
      };

      try {
        const payload = await loadReportsExportPayload(db, { eventId, dateRange });
        // Excel sheet protection is accidental-edit protection only; access control is enforced server-side.
        const { buffer, filename, rowCount } = await buildReportsExcelBuffer({
          eventId,
          eventName,
          dateRange,
          language,
          orders: payload.orders,
          ambassadorRoster: payload.ambassadorRoster,
          eventPassNames: payload.eventPassNames,
          passStockRows: payload.passStockRows,
        });

        await writeAdminMutationAudit(db, {
          admin: req.admin,
          action: 'reports_excel_export',
          targetType: 'report',
          targetId: eventId || 'all_events',
          details: { ...auditBase, success: true, row_count: rowCount },
        });

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-store');
        return res.send(buffer);
      } catch (err) {
        console.error('[reports/export]', err?.message || err);
        await writeAdminMutationAudit(db, {
          admin: req.admin,
          action: 'reports_excel_export',
          targetType: 'report',
          targetId: eventId || 'all_events',
          details: { ...auditBase, success: false, error: String(err?.message || 'export_failed') },
        });
        return res.status(500).json({ error: 'Report export failed' });
      }
    }
  );
}

module.exports = { registerReportsExportRoute };
