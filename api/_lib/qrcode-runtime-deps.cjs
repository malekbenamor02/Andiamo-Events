'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

/**
 * Lockfile-aware Vercel includeFiles for ticket email: inline QR, PDF (Chromium), SMTP attachments.
 * Hoisted npm deps are not copied when only the parent package glob is listed.
 */

const TICKET_EMAIL_ROOT_PACKAGES = [
  'qrcode',
  '@sparticuz/chromium',
  'puppeteer-core',
  'pdf-lib',
  'nodemailer',
];

/** CLI-only; excluded from serverless bundles. */
const TICKET_EMAIL_EXCLUDED_PACKAGES = new Set(['yargs']);

const QR_GENERATING_VERCEL_FUNCTIONS = [
  'api/clictopay-confirm-payment.js',
  'api/admin-approve-order.js',
  'api/admin-pos.js',
  'api/misc.js',
];

const MISC_EXTRA_VERCEL_INCLUDES = [
  'academyRoutes.cjs',
  'shared/admin/**',
  'node_modules/multer/**',
  'node_modules/sharp/**',
  'node_modules/bcryptjs/**',
];

function lockfilePackagePath(packageName) {
  if (packageName.startsWith('@')) {
    const [scope, pkg] = packageName.split('/');
    return `node_modules/${scope}/${pkg}`;
  }
  return `node_modules/${packageName}`;
}

function resolveLockfileDepPath(lock, parentPath, depName) {
  const nested = `${parentPath}/node_modules/${depName}`;
  if (lock.packages && lock.packages[nested]) return nested;
  return lockfilePackagePath(depName);
}

function collectTransitivePackagePaths(lock, rootPackageNames, exclude = TICKET_EMAIL_EXCLUDED_PACKAGES) {
  const visited = new Set();
  const queue = rootPackageNames.map(lockfilePackagePath);

  while (queue.length) {
    const pkgPath = queue.shift();
    if (!pkgPath || visited.has(pkgPath)) continue;
    const pkg = lock.packages && lock.packages[pkgPath];
    if (!pkg) continue;
    visited.add(pkgPath);

    const deps = pkg.dependencies || {};
    for (const depName of Object.keys(deps)) {
      if (exclude.has(depName)) continue;
      queue.push(resolveLockfileDepPath(lock, pkgPath, depName));
    }
  }

  return [...visited].sort();
}

function minimalIncludeGlobs(packagePaths) {
  const sorted = [...packagePaths].sort((a, b) => a.length - b.length);
  const kept = [];
  for (const pkgPath of sorted) {
    if (kept.some((parent) => pkgPath.startsWith(`${parent}/`))) continue;
    kept.push(pkgPath);
  }
  return kept.map((pkgPath) => `${pkgPath}/**`);
}

function loadLockfile(lockfilePath) {
  const lockPath = lockfilePath || resolve(__dirname, '../../package-lock.json');
  return JSON.parse(readFileSync(lockPath, 'utf8'));
}

function ticketEmailNodeModuleGlobsFromLockfile(lockfilePath) {
  const lock = loadLockfile(lockfilePath);
  const paths = collectTransitivePackagePaths(lock, TICKET_EMAIL_ROOT_PACKAGES);
  return minimalIncludeGlobs(paths);
}

function buildBraceIncludeFiles(parts) {
  const unique = [...new Set(parts.filter(Boolean))];
  return `{${unique.join(',')}}`;
}

const TICKET_EMAIL_VERCEL_NODE_MODULES = ticketEmailNodeModuleGlobsFromLockfile();

const TICKET_EMAIL_VERCEL_INCLUDE_FILES = buildBraceIncludeFiles([
  'api/_lib/**',
  ...TICKET_EMAIL_VERCEL_NODE_MODULES,
]);

const MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES = buildBraceIncludeFiles([
  'api/_lib/**',
  ...MISC_EXTRA_VERCEL_INCLUDES,
  ...TICKET_EMAIL_VERCEL_NODE_MODULES,
]);

/** @deprecated use TICKET_EMAIL_VERCEL_NODE_MODULES filtered for qrcode tree */
const QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES = ['dijkstrajs', 'pngjs'];

/** @deprecated use TICKET_EMAIL_VERCEL_NODE_MODULES */
const QRCODE_VERCEL_NODE_MODULES = [
  'node_modules/qrcode/**',
  ...QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES.map((name) => `node_modules/${name}/**`),
];

/** @deprecated use TICKET_EMAIL_VERCEL_INCLUDE_FILES */
const QR_PDF_EMAIL_VERCEL_INCLUDE_FILES = TICKET_EMAIL_VERCEL_INCLUDE_FILES;

const REQUIRED_TICKET_EMAIL_RUNTIME_GLOBS = [
  'node_modules/qrcode/**',
  'node_modules/dijkstrajs/**',
  'node_modules/pngjs/**',
  'node_modules/pdf-lib/**',
  'node_modules/puppeteer-core/**',
  'node_modules/@sparticuz/chromium/**',
  'node_modules/follow-redirects/**',
  'node_modules/nodemailer/**',
];

function getQrcodeRuntimeDepNamesFromLockfile(lockfilePath) {
  const lock = loadLockfile(lockfilePath);
  const qrcodePkg = lock.packages && lock.packages['node_modules/qrcode'];
  if (!qrcodePkg || !qrcodePkg.dependencies) {
    throw new Error('package-lock.json: node_modules/qrcode.dependencies not found');
  }
  return Object.keys(qrcodePkg.dependencies);
}

function programmaticRuntimePackagesFromLockfile(lockfilePath) {
  const all = getQrcodeRuntimeDepNamesFromLockfile(lockfilePath);
  return all.filter((name) => name !== 'yargs');
}

function assertIncludeFilesCoversQrcodeRuntime(includeFiles) {
  const missing = QRCODE_VERCEL_NODE_MODULES.filter((glob) => !String(includeFiles).includes(glob));
  if (missing.length) {
    throw new Error(`includeFiles missing qrcode runtime globs: ${missing.join(', ')}`);
  }
}

function assertIncludeFilesCoversTicketEmailRuntime(includeFiles) {
  const missing = REQUIRED_TICKET_EMAIL_RUNTIME_GLOBS.filter(
    (glob) => !String(includeFiles).includes(glob)
  );
  if (missing.length) {
    throw new Error(`includeFiles missing ticket email runtime globs: ${missing.join(', ')}`);
  }
}

module.exports = {
  TICKET_EMAIL_ROOT_PACKAGES,
  TICKET_EMAIL_EXCLUDED_PACKAGES,
  TICKET_EMAIL_VERCEL_NODE_MODULES,
  TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  MISC_EXTRA_VERCEL_INCLUDES,
  MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  QR_GENERATING_VERCEL_FUNCTIONS,
  REQUIRED_TICKET_EMAIL_RUNTIME_GLOBS,
  QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES,
  QRCODE_VERCEL_NODE_MODULES,
  QR_PDF_EMAIL_VERCEL_INCLUDE_FILES,
  lockfilePackagePath,
  collectTransitivePackagePaths,
  minimalIncludeGlobs,
  ticketEmailNodeModuleGlobsFromLockfile,
  buildBraceIncludeFiles,
  getQrcodeRuntimeDepNamesFromLockfile,
  programmaticRuntimePackagesFromLockfile,
  assertIncludeFilesCoversQrcodeRuntime,
  assertIncludeFilesCoversTicketEmailRuntime,
};
