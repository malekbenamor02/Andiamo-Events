'use strict';

/**
 * Generate ticket QR PNG buffer from secure_token (same params as production upload flows).
 */
async function generateTicketQrPngBuffer(secureToken) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toBuffer(String(secureToken), {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

async function generateTicketQrDataUrl(secureToken) {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(String(secureToken), {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}

module.exports = { generateTicketQrPngBuffer, generateTicketQrDataUrl };
