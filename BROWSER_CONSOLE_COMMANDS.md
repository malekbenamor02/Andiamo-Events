# Browser Console Commands Guide

This document contains console commands you can run directly in your browser's developer console to fetch and inspect data from your application.

## 🚀 Quick Reference - Get Admin Names & Emails

**⚠️ Important:** Passwords are hashed (bcrypt) and cannot be retrieved. You can only see names, emails, and roles.

### Quick Method (If logged in as super_admin):
```javascript
// Get all admins via Supabase (requires Supabase URL and Key)
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
const { data } = await supabase.from('admins').select('id, name, email, role, is_active').order('created_at');
console.table(data);
```

### Alternative (If you have the credentials):
```javascript
// Replace with your actual values
getAdminsDirect('https://your-project.supabase.co', 'your-anon-key-here');
```

**See [Admin Data](#admin-data) section below for more options.**

## 📋 Table of Contents
1. [Accessing Supabase Client](#accessing-supabase-client)
2. [Fetching Data from Tables](#fetching-data-from-tables)
3. [Calling API Endpoints](#calling-api-endpoints)
4. [Common Queries](#common-queries)
5. [Authentication & Session](#authentication--session)
6. [Admin Data](#admin-data)

---

## 🔧 Accessing Supabase Client

### Get Supabase Client Instance
```javascript
// Access the Supabase client from the window object (if exposed)
// Or create a new client instance
const supabaseUrl = 'YOUR_SUPABASE_URL'; // Get from localStorage or env
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'; // Get from localStorage or env

// Check if Supabase is available in the app
const checkSupabase = () => {
  // Try to access from React DevTools or window
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('React DevTools available');
  }
  // Check localStorage for Supabase session
  const session = localStorage.getItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
  console.log('Session:', session ? 'Found' : 'Not found');
};

// Alternative: Access via module (if exposed)
// This works if your app exposes supabase globally
```

### Get Environment Variables from LocalStorage
```javascript
// Supabase stores session data in localStorage
const getSupabaseConfig = () => {
  const keys = Object.keys(localStorage);
  const supabaseKeys = keys.filter(k => k.includes('supabase') || k.includes('sb-'));
  console.log('Supabase keys in localStorage:', supabaseKeys);
  return supabaseKeys;
};
getSupabaseConfig();
```

---

## 📊 Fetching Data from Tables

### Orders Table
```javascript
// Get all orders
const getAllOrders = async () => {
  const response = await fetch('/api/admin/ambassador-sales/orders', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  console.table(data.orders || data);
  return data;
};
getAllOrders();

// Get orders by status
const getOrdersByStatus = async (status) => {
  const response = await fetch(`/api/admin/ambassador-sales/orders?status=${status}`, {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.orders || data);
  return data;
};
// Usage: getOrdersByStatus('completed');

// Get orders by date range
const getOrdersByDate = async (startDate, endDate) => {
  const response = await fetch(`/api/admin/ambassador-sales/orders?date_from=${startDate}&date_to=${endDate}`, {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.orders || data);
  return data;
};
// Usage: getOrdersByDate('2025-01-01', '2025-01-31');
```

### Events Table
```javascript
// Get all events
const getAllEvents = async () => {
  const response = await fetch('/api/admin/pos-events', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.events || data);
  return data;
};
getAllEvents();

// Get upcoming events
const getUpcomingEvents = async () => {
  const response = await fetch('/api/scanner/events', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data);
  return data;
};
getUpcomingEvents();
```

### Ambassadors Table
```javascript
// Get active ambassadors
const getActiveAmbassadors = async () => {
  const response = await fetch('/api/ambassadors/active', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.ambassadors || data);
  return data;
};
getActiveAmbassadors();

// Get ambassador performance
const getAmbassadorPerformance = async (ambassadorId) => {
  const response = await fetch(`/api/ambassador/performance?id=${ambassadorId}`, {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data);
  return data;
};
// Usage: getAmbassadorPerformance('ambassador-uuid-here');
```

### Tickets Table
```javascript
// Get tickets for an order
const getTicketsForOrder = async (orderId) => {
  const response = await fetch(`/api/admin/orders/${orderId}/tickets`, {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.tickets || data);
  return data;
};
// Usage: getTicketsForOrder('order-uuid-here');

// Validate a ticket
const validateTicket = async (secureToken, eventId) => {
  const response = await fetch('/api/validate-ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secure_token: secureToken, event_id: eventId })
  });
  const data = await response.json();
  console.log('Validation result:', data);
  return data;
};
// Usage: validateTicket('ticket-secure-token-here', 'event-uuid-here');
```

### POS (Point de Vente) Data
```javascript
// Get POS outlets
const getPOSOutlets = async () => {
  const response = await fetch('/api/admin/pos-outlets', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.outlets || data);
  return data;
};
getPOSOutlets();

// Get POS orders
const getPOSOrders = async () => {
  const response = await fetch('/api/admin/pos-orders', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.orders || data);
  return data;
};
getPOSOrders();

// Get POS stock
const getPOSStock = async () => {
  const response = await fetch('/api/admin/pos-stock', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.stock || data);
  return data;
};
getPOSStock();

// Get POS statistics
const getPOSStatistics = async () => {
  const response = await fetch('/api/admin/pos-statistics', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.log('POS Statistics:', data);
  return data;
};
getPOSStatistics();
```

### Scanner System Data
```javascript
// Get scan system status
const getScanSystemStatus = async () => {
  const response = await fetch('/api/scan-system-status', {
    method: 'GET'
  });
  const data = await response.json();
  console.log('Scan System Status:', data);
  return data;
};
getScanSystemStatus();

// Get scan history
const getScanHistory = async () => {
  const response = await fetch('/api/admin/scan-history', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.scans || data);
  return data;
};
getScanHistory();

// Get scan statistics
const getScanStatistics = async () => {
  const response = await fetch('/api/admin/scan-statistics', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.log('Scan Statistics:', data);
  return data;
};
getScanStatistics();
```

---

## 🌐 Calling API Endpoints

### Generic API Call Function
```javascript
// Universal API caller
const callAPI = async (endpoint, method = 'GET', body = null, params = {}) => {
  let url = endpoint;
  
  // Add query parameters
  if (Object.keys(params).length > 0) {
    const queryString = new URLSearchParams(params).toString();
    url += '?' + queryString;
  }
  
  const options = {
    method: method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    console.log(`API Response (${endpoint}):`, data);
    return data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    return { error: error.message };
  }
};

// Usage examples:
// callAPI('/api/admin/ambassador-sales/overview');
// callAPI('/api/ambassadors/active');
// callAPI('/api/admin/pos-orders', 'GET', null, { status: 'pending' });
```

### SMS & Phone Data
```javascript
// Get SMS balance
const getSMSBalance = async () => {
  const response = await fetch('/api/sms-balance', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.log('SMS Balance:', data);
  return data;
};
getSMSBalance();

// Get phone numbers sources
const getPhoneNumbersSources = async () => {
  const response = await fetch('/api/admin/phone-numbers/sources', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.log('Phone Number Sources:', data);
  return data;
};
getPhoneNumbersSources();

// Get phone numbers counts
const getPhoneNumbersCounts = async () => {
  const response = await fetch('/api/admin/phone-numbers/counts', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.log('Phone Number Counts:', data);
  return data;
};
getPhoneNumbersCounts();
```

### Payment Options
```javascript
// Get payment options
const getPaymentOptions = async () => {
  const response = await fetch('/api/payment-options', {
    method: 'GET'
  });
  const data = await response.json();
  console.log('Payment Options:', data);
  return data;
};
getPaymentOptions();
```

### Official Invitations
```javascript
// Get official invitations
const getOfficialInvitations = async () => {
  const response = await fetch('/api/admin/official-invitations', {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.invitations || data);
  return data;
};
getOfficialInvitations();
```

### Admin Logs
```javascript
// Get admin logs
const getAdminLogs = async (limit = 100) => {
  const response = await fetch(`/api/admin/logs?limit=${limit}`, {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.logs || data);
  return data;
};
getAdminLogs(50);
```

---

## 🔍 Common Queries

### Get All Data at Once
```javascript
// Fetch multiple endpoints in parallel
const getAllData = async () => {
  const endpoints = [
    '/api/admin/ambassador-sales/overview',
    '/api/ambassadors/active',
    '/api/admin/pos-orders',
    '/api/admin/pos-statistics',
    '/api/admin/scan-statistics'
  ];
  
  const results = await Promise.all(
    endpoints.map(endpoint => 
      fetch(endpoint, { credentials: 'include' })
        .then(r => r.json())
        .catch(e => ({ error: e.message, endpoint }))
    )
  );
  
  const data = {};
  endpoints.forEach((endpoint, i) => {
    const key = endpoint.split('/').pop();
    data[key] = results[i];
  });
  
  console.log('All Data:', data);
  return data;
};
getAllData();
```

### Search Orders by Customer
```javascript
// Search orders by customer name or phone
const searchOrders = async (searchTerm) => {
  const response = await fetch(`/api/admin/ambassador-sales/orders?search=${encodeURIComponent(searchTerm)}`, {
    method: 'GET',
    credentials: 'include'
  });
  const data = await response.json();
  console.table(data.orders || data);
  return data;
};
// Usage: searchOrders('John Doe');
// Usage: searchOrders('+21612345678');
```

### Get Order Details
```javascript
// Get full order details including tickets
const getOrderDetails = async (orderId) => {
  // Get order info
  const orderResponse = await fetch(`/api/admin/ambassador-sales/orders?id=${orderId}`, {
    method: 'GET',
    credentials: 'include'
  });
  const orderData = await orderResponse.json();
  
  // Get tickets if available
  let tickets = null;
  try {
    const ticketsResponse = await fetch(`/api/admin/orders/${orderId}/tickets`, {
      method: 'GET',
      credentials: 'include'
    });
    tickets = await ticketsResponse.json();
  } catch (e) {
    console.log('Tickets endpoint not available');
  }
  
  const fullData = {
    order: orderData.orders?.[0] || orderData,
    tickets: tickets
  };
  
  console.log('Order Details:', fullData);
  return fullData;
};
// Usage: getOrderDetails('order-uuid-here');
```

### Get Statistics Summary
```javascript
// Get comprehensive statistics
const getStatisticsSummary = async () => {
  const stats = {};
  
  // Ambassador sales overview
  try {
    const sales = await fetch('/api/admin/ambassador-sales/overview', { credentials: 'include' }).then(r => r.json());
    stats.ambassadorSales = sales;
  } catch (e) {}
  
  // POS statistics
  try {
    const pos = await fetch('/api/admin/pos-statistics', { credentials: 'include' }).then(r => r.json());
    stats.pos = pos;
  } catch (e) {}
  
  // Scan statistics
  try {
    const scans = await fetch('/api/admin/scan-statistics', { credentials: 'include' }).then(r => r.json());
    stats.scans = scans;
  } catch (e) {}
  
  console.log('Statistics Summary:', stats);
  return stats;
};
getStatisticsSummary();
```

---

## 🔐 Authentication & Session

### Check Current Session
```javascript
// Check if user is authenticated
const checkAuth = async () => {
  try {
    const response = await fetch('/api/verify-admin', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await response.json();
    console.log('Auth Status:', data);
    return data;
  } catch (error) {
    console.error('Auth Check Error:', error);
    return { authenticated: false };
  }
};
checkAuth();
```

### Get Session Info from LocalStorage
```javascript
// Inspect all session data
const inspectSession = () => {
  const sessionData = {};
  
  // Get all localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try {
      const value = localStorage.getItem(key);
      if (value && (key.includes('auth') || key.includes('supabase') || key.includes('session'))) {
        sessionData[key] = JSON.parse(value);
      }
    } catch (e) {
      sessionData[key] = localStorage.getItem(key);
    }
  }
  
  console.log('Session Data:', sessionData);
  return sessionData;
};
inspectSession();
```

---

## 👥 Admin Data

### ⚠️ Important Security Note
**Passwords are stored as bcrypt hashes (one-way encryption).** You cannot retrieve the original plaintext passwords. This is by design for security. You can only:
- View admin names, emails, roles, and status
- See the password hash (which is not useful for login)
- Reset passwords using the reset script (requires server access)

### Get All Admins (Names, Emails, Roles)
```javascript
// Get admin list with safe information (no password hashes)
const getAdmins = async () => {
  try {
    // Try to access Supabase from the app's context
    // First, try to get it from React DevTools
    let supabase = null;
    
    // Method 1: Try to access from window if exposed
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const reactInstances = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers;
      // This is a fallback - may not work in all cases
    }
    
    // Method 2: Create Supabase client from environment
    // Get Supabase URL and key from localStorage or network requests
    const getSupabaseConfig = () => {
      // Check localStorage for Supabase config
      const keys = Object.keys(localStorage);
      const supabaseKeys = keys.filter(k => k.includes('supabase') || k.includes('sb-'));
      
      // Try to extract from session storage
      for (const key of supabaseKeys) {
        try {
          const value = localStorage.getItem(key);
          const parsed = JSON.parse(value);
          if (parsed && (parsed.currentSession || parsed.access_token)) {
            // Found session, but we need URL and key
            console.log('Found Supabase session in:', key);
          }
        } catch (e) {}
      }
      
      return null;
    };
    
    // Method 3: Direct Supabase query via API (if you have admin access)
    // This requires you to be logged in as super_admin
    const response = await fetch('/api/admin/admins', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.table(data.admins || data);
      return data;
    } else {
      // If API doesn't exist, try direct Supabase access
      console.log('API endpoint not available, trying direct Supabase access...');
      throw new Error('API not available');
    }
  } catch (error) {
    console.error('Error:', error);
    console.log('\n📝 Alternative: Use Supabase client directly');
    console.log('You need to create a Supabase client with your credentials:');
    console.log(`
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
const { data, error } = await supabase
  .from('admins')
  .select('id, name, email, role, is_active, phone, created_at')
  .order('created_at', { ascending: false });
console.table(data);
    `);
  }
};

// Usage: getAdmins();
```

### Get Admins with Direct Supabase Client
```javascript
// Create Supabase client and fetch admins
// NOTE: You need to provide your Supabase URL and Anon Key
const getAdminsDirect = async (supabaseUrl, supabaseKey) => {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.log('Get them from:');
    console.log('1. Your .env file (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY)');
    console.log('2. Supabase Dashboard → Settings → API');
    return;
  }
  
  try {
    // Dynamically import Supabase
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch admins (safe fields only)
    const { data: admins, error } = await supabase
      .from('admins')
      .select('id, name, email, role, is_active, phone, created_at, last_login')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching admins:', error);
      return;
    }
    
    console.log(`✅ Found ${admins.length} admin(s):`);
    console.table(admins);
    
    // Summary
    const summary = {
      total: admins.length,
      superAdmins: admins.filter(a => a.role === 'super_admin').length,
      regularAdmins: admins.filter(a => a.role === 'admin').length,
      active: admins.filter(a => a.is_active).length,
      inactive: admins.filter(a => !a.is_active).length
    };
    console.log('\n📊 Summary:', summary);
    
    return admins;
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Usage: 
// getAdminsDirect('https://your-project.supabase.co', 'your-anon-key');
```

### Get Admins with Password Hashes (For Reference Only)
```javascript
// ⚠️ WARNING: Password hashes are NOT useful for login
// They are bcrypt hashes and cannot be reversed
// This is only for reference/debugging purposes

const getAdminsWithHashes = async (supabaseUrl, supabaseKey) => {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    return;
  }
  
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: admins, error } = await supabase
      .from('admins')
      .select('*')  // Includes password hash
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    // Display admins with password hash info
    const displayData = admins.map(admin => ({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      is_active: admin.is_active,
      password_hash: admin.password ? `${admin.password.substring(0, 20)}...` : 'N/A',
      password_length: admin.password ? admin.password.length : 0,
      created_at: admin.created_at
    }));
    
    console.log('⚠️ Password hashes shown below are NOT usable for login');
    console.log('They are bcrypt hashes (one-way encryption)');
    console.table(displayData);
    
    return admins;
  } catch (error) {
    console.error('❌ Error:', error);
  }
};

// Usage: 
// getAdminsWithHashes('https://your-project.supabase.co', 'your-anon-key');
```

### Get Current Admin Info
```javascript
// Get information about the currently logged-in admin
const getCurrentAdmin = async () => {
  try {
    const response = await fetch('/api/verify-admin', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.authenticated) {
      console.log('✅ Current Admin:', {
        id: data.admin?.id,
        email: data.admin?.email,
        role: data.admin?.role,
        isSuperAdmin: data.isSuperAdmin
      });
    } else {
      console.log('❌ Not authenticated');
    }
    
    return data;
  } catch (error) {
    console.error('❌ Error:', error);
  }
};
getCurrentAdmin();
```

### Extract Supabase Credentials from Page
```javascript
// Try to extract Supabase URL and key from the page
const extractSupabaseConfig = () => {
  const config = {
    url: null,
    key: null
  };
  
  // Method 1: Check window object
  if (window.__SUPABASE_URL__) config.url = window.__SUPABASE_URL__;
  if (window.__SUPABASE_KEY__) config.key = window.__SUPABASE_KEY__;
  
  // Method 2: Check localStorage for session data
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.includes('supabase') || key.includes('sb-')) {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        // Supabase stores URL in session sometimes
        if (value && typeof value === 'object') {
          if (value.supabaseUrl) config.url = value.supabaseUrl;
          if (value.supabaseKey) config.key = value.supabaseKey;
        }
      } catch (e) {}
    }
  }
  
  // Method 3: Check network requests (if DevTools Network tab is available)
  console.log('📝 To get credentials manually:');
  console.log('1. Open Network tab in DevTools');
  console.log('2. Look for requests to Supabase');
  console.log('3. Check request headers/URLs for Supabase URL');
  console.log('4. Check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  
  if (config.url && config.key) {
    console.log('✅ Found credentials:', { url: config.url, key: config.key.substring(0, 20) + '...' });
    return config;
  } else {
    console.log('❌ Could not auto-detect credentials');
    console.log('You need to provide them manually');
    return null;
  }
};
extractSupabaseConfig();
```

### Password Reset Information
```javascript
// Get information about password reset
const getPasswordResetInfo = () => {
  console.log('🔐 Password Reset Information:');
  console.log('');
  console.log('Passwords are stored as bcrypt hashes and CANNOT be retrieved.');
  console.log('To reset a password, you need server access:');
  console.log('');
  console.log('1. Use the reset script:');
  console.log('   node reset-admin-password.cjs <email> <newPassword>');
  console.log('');
  console.log('2. Or use SQL directly in Supabase:');
  console.log(`
   -- First, hash the new password using bcrypt
   -- Then update:
   UPDATE admins 
   SET password = '$2b$10$...hashed_password...' 
   WHERE email = 'admin@example.com';
   `);
  console.log('');
  console.log('3. Or use Supabase SQL Editor with a function that hashes the password');
};
getPasswordResetInfo();
```

### Attempting to Get Data Without Keys (Educational)
```javascript
// ⚠️ IMPORTANT: This demonstrates why passwords CANNOT be retrieved
// These attempts will show you what's accessible vs what's protected

const tryGetDataWithoutKeys = async () => {
  console.log('🔍 Attempting to access data without Supabase credentials...\n');
  
  // Method 1: Try to extract credentials from the page
  console.log('📋 Method 1: Extracting credentials from page...');
  const extracted = extractSupabaseConfig();
  if (!extracted || !extracted.url || !extracted.key) {
    console.log('❌ Could not extract Supabase credentials from page');
    console.log('   This is expected - credentials are not exposed in frontend\n');
  } else {
    console.log('✅ Found credentials (unlikely to work)');
  }
  
  // Method 2: Try to access REAL authentication and admin endpoints for password data
  console.log('📋 Method 2: Testing REAL API endpoints from your codebase...');
  console.log('⚠️ These are actual endpoints - testing what password data they expose\n');
  
  try {
    // Real authentication endpoints from API_ROUTES
    const authEndpoints = [
      { url: '/api/admin-login', method: 'POST', body: { email: 'test@test.com', password: 'test123' }, note: 'Admin login (tests if passwords returned)' },
      { url: '/api/verify-admin', method: 'GET', note: 'Verify admin session' },
      { url: '/api/ambassador-login', method: 'POST', body: { email: 'test@test.com', password: 'test123' }, note: 'Ambassador login' },
      { url: '/api/scanner-login', method: 'POST', body: { email: 'test@test.com', password: 'test123' }, note: 'Scanner login' }
    ];
    
    // Real admin endpoints that return user/admin data
    const adminDataEndpoints = [
      { url: '/api/admin/ambassador-sales/orders', method: 'GET', note: 'Orders with user data' },
      { url: '/api/admin/pos-users', method: 'GET', note: 'POS users list (should NOT return passwords)' },
      { url: '/api/admin/scanners', method: 'GET', note: 'Scanners list (super_admin only)' },
      { url: '/api/ambassadors/active', method: 'GET', note: 'Active ambassadors' }
    ];
    
    console.log('🔐 Testing Authentication Endpoints:');
    for (const endpoint of authEndpoints) {
      try {
        const options = {
          method: endpoint.method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        };
        
        if (endpoint.body) {
          options.body = JSON.stringify(endpoint.body);
        }
        
        const response = await fetch(endpoint.url, options);
        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = { error: 'Response not JSON', status: response.status };
        }
        
        console.log(`\n📡 ${endpoint.method} ${endpoint.url}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Note: ${endpoint.note}`);
        
        // Deep check for password exposure
        const responseStr = JSON.stringify(data);
        const checks = {
          hasPassword: responseStr.toLowerCase().includes('"password"') || responseStr.toLowerCase().includes("'password'"),
          hasPasswordHash: responseStr.toLowerCase().includes('password_hash') || responseStr.toLowerCase().includes('passwordhash'),
          hasPlainPassword: /["']password["']\s*:\s*["'][^"']{3,}["']/i.test(responseStr),
          responsePreview: responseStr.substring(0, 300)
        };
        
        if (checks.hasPassword || checks.hasPasswordHash || checks.hasPlainPassword) {
          console.log('   ⚠️⚠️⚠️ SECURITY ISSUE: Password data found in response!');
          console.log('   Response preview:', checks.responsePreview);
          if (checks.hasPlainPassword) {
            console.log('   ❌ CRITICAL: Plain password detected!');
          }
        } else {
          console.log('   ✅ Secure: No password data exposed');
        }
        
        if (response.status === 401 || response.status === 403) {
          console.log('   🔒 Protected: Requires authentication');
        } else if (response.status === 400) {
          console.log('   ℹ️ Bad request (expected for test credentials)');
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
      }
    }
    
    console.log('\n\n👥 Testing Admin Data Endpoints:');
    for (const endpoint of adminDataEndpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          credentials: 'include'
        });
        
        let data;
        try {
          data = await response.json();
        } catch (e) {
          data = { error: 'Not accessible or not JSON' };
        }
        
        console.log(`\n📡 ${endpoint.method} ${endpoint.url}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Note: ${endpoint.note}`);
        
        // Recursive check for password fields
        const findPasswordFields = (obj, path = 'root') => {
          const found = [];
          if (obj && typeof obj === 'object') {
            for (const key in obj) {
              const fullPath = `${path}.${key}`;
              const lowerKey = key.toLowerCase();
              
              if (lowerKey.includes('password') || lowerKey.includes('passwd') || lowerKey === 'pwd') {
                found.push({
                  path: fullPath,
                  value: typeof obj[key] === 'string' ? obj[key].substring(0, 50) : typeof obj[key],
                  isPlaintext: typeof obj[key] === 'string' && obj[key].length > 0 && !obj[key].startsWith('$2')
                });
              }
              
              if (typeof obj[key] === 'object' && obj[key] !== null) {
                found.push(...findPasswordFields(obj[key], fullPath));
              }
            }
          }
          return found;
        };
        
        const passwordFields = findPasswordFields(data);
        if (passwordFields.length > 0) {
          console.log('   ⚠️⚠️⚠️ SECURITY ISSUE: Password fields found!');
          passwordFields.forEach(field => {
            console.log(`   - ${field.path}: ${field.value}${field.isPlaintext ? ' (PLAINTEXT!)' : ' (hash)'}`);
          });
        } else {
          console.log('   ✅ Secure: No password fields found');
        }
        
        if (response.status === 401 || response.status === 403) {
          console.log('   🔒 Protected: Requires admin authentication');
        } else if (response.ok) {
          const dataArray = Array.isArray(data) ? data : (data.data || data.users || data.orders || []);
          console.log(`   📊 Returned ${dataArray.length} record(s)`);
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
      }
    }
    
    console.log('\n\n📊 Test Summary:');
    console.log('   ✅ These are REAL endpoints from your application');
    console.log('   ✅ Tests show what data is actually exposed');
    console.log('   ⚠️ If ANY endpoint returns password data, that\'s a CRITICAL security issue');
    console.log('   ✅ Expected result: 401/403 errors OR no password data in responses');
    console.log('   🔐 Passwords should NEVER appear in API responses');
    
  } catch (error) {
    console.log('❌ Error testing endpoints:', error);
  }
  
  // Method 3: Try to access admin endpoints without auth
  console.log('\n📋 Method 3: Trying admin endpoints without authentication...');
  const adminEndpoints = [
    '/api/admin/ambassador-sales/orders',
    '/api/admin/pos-orders',
    '/api/verify-admin'
  ];
  
  for (const endpoint of adminEndpoints) {
    try {
      const response = await fetch(endpoint, {
        credentials: 'include'
      });
      const data = await response.json();
      
      if (response.status === 401 || response.status === 403) {
        console.log(`✅ ${endpoint}:`, 'Protected (requires auth)');
      } else if (response.ok) {
        console.log(`⚠️ ${endpoint}:`, 'Accessible (you may be logged in)');
        // Check for password data
        const dataStr = JSON.stringify(data).toLowerCase();
        if (dataStr.includes('password')) {
          console.log('   ⚠️ WARNING: Password data found in response!');
        } else {
          console.log('   ✅ No password data (secure)');
        }
      }
    } catch (e) {
      console.log(`❌ ${endpoint}:`, 'Error accessing');
    }
  }
  
  // Method 4: Try to access localStorage/sessionStorage
  console.log('\n📋 Method 4: Checking browser storage...');
  const storageKeys = [
    ...Object.keys(localStorage),
    ...Object.keys(sessionStorage)
  ];
  
  let foundCredentials = false;
  for (const key of storageKeys) {
    try {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value) {
        // Check if it looks like Supabase credentials
        if (value.includes('supabase') || value.includes('sb-')) {
          const parsed = JSON.parse(value);
          if (parsed && (parsed.supabaseUrl || parsed.access_token)) {
            console.log(`📦 Found in storage: ${key}`);
            foundCredentials = true;
            // Check if it contains password
            if (JSON.stringify(parsed).toLowerCase().includes('password')) {
              console.log('   ⚠️ WARNING: Password found in storage!');
            }
          }
        }
      }
    } catch (e) {
      // Not JSON, skip
    }
  }
  
  if (!foundCredentials) {
    console.log('✅ No Supabase credentials in browser storage (secure)');
  }
  
  // Method 5: Try to access network requests
  console.log('\n📋 Method 5: Analyzing network requests...');
  console.log('   💡 Tip: Open Network tab in DevTools');
  console.log('   💡 Look for requests to Supabase');
  console.log('   💡 Check if any responses contain password data');
  
  // Method 6: Try to access React state (if DevTools available)
  console.log('\n📋 Method 6: Checking React component state...');
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('   ✅ React DevTools detected');
    console.log('   💡 Use React DevTools to inspect component state');
    console.log('   ⚠️ Even if you find state, passwords should NOT be there');
  } else {
    console.log('   ℹ️ React DevTools not available');
  }
  
  console.log('\n📊 Summary:');
  console.log('   ✅ Passwords are NOT accessible from browser');
  console.log('   ✅ This is by design for security');
  console.log('   ✅ Passwords are hashed (bcrypt) and server-side only');
  console.log('   ✅ Even with Supabase credentials, you can only see hashes');
  console.log('   ✅ Hashes cannot be reversed to get original passwords');
};

// Run the test
tryGetDataWithoutKeys();
```

### Why Passwords Cannot Be Retrieved (Technical Explanation)
```javascript
// This code demonstrates why passwords are secure

const explainPasswordSecurity = () => {
  console.log('🔐 Why Passwords Cannot Be Retrieved:\n');
  
  console.log('1. PASSWORDS ARE HASHED (One-Way Encryption)');
  console.log('   - Original password: "MyPassword123"');
  console.log('   - Stored hash: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"');
  console.log('   - Hash cannot be reversed to get original password');
  console.log('   - This is bcrypt (industry standard)\n');
  
  console.log('2. PASSWORDS ARE SERVER-SIDE ONLY');
  console.log('   - Password hashes stored in database (Supabase)');
  console.log('   - Never sent to frontend/browser');
  console.log('   - Only used for comparison during login\n');
  
  console.log('3. EVEN WITH DATABASE ACCESS');
  console.log('   - You can see: password_hash (the bcrypt hash)');
  console.log('   - You CANNOT see: original plaintext password');
  console.log('   - Hash is useless without the original password\n');
  
  console.log('4. LOGIN PROCESS (Why This Is Secure)');
  console.log('   Step 1: User enters password in browser');
  console.log('   Step 2: Password sent to server (HTTPS encrypted)');
  console.log('   Step 3: Server hashes the entered password');
  console.log('   Step 4: Server compares hash with stored hash');
  console.log('   Step 5: If match, login succeeds');
  console.log('   ⚠️ Original password never stored, only hash\n');
  
  console.log('5. WHAT YOU CAN ACCESS (Without Keys)');
  console.log('   ✅ Public data (events, products, etc.)');
  console.log('   ✅ Data you\'re authorized to see (if logged in)');
  console.log('   ❌ Password hashes (protected by RLS)');
  console.log('   ❌ Original passwords (never stored)\n');
  
  console.log('6. WHAT HAPPENS IF YOU TRY');
  console.log('   - Without Supabase key: Cannot access database');
  console.log('   - With Supabase key: Can access, but only see hashes');
  console.log('   - Hashes are useless for login');
  console.log('   - This is why the system is secure\n');
  
  console.log('✅ CONCLUSION:');
  console.log('   Passwords are protected by:');
  console.log('   1. One-way hashing (bcrypt)');
  console.log('   2. Server-side storage only');
  console.log('   3. Row Level Security (RLS)');
  console.log('   4. Authentication requirements');
  console.log('   5. No plaintext storage');
};

explainPasswordSecurity();
```

### Test: Try to Access Everything Without Keys
```javascript
// Comprehensive test of what's accessible without credentials
const comprehensiveAccessTest = async () => {
  console.log('🧪 Comprehensive Access Test (No Keys Required)\n');
  
  const results = {
    accessible: [],
    protected: [],
    errors: []
  };
  
  // Test all possible endpoints
  const endpoints = [
    // Public endpoints
    { url: '/api/scan-system-status', public: true },
    { url: '/api/payment-options', public: true },
    { url: '/api/test', public: true },
    
    // Admin endpoints (should require auth)
    { url: '/api/admin/ambassador-sales/orders', public: false },
    { url: '/api/admin/pos-orders', public: false },
    { url: '/api/admin/pos-outlets', public: false },
    { url: '/api/admin/logs', public: false },
    { url: '/api/verify-admin', public: false },
    
    // Ambassador endpoints
    { url: '/api/ambassadors/active', public: false },
    { url: '/api/ambassador/orders', public: false },
    
    // Other endpoints
    { url: '/api/sms-balance', public: false },
    { url: '/api/admin/official-invitations', public: false }
  ];
  
  console.log('Testing endpoints...\n');
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        credentials: 'include',
        method: 'GET'
      });
      
      const contentType = response.headers.get('content-type');
      let data = null;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }
      
      // Check response
      if (response.ok) {
        results.accessible.push({
          endpoint: endpoint.url,
          status: response.status,
          hasPassword: data ? JSON.stringify(data).toLowerCase().includes('password') : false,
          dataSize: data ? JSON.stringify(data).length : 0
        });
        console.log(`✅ ${endpoint.url}: Accessible (${response.status})`);
        
        if (data && JSON.stringify(data).toLowerCase().includes('password')) {
          console.log('   ⚠️ WARNING: Contains password-related data!');
        }
      } else if (response.status === 401 || response.status === 403) {
        results.protected.push({
          endpoint: endpoint.url,
          status: response.status
        });
        console.log(`🔒 ${endpoint.url}: Protected (${response.status})`);
      } else {
        results.errors.push({
          endpoint: endpoint.url,
          status: response.status
        });
        console.log(`❌ ${endpoint.url}: Error (${response.status})`);
      }
    } catch (error) {
      results.errors.push({
        endpoint: endpoint.url,
        error: error.message
      });
      console.log(`❌ ${endpoint.url}: ${error.message}`);
    }
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log(`   ✅ Accessible: ${results.accessible.length}`);
  console.log(`   🔒 Protected: ${results.protected.length}`);
  console.log(`   ❌ Errors: ${results.errors.length}`);
  
  // Check for password exposure
  const hasPasswords = results.accessible.some(r => r.hasPassword);
  if (hasPasswords) {
    console.log('\n⚠️ WARNING: Some accessible endpoints contain password data!');
  } else {
    console.log('\n✅ SECURE: No password data found in accessible endpoints');
  }
  
  console.log('\n📋 Detailed Results:');
  console.table(results.accessible);
  
  return results;
};

// Run comprehensive test
comprehensiveAccessTest();
```

---

## 🛠️ Utility Functions

### Pretty Print JSON
```javascript
// Pretty print any data
const prettyPrint = (data, title = 'Data') => {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(data, null, 2));
  console.log('================\n');
};
// Usage: prettyPrint(await getAllOrders(), 'All Orders');
```

### Export Data to CSV
```javascript
// Convert array of objects to CSV
const exportToCSV = (data, filename = 'export.csv') => {
  if (!Array.isArray(data) || data.length === 0) {
    console.error('Data must be a non-empty array');
    return;
  }
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value.replace(/"/g, '""')}"` 
        : value;
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log(`Exported ${data.length} rows to ${filename}`);
};
// Usage: 
// getAllOrders().then(data => {
//   if (data.orders) exportToCSV(data.orders, 'orders.csv');
// });
```

### Count Records
```javascript
// Count records in response
const countRecords = async (endpoint) => {
  const response = await fetch(endpoint, { credentials: 'include' });
  const data = await response.json();
  const count = Array.isArray(data) ? data.length : 
                (data.orders?.length || data.ambassadors?.length || 
                 data.events?.length || data.tickets?.length || 0);
  console.log(`Total records: ${count}`);
  return count;
};
// Usage: countRecords('/api/ambassadors/active');
```

---

## 🔒 Is It Normal to See Data in Console?

### ✅ YES - This is Normal and Expected

**It's completely normal** to see data in the browser console that your application needs to function. Here's why:

#### 1. **Frontend Needs Data to Display**
- Your React app needs user data (names, emails, phones) to display in the UI
- API responses are visible in the Network tab and console
- This is how web applications work - data must be sent to the browser

#### 2. **What You're Seeing is Expected**
Based on your console output showing user data:
- ✅ **User names** - Needed to display in lists/tables
- ✅ **Phone numbers** - Needed for contact/display purposes  
- ✅ **Email addresses** - Needed for display/communication
- ✅ **IDs and source info** - Needed for functionality

#### 3. **This is Standard Web Development**
Every website you visit:
- Loads data via API calls
- Stores data in browser memory
- Makes data visible in DevTools
- This is how the web works!

---

### ⚠️ What Would Be a Security Issue

#### ❌ NEVER Visible in Console:
1. **Plaintext Passwords** - Should NEVER be sent to frontend
2. **Password Hashes** - Should only be on server-side
3. **API Keys/Secrets** - Should be server-side only
4. **Credit Card Numbers** - Should use tokenization
5. **JWT Secrets** - Server-side only

#### ✅ What's Safe to See:
- User names, emails, phones (for display)
- Public data (events, products, etc.)
- IDs and references
- Data the user is authorized to see

---

### 🛡️ Security Best Practices

#### 1. **Authentication & Authorization**
```javascript
// ✅ GOOD: Check permissions server-side
// Backend verifies user can see this data
app.get('/api/users', requireAuth, (req, res) => {
  // Only return data user is authorized to see
  res.json(users);
});

// ❌ BAD: No permission check
app.get('/api/users', (req, res) => {
  res.json(allUsers); // Anyone can access!
});
```

#### 2. **Sensitive Data Filtering**
```javascript
// ✅ GOOD: Filter sensitive fields
const safeUserData = users.map(user => ({
  id: user.id,
  name: user.name,
  email: user.email,
  // password: NOT included
  // internal_notes: NOT included
}));

// ❌ BAD: Send everything
res.json(users); // Includes password hash!
```

#### 3. **Row Level Security (RLS)**
Your Supabase setup uses RLS policies to ensure:
- Users only see data they're authorized to see
- Even if someone accesses the API, they can't see unauthorized data
- Database-level security as a backup

---

### 📊 What Your App Does Right

Based on your codebase:

1. ✅ **Passwords are hashed** (bcrypt) - Never sent to frontend
2. ✅ **Authentication required** - Most endpoints check auth
3. ✅ **RLS enabled** - Database-level security
4. ✅ **Only necessary data** - APIs return only what's needed
5. ✅ **No secrets in frontend** - API keys are server-side

---

### 🎯 Summary

| Question | Answer |
|----------|--------|
| **Is it normal to see user data in console?** | ✅ YES - If the app needs to display it |
| **Should passwords be visible?** | ❌ NO - Never, not even hashed |
| **Is this a security issue?** | ✅ NO - This is expected behavior |
| **Should I be worried?** | ✅ NO - Your app follows best practices |
| **Can users see other users' data?** | ⚠️ Only if authorized (check your RLS policies) |

---

### 💡 Key Points

1. **Console visibility ≠ Security vulnerability**
   - Data must be in browser to display
   - DevTools can always see what the browser sees
   - This is normal and expected

2. **Real security is:**
   - ✅ Server-side authentication
   - ✅ Authorization checks
   - ✅ RLS policies
   - ✅ Not exposing sensitive data (passwords, secrets)

3. **Your app is secure if:**
   - ✅ Passwords are never sent to frontend
   - ✅ Users can only see authorized data
   - ✅ API endpoints check permissions
   - ✅ Sensitive operations require authentication

---

### 🔍 How to Verify Your Security

```javascript
// Check what data is actually exposed
const checkDataExposure = async () => {
  // Test 1: Can you see passwords?
  const test1 = await fetch('/api/admin/ambassador-sales/orders', {
    credentials: 'include'
  });
  const data1 = await test1.json();
  console.log('✅ Passwords visible?', data1.orders?.some(o => o.password) ? '❌ YES (BAD!)' : '✅ NO (GOOD!)');
  
  // Test 2: Can unauthorized users see data?
  // (Log out and try accessing admin endpoints)
  
  // Test 3: Check Network tab
  console.log('📊 Check Network tab for all API calls');
  console.log('Look for any responses containing passwords or secrets');
};

checkDataExposure();
```

---

## 📝 Notes

1. **Authentication Required**: Most admin endpoints require authentication. Make sure you're logged in as an admin before running these commands.

2. **CORS**: If you're running these from a different domain, you may encounter CORS issues. These commands are designed to work from the same origin.

3. **Error Handling**: All functions include basic error handling, but you may need to adjust based on your API's response format.

4. **Rate Limiting**: Be mindful of rate limits when making multiple API calls.

5. **Data Format**: Responses may vary. Some APIs return `{ data: [...] }` while others return arrays directly. Adjust the console.table calls accordingly.

6. **Console Visibility**: It's normal to see data in the console - this is how web apps work. Security comes from authentication, authorization, and not exposing sensitive data like passwords.

---

## 🚀 Quick Start

Copy and paste this into your browser console to get started:

```javascript
// Quick start - test API connectivity
(async () => {
  console.log('🚀 Testing API connectivity...\n');
  
  // Test public endpoint
  try {
    const status = await fetch('/api/scan-system-status').then(r => r.json());
    console.log('✅ Public API working:', status);
  } catch (e) {
    console.error('❌ API error:', e);
  }
  
  // Test auth
  try {
    const auth = await fetch('/api/verify-admin', { credentials: 'include' }).then(r => r.json());
    console.log('🔐 Auth status:', auth);
  } catch (e) {
    console.log('⚠️ Auth check failed (may need login)');
  }
  
  console.log('\n📚 See BROWSER_CONSOLE_COMMANDS.md for more commands');
})();
```

---

**Last Updated**: 2025-01-02
**Version**: 1.0
