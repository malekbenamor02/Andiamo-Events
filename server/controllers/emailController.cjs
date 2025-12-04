/**
 * Email controller
 * Request/response handling for email endpoints
 */

const { sendSuccess, sendError } = require('../middleware/errorHandler.cjs');
const emailService = require('../services/emailService.cjs');

/**
 * Send email
 */
async function sendEmail(req, res) {
  try {
    const { to, subject, html } = req.body;

    await emailService.sendEmail(to, subject, html);
    return sendSuccess(res, null, 'Email sent successfully');
  } catch (error) {
    // Provide specific error messages
    let errorMessage = 'Failed to send email';
    let errorDetails = error.message || 'Unknown error occurred';
    let statusCode = 500;

    if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = 'Email authentication failed';
      errorDetails = 'The email server credentials are invalid. Please contact the administrator.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection failed';
      errorDetails = 'Unable to connect to the email server. Please try again later.';
    } else if (error.message.includes('not configured')) {
      statusCode = 500;
      errorDetails = 'Email server configuration is missing. Please contact the administrator.';
    } else if (error.message.includes('Invalid email')) {
      statusCode = 400;
    }

    return sendError(res, errorMessage, errorDetails, statusCode);
  }
}

module.exports = {
  sendEmail
};

