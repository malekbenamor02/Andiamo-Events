/**
 * Vercel serverless entry for R2 media upload/delete (multipart + JSON).
 * Local dev uses server.cjs, which registers the same routes via register-media-routes.cjs.
 */
import serverless from 'serverless-http';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const express = require('express');
const cookieParser = require('cookie-parser');
const { registerMediaRoutes } = require(path.join(__dirname, '_lib', 'register-media-routes.cjs'));
const { requireAdminAuth } = require(path.join(__dirname, '_lib', 'admin-auth-express.cjs'));

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: '512kb' }));
registerMediaRoutes(app, { requireAdminAuth });

export default serverless(app);
