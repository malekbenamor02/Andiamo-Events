import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo root: api/lib -> .. -> api -> .. -> root */
const LOG_FILE = path.join(__dirname, '..', '..', 'debug-03cead.log');
const INGEST = 'http://127.0.0.1:7315/ingest/5768a363-992a-4921-888d-de188b339445';

/**
 * Debug NDJSON to workspace + optional local ingest (vercel dev / Cursor).
 * Do not log secrets or PII.
 */
export function agentDebugLog(payload) {
  const lineObj = { sessionId: '03cead', ...payload, timestamp: Date.now() };
  const line = JSON.stringify(lineObj) + '\n';
  try {
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (_) {
    /* ignore */
  }
  fetch(INGEST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '03cead' },
    body: JSON.stringify(lineObj),
  }).catch(() => {});
}
