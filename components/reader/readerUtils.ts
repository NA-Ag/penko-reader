/** Helpers for the paged book reader. */

const CJK_RE = /[　-〿぀-ゟ゠-ヿ＀-ﾟ一-龯㐀-䶿]/;
const WORD_CHAR = /[\p{L}\p{N}'’-]/u;

/** Find the word under a screen point (double-click / double-tap to define). */
export const wordAtPoint = (x: number, y: number): string | null => {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let offset = 0;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (p) { node = p.offsetNode; offset = p.offset; }
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) { node = r.startContainer; offset = r.startOffset; }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent || '';
  if (!text.trim()) return null;

  let s = Math.min(offset, text.length);
  let e = s;
  while (s > 0 && WORD_CHAR.test(text[s - 1])) s--;
  while (e < text.length && WORD_CHAR.test(text[e])) e++;
  let run = text.slice(s, e);
  if (!run) return null;

  // CJK runs have no spaces: pick the segment under the caret.
  const Segmenter = (Intl as any).Segmenter as (new (l: string, o: any) => any) | undefined;
  if (CJK_RE.test(run) && Segmenter) {
    const seg = new Segmenter(undefined, { granularity: 'word' });
    const rel = offset - s;
    for (const part of seg.segment(run) as Iterable<{ segment: string; index: number; isWordLike?: boolean }>) {
      if (rel >= part.index && rel <= part.index + part.segment.length) {
        run = part.isWordLike ? part.segment : '';
        break;
      }
    }
  }
  const word = run.replace(/^[-'’]+|[-'’]+$/g, '');
  return word || null;
};

/** Split plain text into sentence-sized chunks that speech synthesis handles reliably. */
export const splitSentences = (text: string): string[] => {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return [];
  const parts = raw.match(/[^.!?。！？]+[.!?。！？]+["'”’)\]]*\s*|[^.!?。！？]+$/g) || [raw];
  const out: string[] = [];
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    if (s.length <= 260) { out.push(s); continue; }
    // Long sentence: break at commas / spaces.
    let rest = s;
    while (rest.length > 260) {
      let cut = rest.lastIndexOf(',', 260);
      if (cut < 80) cut = rest.lastIndexOf(' ', 260);
      if (cut < 80) cut = 260;
      out.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
};

/** First ~N characters of text that sits on the current page of a column-paged container. */
export const visibleTextSnippet = (container: HTMLElement, maxChars = 40): string | null => {
  const rect = container.getBoundingClientRect();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  let steps = 0;
  const range = document.createRange();
  while ((n = walker.nextNode()) && steps < 20000) {
    steps++;
    const text = n.textContent || '';
    if (!text.trim()) continue;
    range.selectNodeContents(n);
    const rects = range.getClientRects();
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.width === 0) continue;
      if (r.left >= rect.left - 1 && r.left < rect.right && r.top >= rect.top - 1 && r.bottom <= rect.bottom + 1) {
        const snippet = text.trim().slice(0, maxChars);
        return snippet.length < text.trim().length ? `${snippet}…` : snippet;
      }
    }
  }
  return null;
};
