import createDOMPurify from 'dompurify';

const CMS_HTML_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'a',
  'span',
  'div',
];

const CMS_HTML_ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

const CMS_SANITIZE_CONFIG = {
  ALLOWED_TAGS: CMS_HTML_ALLOWED_TAGS,
  ALLOWED_ATTR: CMS_HTML_ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
};

function getBrowserPurify() {
  if (typeof window === 'undefined') return null;
  return createDOMPurify(window);
}

/** Minimal fallback when DOM is unavailable (tests/SSR). Not a full HTML parser. */
function fallbackSanitizeCmsHtml(dirty: string): string {
  let out = dirty
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
  return out;
}

/**
 * Sanitize CMS/admin HTML before dangerouslySetInnerHTML.
 * Blocks scripts, event handlers, and javascript: URLs.
 */
export function sanitizeCmsHtml(dirty: string | null | undefined): string {
  if (dirty == null || dirty === '') return '';
  const input = String(dirty);
  const purify = getBrowserPurify();
  if (purify) {
    return purify.sanitize(input, CMS_SANITIZE_CONFIG);
  }
  return fallbackSanitizeCmsHtml(input);
}
