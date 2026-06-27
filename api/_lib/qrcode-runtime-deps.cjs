'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

/**
 * Top-level runtime packages required by `qrcode` for programmatic toBuffer/toDataURL.
 * `yargs` is CLI-only (bin/qrcode) and is intentionally excluded from serverless bundles.
 *
 * Source: package-lock.json → node_modules/qrcode.dependencies
 */
const QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES = ['dijkstrajs', 'pngjs'];

/** Vercel includeFiles globs for qrcode + programmatic runtime deps. */
const QRCODE_VERCEL_NODE_MODULES = [
  'node_modules/qrcode/**',
  ...QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES.map((name) => `node_modules/${name}/**`),
];

const QR_PDF_EMAIL_VERCEL_INCLUDE_FILES = `{api/_lib/**,node_modules/@sparticuz/chromium/**,${QRCODE_VERCEL_NODE_MODULES.join(
  ','
)},node_modules/pdf-lib/**,node_modules/puppeteer-core/**}`;

const QR_GENERATING_VERCEL_FUNCTIONS = [
  'api/clictopay-confirm-payment.js',
  'api/admin-approve-order.js',
  'api/admin-pos.js',
  'api/misc.js',
];

function getQrcodeRuntimeDepNamesFromLockfile(lockfilePath) {
  const lockPath = lockfilePath || resolve(__dirname, '../../package-lock.json');
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
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

module.exports = {
  QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES,
  QRCODE_VERCEL_NODE_MODULES,
  QR_PDF_EMAIL_VERCEL_INCLUDE_FILES,
  QR_GENERATING_VERCEL_FUNCTIONS,
  getQrcodeRuntimeDepNamesFromLockfile,
  programmaticRuntimePackagesFromLockfile,
  assertIncludeFilesCoversQrcodeRuntime,
};
