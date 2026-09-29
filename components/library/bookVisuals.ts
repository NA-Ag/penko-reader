import { BookFileType, BookMeta } from '../../types';

export interface CoverStyle { bg: string; fg: string; rule: string }

/** Muted, bookish cloth colours for generated covers. */
const COVER_PALETTE: CoverStyle[] = [
  { bg: '#2F4A3A', fg: '#F1EBDD', rule: '#C9B98F' }, // forest
  { bg: '#243B53', fg: '#EEF2F6', rule: '#B7C6D6' }, // navy
  { bg: '#5E2A2A', fg: '#F5E9E4', rule: '#D9A48F' }, // oxblood
  { bg: '#4A2E45', fg: '#F3E8F0', rule: '#C9A6BF' }, // plum
  { bg: '#8A6420', fg: '#FBF3E2', rule: '#F0D69A' }, // ochre
  { bg: '#1F4E4F', fg: '#E8F3F2', rule: '#9CC8C4' }, // teal
  { bg: '#7A4331', fg: '#FAEDE6', rule: '#E4B39D' }, // clay
  { bg: '#3A4750', fg: '#EDF0F2', rule: '#AAB6BF' }, // slate
  { bg: '#E9E2D3', fg: '#2C2620', rule: '#9B8B6E' }, // linen
];

const hash = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
};

export const getCoverStyle = (id: string): CoverStyle => COVER_PALETTE[hash(id) % COVER_PALETTE.length];

export const formatLabel = (type: BookFileType): string => {
  switch (type) {
    case 'md': return 'Markdown';
    case 'html': return 'HTML';
    case 'docx': return 'Word';
    case 'fb2': return 'FB2';
    default: return type.toUpperCase();
  }
};

/**
 * 0–100 reading progress using whichever position (paged or speed reader) is further along.
 * PDFs store the current page (1-based), so page 1 counts as 0% and the last page as 100%.
 */
export const progressPercent = (book: Pick<BookMeta, 'progress' | 'totalTokens' | 'rsvpProgress'> & { fileType?: BookFileType }): number => {
  if (!book.totalTokens) return 0;
  const paged = book.fileType === 'pdf'
    ? (book.totalTokens > 1 ? (Math.max(1, book.progress) - 1) / (book.totalTokens - 1) : 0)
    : book.progress / book.totalTokens;
  const rsvp = (book.rsvpProgress || 0) / book.totalTokens;
  return Math.round(Math.min(1, Math.max(0, paged, rsvp)) * 100);
};

/** Rough minutes left at a comfortable 250 wpm (text books only). */
export const minutesLeft = (book: Pick<BookMeta, 'fileType' | 'progress' | 'totalTokens' | 'rsvpProgress'>): number | null => {
  if (book.fileType === 'pdf' || !book.totalTokens) return null;
  const remaining = book.totalTokens * (1 - progressPercent(book) / 100);
  return Math.max(1, Math.round(remaining / 250));
};

const RTF_CACHE = new Map<string, Intl.RelativeTimeFormat>();

/** Human "x days ago" style label using Intl.RelativeTimeFormat. */
export const relativeTime = (ms: number, locale: string): string => {
  const diff = ms - Date.now();
  let rtf = RTF_CACHE.get(locale);
  if (!rtf) { rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }); RTF_CACHE.set(locale, rtf); }
  const abs = Math.abs(diff);
  const minute = 60_000, hour = 3_600_000, day = 86_400_000;
  if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day');
  return new Date(ms).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
};
