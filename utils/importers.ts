import type JSZipType from 'jszip';
import { BookFileType, LanguageCode } from '../types';
import { readEpubZip, toLanguageCode } from './epubProcessor';
import { readMobiFile } from './mobiProcessor';
import { blobToDataUrl, dataUrlToBytes, decodeText, downscaleImage, escapeHtml, isSafeUrl, sanitizeDocument, sniffImageMime } from './importHelpers';

/*
 * Heavy dependencies are loaded on demand so importing this module is cheap:
 *   - pdf.js  (~300 KB) via `import('./pdf')`  — only for PDFs
 *   - JSZip   (~100 KB) via `import('jszip')`  — only for EPUB / DOCX
 */

export interface ImportedBook {
  title: string;
  author?: string;
  text: string;
  coverUrl?: string;
  fileType: BookFileType;
  language?: LanguageCode;
  /** page count for PDFs, otherwise undefined */
  pageCount?: number;
}

import { SUPPORTED_EXTENSIONS, ACCEPT_STRING } from './formats';
export { SUPPORTED_EXTENSIONS, ACCEPT_STRING };

const EXT_TO_TYPE: Record<string, BookFileType> = {
  epub: 'epub', pdf: 'pdf', mobi: 'mobi', azw: 'mobi', prc: 'mobi', txt: 'txt', text: 'txt',
  md: 'md', markdown: 'md', html: 'html', htm: 'html', xhtml: 'html', docx: 'docx', fb2: 'fb2'
};

const loadJSZip = async () => (await import('jszip')).default;
const loadPdfModule = () => import('./pdf');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const extensionOf = (name: string): string => {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : '';
};

/** Human-friendly title from a filename. */
export const titleFromFilename = (name: string): string =>
  name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';

const cleanTitle = (s: string | null | undefined): string | undefined => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > 0 ? t : undefined;
};

// ---------------------------------------------------------------------------
// Markdown (small, dependency-free, XSS-safe)
// ---------------------------------------------------------------------------

const inlineMd = (text: string): string => {
  // Protect code spans so emphasis/link rules never apply inside them.
  const codes: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${escapeHtml(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = escapeHtml(out);
  // Images: only inline data images survive (remote ones would phone home; relative ones can't resolve).
  // URLs may contain one level of balanced parentheses, e.g. …/wiki/Foo_(bar)
  out = out.replace(/!\[([^\]]*)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;[^)]*&quot;)?\s*\)/g, (_, alt: string, src: string) =>
    isSafeUrl(src, 'image') ? `<img alt="${alt}" src="${src}">` : alt);
  out = out.replace(/\[([^\]]+)\]\(\s*((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;[^)]*&quot;)?\s*\)/g, (_, label: string, href: string) =>
    isSafeUrl(href, 'link') ? `<a href="${href}"${href.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${label}</a>` : label);
  // Delimiter-bounded (no lookbehind: older Safari can't parse it; no `.*` so it stays linear)
  out = out.replace(/\*\*(\S(?:[^*]*?\S)?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(\S(?:[^_]*?\S)?)__/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*\w])\*(\S(?:[^*\n]*?\S)?)\*(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_\w])_(\S(?:[^_\n]*?\S)?)_(?!\w)/g, '$1<em>$2</em>');
  out = out.replace(/~~(\S(?:[^~]*?\S)?)~~/g, '<del>$1</del>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)] ?? '');
};

export const markdownToHtml = (md: string): { html: string; title?: string } => {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let title: string | undefined;
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let quote: string[] = [];
  let code: { lang: string; lines: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inlineMd(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`<${list.type}>${list.items.map(i => `<li>${inlineMd(i)}</li>`).join('')}</${list.type}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote><p>${inlineMd(quote.join(' '))}</p></blockquote>`);
      quote = [];
    }
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');

    if (code) {
      if (/^\s*```/.test(line)) {
        html.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.lines.push(line);
      }
      continue;
    }

    const fence = /^\s*```\s*([\w+-]+)?/.exec(line);
    if (fence) {
      flushAll();
      code = { lang: fence[1] || '', lines: [] };
      continue;
    }

    if (!line.trim()) { flushAll(); continue; }

    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushAll();
      const level = heading[1].length;
      const text = heading[2];
      if (level === 1 && !title) title = text.replace(/[*_`]/g, '').trim();
      html.push(`<h${level}>${inlineMd(text)}</h${level}>`);
      continue;
    }

    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); html.push('<hr>'); continue; }

    const ul = /^\s{0,3}[-*+]\s+(.+)$/.exec(line);
    const ol = /^\s{0,3}\d+[.)]\s+(.+)$/.exec(line);
    if (ul || ol) {
      flushPara(); flushQuote();
      const type = ul ? 'ul' : 'ol';
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((ul || ol)![1]);
      continue;
    }

    const bq = /^\s{0,3}>\s?(.*)$/.exec(line);
    if (bq) {
      flushPara(); flushList();
      quote.push(bq[1]);
      continue;
    }

    // Lazy continuation of a list item
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ' ' + line.trim();
      continue;
    }

    flushList(); flushQuote();
    para.push(line.trim());
  }
  if (code) html.push(`<pre><code>${escapeHtml(code.lines.join('\n'))}</code></pre>`);
  flushAll();

  return { html: html.join('\n'), title };
};

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const wAttr = (el: Element | undefined, name: string): string | null =>
  el ? (el.getAttributeNS(W_NS, name) ?? el.getAttribute(`w:${name}`)) : null;
const childByLocal = (el: Element | undefined, local: string): Element | undefined =>
  el ? Array.from(el.children).find(c => c.localName === local) : undefined;

const docxToHtml = async (zip: JSZipType): Promise<{ html: string; title?: string; author?: string }> => {
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('Invalid DOCX: word/document.xml not found');

  const parser = new DOMParser();
  const parseXml = (xml: string) => parser.parseFromString(xml, 'application/xml');
  const doc = parseXml(docXml);
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid DOCX: could not parse document.xml');

  const [stylesXml, numberingXml, relsXml, coreXml] = await Promise.all([
    zip.file('word/styles.xml')?.async('string'),
    zip.file('word/numbering.xml')?.async('string'),
    zip.file('word/_rels/document.xml.rels')?.async('string'),
    zip.file('docProps/core.xml')?.async('string'),
  ]);

  // styleId → human style name (handles localized ids like "Titre1" whose name is "heading 1")
  const styleNames = new Map<string, string>();
  if (stylesXml) {
    for (const s of Array.from(parseXml(stylesXml).getElementsByTagNameNS(W_NS, 'style'))) {
      const id = wAttr(s, 'styleId');
      const name = wAttr(childByLocal(s, 'name'), 'val');
      if (id) styleNames.set(id.toLowerCase(), (name || id).toLowerCase().replace(/\s+/g, ''));
    }
  }

  // numId → is the list ordered? (bullet formats are unordered)
  const orderedByNumId = new Map<string, boolean>();
  if (numberingXml) {
    const nd = parseXml(numberingXml);
    const abstractOrdered = new Map<string, boolean>();
    for (const a of Array.from(nd.getElementsByTagNameNS(W_NS, 'abstractNum'))) {
      const lvl0 = Array.from(a.getElementsByTagNameNS(W_NS, 'lvl')).find(l => (wAttr(l, 'ilvl') || '0') === '0');
      const fmt = wAttr(childByLocal(lvl0, 'numFmt'), 'val') || 'bullet';
      abstractOrdered.set(wAttr(a, 'abstractNumId') || '', fmt !== 'bullet' && fmt !== 'none');
    }
    for (const n of Array.from(nd.getElementsByTagNameNS(W_NS, 'num'))) {
      const abs = wAttr(childByLocal(n, 'abstractNumId'), 'val') || '';
      orderedByNumId.set(wAttr(n, 'numId') || '', abstractOrdered.get(abs) ?? false);
    }
  }

  // Relationship id → external hyperlink target
  const links = new Map<string, string>();
  if (relsXml) {
    for (const r of Array.from(parseXml(relsXml).getElementsByTagName('Relationship'))) {
      const id = r.getAttribute('Id');
      const target = r.getAttribute('Target');
      if (id && target && r.getAttribute('TargetMode') === 'External') links.set(id, target);
    }
  }

  const isOn = (el: Element | undefined): boolean => {
    if (!el) return false;
    const val = wAttr(el, 'val');
    return val === null || val === '' || val === 'true' || val === '1' || val === 'on';
  };

  const renderRun = (run: Element): string => {
    let text = '';
    for (const el of Array.from(run.children)) {
      switch (el.localName) {
        case 't': text += escapeHtml(el.textContent || ''); break;
        case 'br': case 'cr': text += '<br>'; break;
        case 'tab': text += '&emsp;'; break;
        case 'noBreakHyphen': text += '‑'; break;
      }
    }
    if (!text) return '';
    const rPr = childByLocal(run, 'rPr');
    if (isOn(childByLocal(rPr, 'b'))) text = `<strong>${text}</strong>`;
    if (isOn(childByLocal(rPr, 'i'))) text = `<em>${text}</em>`;
    if (isOn(childByLocal(rPr, 'strike'))) text = `<del>${text}</del>`;
    const va = wAttr(childByLocal(rPr, 'vertAlign'), 'val');
    if (va === 'superscript') text = `<sup>${text}</sup>`;
    else if (va === 'subscript') text = `<sub>${text}</sub>`;
    return text;
  };

  const renderInline = (node: Element): string => {
    let inner = '';
    for (const child of Array.from(node.children)) {
      switch (child.localName) {
        case 'r': inner += renderRun(child); break;
        case 'hyperlink': {
          const content = renderInline(child);
          const rid = child.getAttributeNS(R_NS, 'id') ?? child.getAttribute('r:id');
          const href = rid ? links.get(rid) : undefined;
          inner += href && isSafeUrl(href, 'link') ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${content}</a>` : content;
          break;
        }
        case 'smartTag': case 'ins': case 'sdt': case 'sdtContent': case 'fldSimple':
          inner += renderInline(child);
          break;
      }
    }
    return inner;
  };

  type Block = { html: string; list?: { ordered: boolean } };

  const renderParagraph = (p: Element): Block | null => {
    const pPr = childByLocal(p, 'pPr');
    const styleId = (wAttr(childByLocal(pPr, 'pStyle'), 'val') || '').toLowerCase();
    const style = styleNames.get(styleId) || styleId.replace(/\s+/g, '');
    let tag = 'p';
    const heading = /^heading([1-9])$/.exec(style);
    const outline = wAttr(childByLocal(pPr, 'outlineLvl'), 'val');
    if (style === 'title') tag = 'h1';
    else if (heading) tag = `h${Math.min(4, Number(heading[1]))}`;
    else if (outline !== null && /^\d$/.test(outline) && Number(outline) < 4) tag = `h${Number(outline) + 1}`;
    else if (style === 'subtitle') tag = 'h2';

    const inner = renderInline(p);
    if (!inner.replace(/<br>/g, '').trim()) return null;

    const numPr = childByLocal(pPr, 'numPr');
    if (numPr && tag === 'p') {
      const numId = wAttr(childByLocal(numPr, 'numId'), 'val') || '';
      if (numId !== '0') return { html: `<li>${inner}</li>`, list: { ordered: orderedByNumId.get(numId) ?? false } };
    }
    return { html: `<${tag}>${inner}</${tag}>` };
  };

  const out: string[] = [];
  let openList: 'ul' | 'ol' | null = null;
  const closeList = () => { if (openList) { out.push(`</${openList}>`); openList = null; } };
  const emit = (block: Block | null) => {
    if (!block) return;
    if (block.list) {
      const tag = block.list.ordered ? 'ol' : 'ul';
      if (openList !== tag) { closeList(); out.push(`<${tag}>`); openList = tag; }
    } else {
      closeList();
    }
    out.push(block.html);
  };

  const walkBlocks = (container: Element) => {
    for (const child of Array.from(container.children)) {
      switch (child.localName) {
        case 'p': emit(renderParagraph(child)); break;
        case 'tbl': {
          closeList();
          const rows = Array.from(child.children).filter(c => c.localName === 'tr');
          out.push(`<table>${rows.map(tr => `<tr>${Array.from(tr.children).filter(c => c.localName === 'tc')
            .map(tc => `<td>${Array.from(tc.children).filter(c => c.localName === 'p').map(p => renderParagraph(p)?.html.replace(/^<li>|<\/li>$/g, '') || '').join('')}</td>`).join('')}</tr>`).join('')}</table>`);
          break;
        }
        case 'sdt': case 'sdtContent': case 'customXml': walkBlocks(child); break;
      }
    }
  };
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0] || doc.documentElement;
  walkBlocks(body);
  closeList();

  let title: string | undefined;
  let author: string | undefined;
  if (coreXml) {
    const core = parseXml(coreXml);
    const DC = 'http://purl.org/dc/elements/1.1/';
    title = cleanTitle(core.getElementsByTagNameNS(DC, 'title')[0]?.textContent);
    author = cleanTitle(core.getElementsByTagNameNS(DC, 'creator')[0]?.textContent);
  }

  return { html: out.join('\n'), title, author };
};

// ---------------------------------------------------------------------------
// FB2
// ---------------------------------------------------------------------------

const XLINK = 'http://www.w3.org/1999/xlink';
const FB2_MAX_IMAGE_B64 = 2_000_000;
const FB2_MAX_TOTAL_B64 = 27_000_000;

const fb2ToHtml = async (xmlText: string): Promise<{ html: string; title?: string; author?: string; language?: LanguageCode; coverUrl?: string }> => {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid FB2: could not parse XML');

  const first = (parent: Document | Element | undefined, local: string): Element | undefined =>
    parent ? parent.getElementsByTagNameNS('*', local)[0] : undefined;
  const hrefOf = (el: Element): string =>
    el.getAttributeNS(XLINK, 'href') || el.getAttribute('l:href') || el.getAttribute('xlink:href') || el.getAttribute('href') || '';

  const titleInfo = first(doc, 'title-info');
  const title = cleanTitle(first(titleInfo, 'book-title')?.textContent);
  const authorEl = first(titleInfo, 'author');
  const author = authorEl
    ? cleanTitle(['first-name', 'middle-name', 'last-name'].map(n => first(authorEl, n)?.textContent).filter(Boolean).join(' '))
      || cleanTitle(first(authorEl, 'nickname')?.textContent)
    : undefined;
  const language = toLanguageCode(first(titleInfo, 'lang')?.textContent);

  // Binaries (images) by id; only images, within a size budget.
  const binaries = new Map<string, { type: string; b64: string }>();
  for (const b of Array.from(doc.getElementsByTagNameNS('*', 'binary'))) {
    const id = b.getAttribute('id');
    const type = (b.getAttribute('content-type') || 'image/jpeg').toLowerCase();
    if (id && type.startsWith('image/') && type !== 'image/svg+xml') binaries.set(id, { type, b64: (b.textContent || '').replace(/\s+/g, '') });
  }
  let budget = FB2_MAX_TOTAL_B64;
  const imageSrc = (href: string): string | undefined => {
    const bin = binaries.get(href.replace(/^#/, ''));
    if (!bin || bin.b64.length > FB2_MAX_IMAGE_B64 || bin.b64.length > budget) return undefined;
    budget -= bin.b64.length;
    return `data:${bin.type};base64,${bin.b64}`;
  };

  // Cover, downscaled for the library
  let coverUrl: string | undefined;
  const coverImg = first(first(titleInfo, 'coverpage'), 'image');
  const coverBin = coverImg ? binaries.get(hrefOf(coverImg).replace(/^#/, '')) : undefined;
  if (coverBin) {
    try {
      const bytes = await dataUrlToBytes(`data:${coverBin.type};base64,${coverBin.b64}`);
      coverUrl = await downscaleImage(bytes, sniffImageMime(bytes, coverBin.type), 600);
    } catch { /* no cover */ }
  }

  const idAttr = (el: Element) => {
    const id = el.getAttribute('id');
    return id ? ` id="${escapeHtml(id)}"` : '';
  };

  const renderInline = (node: Node): string => {
    if (node.nodeType === 3) return escapeHtml(node.textContent || '');
    if (node.nodeType !== 1) return '';
    const el = node as Element;
    const inner = () => Array.from(el.childNodes).map(renderInline).join('');
    switch (el.localName) {
      case 'emphasis': return `<em>${inner()}</em>`;
      case 'strong': return `<strong>${inner()}</strong>`;
      case 'strikethrough': return `<del>${inner()}</del>`;
      case 'sub': return `<sub>${inner()}</sub>`;
      case 'sup': return `<sup>${inner()}</sup>`;
      case 'code': return `<code>${inner()}</code>`;
      case 'a': {
        const href = hrefOf(el);
        if (!href || !isSafeUrl(href, 'link')) return inner();
        const link = `<a href="${escapeHtml(href)}"${href.startsWith('#') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${inner()}</a>`;
        return el.getAttribute('type') === 'note' ? `<sup>${link}</sup>` : link;
      }
      case 'image': {
        const src = imageSrc(hrefOf(el));
        return src ? `<img src="${src}" alt="${escapeHtml(el.getAttribute('alt') || '')}">` : '';
      }
      default: return inner();
    }
  };
  const inlineChildren = (el: Element) => Array.from(el.childNodes).map(renderInline).join('');

  const renderBlock = (el: Element, depth: number): string => {
    const kids = Array.from(el.children);
    switch (el.localName) {
      case 'section': return `<div class="chapter-container"${idAttr(el)}>${kids.map(k => renderBlock(k, depth + 1)).join('')}</div>`;
      case 'title': {
        const tag = `h${Math.min(4, Math.max(2, depth))}`;
        const text = kids.length ? kids.map(k => inlineChildren(k)).filter(Boolean).join(' ') : inlineChildren(el);
        return `<${tag}>${text}</${tag}>`;
      }
      case 'subtitle': return `<h4${idAttr(el)}>${inlineChildren(el)}</h4>`;
      case 'p': case 'v': return `<p${idAttr(el)}>${inlineChildren(el)}</p>`;
      case 'empty-line': return '<br>';
      case 'epigraph': case 'cite': case 'annotation': return `<blockquote${idAttr(el)}>${kids.map(k => renderBlock(k, depth)).join('')}</blockquote>`;
      case 'poem': case 'stanza': return `<div${idAttr(el)}>${kids.map(k => renderBlock(k, depth)).join('')}</div>`;
      case 'text-author': return `<p><em>${inlineChildren(el)}</em></p>`;
      case 'image': return renderInline(el);
      case 'table': return `<table>${kids.map(tr => `<tr>${Array.from(tr.children).map(td => `<td>${inlineChildren(td)}</td>`).join('')}</tr>`).join('')}</table>`;
      default: return kids.length ? kids.map(k => renderBlock(k, depth)).join('') : `<p>${inlineChildren(el)}</p>`;
    }
  };

  // All bodies: the main text first, then notes/comments so footnote links resolve.
  const bodies = Array.from(doc.documentElement.children).filter(e => e.localName === 'body');
  const html = bodies.map(b => Array.from(b.children).map(k => renderBlock(k, 1)).join('')).join('<hr>');
  return { html, title, author, language, coverUrl };
};

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

interface PdfTextItem { str?: string; transform?: number[]; width?: number; height?: number; hasEOL?: boolean }

/**
 * Turn one page's text items into text with real paragraph breaks: items are grouped
 * into lines by baseline, spaces are inserted from horizontal gaps, hyphenated line
 * ends are joined, and unusually large vertical gaps become blank lines.
 */
const pageToText = (items: PdfTextItem[]): string => {
  const lines: { y: number; h: number; text: string }[] = [];
  let cur: { y: number; h: number; text: string; end: number } | null = null;

  for (const item of items) {
    const str = typeof item?.str === 'string' ? item.str : '';
    const t = Array.isArray(item?.transform) ? item.transform : null;
    const x = t ? t[4] : NaN;
    const y = t ? t[5] : NaN;
    const h = item?.height && item.height > 0 ? item.height : t ? Math.abs(t[3]) || 10 : 10;

    const newLine = !cur || (Number.isFinite(y) && Math.abs(y - cur.y) > Math.max(2, Math.min(h, cur.h) * 0.5));
    if (newLine) {
      if (cur && cur.text.trim()) lines.push(cur);
      cur = { y: Number.isFinite(y) ? y : cur ? cur.y - h : 0, h, text: str, end: x + (item?.width || 0) };
    } else if (str) {
      const gap = Number.isFinite(x) ? x - cur!.end : 0;
      const needsSpace = gap > h * 0.15 && !/\s$/.test(cur!.text) && !/^\s/.test(str);
      cur!.text += (needsSpace ? ' ' : '') + str;
      cur!.end = x + (item?.width || 0);
    }
    if (item?.hasEOL && cur) {
      if (cur.text.trim()) lines.push(cur);
      cur = null;
    }
  }
  if (cur && cur.text.trim()) lines.push(cur);
  if (lines.length === 0) return '';

  // Typical line spacing = median of positive gaps.
  const gaps = lines.slice(1).map((l, i) => lines[i].y - l.y).filter(g => g > 0).sort((a, b) => a - b);
  const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  let text = lines[0].text.trim();
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y;
    const next = lines[i].text.trim();
    if (typical > 0 && (gap > typical * 1.6 || gap < 0)) text += '\n\n' + next;
    else if (/[A-Za-zÀ-ÿ]-$/.test(text) && /^[a-zà-ÿ]/.test(next)) text = text.slice(0, -1) + next;
    else text += ' ' + next;
  }
  return text.replace(/[ \t]{2,}/g, ' ');
};

// One-entry cache: speed-reading the same PDF twice shouldn't re-extract it.
let lastExtraction: { key: string; text: Promise<string> } | null = null;

export async function extractPdfText(dataUrl: string): Promise<string> {
  if (lastExtraction && lastExtraction.key === dataUrl) return lastExtraction.text;
  const job = extractPdfTextUncached(dataUrl);
  lastExtraction = { key: dataUrl, text: job };
  job.catch(() => { if (lastExtraction?.text === job) lastExtraction = null; });
  return job;
}

async function extractPdfTextUncached(dataUrl: string): Promise<string> {
  const [{ pdfjs, pdfErrorMessage }, data] = await Promise.all([loadPdfModule(), dataUrlToBytes(dataUrl)]);
  const task = pdfjs.getDocument({ data });
  try {
    let pdf: any;
    try {
      pdf = await task.promise;
    } catch (e) {
      throw new Error(pdfErrorMessage(e));
    }
    const count: number = pdf.numPages;
    const pages = new Array<string>(count).fill('');
    let next = 1;
    const worker = async () => {
      while (next <= count) {
        const i = next++;
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          pages[i - 1] = pageToText(content.items as PdfTextItem[]);
          page.cleanup?.();
        } catch (e) {
          console.warn(`Could not extract text from PDF page ${i}`, e);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, count) }, worker));
    return pages.filter(Boolean).join('\n\n');
  } finally {
    task.destroy().catch(() => { /* ignore */ });
  }
}

/** PDF producers often put junk like "Microsoft Word - notes.docx" in the Title field. */
const cleanPdfTitle = (raw: unknown): string | undefined => {
  const t = cleanTitle(typeof raw === 'string' ? raw : undefined)?.replace(/^Microsoft (Word|PowerPoint) - /i, '');
  if (!t || /\.(docx?|pdf|pptx?|odt|rtf|txt|tex|indd)$/i.test(t) || /^untitled/i.test(t)) return undefined;
  return t;
};

const importPdf = async (file: File, fallbackTitle: string): Promise<ImportedBook> => {
  // The stored format is a data:application/pdf URL (the reader renders from it). FileReader
  // encodes natively and asynchronously; the bytes for pdf.js are read in parallel.
  const [{ pdfjs, pdfErrorMessage }, dataUrl, data] = await Promise.all([
    loadPdfModule(),
    blobToDataUrl(file.slice(0, file.size, 'application/pdf')),
    file.arrayBuffer(),
  ]);
  const task = pdfjs.getDocument({ data });
  try {
    let pdf: any;
    try {
      pdf = await task.promise;
    } catch (e) {
      throw new Error(pdfErrorMessage(e));
    }
    let title: string | undefined;
    let author: string | undefined;
    try {
      const meta = await pdf.getMetadata();
      title = cleanPdfTitle(meta?.info?.Title);
      author = cleanTitle(meta?.info?.Author);
    } catch { /* metadata is optional */ }
    return { title: title || fallbackTitle, author, text: dataUrl, fileType: 'pdf', pageCount: pdf.numPages };
  } finally {
    task.destroy().catch(() => { /* ignore */ });
  }
};

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const asciiOf = (bytes: Uint8Array, start: number, len: number): string =>
  String.fromCharCode.apply(null, bytes.subarray(start, start + len) as unknown as number[]);

const isZip = (h: Uint8Array) => h.length >= 2 && h[0] === 0x50 && h[1] === 0x4b;
const isPdf = (h: Uint8Array) => h.length >= 4 && h[0] === 0x25 && h[1] === 0x50 && h[2] === 0x44 && h[3] === 0x46;

export function detectFileType(file: File, header: Uint8Array): BookFileType | null {
  const byExt = EXT_TO_TYPE[extensionOf(file.name)] || null;

  if (isPdf(header)) return 'pdf';
  if (header.length >= 68) {
    const kind = asciiOf(header, 60, 8);
    if (kind === 'BOOKMOBI' || kind === 'TEXtREAd') return 'mobi';
  }
  if (isZip(header)) {
    // ZIP container: the archive itself is inspected in importFile.
    return byExt === 'docx' ? 'docx' : 'epub';
  }
  if (byExt) return byExt;

  // Sniff text-like content
  const head = asciiOf(header, 0, Math.min(header.length, 512)).trimStart().toLowerCase();
  if (head.startsWith('<?xml') && head.includes('fictionbook')) return 'fb2';
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return 'html';
  if (file.type === 'text/plain') return 'txt';
  if (file.type === 'text/html') return 'html';
  if (file.type === 'text/markdown') return 'md';
  return null;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function importFile(file: File): Promise<ImportedBook> {
  if (file.size === 0) throw new Error('The file is empty');
  const header = new Uint8Array(await file.slice(0, 1024).arrayBuffer());

  const detected = detectFileType(file, header);
  if (!detected) throw new Error(`Unsupported file type: ${file.name}`);
  const fallbackTitle = titleFromFilename(file.name);

  // ZIP containers are opened once and routed by their contents, whatever the extension says.
  if (detected === 'epub' || detected === 'docx') {
    if (!isZip(header)) throw new Error(`This ${detected.toUpperCase()} file is damaged (not a ZIP archive)`);
    const JSZip = await loadJSZip();
    let zip: JSZipType;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new Error('The archive could not be opened; the file may be damaged');
    }
    if (zip.file('word/document.xml')) {
      const { html, title, author } = await docxToHtml(zip);
      return { title: title || fallbackTitle, author, text: html, fileType: 'docx' };
    }
    if (zip.file('META-INF/container.xml')) {
      const result = await readEpubZip(zip);
      return {
        title: cleanTitle(result.title) || fallbackTitle,
        author: cleanTitle(result.author),
        text: result.text,
        coverUrl: result.coverUrl,
        fileType: 'epub',
        language: result.language
      };
    }
    throw new Error(`Unsupported archive: ${file.name}`);
  }

  switch (detected) {
    case 'txt': {
      const text = decodeText(await file.arrayBuffer()).replace(/\r\n?/g, '\n');
      return { title: fallbackTitle, text, fileType: 'txt' };
    }
    case 'md': {
      const { html, title } = markdownToHtml(decodeText(await file.arrayBuffer()));
      return { title: cleanTitle(title) || fallbackTitle, text: html, fileType: 'md' };
    }
    case 'html': {
      const raw = decodeText(await file.arrayBuffer(), { markup: true });
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      const title = cleanTitle(doc.querySelector('title')?.textContent) || cleanTitle(doc.querySelector('h1')?.textContent) || fallbackTitle;
      const language = toLanguageCode(doc.documentElement.getAttribute('lang'));
      sanitizeDocument(doc);
      return { title, text: doc.body?.innerHTML || '', fileType: 'html', language };
    }
    case 'fb2': {
      const { html, title, author, language, coverUrl } = await fb2ToHtml(decodeText(await file.arrayBuffer(), { markup: true }));
      return { title: title || fallbackTitle, author, text: html, fileType: 'fb2', language, coverUrl };
    }
    case 'mobi': {
      const result = await readMobiFile(file);
      return { title: cleanTitle(result.title) || fallbackTitle, author: cleanTitle(result.author), text: result.text, coverUrl: result.coverUrl, fileType: 'mobi', language: result.language };
    }
    case 'pdf':
      return importPdf(file, fallbackTitle);
    default:
      throw new Error(`Unsupported file type: ${file.name}`);
  }
}
