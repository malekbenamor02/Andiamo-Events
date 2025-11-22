export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if WinSMS API credentials are configured
    const winsmsApiKey = process.env.WINSMS_API_KEY;
    const winsmsApiUrl = process.env.WINSMS_API_URL || 'https://www.winsms.co.za/api/rest/v1';

    if (!winsmsApiKey) {
      return res.status(200).json({
        success: true,
        balance: null,
        currency: null,
        message: 'SMS API not configured',
        configured: false
      });
    }

    // Fetch balance from WinSMS API
    // Use global fetch (available in Node.js 18+ and Vercel)
    if (typeof fetch === 'undefined') {
      console.error('Fetch is not available in this environment');
      return res.status(200).json({
        success: true,
        balance: null,
        currency: null,
        message: 'Fetch API not available',
        configured: true,
        error: 'Environment does not support fetch API'
      });
    }

    let response;
    try {
      response = await fetch(`${winsmsApiUrl}/credits/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${winsmsApiKey}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return res.status(200).json({
        success: true,
        balance: null,
        currency: null,
        message: 'Unable to connect to SMS provider',
        configured: true,
        error: fetchError?.message || 'Connection error'
      });
    }

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }
      console.error('WinSMS API error:', response.status, errorText);
      
      return res.status(200).json({
        success: true,
        balance: null,
        currency: null,
        message: 'Unable to fetch balance from SMS provider',
        configured: true,
        error: `API returned ${response.status}`
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('Error parsing JSON response:', jsonError);
      return res.status(200).json({
        success: true,
        balance: null,
        currency: null,
        message: 'Invalid response from SMS provider',
        configured: true,
        error: 'JSON parse error'
      });
    }
    
    return res.status(200).json({
      success: true,
      balance: data.balance || data.credits || null,
      currency: data.currency || 'ZAR',
      message: 'Balance retrieved successfully',
      configured: true
    });

  } catch (error) {
    console.error('Error fetching SMS balance:', error);
    
    // Return success with null balance instead of error
    // This prevents the UI from breaking if SMS service is unavailable
    return res.status(200).json({
      success: true,
      balance: null,
      currency: null,
      message: 'SMS service unavailable',
      configured: false,
      error: error?.message || 'Unknown error'
    });
  }
}

