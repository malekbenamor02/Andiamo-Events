'use strict';

const { emailLogoHeaderHtml, invitationEmailDarkStylesCss } = require('./email-branding.cjs');

function createOfficialInvitationEmailHTML(data) {
  // Validate required data
  if (!data || !data.event || !data.qrCodes || !Array.isArray(data.qrCodes) || data.qrCodes.length === 0) {
    throw new Error('Invalid email data: missing required fields or empty QR codes array');
  }

  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'TBD';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateString || 'TBD'; }
  };
  const formatTime = (dateString) => {
    try {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return ''; }
  };
  const eventDate = formatDate(data.event?.date);
  const eventTime = formatTime(data.event?.date);
  const qrCodesHtml = data.qrCodes.map((qr, index) => {
    if (data.qrCodes.length === 1) {
      return `<img src="${qr.qr_code_url}" alt="Invitation QR Code" style="max-width: 300px; height: auto; display: block; margin: 0 auto 20px; border-radius: 8px;" />`;
    } else {
      return `<div style="margin: 10px; padding: 20px; background: #181818; border: 2px solid #E21836; border-radius: 12px; display: inline-block;"><p style="margin: 0 0 15px 0; color: #E21836; font-size: 14px; font-weight: 600;">QR Code ${index + 1}</p><img src="${qr.qr_code_url}" alt="Invitation QR Code ${index + 1}" style="max-width: 250px; height: auto; display: block; margin: 0 auto; border-radius: 8px;" /></div>`;
    }
  }).join('');
  const qrCodeSectionTitle = data.qrCodes.length > 1 ? `Your QR Codes (${data.qrCodes.length})` : "Your QR Code";
  const qrCodeInstruction = data.qrCodes.length > 1 ? "Scan any of these QR codes at the entrance to access your assigned zone" : "Scan this QR code at the entrance to access your assigned zone";
  const zoneTableHtml = data.zoneName && data.zoneDescription ? `<table style="width: 100%; border-collapse: collapse; margin-top: 20px;"><thead><tr><th style="background: #141414; color: #FFFFFF; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;">Zone</th><th style="background: #141414; color: #FFFFFF; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;">Access Details</th></tr></thead><tbody><tr><td style="padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); font-size: 14px; color: #E8E8E8;">${data.zoneName}</td><td style="padding: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.12); font-size: 14px; color: #E8E8E8;">${data.zoneDescription}</td></tr></tbody></table><p style="margin-top: 20px; font-size: 14px; color: #B8B8B8; line-height: 1.7;">Access is valid only for the zone mentioned above.<br>Zone changes are not permitted on-site.</p>` : '';
  // Preview: node email-templates/generate-previews.cjs → previews/05-official-invitation.html
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Official Invitation – Andiamo Events</title>
  <style>
${invitationEmailDarkStylesCss()}
    .info-block .info-row { margin-bottom: 25px; }
  </style>
</head>
<body>
  ${emailLogoHeaderHtml()}
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <h1 class="title">Official Invitation</h1>
        <p class="subtitle">Andiamo Events</p>
      </div>
      <p class="greeting">Dear <strong>${data.guestName}</strong>,</p>
      <p class="message">Mouayed Chakir has the pleasure to invite you to the <strong>${data.event.name}</strong>, proudly organized by Andiamo Events.</p>
      <p class="message">We are pleased to confirm that your invitation has been successfully registered. This email serves as your official entry pass to the event.</p>
      <p class="message">Please find your personal QR code${data.qrCodes.length > 1 ? 's' : ''} included below. ${data.qrCodes.length > 1 ? 'They' : 'It'} will be required for access control and validation at the venue.</p>
      <p class="message">Kindly keep this invitation available on your phone or printed on the day of the event.</p>
      <div class="event-details-block">
        <div class="event-details-title">Event Details</div>
        <div class="event-detail-row">
          <div class="event-detail-label">Date</div>
          <div class="event-detail-value">${eventDate}</div>
        </div>
        ${eventTime ? `<div class="event-detail-row"><div class="event-detail-label">Show Time</div><div class="event-detail-value">${eventTime}</div></div>` : ''}
        <div class="event-detail-row">
          <div class="event-detail-label">Venue</div>
          <div class="event-detail-value">${data.event.venue}</div>
        </div>
      </div>
      <div class="info-block">
        <div class="info-row"><div class="info-label">Invitation</div><div class="info-value">#${data.invitationNumber}</div></div>
        <div class="info-row"><div class="info-label">Guest Name</div><div class="info-value">${data.guestName}</div></div>
        <div class="info-row"><div class="info-label">Phone Number</div><div class="info-value">${data.guestPhone}</div></div>
      </div>
      ${zoneTableHtml ? `<div class="info-block"><div class="info-label" style="margin-bottom:15px;">Zone &amp; Access Details</div>${zoneTableHtml}</div>` : ''}
      <div class="qr-code-section">
        <h3 class="qr-code-title">${qrCodeSectionTitle}</h3>
        <p class="qr-code-instruction">${qrCodeInstruction}</p>
        ${qrCodesHtml}
      </div>
      <div class="rules-section">
        <div class="rules-title">Important Access Rules</div>
        <ul class="rules-list">
          <li>Each QR code is valid for one (1) person only and for a single entry.</li>
          <li>Reproduction, sharing, or duplication of the QR code is strictly prohibited.</li>
          <li>Once scanned, the QR code becomes invalid.</li>
        </ul>
        <p class="arrival-note">Please arrive at least 1h30mn before the show time to ensure smooth check-in.</p>
      </div>
      <div class="support-section">
        <p class="support-text">For any assistance or additional information, please contact us at</p>
        <p class="support-contact"><a href="mailto:contact@andiamoevents.com" class="support-email">contact@andiamoevents.com</a> or <strong style="color:#E21836!important">+216 28 070 128</strong></p>
      </div>
      <div class="closing-section">
        <p class="slogan">We Create Memories</p>
        <p class="signature">Best regards,<br>Andiamo Events Team</p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Developed by <span style="color:#E21836!important">Malek Ben Amor</span></p>
      <div class="footer-links">
        <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
        <span style="color:#888888">•</span>
        <a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  return { from: '"Andiamo Events" <contact@andiamoevents.com>', to: data.guestEmail, subject: 'Official Invitation – Andiamo Events', html: html };
}


module.exports = { createOfficialInvitationEmailHTML };
