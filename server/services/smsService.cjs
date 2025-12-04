/**
 * SMS service
 * Business logic for SMS operations using WinSMS API
 */

const https = require('https');
const querystring = require('querystring');
const { formatPhoneNumber } = require('../utils/phone.cjs');
const { getSupabase, getSupabaseService } = require('../utils/supabase.cjs');

const WINSMS_API_KEY = process.env.WINSMS_API_KEY;
if (!WINSMS_API_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('WINSMS_API_KEY environment variable is required in production');
}

const WINSMS_API_HOST = "www.winsmspro.com";
const WINSMS_API_PATH = "/sms/sms/api";
const WINSMS_SENDER = "Andiamo";

/**
 * Check SMS balance
 */
async function checkBalance() {
  const url = `${WINSMS_API_PATH}?action=check-balance&api_key=${WINSMS_API_KEY}&response=json`;

  const options = {
    hostname: WINSMS_API_HOST,
    port: 443,
    path: url,
    method: 'GET',
    timeout: 10000
  };

  return new Promise((resolve, reject) => {
    const req = https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Send SMS to a single phone number
 */
async function sendSMS(phoneNumber, message) {
  const formattedNumber = formatPhoneNumber(phoneNumber);
  
  if (!formattedNumber) {
    throw new Error(`Invalid phone number format: ${phoneNumber}`);
  }

  const postData = querystring.stringify({
    'action': 'send-sms',
    'api_key': WINSMS_API_KEY,
    'to': formattedNumber,
    'sms': message.trim(),
    'from': WINSMS_SENDER
  });

  const options = {
    hostname: WINSMS_API_HOST,
    port: 443,
    path: WINSMS_API_PATH + '?' + postData,
    method: 'GET',
    timeout: 10000
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Log SMS attempt
 */
async function logSMS(phoneNumber, message, status, errorMessage = null, apiResponse = null) {
  const supabase = getSupabaseService();
  
  if (!supabase) {
    return;
  }

  try {
    await supabase.from('sms_logs').insert({
      phone_number: phoneNumber,
      message: message.trim(),
      status,
      error_message: errorMessage,
      api_response: apiResponse ? JSON.stringify(apiResponse) : null,
      ...(status === 'sent' && { sent_at: new Date().toISOString() })
    });
  } catch (error) {
    console.error('Error logging SMS:', error);
  }
}

/**
 * Add bulk phone numbers
 */
async function addBulkPhones(phoneNumbers) {
  const supabase = getSupabase();
  
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const validNumbers = [];
  const invalidNumbers = [];
  const duplicateNumbers = [];

  for (const phone of phoneNumbers) {
    const formatted = formatPhoneNumber(phone);
    
    if (!formatted) {
      invalidNumbers.push(phone);
      continue;
    }

    const localNumber = formatted.substring(3);

    // Check if number already exists
    const { data: existing } = await supabase
      .from('phone_subscribers')
      .select('phone_number')
      .eq('phone_number', localNumber)
      .single();

    if (existing) {
      duplicateNumbers.push(phone);
      continue;
    }

    validNumbers.push({
      phone_number: localNumber,
      language: 'en'
    });
  }

  let insertedCount = 0;
  if (validNumbers.length > 0) {
    const { data, error } = await supabase
      .from('phone_subscribers')
      .insert(validNumbers)
      .select();

    if (error && error.code !== '23505') {
      throw error;
    }

    insertedCount = data?.length || 0;
  }

  return {
    total: phoneNumbers.length,
    inserted: insertedCount,
    duplicates: duplicateNumbers.length,
    invalid: invalidNumbers.length,
    duplicateNumbers,
    invalidNumbers
  };
}

module.exports = {
  checkBalance,
  sendSMS,
  logSMS,
  addBulkPhones
};

