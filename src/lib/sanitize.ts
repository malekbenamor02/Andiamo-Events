/**
 * Sanitize sensitive data from logs and console output
 * Removes API keys, passwords, tokens, and other sensitive information
 */

const SENSITIVE_PATTERNS = [
  // API Keys
  /api[_-]?key["\s:=]+([a-zA-Z0-9_\-]{20,})/gi,
  /apikey["\s:=]+([a-zA-Z0-9_\-]{20,})/gi,
  /supabase[_-]?(url|key|anon|service)[\s:=]+([a-zA-Z0-9_\-\.\/]{20,})/gi,
  
  // Passwords
  /password["\s:=]+([^\s"']+)/gi,
  /pwd["\s:=]+([^\s"']+)/gi,
  /pass["\s:=]+([^\s"']+)/gi,
  
  // Tokens
  /token["\s:=]+([a-zA-Z0-9_\-]{20,})/gi,
  /jwt["\s:=]+([a-zA-Z0-9_\-\.]{20,})/gi,
  /bearer[\s]+([a-zA-Z0-9_\-\.]{20,})/gi,
  /auth[_-]?token["\s:=]+([a-zA-Z0-9_\-]{20,})/gi,
  
  // Secrets
  /secret["\s:=]+([a-zA-Z0-9_\-]{10,})/gi,
  /jwt[_-]?secret["\s:=]+([a-zA-Z0-9_\-]{10,})/gi,
  
  // Database credentials
  /(?:postgres|mysql|mongodb):\/\/[^:]+:([^@]+)@/gi,
  /connection[_-]?string["\s:=]+([^\s"']+)/gi,
  
  // Email credentials
  /smtp[_-]?(user|pass|password)["\s:=]+([^\s"']+)/gi,
  /gmail[_-]?(user|pass|password|app[_-]?password)["\s:=]+([^\s"']+)/gi,
  
  // AWS/Cloud credentials
  /aws[_-]?(access[_-]?key|secret[_-]?key)["\s:=]+([a-zA-Z0-9_\-]{20,})/gi,
  
  // URLs with credentials
  /https?:\/\/[^:]+:([^@]+)@/gi,
];

const SENSITIVE_KEYS = [
  'password',
  'pwd',
  'pass',
  'token',
  'jwt',
  'secret',
  'apiKey',
  'api_key',
  'apikey',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authToken',
  'auth_token',
  'bearer',
  'authorization',
  'supabaseUrl',
  'supabase_url',
  'supabaseKey',
  'supabase_key',
  'supabaseAnonKey',
  'supabase_anon_key',
  'supabaseServiceKey',
  'supabase_service_key',
  'jwtSecret',
  'jwt_secret',
  'connectionString',
  'connection_string',
  'databaseUrl',
  'database_url',
  'smtpUser',
  'smtpPass',
  'smtpPassword',
  'gmailUser',
  'gmailPass',
  'gmailPassword',
  'gmailAppPassword',
  'awsAccessKey',
  'awsSecretKey',
];

/**
 * Sanitize a string by removing sensitive patterns
 */
export const sanitizeString = (str: string): string => {
  if (!str || typeof str !== 'string') return str;
  
  let sanitized = str;
  
  // Replace sensitive patterns
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, (match, value) => {
      return match.replace(value, '[REDACTED]');
    });
  });
  
  return sanitized;
};

/**
 * Sanitize an object by removing or redacting sensitive keys
 */
export const sanitizeObject = (obj: any, depth: number = 0): any => {
  // Prevent infinite recursion
  if (depth > 10) return '[MAX_DEPTH]';
  
  if (obj === null || obj === undefined) return obj;
  
  // Handle primitives
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  // Handle Error objects
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message),
      stack: obj.stack ? sanitizeString(obj.stack) : undefined,
    };
  }
  
  // Handle regular objects
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key is sensitive
    const isSensitiveKey = SENSITIVE_KEYS.some(sensitive => 
      lowerKey.includes(sensitive.toLowerCase())
    );
    
    if (isSensitiveKey) {
      // Redact sensitive values
      if (typeof value === 'string' && value.length > 0) {
        sanitized[key] = '[REDACTED]';
      } else if (value !== null && value !== undefined) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    } else {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, depth + 1);
    }
  }
  
  return sanitized;
};

/**
 * Sanitize arguments for console.log/error/warn
 */
export const sanitizeConsoleArgs = (args: any[]): any[] => {
  return args.map(arg => {
    if (arg instanceof Error) {
      return sanitizeObject(arg);
    }
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObject(arg);
    }
    if (typeof arg === 'string') {
      return sanitizeString(arg);
    }
    return arg;
  });
};

/**
 * Check if a string contains sensitive information
 */
export const containsSensitiveData = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(str)) ||
         SENSITIVE_KEYS.some(key => 
           str.toLowerCase().includes(key.toLowerCase())
         );
};






