import serverless from 'serverless-http';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const express = require('express');
const cookieParser = require('cookie-parser');
const { registerStorageSecurityRoutes } = require(path.join(__dirname, '_lib', 'register-storage-security-routes.cjs'));
const { requireAdminAuth, requireAdminPermission } = require(path.join(__dirname, '_lib', 'admin-auth-express.cjs'));

const app = express();
app.use(cookieParser());
app.use(express.json({ limit: '512kb' }));
registerStorageSecurityRoutes(app, { requireAdminAuth, requireAdminPermission });

export default serverless(app);
