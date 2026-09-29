import type JSZipType from 'jszip';
import { LanguageCode, LANGUAGE_CODES } from '../types';
import { blobToDataUrl, bytesToDataUrl, downscaleImage, htmlScratchDocument, sanitizeTree, sniffImageMime } from './importHelpers';

export interface EpubResult {
  text: string;
  coverUrl?: string;
  title?: string;
  author?: string;
  language?: LanguageCode;
}

/** Per-image and whole-book budgets for inlined images (they're stored inside the book). */
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_TOTAL_IMAGE_BYTES = 20_000_000;
const COVER_WIDTH = 600;
const INLINE_IMAGE_WIDTH = 1200;

const XLINK = 'http://www.w3.org/1999/xlink';
const DC = 'http://purl.org/dc/elements/1.1/';

/** Map a BCP-47-ish tag (e.g. "en-US", "pt-BR") to one of the supported codes. */
export const toLanguageCode = (tag: string | null | undefined): LanguageCode | undefined => {
  if (!tag) return undefined;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return (LANGUAGE_CODES as string[]).includes(base) ? (base as LanguageCode) : undefined;
};

/** Convert a blob: URL to a persistent base64 data: URL. */
export const blobUrlToDataUrl = async (url: string): Promise<string> => blobToDataUrl(await (await fetch(url)).blob());

const safeDecode = (s: string): string => {
  try { return decodeURIComponent(s); } catch { return s; }
};

/** Normalise a zip path: resolve `.`/`..`, collapse slashes. */
const normalizePath = (p: string): string => {
  const stack: string[] = [];
  for (const part of p.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
};

/** Resolve `relative` (URL-encoded, maybe with a fragment) against the directory of `basePath`. */
const resolvePath = (basePath: string, relative: string): string => {
  const clean = safeDecode(relative.split('#')[0].split('?')[0]);
  if (clean.startsWith('/')) return normalizePath(clean);
  const dir = basePath.includes('/') ? basePath.slice(0, basePath.lastIndexOf('/') + 1) : '';
  return normalizePath(dir + clean);
};

const isExternal = (url: string) => /^[a-z][a-z0-9+.-]*:/i.test(url.trim());

const firstText = (doc: Document, ns: string, local: string): string | undefined => {
  const el = doc.getElementsByTagNameNS(ns, local)[0] || doc.getElementsByTagName(`dc:${local}`)[0];
  return el?.textContent?.replace(/\s+/g, ' ').trim() || undefined;
};

const byLocalName = (doc: Document | Element, local: string): Element[] =>
  Array.from(doc.getElementsByTagNameNS('*', local));

/** Parse chapter markup as XHTML first (so `<a id="x"/>` doesn't swallow the page), HTML as fallback. */
const parseChapter = (parser: DOMParser, text: string): Document => {
  const xml = parser.parseFromString(text, 'application/xhtml+xml');
  if (!xml.getElementsByTagName('parsererror').length && xml.documentElement) return xml;
  return parser.parseFromString(text, 'text/html');
};

/** Read an EPUB file. JSZip is loaded on demand. */
export const readEpubFile = async (file: Blob): Promise<EpubResult> => {
  const { default: JSZip } = await import('jszip');
  let zip: JSZipType;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('Failed to parse EPUB file: not a valid ZIP archive');
  }
  return readEpubZip(zip);
};

/** Read an EPUB from an already-opened zip (avoids parsing the archive twice). */
export const readEpubZip = async (zip: JSZipType): Promise<EpubResult> => {
  try {
    const parser = new DOMParser();

    // 1. container.xml → OPF path
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) throw new Error('container.xml not found');
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');
    const opfPath = normalizePath(safeDecode(byLocalName(containerDoc, 'rootfile')[0]?.getAttribute('full-path') || ''));
    if (!opfPath) throw new Error('package document not found');

    // 2. OPF: metadata, manifest, spine
    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) throw new Error('package document missing');
    const opfDoc = parser.parseFromString(opfContent, 'application/xml');

    const title = firstText(opfDoc, DC, 'title');
    const creators = Array.from(opfDoc.getElementsByTagNameNS(DC, 'creator')).map(e => e.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean) as string[];
    const author = creators.length ? creators.slice(0, 3).join(', ') : undefined;
    const language = toLanguageCode(firstText(opfDoc, DC, 'language'));

    interface ManifestItem { id: string; path: string; type: string; properties: string }
    const manifest = new Map<string, ManifestItem>();
    const typeByPath = new Map<string, string>();
    for (const item of byLocalName(opfDoc, 'item')) {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (!id || !href) continue;
      const path = resolvePath(opfPath, href);
      const type = (item.getAttribute('media-type') || '').toLowerCase();
      manifest.set(id, { id, path, type, properties: item.getAttribute('properties') || '' });
      typeByPath.set(path, type);
    }

    const spinePaths: string[] = [];
    for (const ref of byLocalName(opfDoc, 'itemref')) {
      const item = manifest.get(ref.getAttribute('idref') || '');
      if (item && !spinePaths.includes(item.path)) spinePaths.push(item.path);
    }
    // Stable, safe element ids for chapters, used for internal links.
    const chapterIds = new Map<string, string>(spinePaths.map((p, i) => [p, `pk-ch-${i}`]));

    // 3. Images: inlined as data URLs on demand, within a size budget.
    const imageCache = new Map<string, Promise<string | undefined>>();
    let imageBytes = 0;
    const loadImage = (path: string): Promise<string | undefined> => {
      let pending = imageCache.get(path);
      if (!pending) {
        pending = (async () => {
          const entry = zip.file(path);
          if (!entry || imageBytes >= MAX_TOTAL_IMAGE_BYTES) return undefined;
          const bytes = await entry.async('uint8array');
          const mime = typeByPath.get(path)?.startsWith('image/') ? typeByPath.get(path)! : sniffImageMime(bytes);
          const url = bytes.length <= MAX_IMAGE_BYTES
            ? bytesToDataUrl(bytes, mime)
            : await downscaleImage(bytes, mime, INLINE_IMAGE_WIDTH, { maxBytes: MAX_IMAGE_BYTES, hardLimit: MAX_IMAGE_BYTES });
          if (!url) return undefined;
          const size = url.length * 0.75;
          if (imageBytes + size > MAX_TOTAL_IMAGE_BYTES) return undefined;
          imageBytes += size;
          return url;
        })().catch(() => undefined);
        imageCache.set(path, pending);
      }
      return pending;
    };

    // 4. Cover (downscaled; it lives in the library metadata)
    let coverUrl: string | undefined;
    {
      const metaCover = byLocalName(opfDoc, 'meta').find(m => m.getAttribute('name') === 'cover')?.getAttribute('content') || '';
      const candidates: (ManifestItem | undefined)[] = [
        manifest.get(metaCover),
        Array.from(manifest.values()).find(i => i.path.endsWith(safeDecode(metaCover)) && i.type.startsWith('image/')),
        Array.from(manifest.values()).find(i => /\bcover-image\b/.test(i.properties)),
        Array.from(manifest.values()).find(i => i.type.startsWith('image/') && /cover/i.test(i.id + ' ' + i.path)),
      ];
      const coverItem = candidates.find(c => c && c.type.startsWith('image/'));
      const entry = coverItem ? zip.file(coverItem.path) : null;
      if (coverItem && entry) {
        try {
          const bytes = await entry.async('uint8array');
          coverUrl = await downscaleImage(bytes, coverItem.type || sniffImageMime(bytes), COVER_WIDTH);
        } catch { /* a book without a cover is fine */ }
      }
    }

    // 5. Chapters, in spine order
    const out = htmlScratchDocument();
    const parts: string[] = [];
    for (const chapterPath of spinePaths) {
      const type = typeByPath.get(chapterPath) || '';
      if (type && !/html|xml/.test(type)) continue;
      const source = await zip.file(chapterPath)?.async('string');
      if (!source) continue;

      const doc = parseChapter(parser, source);
      const body = doc.body || byLocalName(doc, 'body')[0];
      if (!body) continue;

      // Move the chapter into an HTML document so it serialises as HTML, not XML.
      const container = out.createElement('div');
      container.className = 'chapter-container';
      container.id = chapterIds.get(chapterPath)!;
      for (const child of Array.from(body.childNodes)) container.appendChild(out.importNode(child, true));

      // Images (<img src> and SVG <image xlink:href>)
      const imageJobs: Promise<void>[] = [];
      container.querySelectorAll('img[src]').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('data:image/')) return;
        if (isExternal(src)) { img.removeAttribute('src'); return; }
        imageJobs.push(loadImage(resolvePath(chapterPath, src)).then(url => {
          if (url) img.setAttribute('src', url); else img.removeAttribute('src');
        }));
      });
      container.querySelectorAll('image').forEach(img => {
        const src = img.getAttributeNS(XLINK, 'href') || img.getAttribute('xlink:href') || img.getAttribute('href') || '';
        if (!src || src.startsWith('data:image/') || isExternal(src)) return;
        imageJobs.push(loadImage(resolvePath(chapterPath, src)).then(url => {
          if (url) {
            img.setAttributeNS(XLINK, 'xlink:href', url);
            img.setAttribute('href', url);
          } else {
            img.remove();
          }
        }));
      });
      await Promise.all(imageJobs);

      // Internal links → in-document anchors
      container.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        if (isExternal(href)) return; // sanitizeTree decides on http/mailto
        const hashAt = href.indexOf('#');
        const fragment = hashAt >= 0 ? safeDecode(href.slice(hashAt + 1)) : '';
        const pathPart = hashAt >= 0 ? href.slice(0, hashAt) : href;
        const target = pathPart ? chapterIds.get(resolvePath(chapterPath, pathPart)) : container.id;
        if (fragment) a.setAttribute('href', `#${fragment}`);
        else if (target) a.setAttribute('href', `#${target}`);
        else a.removeAttribute('href');
      });

      sanitizeTree(container);
      parts.push(container.outerHTML);
    }

    if (parts.length === 0) throw new Error('no readable chapters');
    return { text: parts.join(''), coverUrl, title, author, language };
  } catch (error) {
    console.error('EPUB parsing error:', error);
    const reason = error instanceof Error ? error.message : '';
    throw new Error(`Failed to parse EPUB file${reason ? `: ${reason}` : ''}`);
  }
};
