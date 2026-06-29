'use strict';

const { isValidUuid } = require('./hash-key.cjs');

/**
 * Extract orderId from ClicToPay confirm GET query or POST body.
 * @param {'GET'|'POST'} method
 * @param {Record<string, unknown>} [bodyData]
 * @param {string} [urlString]
 */
function extractPaymentConfirmOrderId(method, bodyData, urlString) {
  if (method === 'POST') {
    const id = bodyData?.orderId ?? bodyData?.order_id;
    return id != null && String(id).trim() !== '' ? String(id).trim() : null;
  }
  const urlObj = new URL(urlString || '', 'http://localhost');
  return urlObj.searchParams.get('orderId') || urlObj.searchParams.get('order_id') || null;
}

/**
 * @param {'GET'|'POST'} method
 * @param {Record<string, unknown>} [bodyData]
 * @param {string} [urlString]
 */
function extractAcademyConfirmRegistrationId(method, bodyData, urlString) {
  if (method === 'POST') {
    const id = bodyData?.registrationId ?? bodyData?.registration_id;
    return id != null && String(id).trim() !== '' ? String(id).trim() : null;
  }
  const urlObj = new URL(urlString || '', 'http://localhost');
  return urlObj.searchParams.get('registrationId') || urlObj.searchParams.get('registration_id') || null;
}

function isValidPaymentConfirmOrderId(orderId) {
  return isValidUuid(orderId);
}

function isValidAcademyConfirmRegistrationId(registrationId) {
  return isValidUuid(registrationId);
}

module.exports = {
  extractPaymentConfirmOrderId,
  extractAcademyConfirmRegistrationId,
  isValidPaymentConfirmOrderId,
  isValidAcademyConfirmRegistrationId,
};
