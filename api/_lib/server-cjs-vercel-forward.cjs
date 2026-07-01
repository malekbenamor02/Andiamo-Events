'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

/** Repo root (server.cjs passes paths like ./api/admin-login.js relative to this). */
const PROJECT_ROOT = path.join(__dirname, '..', '..');

function resolveHandlerModule(modulePath) {
  if (path.isAbsolute(modulePath)) return modulePath;
  return path.join(PROJECT_ROOT, modulePath.replace(/^\.\//, ''));
}

/**
 * Forward Express requests to Vercel-style ESM handlers (source of truth on production).
 * Used by server.cjs local dev parity (PR-1e).
 */
function createVercelHandlerForward(modulePath) {
  /** @type {Promise<(req: import('http').IncomingMessage, res: import('http').ServerResponse) => Promise<void>>|null} */
  let handlerPromise = null;
  const resolvedPath = resolveHandlerModule(modulePath);
  const importUrl = pathToFileURL(resolvedPath).href;

  return async function forwardToVercelHandler(req, res, next) {
    try {
      if (!handlerPromise) {
        handlerPromise = import(importUrl).then((mod) => {
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
  resolveHandlerModule,
};
