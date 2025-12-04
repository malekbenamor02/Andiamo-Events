/**
 * Phone number formatting utilities
 * Centralized phone number formatting logic
 */

/**
 * Format Tunisian phone number to international format
 * @param {string} phone - Phone number to format
 * @returns {string|null} Formatted phone number or null if invalid
 */
function formatPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  let cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present
  if (cleaned.startsWith('216')) {
    cleaned = cleaned.substring(3);
  }
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Validate Tunisian phone number format (8 digits starting with 2, 5, 9, or 4)
  if (cleaned.length === 8 && /^[2594]/.test(cleaned)) {
    return '216' + cleaned;
  }
  
  return null;
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function isValidPhoneNumber(phone) {
  return formatPhoneNumber(phone) !== null;
}

module.exports = {
  formatPhoneNumber,
  isValidPhoneNumber
};

