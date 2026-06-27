'use strict';

const QRCode = require('qrcode');
const { isValidSecureToken } = require('./ticket-qr-url.cjs');

const QR_OPTIONS = {
  type: 'png',
  width: 512,
  margin: 2,
  errorCorrectionLevel: 'M',
};

/**
 * Generate ticket QR PNG buffer from secure_token (same params as production upload flows).
 */
async function generateTicketQrPngBuffer(secureToken) {
  if (!isValidSecureToken(secureToken)) {
    throw new Error('Invalid secure token');
  }
  return QRCode.toBuffer(String(secureToken).trim(), QR_OPTIONS);
}

async function generateTicketQrDataUrl(secureToken) {
  if (!isValidSecureToken(secureToken)) {
    throw new Error('Invalid secure token');
  }
  return QRCode.toDataURL(String(secureToken).trim(), QR_OPTIONS);
}

module.exports = { generateTicketQrPngBuffer, generateTicketQrDataUrl };
