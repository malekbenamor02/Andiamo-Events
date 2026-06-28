import { describe, it, expect } from 'vitest';
import { sanitizeCmsHtml } from './sanitizeHtml';

describe('sanitizeCmsHtml', () => {
  it('strips script tags', () => {
    const out = sanitizeCmsHtml('<p>Hi</p><script>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('<p>Hi</p>');
  });

  it('strips img onerror handlers', () => {
    const out = sanitizeCmsHtml('<img src=x onerror=alert(1)>');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  it('strips javascript: hrefs', () => {
    const out = sanitizeCmsHtml('<a href="javascript:alert(1)">x</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('preserves safe formatting', () => {
    const out = sanitizeCmsHtml('<p><strong>Bold</strong> text</p>');
    expect(out).toContain('<strong>Bold</strong>');
  });

  it('preserves line-break email body formatting', () => {
    const out = sanitizeCmsHtml('Hello<br>World');
    expect(out).toContain('Hello');
    expect(out).toContain('World');
  });

  it('sanitizes email campaign-style malicious HTML', () => {
    const malicious = 'Welcome!<br><script>alert(1)</script><img src=x onerror=alert(1)>';
    const out = sanitizeCmsHtml(malicious);
    expect(out.toLowerCase()).not.toMatch(/<script|onerror|javascript:/);
    expect(out).toContain('Welcome!');
  });
});
