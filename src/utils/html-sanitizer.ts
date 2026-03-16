/**
 * HTML sanitizer for email content.
 * Prevents prompt injection attacks by stripping hidden content,
 * dangerous tags, invisible characters, and tracking elements.
 */

// Tags whose content should be removed entirely (not just the tag itself)
const DANGEROUS_TAGS = new Set([
  "script", "style", "link", "meta", "head", "title", "noscript",
  "iframe", "object", "embed", "applet", "form", "input", "textarea",
  "select", "button", "base", "svg", "math",
]);

// Invisible Unicode characters to strip
// eslint-disable-next-line no-control-regex
const INVISIBLE_CHARS_RE = new RegExp(
  "[" +
    "\u200B" + // zero-width space
    "\u200C" + // zero-width non-joiner
    "\u200D" + // zero-width joiner
    "\u2060" + // word joiner
    "\uFEFF" + // zero-width no-break space / BOM
    "\u00AD" + // soft hyphen
    "\u200E" + // left-to-right mark
    "\u200F" + // right-to-left mark
    "\u202A-\u202E" + // LTR/RTL embedding/override
    "\u2028" + // line separator
    "\u2029" + // paragraph separator
  "]",
  "g"
);

// Tag characters U+E0001-U+E007F (used in homoglyph attacks)
// These are in the supplementary plane so we need surrogate pair ranges
const TAG_CHARS_RE = /[\u{E0001}-\u{E007F}]/gu;

/**
 * Check if an inline style string indicates the element should be hidden.
 */
function isHiddenByStyle(style: string): boolean {
  const s = style.toLowerCase().replace(/\s/g, "");

  // display:none
  if (s.includes("display:none")) return true;

  // visibility:hidden
  if (s.includes("visibility:hidden")) return true;

  // opacity:0 (but not opacity:0.5 etc.)
  if (/opacity\s*:\s*0(?:[;\s"]|$)/.test(style.toLowerCase())) return true;

  // font-size:0 / font-size:0px / font-size:0pt / font-size:0em
  if (/font-size\s*:\s*0(px|pt|em|rem|%)?\s*[;"]?/i.test(style)) return true;

  // Zero dimensions
  if (/(?:^|;|\s)height\s*:\s*0(px|pt|em|rem)?\s*[;"]?/i.test(style)) return true;
  if (/(?:^|;|\s)width\s*:\s*0(px|pt|em|rem)?\s*[;"]?/i.test(style)) return true;
  if (/max-height\s*:\s*0(px|pt|em|rem)?\s*[;"]?/i.test(style)) return true;
  if (/max-width\s*:\s*0(px|pt|em|rem)?\s*[;"]?/i.test(style)) return true;

  // text-indent with large negative value
  if (/text-indent\s*:\s*-\d{3,}px/i.test(style)) return true;

  // Position off-screen
  if (/position\s*:\s*absolute/i.test(style) && /(?:left|top)\s*:\s*-\d{3,}px/i.test(style)) {
    return true;
  }

  // overflow:hidden with zero dimensions
  if (s.includes("overflow:hidden") && (/height:0/.test(s) || /width:0/.test(s))) {
    return true;
  }

  // Color matching background (basic check for same-color text/bg)
  if (hasMatchingColors(style)) return true;

  return false;
}

/**
 * Basic check for text color matching background color.
 */
function hasMatchingColors(style: string): boolean {
  const colorMatch = style.match(/(?:^|;|\s)color\s*:\s*([^;]+)/i);
  const bgMatch = style.match(/background(?:-color)?\s*:\s*([^;]+)/i);
  if (colorMatch && bgMatch) {
    const color = normalizeColor(colorMatch[1].trim());
    const bg = normalizeColor(bgMatch[1].trim());
    if (color && bg && color === bg) return true;
  }
  return false;
}

/**
 * Normalize a CSS color value for comparison.
 */
function normalizeColor(color: string): string | null {
  const c = color.toLowerCase().replace(/\s/g, "");
  // Map common color names
  const names: Record<string, string> = {
    white: "#ffffff", "#fff": "#ffffff",
    black: "#000000", "#000": "#000000",
  };
  if (names[c]) return names[c];
  // Normalize 3-char hex to 6-char
  const hex3 = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (hex3) return `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`;
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  return c; // return as-is for comparison
}

/**
 * Check if a tag has aria-hidden="true".
 */
function hasAriaHidden(tagHtml: string): boolean {
  return /aria-hidden\s*=\s*["']true["']/i.test(tagHtml);
}

/**
 * Check if an img tag is a tracking pixel.
 */
function isTrackingPixel(tagHtml: string): boolean {
  const widthMatch = tagHtml.match(/width\s*=\s*["']?(\d+)/i);
  const heightMatch = tagHtml.match(/height\s*=\s*["']?(\d+)/i);
  if (widthMatch && heightMatch) {
    const w = parseInt(widthMatch[1], 10);
    const h = parseInt(heightMatch[1], 10);
    if (w <= 1 && h <= 1) return true;
  }
  return false;
}

/**
 * Check if a tag contains data: URIs or base64 content.
 */
function hasDataUri(tagHtml: string): boolean {
  return /(?:src|href|data-\w+)\s*=\s*["']?\s*data:/i.test(tagHtml);
}

/**
 * Decode HTML entities in text.
 */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

/**
 * Remove invisible Unicode characters from text.
 */
function removeInvisibleChars(text: string): string {
  return text.replace(INVISIBLE_CHARS_RE, "").replace(TAG_CHARS_RE, "");
}

/**
 * Main sanitization function. Converts HTML email content to safe plain text.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) {
    return "--- BEGIN EMAIL CONTENT ---\n\n--- END EMAIL CONTENT ---";
  }

  let text = html;

  // 1. Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 2. Remove dangerous tags and their content (case-insensitive, handles nested)
  for (const tag of DANGEROUS_TAGS) {
    const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}\\s*>`, "gi");
    text = text.replace(re, "");
    // Also remove self-closing or unclosed versions
    const reSelf = new RegExp(`<${tag}(?:\\s[^>]*)?\\/?>`, "gi");
    text = text.replace(reSelf, "");
  }

  // 3. Remove elements with data: URIs
  text = text.replace(/<[a-zA-Z][^>]*(?:src|href|data-\w+)\s*=\s*["']?\s*data:[^>]*>/gi, "");

  // 4. Remove tracking pixels
  text = text.replace(/<img\b[^>]*>/gi, (match) => {
    if (isTrackingPixel(match)) return "";
    if (hasDataUri(match)) return "";
    return match;
  });

  // 5. Remove elements with aria-hidden="true" and their content
  text = text.replace(/<(span|div)\b[^>]*aria-hidden\s*=\s*["']true["'][^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  // Self-closing or empty
  text = text.replace(/<[a-zA-Z][^>]*aria-hidden\s*=\s*["']true["'][^>]*\/?>/gi, "");

  // 6. Remove elements hidden by inline styles (including their content)
  // Process elements with style attributes that indicate hiding
  text = text.replace(/<(\w+)\b([^>]*style\s*=\s*["'][^"']*["'][^>]*)>([\s\S]*?)<\/\1\s*>/gi, (match, tag, attrs, content) => {
    const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
    if (styleMatch && isHiddenByStyle(styleMatch[1])) {
      return "";
    }
    return match;
  });

  // Also handle self-closing hidden elements
  text = text.replace(/<(\w+)\b[^>]*style\s*=\s*["']([^"']*)["'][^>]*\/?>/gi, (match, _tag, style) => {
    if (isHiddenByStyle(style)) return "";
    return match;
  });

  // 7. Convert structural HTML to text formatting

  // Links: <a href="url">text</a> -> text (url)
  text = text.replace(/<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a\s*>/gi, (_, url, linkText) => {
    const cleanUrl = url.trim();
    const cleanText = linkText.replace(/<[^>]*>/g, "").trim();
    if (cleanUrl && !cleanUrl.startsWith("data:")) {
      return `${cleanText} (${cleanUrl})`;
    }
    return cleanText;
  });

  // List items
  text = text.replace(/<li\b[^>]*>/gi, "\n- ");
  text = text.replace(/<\/li\s*>/gi, "");

  // Headings: add newlines
  text = text.replace(/<\/h[1-6]\s*>/gi, "\n\n");
  text = text.replace(/<h[1-6]\b[^>]*>/gi, "\n\n");

  // BR tags -> newline
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Block elements endings -> double newline
  text = text.replace(/<\/(?:p|div|blockquote|ul|ol|table|tr)\s*>/gi, "\n\n");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // 8. Decode HTML entities
  text = decodeEntities(text);

  // 9. Remove invisible Unicode characters
  text = removeInvisibleChars(text);

  // 10. Clean up whitespace
  // Collapse multiple newlines to max 2
  text = text.replace(/\n{3,}/g, "\n\n");
  // Trim leading/trailing whitespace
  text = text.trim();

  // 11. Wrap with boundary markers
  return `--- BEGIN EMAIL CONTENT ---\n${text}\n--- END EMAIL CONTENT ---`;
}
