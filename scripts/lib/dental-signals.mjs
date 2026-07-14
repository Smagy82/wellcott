/**
 * scripts/lib/dental-signals.mjs
 * Shared URL normalization and dental-signal detection logic.
 * Imported by build-dental-flags.mjs and retry-dental-flags.mjs.
 * Do NOT change signal definitions here without re-running both scripts.
 */

export const TRASH = new Set(['n/a', 'na', 'none', '-', '']);

/** Canonical domain key: lowercase, no scheme, no www., no trailing slash. */
export function canonicalize(raw) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (TRASH.has(s)) return null;
  let c = s.replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/+$/, '');
  if (c.length < 5 || !c.includes('.')) return null;
  return c;
}

/** https first, then http fallback. */
export function toFetchUrls(canon) {
  return [`https://${canon}`, `http://${canon}`];
}

// ── Signal patterns (case-insensitive) ───────────────────────────────────────

// Remove these before counting signal hits
export const NOISE_RES = [
  /dental\s+insurance/gi,
  /dental\s+coverage/gi,
  /no\s+dental/gi,
  /dental\s+not\s+offered/gi,
  /dental\s+plan/gi,
];

// 'strong': navigation links or explicit service pages
export const STRONG_RES = [
  /href="[^"]*dental[^"]*"/gi,
  /href="[^"]*oral-health[^"]*"/gi,
  /dental\s+services/gi,
  /dental\s+care/gi,
  /oral\s+health\s+services/gi,
];

// 'medium': incidental mentions — real but weaker signal
export const MEDIUM_RES = [
  /\bdentist\b/gi,
  /\bdentistry\b/gi,
  /\boral\s+health\b/gi,
];

/**
 * Returns 'strong' | 'medium' | 'none'.
 * Call only when html is a non-empty string (fetch succeeded).
 */
export function analyzeHtml(html) {
  let cleaned = html;
  for (const re of NOISE_RES) cleaned = cleaned.replace(re, ' ');

  const strong = STRONG_RES.some(re => { re.lastIndex = 0; return re.test(cleaned); });
  if (strong) return 'strong';

  const medium = MEDIUM_RES.some(re => { re.lastIndex = 0; return re.test(cleaned); });
  if (medium) return 'medium';

  return 'none';
}
