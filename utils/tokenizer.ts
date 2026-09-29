import { LanguageCode, WordToken } from '../types';

const CJK_RE = /[　-〿぀-ゟ゠-ヿ＀-ﾟ一-龯㐀-䶿]/;
const CJK_CHAR_G = /[぀-ゟ゠-ヿ一-龯㐀-䶿]/g;
const PAUSE_RE = /[.,;:!?…]["'”’)\]]*$/;
const CJK_PAUSE_RE = /[。、！？，：；]/;

const NAMED_ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Decode a numeric character reference without throwing on out-of-range values. */
const fromCodePointSafe = (cp: number): string =>
  Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : '';

/**
 * Strip HTML tags and decode the entities that matter for reading.
 * Every regex here is linear in the input size, so multi-megabyte books are safe.
 */
export const stripHtml = (text: string): string => {
  if (!/<[a-z!/][^>]*>/i.test(text)) return text;
  return text
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/(?:p|div|h[1-6]|li|tr|section|article|blockquote)\s*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/g, (_, name: string) => NAMED_ENTITIES[name])
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex: string) => fromCodePointSafe(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_, dec: string) => fromCodePointSafe(Number(dec)))
    .replace(/[ \t]+/g, ' ');
};

type Segment = { segment: string; isWordLike?: boolean };
type SegmenterCtor = new (locale: string, opts: { granularity: 'word' }) => { segment(s: string): Iterable<Segment> };

/**
 * Turn text into RSVP tokens. Paragraph boundaries are preserved (double newline)
 * and the first word of each paragraph is flagged so the full-text view can add breaks.
 * CJK text is segmented with Intl.Segmenter when available.
 */
export const tokenize = (text: string, lang: LanguageCode = 'en'): WordToken[] => {
  const tokens: WordToken[] = [];
  const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  // One segmenter for the whole text: constructing one per paragraph is surprisingly costly.
  const segmenter = Segmenter && CJK_RE.test(text) ? new Segmenter(lang, { granularity: 'word' }) : null;

  for (const para of text.split(/\n\s*\n/)) {
    const clean = para.replace(/\s*\n\s*/g, ' ').trim();
    if (!clean) continue;

    let words: string[];
    if (segmenter) {
      words = [];
      let buffer = '';
      for (const s of segmenter.segment(clean)) {
        const piece = s.segment;
        if (/^\s+$/.test(piece)) {
          if (buffer) { words.push(buffer); buffer = ''; }
          continue;
        }
        if (s.isWordLike) {
          if (buffer) words.push(buffer);
          buffer = piece;
        } else if (buffer) {
          // Attach punctuation to the preceding word so pauses work naturally.
          buffer += piece;
        } else {
          words.push(piece);
        }
      }
      if (buffer) words.push(buffer);
    } else {
      words = clean.split(/\s+/);
    }

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;
      tokens.push({
        id: `t${tokens.length}`,
        word,
        raw: word,
        hasPause: PAUSE_RE.test(word) || CJK_PAUSE_RE.test(word),
        isParagraphStart: i === 0 && tokens.length > 0
      });
    }
  }

  return tokens;
};

/** Optimal Recognition Point: the letter the eye should land on. */
export const getPivotIndex = (word: string): number => {
  const length = word.length;
  if (length <= 1) return 0;
  if (length <= 5) return Math.ceil(length / 2) - 1;
  if (length <= 9) return Math.floor(length / 2) - 1;
  return 3;
};

export interface ChunkedTokens {
  tokens: WordToken[];
  /** Raw-token index where each chunk starts (same length as `tokens`, ascending). */
  starts: number[];
}

/**
 * Group tokens into chunks of up to N words for wide-span reading. Chunks never cross a
 * paragraph break and end early at punctuation for a natural rhythm.
 */
export const chunkTokensWithStarts = (tokens: WordToken[], size: number): ChunkedTokens => {
  if (size <= 1) return { tokens, starts: tokens.map((_, i) => i) };
  const out: WordToken[] = [];
  const starts: number[] = [];
  let i = 0;
  while (i < tokens.length) {
    const start = i;
    const group: WordToken[] = [tokens[i++]];
    while (group.length < size && i < tokens.length && !tokens[i].isParagraphStart && !group[group.length - 1].hasPause) {
      group.push(tokens[i++]);
    }
    starts.push(start);
    out.push({
      id: `c${out.length}`,
      word: group.map(g => g.word).join(' '),
      raw: group.map(g => g.raw).join(' '),
      hasPause: group[group.length - 1].hasPause,
      isParagraphStart: group[0].isParagraphStart
    });
  }
  return { tokens: out, starts };
};

export const chunkTokens = (tokens: WordToken[], size: number): WordToken[] => chunkTokensWithStarts(tokens, size).tokens;

/**
 * Fast approximate word count for progress bookkeeping (no token objects are built).
 * Whitespace-separated runs, plus CJK characters for text without spaces.
 */
export const countWords = (text: string): number => {
  const plain = stripHtml(text);
  let count = 0;
  let inWord = false;
  for (let i = 0; i < plain.length; i++) {
    const c = plain.charCodeAt(i);
    const space = c === 32 || c === 10 || c === 9 || c === 13 || c === 12 || c === 0xa0 || c === 0x3000;
    if (space) inWord = false;
    else if (!inWord) { inWord = true; count++; }
  }
  if (CJK_RE.test(plain)) {
    // CJK runs have no spaces: approximate one token per ~1.6 characters (typical segmenter output).
    const cjk = (plain.match(CJK_CHAR_G) || []).length;
    count += Math.round(cjk / 1.6);
  }
  return count;
};
