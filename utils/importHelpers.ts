/**
 * Small, dependency-free helpers shared by the importers (EPUB, MOBI, PDF, HTML, ...).
 * Nothing heavy is imported here so this module stays in the startup bundle cheaply.
 */

// ---------------------------------------------------------------------------
// Bytes, base64, data URLs
// ---------------------------------------------------------------------------

/** Base64-encode bytes without building a string one character at a time. */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]));
  }
  return btoa(parts.join(''));
};

export const bytesToDataUrl = (bytes: Uint8Array, mime: string): string => `data:${mime};base64,${bytesToBase64(bytes)}`;

/** Native (async, off the main string-building path) data URL encoding. */
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });

/** Decode a data: URL to bytes, using the browser's native decoder when available. */
export const dataUrlToBytes = async (dataUrl: string): Promise<Uint8Array> => {
  if (!dataUrl.startsWith('data:')) throw new Error('Not a data URL');
  try {
    const res = await fetch(dataUrl);
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
  } catch { /* fall back to atob */ }
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!/;base64/i.test(meta)) return new TextEncoder().encode(decodeURIComponent(payload));
  const bin = atob(payload);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/** Identify common image formats from their magic bytes. */
export const sniffImageMime = (bytes: Uint8Array, fallback = 'image/jpeg'): string => {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp';
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';
  // SVG / XML text
  const head = String.fromCharCode.apply(null, bytes.subarray(0, 256) as unknown as number[]).trimStart().toLowerCase();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  return fallback;
};

/**
 * Return a data URL for an image, re-encoding it as JPEG no wider than `maxWidth`
 * when it's larger than that (or heavier than `maxBytes`). Falls back to the original
 * bytes if decoding isn't possible (e.g. SVG, no canvas). Returns undefined if the
 * original is too big to keep and couldn't be shrunk.
 */
export const downscaleImage = async (
  bytes: Uint8Array,
  mime: string,
  maxWidth: number,
  { quality = 0.85, maxBytes = 350_000, hardLimit = 2_000_000 }: { quality?: number; maxBytes?: number; hardLimit?: number } = {}
): Promise<string | undefined> => {
  const original = () => (bytes.length <= hardLimit ? bytesToDataUrl(bytes, mime) : undefined);
  if (mime === 'image/svg+xml' || typeof createImageBitmap === 'undefined') return original();

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    if (bitmap.width <= maxWidth && bytes.length <= maxBytes) return bytesToDataUrl(bytes, mime);

    const scale = Math.min(1, maxWidth / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) return original();
      ctx.fillStyle = '#ffffff'; // JPEG has no alpha; avoid black backgrounds on transparent PNGs
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      return await blobToDataUrl(await canvas.convertToBlob({ type: 'image/jpeg', quality }));
    }
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return original();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bitmap, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', quality);
    }
    return original();
  } catch {
    return original();
  } finally {
    bitmap?.close();
  }
};

// ---------------------------------------------------------------------------
// Text decoding
// ---------------------------------------------------------------------------

const latin1Head = (bytes: Uint8Array, len = 1024): string =>
  String.fromCharCode.apply(null, bytes.subarray(0, len) as unknown as number[]);

/** Encoding declared by an XML prolog or HTML meta tag, if any. */
const declaredCharset = (bytes: Uint8Array): string | undefined => {
  const head = latin1Head(bytes);
  const m = /<\?xml[^>]*\bencoding\s*=\s*["']([\w.:-]+)["']/i.exec(head)
    || /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head);
  return m ? m[1].toLowerCase() : undefined;
};

/** Guess a legacy single-byte encoding: Cyrillic text is almost all high bytes. */
const guessLegacyEncoding = (bytes: Uint8Array): string => {
  let high = 0;
  const n = Math.min(bytes.length, 200_000);
  for (let i = 0; i < n; i++) if (bytes[i] >= 0xc0) high++;
  return high / Math.max(1, n) > 0.25 ? 'windows-1251' : 'windows-1252';
};

/**
 * Decode a text file: honours BOMs, a declared XML/HTML charset (when `markup`),
 * strict UTF-8, and falls back to windows-1251/1252 for legacy files.
 */
export const decodeText = (buffer: ArrayBuffer, { markup = false }: { markup?: boolean } = {}): string => {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));

  if (markup) {
    const declared = declaredCharset(bytes);
    if (declared && declared !== 'utf-8' && declared !== 'utf8') {
      try { return new TextDecoder(declared).decode(bytes); } catch { /* unknown label: continue */ }
    }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    const lenient = new TextDecoder('utf-8').decode(bytes);
    let bad = 0;
    for (let i = 0; i < lenient.length; i++) if (lenient.charCodeAt(i) === 0xfffd) bad++;
    if (bad / Math.max(1, lenient.length) <= 0.002) return lenient; // a few damaged bytes
    try { return new TextDecoder(guessLegacyEncoding(bytes)).decode(bytes); } catch { return lenient; }
  }
};

// ---------------------------------------------------------------------------
// HTML sanitising
// ---------------------------------------------------------------------------

const REMOVE_SELECTOR = [
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base',
  'noscript', 'template', 'form', 'input', 'button', 'select', 'textarea', 'audio', 'video', 'source', 'track', 'canvas'
].join(',');

/** Presentation attributes that would fight the reader's page themes (colours, fonts). */
const PRESENTATION_ATTRS = new Set(['style', 'color', 'bgcolor', 'background', 'face']);
/** URL-bearing attributes that are never needed in a stored book. */
const DROP_URL_ATTRS = new Set(['srcset', 'action', 'formaction', 'poster', 'data', 'longdesc', 'cite']);

/** Strip control characters and whitespace that browsers ignore inside URL schemes. */
const normalizeUrl = (value: string): string => value.replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase();

/**
 * Whether a URL is safe to keep. Only local fragments, http(s)/mailto links and inline
 * images are allowed; `javascript:`, `vbscript:`, `data:` documents and the like are not.
 */
export const isSafeUrl = (value: string, kind: 'link' | 'image'): boolean => {
  const v = normalizeUrl(value);
  if (!v) return false;
  if (kind === 'image') return v.startsWith('data:image/') && !v.startsWith('data:image/svg+xml');
  if (v.startsWith('#')) return true;
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('mailto:');
};

/**
 * Make imported HTML safe and theme-friendly, in place:
 * removes active content, event handlers, unsafe URLs, remote images (privacy: a
 * stored book must never phone home), and inline presentation. Images without a
 * usable inline source are replaced by their alt text.
 */
export const sanitizeTree = (root: ParentNode): void => {
  root.querySelectorAll(REMOVE_SELECTOR).forEach(el => el.remove());

  const all = root.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    const tag = el.localName;
    const isImage = tag === 'img' || tag === 'image';
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || PRESENTATION_ATTRS.has(name) || DROP_URL_ATTRS.has(name)) {
        el.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src' || name === 'xlink:href') && !isSafeUrl(attr.value, isImage ? 'image' : 'link')) {
        el.removeAttribute(attr.name);
      }
    }
    if (tag === 'a' && el.hasAttribute('href')) {
      const href = el.getAttribute('href') || '';
      if (!href.startsWith('#')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }

  // Images whose source was dropped become their alt text so nothing is lost or fetched.
  root.querySelectorAll('img').forEach(img => {
    if (img.getAttribute('src')) return;
    const alt = (img.getAttribute('alt') || '').trim();
    if (alt && img.ownerDocument) img.replaceWith(img.ownerDocument.createTextNode(alt));
    else img.remove();
  });
  root.querySelectorAll('image').forEach(img => {
    if (!img.getAttribute('href') && !img.getAttributeNS('http://www.w3.org/1999/xlink', 'href')) img.remove();
  });
};

/** Sanitize a whole parsed document. */
export const sanitizeDocument = (doc: Document): void => sanitizeTree(doc);

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A single reusable HTML document for building fragments (avoids creating one per chapter). */
let scratchDoc: Document | null = null;
export const htmlScratchDocument = (): Document => {
  if (!scratchDoc) scratchDoc = document.implementation.createHTMLDocument('');
  return scratchDoc;
};
