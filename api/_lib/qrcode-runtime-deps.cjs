'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

/** Vercel `functions.*.includeFiles` max length (schema validation). */
const VERCEL_INCLUDE_FILES_MAX_LENGTH = 256;

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

/** Short includeFiles: local _lib + Chromium binary assets (not reliably file-traced). */
const TICKET_EMAIL_CHROMIUM_GLOB = 'node_modules/@sparticuz/chromium/**';

const TICKET_EMAIL_VERCEL_INCLUDE_FILES = `{api/_lib/**,${TICKET_EMAIL_CHROMIUM_GLOB}}`;

const MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES = `{api/_lib/**,${MISC_EXTRA_VERCEL_INCLUDES.join(
  ','
)},${TICKET_EMAIL_CHROMIUM_GLOB}}`;

const QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES = ['dijkstrajs', 'pngjs'];

const QRCODE_VERCEL_NODE_MODULES = [
  'node_modules/qrcode/**',
  ...QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES.map((name) => `node_modules/${name}/**`),
];

/** @deprecated use TICKET_EMAIL_VERCEL_INCLUDE_FILES */
const QR_PDF_EMAIL_VERCEL_INCLUDE_FILES = TICKET_EMAIL_VERCEL_INCLUDE_FILES;

function loadLockfile(lockfilePath) {
  const lockPath = lockfilePath || resolve(__dirname, '../../package-lock.json');
  return JSON.parse(readFileSync(lockPath, 'utf8'));
}

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

function parseIncludeFilesFromVercelJson(vercelJson) {
  const results = [];
  const re = /"includeFiles":\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(vercelJson)) !== null) {
    results.push(match[1]);
  }
  return results;
}

function assertAllIncludeFilesWithinSchemaLimit(vercelJson) {
  const values = parseIncludeFilesFromVercelJson(vercelJson);
  for (const value of values) {
    if (value.length > VERCEL_INCLUDE_FILES_MAX_LENGTH) {
      throw new Error(
        `includeFiles exceeds ${VERCEL_INCLUDE_FILES_MAX_LENGTH} chars (${value.length}): ${value.slice(0, 80)}…`
      );
    }
  }
}

function assertShortTicketEmailIncludeFiles(includeFiles) {
  if (!String(includeFiles).includes('api/_lib/**')) {
    throw new Error('includeFiles missing api/_lib/**');
  }
  if (!String(includeFiles).includes(TICKET_EMAIL_CHROMIUM_GLOB)) {
    throw new Error(`includeFiles missing ${TICKET_EMAIL_CHROMIUM_GLOB}`);
  }
}

function includeFilesForFunction(vercelJson, functionPath) {
  const block = new RegExp(
    `"${functionPath.replace(/\//g, '\\/')}"[\\s\\S]*?"includeFiles":\\s*"([^"]+)"`
  ).exec(vercelJson);
  if (!block) {
    throw new Error(`includeFiles block not found for ${functionPath}`);
  }
  return block[1];
}

const TICKET_EMAIL_ENTRYPOINT_RUNTIME_PACKAGES = [
  'qrcode',
  'dijkstrajs',
  'pngjs',
  'pdf-lib',
  'puppeteer-core',
  '@sparticuz/chromium',
  'follow-redirects',
  'nodemailer',
];

function entrypointStaticImportPattern(packageName) {
  const escaped = packageName.replace('/', '\\/');
  return new RegExp(`import\\s+['"]${escaped}['"]\\s*;`);
}

function assertEntrypointStaticallyImportsTicketEmailPackages(entrypointSource, entrypointPath) {
  for (const pkg of TICKET_EMAIL_ENTRYPOINT_RUNTIME_PACKAGES) {
    if (!entrypointStaticImportPattern(pkg).test(entrypointSource)) {
      throw new Error(
        `${entrypointPath} missing top-level import '${pkg}' (Vercel file trace requires entrypoint-level bare imports)`
      );
    }
  }
}

module.exports = {
  VERCEL_INCLUDE_FILES_MAX_LENGTH,
  QR_GENERATING_VERCEL_FUNCTIONS,
  TICKET_EMAIL_ENTRYPOINT_RUNTIME_PACKAGES,
  MISC_EXTRA_VERCEL_INCLUDES,
  TICKET_EMAIL_CHROMIUM_GLOB,
  TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES,
  QRCODE_VERCEL_NODE_MODULES,
  QR_PDF_EMAIL_VERCEL_INCLUDE_FILES,
  getQrcodeRuntimeDepNamesFromLockfile,
  programmaticRuntimePackagesFromLockfile,
  parseIncludeFilesFromVercelJson,
  assertAllIncludeFilesWithinSchemaLimit,
  assertShortTicketEmailIncludeFiles,
  includeFilesForFunction,
  entrypointStaticImportPattern,
  assertEntrypointStaticallyImportsTicketEmailPackages,
};
