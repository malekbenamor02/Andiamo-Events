/**
 * Returns 410 Gone for scanner/bot paths (WordPress, etc.).
 * These paths are commonly probed by bots looking for vulnerabilities.
 * Used via rewrites in vercel.json.
 */
export default function handler(req, res) {
  res.status(410).end();
}
