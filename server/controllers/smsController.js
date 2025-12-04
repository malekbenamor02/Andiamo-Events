/**
 * SMS controller
 * Request/response handling for SMS endpoints
 */

const { sendSuccess, sendError } = require('../middleware/errorHandler');
const smsService = require('../services/smsService');

/**
 * Check SMS balance
 */
async function checkBalance(req, res) {
  try {
    const result = await smsService.checkBalance();
    
    // Parse balance from response
    let balanceData = result.data;
    if (typeof balanceData === 'string') {
      try {
        balanceData = JSON.parse(balanceData);
      } catch (e) {
        // Keep as string if JSON parse fails
      }
    }

    // Check for error codes
    if (balanceData && balanceData.code && balanceData.code !== '200') {
      return sendSuccess(res, {
        balance: null,
        currency: null,
        message: 'Unable to fetch balance from SMS provider',
        error: balanceData.message || `Error code ${balanceData.code}`,
        rawResponse: balanceData
      }, null, 200);
    }

    return sendSuccess(res, {
      balance: balanceData,
      balanceValue: balanceData?.balance || balanceData?.solde || balanceData?.credit || balanceData?.amount || null,
      rawResponse: result.raw
    });
  } catch (error) {
    return sendSuccess(res, {
      balance: null,
      currency: null,
      message: 'SMS service unavailable',
      configured: false,
      error: error.message || 'Failed to check SMS balance'
    }, null, 200);
  }
}

/**
 * Send SMS broadcast
 */
async function sendSMS(req, res) {
  try {
    const { phoneNumbers, message } = req.body;

    if (!message || !message.trim()) {
      return sendError(res, 'Message is required', null, 400);
    }

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return sendError(res, 'Phone numbers array is required', null, 400);
    }

    const results = [];
    const errors = [];

    for (const phoneNumber of phoneNumbers) {
      try {
        const responseData = await smsService.sendSMS(phoneNumber, message);
        
        const responseText = typeof responseData.data === 'string' 
          ? responseData.data 
          : JSON.stringify(responseData.data);
        
        // Check for errors
        const isError = responseData.status !== 200 ||
                       (responseData.data && responseData.data.code && responseData.data.code !== '200') ||
                       responseText.includes('error') || 
                       responseText.includes('Error') || 
                       responseText.includes('ERROR') ||
                       responseText.includes('Authentication Failed') ||
                       responseText.includes('Failed') ||
                       responseText.includes('insufficient') ||
                       responseText.includes('Insufficient') ||
                       responseText.includes('balance') && responseText.includes('0') ||
                       responseText.toLowerCase().includes('solde insuffisant');
        
        if (isError) {
          let errorMessage = 'SMS sending failed';
          if (responseData.data && responseData.data.message) {
            errorMessage = responseData.data.message;
          } else if (responseData.data && responseData.data.code) {
            errorMessage = `Error code ${responseData.data.code}: ${responseData.data.message || 'Unknown error'}`;
          } else {
            errorMessage = responseText || 'Unknown error';
          }
          
          await smsService.logSMS(phoneNumber, message, 'failed', errorMessage, responseData.data || responseData.raw);
          errors.push({ phoneNumber, error: errorMessage });
        } else {
          await smsService.logSMS(phoneNumber, message, 'sent', null, responseData.data || responseData.raw);
          results.push({ phoneNumber, success: true, response: responseData.data || responseData.raw });
        }
      } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        await smsService.logSMS(phoneNumber, message, 'failed', errorMessage);
        errors.push({ phoneNumber, error: errorMessage });
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return sendSuccess(res, {
      total: phoneNumbers.length,
      sent: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    return sendError(res, error.message || 'Failed to send SMS broadcast', null, 500);
  }
}

/**
 * Add bulk phone numbers
 */
async function addBulkPhones(req, res) {
  try {
    const { phoneNumbers } = req.body;

    if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return sendError(res, 'Phone numbers array is required', null, 400);
    }

    const result = await smsService.addBulkPhones(phoneNumbers);
    return sendSuccess(res, result);
  } catch (error) {
    return sendError(res, error.message || 'Failed to add phone numbers', null, 500);
  }
}

module.exports = {
  checkBalance,
  sendSMS,
  addBulkPhones
};

