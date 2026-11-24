const SAFE_HREF_PROTOCOL_REGEX = /^(https?:|mailto:|tel:|\/(?!\/)|#|\?)/i;
const SAFE_DATA_IMAGE_REGEX = /^data:image\/(png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const DANGEROUS_SCHEME_REGEX = /^(javascript|vbscript|data):/i;
const CONTROL_AND_SPACE_REGEX = /[\u0000-\u0020\u007f-\u009f\s]+/g;

function decodeHtmlEntitiesForScheme(raw: string): string {
  return String(raw || '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#([0-9]+);?/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '\t')
    .replace(/&newline;/gi, '\n');
}

function isSafeUrlAttribute(attrName: string, rawValue: string): boolean {
  const decoded = decodeHtmlEntitiesForScheme(rawValue);
  const stripped = decoded.replace(CONTROL_AND_SPACE_REGEX, '').trim();
  if (!stripped) return true;
  if (DANGEROUS_SCHEME_REGEX.test(stripped)) {
    if (attrName.toLowerCase() === 'src' && SAFE_DATA_IMAGE_REGEX.test(decoded.trim())) {
      return true;
    }
    return false;
  }
  return SAFE_HREF_PROTOCOL_REGEX.test(stripped) || !stripped.includes(':');
}

function isUnsafeStyleValue(styleValue: string): boolean {
  const decoded = decodeHtmlEntitiesForScheme(styleValue);
  return /expression\s*\(|javascript\s*:|vbscript\s*:|@import|-moz-binding|behavior\s*:|data\s*:\s*text\/html|data\s*:\s*image\/svg\+xml/i.test(
    decoded,
  );
}

const BLOCKED_PAIR_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
  'svg',
  'math',
  'style',
  'form',
  'textarea',
  'select',
  'button',
  'noscript',
  'template',
];

const BLOCKED_VOID_TAGS = ['input', 'base', 'meta', 'link', 'param', 'source'];

/**
 * Sanitizes rich HTML for storefront rendering while preserving benign inline styles
 * such as background, border-radius, direction, margin, width, max-width, box-sizing, and display.
 */
export function sanitizeRichHtml(input: string | null | undefined): string {
  if (input === null || input === undefined) return '';
  let html = String(input);
  if (!html) return '';

  html = html.replace(/\0/g, '').replace(/<!--[\s\S]*?-->/g, '');

  for (let pass = 0; pass < 3; pass += 1) {
    const prev = html;
    for (const tag of BLOCKED_PAIR_TAGS) {
      const pairRegex = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`, 'gi');
      const unclosedRegex = new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*$`, 'gi');
      const closingRegex = new RegExp(`<\\s*\\/\\s*${tag}\\b[^>]*>`, 'gi');
      html = html.replace(pairRegex, '').replace(unclosedRegex, '').replace(closingRegex, '');
    }
    for (const tag of BLOCKED_VOID_TAGS) {
      const voidRegex = new RegExp(`<\\s*\\/?\\s*${tag}\\b[^>]*>`, 'gi');
      html = html.replace(voidRegex, '');
    }
    if (html === prev) break;
  }

  html = html.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)(\s+[^>]*)?>/g, (full, tagName, attrsRaw) => {
    if (!attrsRaw) return full;

    let attrs = String(attrsRaw);
    attrs = attrs.replace(
      /\s+(?:on[a-z0-9_-]+|srcdoc|formaction|xlink:href)\s*=\s*(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s>]+)/gi,
      '',
    );
    attrs = attrs.replace(/\s+(?:on[a-z0-9_-]+|srcdoc|formaction)\b(?=\s|$)/gi, '');

    attrs = attrs.replace(
      /\s+(href|src|action|poster|data)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|([^\s>]+))/gi,
      (attrMatch, attrName, v1, v2, v3, v4) => {
        const val = v1 ?? v2 ?? v3 ?? v4 ?? '';
        if (!isSafeUrlAttribute(String(attrName), String(val))) {
          return '';
        }
        return attrMatch;
      },
    );

    attrs = attrs.replace(/\s+style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (styleMatch, v1, v2) => {
      const val = String(v1 ?? v2 ?? '');
      if (isUnsafeStyleValue(val)) {
        return '';
      }
      if (/url\s*\(/i.test(val)) {
        const hasUnsafeUrl = /url\s*\(([^)]*)\)/i.test(val) &&
          !/url\s*\(\s*['"]?(?:https?:\/\/|\/)[^"'<>)]+['"]?\s*\)/i.test(val);
        if (hasUnsafeUrl) return '';
      }
      return styleMatch;
    });

    return `<${tagName}${attrs}>`;
  });

  return html;
}

export function safeExternalHref(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '#';
  const decoded = decodeHtmlEntitiesForScheme(url);
  const compact = decoded.replace(CONTROL_AND_SPACE_REGEX, '').trim();
  if (!compact || /[<>"']/.test(url)) return '#';
  if (DANGEROUS_SCHEME_REGEX.test(compact)) return '#';
  if (SAFE_HREF_PROTOCOL_REGEX.test(url.trim())) {
    return url.trim();
  }
  return '#';
}

const TRUSTED_PAYMENT_HOST_SUFFIXES = ['zarinpal.com', 'shaparak.ir'];

export function safePaymentRedirectUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isProd = process.env.NODE_ENV === 'production';

    if (
      parsed.protocol === 'https:' &&
      TRUSTED_PAYMENT_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
    ) {
      return parsed.toString();
    }

    if (typeof window !== 'undefined' && parsed.origin === window.location.origin) {
      return parsed.toString();
    }

    if (!isProd && (host === 'localhost' || host === '127.0.0.1') && /^https?:$/i.test(parsed.protocol)) {
      return parsed.toString();
    }

    return null;
  } catch {
    return null;
  }
}

export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
