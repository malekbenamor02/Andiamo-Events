'use strict';

/**
 * Forward Express requests to Vercel-style ESM handlers (source of truth on production).
 * Used by server.cjs local dev parity (PR-1e).
 */
function createVercelHandlerForward(modulePath) {
  /** @type {Promise<(req: import('http').IncomingMessage, res: import('http').ServerResponse) => Promise<void>>|null} */
  let handlerPromise = null;

  return async function forwardToVercelHandler(req, res, next) {
    try {
      if (!handlerPromise) {
        handlerPromise = import(modulePath).then((mod) => {
          if (!mod?.default) {
            throw new Error(`Module ${modulePath} has no default export`);
          }
          return mod.default;
        });
      }
      const handler = await handlerPromise;
      const savedUrl = req.url;
      req.url = req.originalUrl || req.url;
      await handler(req, res);
      req.url = savedUrl;
    } catch (err) {
      console.error('[server.cjs vercel-forward]', modulePath, err);
      if (typeof next === 'function' && !res.headersSent) {
        next(err);
      } else if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

module.exports = {
  createVercelHandlerForward,
};
