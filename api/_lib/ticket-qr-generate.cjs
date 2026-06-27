'use strict';

const { isValidSecureToken } = require('./ticket-qr-url.cjs');

/**
 * Generate ticket QR PNG buffer from secure_token (same params as production upload flows).
 */
async function generateTicketQrPngBuffer(secureToken) {
  if (!isValidSecureToken(secureToken)) {
    throw new Error('Invalid secure token');
  }
  const QRCode = (await import('qrcode')).default;
  return QRCode.toBuffer(String(secureToken).trim(), {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

async function generateTicketQrDataUrl(secureToken) {
  if (!isValidSecureToken(secureToken)) {
    throw new Error('Invalid secure token');
  }
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(String(secureToken).trim(), {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

module.exports = { generateTicketQrPngBuffer, generateTicketQrDataUrl };
