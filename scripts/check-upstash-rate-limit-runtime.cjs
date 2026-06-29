'use strict';

/**
 * Local/CI Upstash REST healthcheck for rate-limit module.
 * Prints booleans and categories only — never secrets.
 */

const path = require('path');

const {
  getEnvPresence,
  categorizeUpstashError,
} = require(path.join(__dirname, '..', 'api', '_lib', 'rate-limit', 'upstash-diagnostics.cjs'));
const {
  incrFixedWindow,
  buildEvalBody,
} = require(path.join(__dirname, '..', 'api', '_lib', 'rate-limit', 'upstash.cjs'));

async function main() {
  const env = getEnvPresence();
  const healthKey = `ae:rl:healthcheck:${Date.now()}`;

  const out = {
    upstash_url_set: env.upstash_url_set,
    upstash_token_set: env.upstash_token_set,
    url_shape_valid: env.url_shape_valid,
    eval_body_has_eval_command: (() => {
      try {
        const parsed = JSON.parse(buildEvalBody(healthKey, 30));
        return parsed[0] === 'EVAL';
      } catch {
        return false;
      }
    })(),
    upstash_http_status: null,
    success: false,
    category: null,
  };

  if (!env.upstash_url_set || !env.upstash_token_set || !env.url_shape_valid) {
    out.category = categorizeUpstashError({ envPresence: env });
    console.log(JSON.stringify(out, null, 2));
    process.exit(1);
  }

  const result = await incrFixedWindow(healthKey, 999, 30, {
    onRedisMissing: 'fail-closed',
    onRedisError: 'fail-closed',
  });

  out.upstash_http_status = result.httpStatus ?? null;
  out.success = result.allowed === true && result.reason !== 'redis_error' && result.reason !== 'redis_missing';
  out.category = out.success
    ? 'ok'
    : result.errorCategory || categorizeUpstashError({ envPresence: env, httpStatus: result.httpStatus });

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.success ? 0 : 1);
}

main().catch((err) => {
  console.log(
    JSON.stringify(
      {
        success: false,
        category: 'unknown',
        message: err instanceof Error ? err.message.slice(0, 120) : 'unknown',
      },
      null,
      2
    )
  );
  process.exit(1);
});
