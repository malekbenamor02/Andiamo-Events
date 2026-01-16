// API endpoint to auto-reject expired PENDING_CASH orders
// This can be called by Vercel Cron Jobs or external cron services
// 
// Vercel Cron Job configuration (add to vercel.json):
// {
//   "crons": [{
//     "path": "/api/auto-reject-expired-orders",
//     "schedule": "*/5 * * * *"  // Every 5 minutes
//   }]
// }

export default async function handler(req, res) {
  // Only allow POST or GET (for cron jobs)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add authentication for security
  // For cron jobs, you can use a secret token
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
    if (providedSecret !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        error: 'Server configuration error',
        details: 'Supabase not configured'
      });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Call the database function to auto-reject expired orders
    const { data, error } = await supabase.rpc('auto_reject_expired_pending_cash_orders');

    if (error) {
      console.error('Error auto-rejecting expired orders:', error);
      return res.status(500).json({
        error: 'Failed to auto-reject expired orders',
        details: error.message
      });
    }

    const result = data && data[0] ? data[0] : { rejected_count: 0, rejected_order_ids: [] };

    return res.status(200).json({
      success: true,
      rejected_count: result.rejected_count || 0,
      rejected_order_ids: result.rejected_order_ids || [],
      message: `Auto-rejected ${result.rejected_count || 0} expired order(s)`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in auto-reject-expired-orders:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}
