/**
 * Vercel serverless entry for Academy registration & admin APIs.
 * Local dev: server.cjs registers the same routes via academyRoutes.cjs.
 */
import serverless from 'serverless-http';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const express = require('express');
const cookieParser = require('cookie-parser');
const { registerAcademyRoutes } = require(path.join(__dirname, '..', 'academyRoutes.cjs'));
const { requireAdminAuth } = require(path.join(__dirname, '_lib', 'admin-auth-express.cjs'));

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));
registerAcademyRoutes(app, { requireAdminAuth });

export default serverless(app);
