// Admin logs endpoint for Vercel
// Read-only, admin-only access
// Aggregates logs from site_logs, security_audit_logs, sms_logs, and email_delivery_logs

// Inlined verifyAdminAuth function
async function verifyAdminAuth(req) {
  try {
    const cookies = req.headers.cookie || '';
    const cookieMatch = cookies.match(/adminToken=([^;]+)/);
    const token = cookieMatch ? cookieMatch[1] : null;
    
    if (!token) {
      return {
        valid: false,
        error: 'No authentication token provided',
        statusCode: 401
      };
    }
    
    const jwt = await import('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-dev-only';
    
    const isProduction = process.env.NODE_ENV === 'production' || 
                         process.env.VERCEL === '1' || 
                         !!process.env.VERCEL_URL;
    
    if (!jwtSecret || jwtSecret === 'fallback-secret-dev-only') {
      if (isProduction) {
        return {
          valid: false,
          error: 'Server configuration error: JWT_SECRET not set',
          statusCode: 500
        };
      }
    }
    
    let decoded;
    try {
      decoded = jwt.default.verify(token, jwtSecret);
    } catch (jwtError) {
      return {
        valid: false,
        error: 'Invalid or expired token',
        reason: jwtError.name === 'TokenExpiredError' 
          ? 'Token expired - session ended' 
          : jwtError.message,
        statusCode: 401
      };
    }
    
    if (!decoded.id || !decoded.email || !decoded.role) {
      return {
        valid: false,
        error: 'Invalid token payload',
        statusCode: 401
      };
    }
    
    if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
      return {
        valid: false,
        error: 'Invalid admin role',
        statusCode: 403
      };
    }
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return {
        valid: false,
        error: 'Supabase not configured',
        statusCode: 500
      };
    }
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data: admin, error: dbError } = await supabase
      .from('admins')
      .select('id, email, name, role, is_active')
      .eq('id', decoded.id)
      .eq('email', decoded.email)
      .eq('is_active', true)
      .single();
    
    if (dbError || !admin) {
      return {
        valid: false,
        error: 'Admin not found or inactive',
        statusCode: 401
      };
    }
    
    return {
      valid: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    };
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return {
      valid: false,
      error: 'Authentication error',
      details: error.message,
      statusCode: 500
    };
  }
}

// Import shared CORS utility (using dynamic import for ES modules)
let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) {
    corsUtils = await import('../utils/cors.js');
  }
  return corsUtils;
}

export default async (req, res) => {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  
  // Handle preflight requests
  if (handlePreflight(req, res, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    return; // Preflight handled
  }
  
  // Set CORS headers for actual requests (credentials needed for cookies)
  if (!setCORSHeaders(res, req, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    if (req.headers.origin) {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }
  
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  const authResult = await verifyAdminAuth(req);
  if (!authResult.valid) {
    return res.status(authResult.statusCode || 401).json({
      error: authResult.error,
      details: authResult.details || authResult.reason
    });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ 
      error: 'Supabase not configured',
      details: 'Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables'
    });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Parse query parameters (all optional)
    const {
      type,           // log_type: info, warning, error, success, action
      category,       // category filter
      userRole,      // user_type: admin, ambassador, guest
      userId,        // user_id UUID
      startDate,     // ISO date string
      endDate,       // ISO date string
      search,        // Full-text search on message
      limit = '50',  // Pagination limit (default 50, max 200)
      offset = '0',  // Pagination offset
      sortBy = 'time', // Sort by: time, type
      order = 'desc'  // Sort order: asc, desc
    } = req.query;

    // Validate and sanitize inputs
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
    const sortOrder = order === 'asc' ? 'asc' : 'desc';
    
    // Validate date range (max 30 days default, but allow override)
    let startDateObj = null;
    let endDateObj = null;
    if (startDate) {
      startDateObj = new Date(startDate);
      if (isNaN(startDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid startDate format. Use ISO 8601 format.' });
      }
    }
    if (endDate) {
      endDateObj = new Date(endDate);
      if (isNaN(endDateObj.getTime())) {
        return res.status(400).json({ error: 'Invalid endDate format. Use ISO 8601 format.' });
      }
    }
    
    // Default to last 30 days if no date range specified
    if (!startDateObj && !endDateObj) {
      endDateObj = new Date();
      startDateObj = new Date();
      startDateObj.setDate(startDateObj.getDate() - 30);
    } else if (!startDateObj) {
      startDateObj = new Date(endDateObj);
      startDateObj.setDate(startDateObj.getDate() - 30);
    } else if (!endDateObj) {
      endDateObj = new Date();
    }

    // Ensure endDate is after startDate
    if (endDateObj < startDateObj) {
      return res.status(400).json({ error: 'endDate must be after startDate' });
    }

    // Build queries for each log table
    const allLogs = [];

    // 1. Query site_logs
    try {
      let siteLogsQuery = supabase
        .from('site_logs')
        .select('*', { count: 'exact' });

      if (type) {
        siteLogsQuery = siteLogsQuery.eq('log_type', type);
      }
      if (category) {
        siteLogsQuery = siteLogsQuery.eq('category', category);
      }
      if (userRole) {
        siteLogsQuery = siteLogsQuery.eq('user_type', userRole);
      }
      if (userId) {
        siteLogsQuery = siteLogsQuery.eq('user_id', userId);
      }
      if (startDateObj) {
        siteLogsQuery = siteLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        siteLogsQuery = siteLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        // Full-text search on message field
        siteLogsQuery = siteLogsQuery.ilike('message', `%${search}%`);
      }

      siteLogsQuery = siteLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: siteLogs, error: siteLogsError } = await siteLogsQuery;

      if (!siteLogsError && siteLogs) {
        siteLogs.forEach(log => {
          allLogs.push({
            id: log.id,
            source: 'site_logs',
            log_type: log.log_type,
            category: log.category,
            message: log.message,
            details: log.details,
            user_id: log.user_id,
            user_type: log.user_type,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            page_url: log.page_url,
            request_method: log.request_method,
            request_path: log.request_path,
            response_status: log.response_status,
            error_stack: log.error_stack,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying site_logs:', err.message);
    }

    // 2. Query security_audit_logs
    try {
      let securityLogsQuery = supabase
        .from('security_audit_logs')
        .select('*');

      if (userRole) {
        // Security logs don't have user_type, but we can filter by user_id if provided
        if (userId) {
          securityLogsQuery = securityLogsQuery.eq('user_id', userId);
        }
      }
      if (startDateObj) {
        securityLogsQuery = securityLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        securityLogsQuery = securityLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        securityLogsQuery = securityLogsQuery.or(`event_type.ilike.%${search}%,endpoint.ilike.%${search}%`);
      }

      securityLogsQuery = securityLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: securityLogs, error: securityLogsError } = await securityLogsQuery;

      if (!securityLogsError && securityLogs) {
        securityLogs.forEach(log => {
          // Map security log to unified format
          const logType = log.severity === 'critical' || log.severity === 'high' ? 'error' :
                         log.severity === 'medium' ? 'warning' : 'info';
          
          allLogs.push({
            id: log.id,
            source: 'security_audit_logs',
            log_type: logType,
            category: 'security',
            message: `${log.event_type}: ${log.endpoint}`,
            details: {
              event_type: log.event_type,
              endpoint: log.endpoint,
              request_method: log.request_method,
              request_path: log.request_path,
              request_body: log.request_body,
              response_status: log.response_status,
              severity: log.severity,
              ...log.details
            },
            user_id: log.user_id,
            user_type: null, // Security logs don't have user_type
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            request_method: log.request_method,
            request_path: log.request_path,
            response_status: log.response_status,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying security_audit_logs:', err.message);
    }

    // 3. Query sms_logs
    try {
      let smsLogsQuery = supabase
        .from('sms_logs')
        .select('*');

      if (startDateObj) {
        smsLogsQuery = smsLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        smsLogsQuery = smsLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        smsLogsQuery = smsLogsQuery.or(`phone_number.ilike.%${search}%,message.ilike.%${search}%`);
      }

      smsLogsQuery = smsLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: smsLogs, error: smsLogsError } = await smsLogsQuery;

      if (!smsLogsError && smsLogs) {
        smsLogs.forEach(log => {
          const logType = log.status === 'failed' ? 'error' :
                         log.status === 'sent' ? 'success' : 'info';
          
          allLogs.push({
            id: log.id,
            source: 'sms_logs',
            log_type: logType,
            category: 'sms',
            message: `SMS ${log.status}: ${log.phone_number}`,
            details: {
              phone_number: log.phone_number,
              message: log.message,
              status: log.status,
              api_response: log.api_response,
              error_message: log.error_message,
              sent_at: log.sent_at
            },
            user_id: null,
            user_type: null,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying sms_logs:', err.message);
    }

    // 4. Query email_delivery_logs
    try {
      let emailLogsQuery = supabase
        .from('email_delivery_logs')
        .select('*');

      if (startDateObj) {
        emailLogsQuery = emailLogsQuery.gte('created_at', startDateObj.toISOString());
      }
      if (endDateObj) {
        emailLogsQuery = emailLogsQuery.lte('created_at', endDateObj.toISOString());
      }
      if (search) {
        emailLogsQuery = emailLogsQuery.or(`recipient_email.ilike.%${search}%,subject.ilike.%${search}%`);
      }

      emailLogsQuery = emailLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });

      const { data: emailLogs, error: emailLogsError } = await emailLogsQuery;

      if (!emailLogsError && emailLogs) {
        emailLogs.forEach(log => {
          const logType = log.status === 'failed' ? 'error' :
                         log.status === 'sent' ? 'success' : 'info';
          
          allLogs.push({
            id: log.id,
            source: 'email_delivery_logs',
            log_type: logType,
            category: 'email',
            message: `Email ${log.status}: ${log.email_type} to ${log.recipient_email}`,
            details: {
              order_id: log.order_id,
              email_type: log.email_type,
              recipient_email: log.recipient_email,
              recipient_name: log.recipient_name,
              subject: log.subject,
              status: log.status,
              error_message: log.error_message,
              sent_at: log.sent_at,
              retry_count: log.retry_count
            },
            user_id: null,
            user_type: null,
            created_at: log.created_at
          });
        });
      }
    } catch (err) {
      console.warn('Error querying email_delivery_logs:', err.message);
    }

    // Sort all logs by created_at
    allLogs.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Apply pagination
    const total = allLogs.length;
    const paginatedLogs = allLogs.slice(offsetNum, offsetNum + limitNum);

    // Mask sensitive data before sending
    const maskedLogs = paginatedLogs.map(log => {
      const masked = { ...log };
      
      // Mask email addresses (show first 3 chars + domain)
      if (masked.details?.recipient_email) {
        const email = masked.details.recipient_email;
        const [local, domain] = email.split('@');
        if (local && domain) {
          masked.details.recipient_email = `${local.substring(0, 3)}***@${domain}`;
        }
      }
      
      // Mask phone numbers (show last 4 digits)
      if (masked.details?.phone_number) {
        const phone = masked.details.phone_number;
        masked.details.phone_number = `***${phone.slice(-4)}`;
      }
      
      // Mask tokens in request_body
      if (masked.details?.request_body) {
        const body = JSON.stringify(masked.details.request_body);
        if (body.includes('token') || body.includes('password')) {
          masked.details.request_body = '[REDACTED - Contains sensitive data]';
        }
      }
      
      // Mask IP addresses (show first 2 octets)
      if (masked.ip_address && masked.ip_address !== 'unknown') {
        const parts = masked.ip_address.split('.');
        if (parts.length === 4) {
          masked.ip_address = `${parts[0]}.${parts[1]}.***.***`;
        }
      }
      
      return masked;
    });

    res.json({
      success: true,
      logs: maskedLogs,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total
      },
      filters: {
        type: type || null,
        category: category || null,
        userRole: userRole || null,
        userId: userId || null,
        startDate: startDateObj?.toISOString() || null,
        endDate: endDateObj?.toISOString() || null,
        search: search || null
      }
    });
  } catch (error) {
    console.error('❌ /api/admin/logs: Error:', {
      error: error.message,
      stack: error.stack,
      adminId: authResult.admin?.id
    });
    res.status(500).json({ 
      error: 'Server error',
      details: error.message || 'An unexpected error occurred while fetching logs'
    });
  }
};
