// Admin update application status endpoint for Vercel
// Handles approving/rejecting ambassador applications
// Using ES module syntax because package.json has "type": "module"

export default async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'This endpoint only accepts POST requests'
    });
  }
  
  try {
    // Verify admin authentication
    const { verifyAdminAuth } = await import('./authAdminMiddleware.js');
    const authResult = await verifyAdminAuth(req);
    
    if (!authResult.valid) {
      return res.status(authResult.statusCode || 401).json({
        error: authResult.error,
        reason: authResult.reason || 'Authentication failed',
        valid: false
      });
    }
    
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('Missing environment variables:', {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY
      });
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Supabase not configured. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.'
      });
    }
    
    // Parse request body
    let bodyData;
    if (req.body) {
      bodyData = req.body;
    } else {
      let body = '';
      for await (const chunk of req) {
        body += chunk.toString();
      }
      bodyData = JSON.parse(body);
    }
    
    const { applicationId, status, reapply_delay_date } = bodyData;
    
    // Validate input
    if (!applicationId || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'applicationId and status are required'
      });
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status',
        details: 'status must be "approved" or "rejected"'
      });
    }
    
    // Initialize Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    
    // Prepare update data
    const updateData = {
      status: status
    };
    
    // Include reapply_delay_date if provided (for rejected status)
    if (reapply_delay_date) {
      updateData.reapply_delay_date = reapply_delay_date;
    }
    
    // Try with updated_at first (if column exists)
    let result = await supabase
      .from('ambassador_applications')
      .update({ 
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select();
    
    // If error is about missing updated_at column, try without it
    if (result.error && result.error.message?.includes('updated_at')) {
      result = await supabase
        .from('ambassador_applications')
        .update(updateData)
        .eq('id', applicationId)
        .select();
    }
    
    if (result.error) {
      console.error('Error updating application:', result.error);
      return res.status(500).json({ 
        error: 'Failed to update application',
        details: result.error.message,
        code: result.error.code
      });
    }
    
    if (!result.data || result.data.length === 0) {
      return res.status(404).json({ 
        error: 'Application not found',
        details: `No application found with id: ${applicationId}`
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      data: result.data[0],
      message: `Application ${status} successfully`
    });
    
  } catch (error) {
    console.error('Admin update application error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      type: error.name
    });
  }
};

