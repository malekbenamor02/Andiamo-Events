/**
 * CSP (Content Security Policy) Violation Reporting Endpoint
 * Receives and logs CSP violation reports from browsers
 * 
 * This endpoint is used in report-only mode to collect violations
 * before enforcing CSP policies.
 */

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse the CSP report
    let reportData;
    if (req.body && typeof req.body === 'object') {
      reportData = req.body;
    } else {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      reportData = JSON.parse(body || '{}');
    }

    // Extract violation details
    const cspReport = reportData['csp-report'] || reportData;
    const violation = {
      documentUri: cspReport['document-uri'] || cspReport.documentUri || 'unknown',
      referrer: cspReport.referrer || 'unknown',
      violatedDirective: cspReport['violated-directive'] || cspReport.violatedDirective || 'unknown',
      effectiveDirective: cspReport['effective-directive'] || cspReport.effectiveDirective || 'unknown',
      originalPolicy: cspReport['original-policy'] || cspReport.originalPolicy || 'unknown',
      blockedUri: cspReport['blocked-uri'] || cspReport.blockedUri || 'unknown',
      sourceFile: cspReport['source-file'] || cspReport.sourceFile || 'unknown',
      lineNumber: cspReport['line-number'] || cspReport.lineNumber || null,
      columnNumber: cspReport['column-number'] || cspReport.columnNumber || null,
      statusCode: cspReport['status-code'] || cspReport.statusCode || null,
    };

    // Log violation (console for now, can be extended to database)
    console.warn('🚨 CSP Violation Report:', {
      timestamp: new Date().toISOString(),
      violation: violation.violatedDirective,
      blockedUri: violation.blockedUri,
      documentUri: violation.documentUri,
      sourceFile: violation.sourceFile,
      lineNumber: violation.lineNumber,
      columnNumber: violation.columnNumber,
    });

    // Optional: Store in database for analysis
    // This can be enabled if you want to track violations over time
    if (process.env.ENABLE_CSP_LOGGING === 'true' && process.env.SUPABASE_URL) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
        );

        // Create table if it doesn't exist (run migration separately)
        // For now, just log to console
        // await supabase.from('csp_violations').insert({
        //   document_uri: violation.documentUri,
        //   blocked_uri: violation.blockedUri,
        //   violated_directive: violation.violatedDirective,
        //   effective_directive: violation.effectiveDirective,
        //   source_file: violation.sourceFile,
        //   line_number: violation.lineNumber,
        //   column_number: violation.columnNumber,
        //   referrer: violation.referrer,
        //   created_at: new Date().toISOString()
        // });
      } catch (dbError) {
        console.error('Failed to log CSP violation to database:', dbError);
      }
    }

    // Return 204 No Content (standard for CSP reporting)
    res.status(204).end();
  } catch (error) {
    console.error('Error processing CSP report:', error);
    // Still return 204 to prevent retries
    res.status(204).end();
  }
}
