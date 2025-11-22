export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumbers, message } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'phoneNumbers must be a non-empty array' 
      });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'message is required' 
      });
    }

    // Check if WinSMS API credentials are configured
    const winsmsApiKey = process.env.WINSMS_API_KEY;
    const winsmsApiUrl = process.env.WINSMS_API_URL || 'https://www.winsms.co.za/api/rest/v1';

    if (!winsmsApiKey) {
      return res.status(200).json({
        success: false,
        error: 'SMS API not configured. Please set WINSMS_API_KEY environment variable.',
        sent: 0,
        failed: phoneNumbers.length
      });
    }

    // Send SMS via WinSMS API
    const results = [];
    let successCount = 0;
    let failCount = 0;

    // Check if fetch is available
    if (typeof fetch === 'undefined') {
      return res.status(200).json({
        success: false,
        error: 'Fetch API not available in this environment',
        sent: 0,
        failed: phoneNumbers.length,
        total: phoneNumbers.length,
        results: phoneNumbers.map(phone => ({ phoneNumber: phone, success: false, error: 'Fetch API not available' }))
      });
    }

    for (const phoneNumber of phoneNumbers) {
      try {
        let response;
        try {
          response = await fetch(`${winsmsApiUrl}/sms/send`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${winsmsApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              recipients: [phoneNumber],
              message: message.trim()
            })
          });
        } catch (fetchError) {
          results.push({ phoneNumber, success: false, error: `Connection error: ${fetchError?.message || 'Unknown'}` });
          failCount++;
          continue;
        }

        if (response.ok) {
          try {
            const data = await response.json();
            results.push({ phoneNumber, success: true, data });
            successCount++;
          } catch (jsonError) {
            results.push({ phoneNumber, success: false, error: 'Invalid response format' });
            failCount++;
          }
        } else {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = 'Unable to read error';
          }
          results.push({ phoneNumber, success: false, error: `API returned ${response.status}` });
          failCount++;
        }
      } catch (error) {
        results.push({ phoneNumber, success: false, error: error?.message || 'Unknown error' });
        failCount++;
      }
    }

    return res.status(200).json({
      success: true,
      sent: successCount,
      failed: failCount,
      total: phoneNumbers.length,
      results: results
    });

  } catch (error) {
    console.error('Error in send-sms:', error);
    return res.status(200).json({ 
      success: false,
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      sent: 0,
      failed: 0,
      total: 0
    });
  }
}

