/**
 * Global error handler middleware
 * Unified error handling and response format
 */

/**
 * Standard API response format
 */
function sendSuccess(res, data = null, message = null, statusCode = 200) {
  const response = {
    success: true,
    ...(data && { data }),
    ...(message && { message })
  };
  return res.status(statusCode).json(response);
}

/**
 * Standard API error response format
 */
function sendError(res, error, details = null, statusCode = 500) {
  const response = {
    success: false,
    error: error || 'Internal server error',
    ...(details && { details })
  };
  return res.status(statusCode).json(response);
}

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 'Token verification failed', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 'Please login again', 401);
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return sendError(res, 'Validation error', err.message, 400);
  }

  // Database errors
  if (err.code && err.code.startsWith('P')) {
    return sendError(res, 'Database error', err.message, 500);
  }

  // Default error
  return sendError(
    res,
    err.message || 'Internal server error',
    process.env.NODE_ENV === 'development' ? err.stack : null,
    500
  );
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  return sendError(res, 'Route not found', `The route ${req.path} does not exist`, 404);
}

module.exports = {
  sendSuccess,
  sendError,
  errorHandler,
  notFoundHandler
};

