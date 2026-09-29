/**
 * Prepares stored book content for the paged reader: detects HTML, sanitises it
 * defensively (older stored books may predate the importers' sanitiser), and indexes
 * chapter headings for the table of contents. Results are cached per book so reopening
 * a book in the same session is instant.
 */

export interface TocEntry { index: number; label: string }

export interface ProcessedContent {
  html: string;
  isHtml: boolean;
  toc: TocEntry[];
}

/** Bounded sniff: never runs a backtracking regex over a multi-megabyte string. */
const HTML_TAG = /<[a-z][a-z0-9]*(?:\s[^<>]*)?\/?>/i;
export const looksLikeHtml = (s: string): boolean => HTML_TAG.test(s.slice(0, 20000));

const DROP_ELEMENTS = 'script,style,link,meta,base,iframe,frame,frameset,object,embed,applet,form,input,button,textarea,select,noscript,template,portal';
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'background', 'srcset'];
const DANGEROUS_URL = /^\s*(javascript|vbscript|data:text\/html|data:image\/svg\+xml)/i;
const DANGEROUS_STYLE = /position\s*:\s*(fixed|sticky)|expression\s*\(|javascript:|-moz-binding|behavior\s*:/i;

const sanitize = (root: ParentNode) => {
  root.querySelectorAll(DROP_ELEMENTS).forEach(el => el.remove());
  root.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
        el.removeAttribute(attr.name);
      } else if (URL_ATTRS.includes(name) && DANGEROUS_URL.test(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (name === 'style' && DANGEROUS_STYLE.test(attr.value)) {
        el.removeAttribute(attr.name);
      } else if (name === 'id' || name === 'name') {
        // Prefix ids so book anchors can never collide with (or target) the app's own elements.
        el.setAttribute(attr.name, `bk-${attr.value}`);
      }
    }
  });
};

const cache = new Map<string, { content: string; result: ProcessedContent }>();
const CACHE_LIMIT = 3;

export const processContent = (bookId: string, content: string): ProcessedContent => {
  const hit = cache.get(bookId);
  if (hit && hit.content === content) return hit.result;

  let result: ProcessedContent;
  if (!looksLikeHtml(content)) {
    result = { html: content, isHtml: false, toc: [] };
  } else {
    try {
      const doc = new DOMParser().parseFromString(content, 'text/html');
      sanitize(doc.body);
      const toc: TocEntry[] = [];
      doc.body.querySelectorAll('h1, h2, .chapter').forEach((header, index) => {
        header.setAttribute('data-toc-index', String(index));
        const label = (header.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) || `${index + 1}`;
        toc.push({ index, label });
      });
      result = { html: doc.body.innerHTML, isHtml: true, toc };
    } catch (e) {
      console.error('Could not process book HTML', e);
      // Fall back to plain text rather than rendering unsanitised markup.
      const div = document.createElement('div');
      div.textContent = content;
      result = { html: div.textContent || '', isHtml: false, toc: [] };
    }
  }

  cache.set(bookId, { content, result });
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return result;
};
