'use strict';

/**
 * Shared Preview probe helper via `vercel curl` + deployment protection bypass.
 * Never logs secrets, tokens, or full sensitive response bodies.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let cachedBypassSecret = null;
let bypassLookupAttempted = false;

function resolveProtectionBypass() {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim()) {
    return process.env.VERCEL_AUTOMATION_BYPASS_SECRET.trim();
  }
  if (cachedBypassSecret) return cachedBypassSecret;
  if (bypassLookupAttempted) return null;
  bypassLookupAttempted = true;
  const r = spawnSync(
    'npx',
    ['vercel@latest', 'project', 'protection', 'andiamo-events'],
    { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, shell: process.platform === 'win32' }
  );
  const raw = String(r.stdout || '');
  const jsonStart = raw.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    const data = JSON.parse(raw.slice(jsonStart));
    const keys = Object.keys(data.protectionBypass || {});
    cachedBypassSecret = keys[0] || null;
    return cachedBypassSecret;
  } catch {
    return null;
  }
}

function extractHttpStatuses(text) {
  const statuses = [];
  const re = /HTTP\/\d(?:\.\d)?\s+(\d{3})/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    statuses.push(Number(m[1]));
  }
  return statuses;
}

function pickFinalStatus(statuses) {
  if (!statuses.length) return null;
  const nonContinue = statuses.filter((s) => s !== 100);
  if (nonContinue.length) return nonContinue[nonContinue.length - 1];
  return statuses[statuses.length - 1];
}

function extractHeadersBlock(text) {
  const blocks = String(text || '').split(/\r?\n\r?\n/);
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (/^HTTP\/\d/i.test(blocks[i]) || /^HTTP\/\d/i.test(blocks[i].split('\n')[0])) {
      return blocks[i];
    }
  }
  const first = blocks[0] || '';
  return /^HTTP\/\d/i.test(first.split('\n')[0]) ? first : '';
}

function extractJsonBody(text) {
  const raw = String(text || '');
  const start = raw.indexOf('{');
  if (start < 0) return { json: null, parseError: 'no_json_object' };
  try {
    return { json: JSON.parse(raw.slice(start)), parseError: null };
  } catch (e) {
    return {
      json: null,
      parseError: e instanceof Error ? e.message.slice(0, 80) : 'parse_failed',
    };
  }
}

function inferStatusFromJson(json) {
  if (!json || typeof json !== 'object') return null;
  const err = json.error;
  if (err === 'rate_limited') return 429;
  if (err === 'service_unavailable') return 503;
  if (err === 'invalid_request' || err === 'Invalid token' || err === 'Invalid JSON') return 400;
  if (err === 'Invalid credentials') return 401;
  if (err === 'Method not allowed') return 405;
  return null;
}

function sanitizeFirstLine(text) {
  const line = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('Vercel CLI') && !l.startsWith('Retrieving project'));
  if (!line) return null;
  if (line.length > 120) return line.slice(0, 120);
  return line;
}

function parseVercelCurlResponse(stdout, stderr, apiPath) {
  const stdoutText = String(stdout || '');
  const stderrText = String(stderr || '');
  const combinedForHeaders = stdoutText;
  const statuses = extractHttpStatuses(combinedForHeaders);
  let status = pickFinalStatus(statuses);
  let parseCategory = 'ok';

  const headerBlock = extractHeadersBlock(combinedForHeaders);
  const retryAfter = (headerBlock.match(/^retry-after:\s*(.+)$/im) || [])[1]?.trim() || null;
  const policy = (headerBlock.match(/^x-ratelimit-policy:\s*(.+)$/im) || [])[1]?.trim() || null;

  const { json, parseError } = extractJsonBody(stdoutText);
  const inferred = inferStatusFromJson(json);

  if (status === 100 || status == null) {
    if (inferred != null) {
      status = inferred;
      parseCategory = status == null ? 'parse_uncertain' : 'inferred_from_json';
    } else if (stdoutText.includes('Vercel Security Checkpoint')) {
      parseCategory = 'blocked_checkpoint';
    } else if (stdoutText.includes('FUNCTION_INVOCATION_FAILED')) {
      parseCategory = 'function_invocation_failed';
      status = 500;
    } else {
      parseCategory = 'parse_uncertain';
      status = null;
    }
  }

  if (parseError && !json && parseCategory === 'ok' && status == null) {
    parseCategory = 'parse_uncertain';
  }

  return {
    status,
    retryAfter,
    policy,
    json,
    parseError,
    parseCategory,
    stdoutLength: stdoutText.length,
    stderrLength: stderrText.length,
    firstSafeLine: sanitizeFirstLine(stdoutText) || sanitizeFirstLine(stderrText),
    functionInvocationFailed: combinedForHeaders.includes('FUNCTION_INVOCATION_FAILED'),
    blockedByCheckpoint: combinedForHeaders.includes('Vercel Security Checkpoint'),
    httpStatusesSeen: statuses,
    path: apiPath,
  };
}

function vercelCurl(base, apiPath, opts = {}) {
  const method = opts.method || 'GET';
  const bypass = resolveProtectionBypass();
  const args = [
    'vercel@latest',
    'curl',
    apiPath.startsWith('/') ? apiPath : `/${apiPath}`,
    '--deployment',
    base,
    '--yes',
  ];
  if (bypass) args.push('--protection-bypass', bypass);

  let bodyFile = null;
  const needsPost = method !== 'GET' || opts.body != null || opts.rawBody != null;
  if (needsPost) {
    args.push('--', '--request', method, '--include');
    if (opts.rawBody != null) {
      bodyFile = path.join(os.tmpdir(), `vercel-curl-body-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
      fs.writeFileSync(bodyFile, String(opts.rawBody), 'utf8');
      args.push('--header', 'Content-Type: application/json');
      args.push('--data-binary', `@${bodyFile}`);
    } else if (opts.body != null) {
      bodyFile = path.join(os.tmpdir(), `vercel-curl-body-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
      fs.writeFileSync(bodyFile, JSON.stringify(opts.body), 'utf8');
      args.push('--header', 'Content-Type: application/json');
      args.push('--data-binary', `@${bodyFile}`);
    }
  } else {
    args.push('--', '--include');
  }

  const r = spawnSync('npx', args, {
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024,
    shell: process.platform === 'win32',
  });

  if (bodyFile) {
    try {
      fs.unlinkSync(bodyFile);
    } catch {
      /* ignore */
    }
  }

  const parsed = parseVercelCurlResponse(r.stdout, r.stderr, apiPath);
  return {
    ...parsed,
    exitCode: r.status ?? 0,
    spawnError: r.error ? String(r.error.message) : null,
    bypassConfigured: !!bypass,
  };
}

module.exports = {
  resolveProtectionBypass,
  parseVercelCurlResponse,
  vercelCurl,
  pickFinalStatus,
  inferStatusFromJson,
};
