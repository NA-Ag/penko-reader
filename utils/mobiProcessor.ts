import { LanguageCode } from '../types';
import { toLanguageCode } from './epubProcessor';
import { bytesToDataUrl, downscaleImage, escapeHtml, sanitizeTree, sniffImageMime } from './importHelpers';

export interface MobiResult {
  /** HTML for MOBI books, plain text for bare PalmDoc files. */
  text: string;
  coverUrl?: string;
  /** Full title from the MOBI header / EXTH, falling back to the PalmDB name. */
  title?: string;
  author?: string;
  language?: LanguageCode;
}

const COMPRESSION_NONE = 1;
const COMPRESSION_PALMDOC = 2;
const COMPRESSION_HUFFCDIC = 17480;
const NO_INDEX = 0xffffffff;

const MAX_IMAGE_BYTES = 1_500_000;
const MAX_TOTAL_IMAGE_BYTES = 20_000_000;

/** Append-only byte buffer that grows geometrically (no per-byte JS array pushes). */
class ByteBuffer {
  buf: Uint8Array;
  len = 0;
  constructor(capacity: number) { this.buf = new Uint8Array(Math.max(1024, capacity)); }
  ensure(extra: number) {
    if (this.len + extra <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  pushBytes(src: Uint8Array) { this.ensure(src.length); this.buf.set(src, this.len); this.len += src.length; }
  view() { return this.buf.subarray(0, this.len); }
}

/** PalmDoc (LZ77 variant) decompression, appending to `out`. */
const decompressPalmDoc = (data: Uint8Array, out: ByteBuffer): void => {
  out.ensure(data.length * 8);
  let i = 0;
  while (i < data.length) {
    const c = data[i++];
    if (c >= 1 && c <= 8) {
      const n = Math.min(c, data.length - i);
      out.ensure(n);
      out.buf.set(data.subarray(i, i + n), out.len);
      out.len += n;
      i += n;
    } else if (c < 0x80) {
      out.ensure(1);
      out.buf[out.len++] = c;
    } else if (c < 0xc0) {
      if (i >= data.length) break;
      const pair = ((c << 8) | data[i++]) & 0x3fff;
      const distance = pair >> 3;
      const length = (pair & 7) + 3;
      out.ensure(length);
      let from = out.len - distance;
      if (distance === 0 || from < 0) continue; // corrupt reference: skip
      for (let k = 0; k < length; k++) out.buf[out.len++] = out.buf[from++]; // may overlap: byte-wise
    } else {
      out.ensure(2);
      out.buf[out.len++] = 0x20;
      out.buf[out.len++] = c ^ 0x80;
    }
  }
};

/** Size of one backward-encoded trailing entry ending at `size`. */
const trailingEntrySize = (data: Uint8Array, size: number): number => {
  let bitpos = 0;
  let result = 0;
  while (size > 0) {
    const v = data[size - 1];
    result |= (v & 0x7f) << bitpos;
    bitpos += 7;
    size--;
    if (v & 0x80 || bitpos >= 28) break;
  }
  return result;
};

/** Bytes to trim from the end of a text record according to the MOBI extra_flags. */
const trailingSize = (data: Uint8Array, flags: number): number => {
  let num = 0;
  let f = flags >> 1;
  while (f) {
    if (f & 1) num += trailingEntrySize(data, data.length - num);
    f >>= 1;
  }
  if (flags & 1) {
    const off = data.length - num - 1;
    if (off >= 0) num += (data[off] & 3) + 1;
  }
  return Math.min(num, data.length);
};

const ascii = (bytes: Uint8Array, start: number, len: number): string =>
  String.fromCharCode.apply(null, bytes.subarray(start, start + len) as unknown as number[]);

export async function readMobiFile(file: File): Promise<MobiResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 86) throw new Error('Invalid MOBI file: too small');
  const dv = new DataView(buffer);

  // --- PalmDB header & record table ---------------------------------------
  const numRecords = dv.getUint16(76);
  if (numRecords === 0 || 78 + numRecords * 8 > bytes.length) throw new Error('Invalid MOBI file: no records found');
  const offsets: number[] = [];
  for (let i = 0; i < numRecords; i++) offsets.push(dv.getUint32(78 + i * 8));
  const record = (i: number): Uint8Array | null => {
    if (i < 0 || i >= offsets.length) return null;
    const start = offsets[i];
    const end = i + 1 < offsets.length ? offsets[i + 1] : bytes.length;
    return start < end && end <= bytes.length ? bytes.subarray(start, end) : null;
  };

  const rec0 = record(0);
  if (!rec0 || rec0.length < 16) throw new Error('Invalid MOBI file: header record missing');
  const r0 = new DataView(rec0.buffer, rec0.byteOffset, rec0.byteLength);
  const u32 = (o: number) => (o + 4 <= rec0.length ? r0.getUint32(o) : NO_INDEX);

  const compression = r0.getUint16(0);
  const textRecordCount = r0.getUint16(8);
  const encryption = r0.getUint16(12);
  if (encryption !== 0) throw new Error('This MOBI book is DRM-protected and can’t be opened.');
  if (compression === COMPRESSION_HUFFCDIC) throw new Error('This MOBI book uses HUFF/CDIC compression, which isn’t supported yet. Try converting it to EPUB.');
  if (compression !== COMPRESSION_NONE && compression !== COMPRESSION_PALMDOC) throw new Error('Unknown MOBI compression');

  // --- MOBI header (optional: bare PalmDoc files don't have one) ----------
  const isMobi = rec0.length >= 24 && ascii(rec0, 16, 4) === 'MOBI';
  let encoding = 1252;
  let extraFlags = 0;
  let firstImage = NO_INDEX;
  let fullName: string | undefined;
  let author: string | undefined;
  let language: LanguageCode | undefined;
  let exthTitle: string | undefined;
  let coverOffset = NO_INDEX;
  let thumbOffset = NO_INDEX;

  if (isMobi) {
    const headerLen = u32(20);
    encoding = u32(28);
    firstImage = u32(108);
    if (headerLen >= 0xe4 && rec0.length >= 0xf4) extraFlags = r0.getUint16(0xf2);
    const decoder = new TextDecoder(encoding === 65001 ? 'utf-8' : 'windows-1252');

    const nameOff = u32(84);
    const nameLen = u32(88);
    if (nameOff !== NO_INDEX && nameLen > 0 && nameOff + nameLen <= rec0.length) {
      fullName = decoder.decode(rec0.subarray(nameOff, nameOff + nameLen)).trim() || undefined;
    }

    // EXTH metadata block
    const exthFlags = u32(128);
    const exthStart = 16 + headerLen;
    if (exthFlags !== NO_INDEX && exthFlags & 0x40 && exthStart + 12 <= rec0.length && ascii(rec0, exthStart, 4) === 'EXTH') {
      const count = r0.getUint32(exthStart + 8);
      let p = exthStart + 12;
      const authors: string[] = [];
      for (let i = 0; i < count && p + 8 <= rec0.length; i++) {
        const type = r0.getUint32(p);
        const len = r0.getUint32(p + 4);
        if (len < 8 || p + len > rec0.length) break;
        const data = rec0.subarray(p + 8, p + len);
        switch (type) {
          case 100: authors.push(decoder.decode(data).trim()); break;
          case 503: exthTitle = decoder.decode(data).trim() || exthTitle; break;
          case 524: language = toLanguageCode(decoder.decode(data)); break;
          case 201: if (data.length >= 4) coverOffset = new DataView(data.buffer, data.byteOffset, 4).getUint32(0); break;
          case 202: if (data.length >= 4) thumbOffset = new DataView(data.buffer, data.byteOffset, 4).getUint32(0); break;
        }
        p += len;
      }
      author = authors.filter(Boolean).join(', ') || undefined;
    }
  }

  // PalmDB name as a last-resort title
  let palmName: string | undefined;
  {
    const raw = ascii(bytes, 0, 32).split('\0')[0].trim();
    if (raw && /^[\x20-\x7e]+$/.test(raw) && !/^[\d_]+$/.test(raw)) palmName = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // --- Text ---------------------------------------------------------------
  const out = new ByteBuffer(textRecordCount * 4096 + 1024);
  for (let i = 1; i <= textRecordCount; i++) {
    let data = record(i);
    if (!data) break;
    if (extraFlags) data = data.subarray(0, data.length - trailingSize(data, extraFlags));
    if (compression === COMPRESSION_PALMDOC) decompressPalmDoc(data, out);
    else out.pushBytes(data);
  }
  const rawText = new TextDecoder(encoding === 65001 ? 'utf-8' : 'windows-1252').decode(out.view()).replace(/\0/g, '');

  // --- Images -------------------------------------------------------------
  let imageBudget = MAX_TOTAL_IMAGE_BYTES;
  const imageRecord = (index: number): Uint8Array | null =>
    firstImage !== NO_INDEX && index !== NO_INDEX ? record(firstImage + index) : null;
  const inlineImage = async (data: Uint8Array | null): Promise<string | undefined> => {
    if (!data || data.length === 0 || imageBudget <= 0) return undefined;
    const mime = sniffImageMime(data, '');
    if (!mime.startsWith('image/')) return undefined;
    const url = data.length <= MAX_IMAGE_BYTES ? bytesToDataUrl(data, mime) : await downscaleImage(data, mime, 1200, { maxBytes: MAX_IMAGE_BYTES, hardLimit: MAX_IMAGE_BYTES });
    if (!url) return undefined;
    imageBudget -= url.length * 0.75;
    return imageBudget >= 0 ? url : undefined;
  };

  let coverUrl: string | undefined;
  const coverData = imageRecord(coverOffset) || imageRecord(thumbOffset);
  if (coverData) {
    const mime = sniffImageMime(coverData, '');
    if (mime.startsWith('image/')) coverUrl = await downscaleImage(coverData, mime, 600);
  }

  const title = fullName || exthTitle || palmName;

  // Bare PalmDoc text: return plain text with paragraph breaks.
  if (!isMobi || !/<[a-z][\s\S]*>/i.test(rawText.slice(0, 20_000))) {
    const text = rawText.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return { text, coverUrl, title, author, language };
  }

  // --- MOBI markup → clean HTML --------------------------------------------
  const markup = rawText
    // mbp:* tags are self-closing in intent; the HTML parser would otherwise nest the rest of the book inside them
    .replace(/<mbp:pagebreak\s*\/?>/gi, '<hr class="pagebreak">')
    .replace(/<\/?mbp:[^>]*>/gi, '')
    // Empty self-closing anchors (<a filepos=... />) would swallow following content
    .replace(/<a\b[^>]*\/>/gi, '');

  const doc = new DOMParser().parseFromString(`<body>${markup}</body>`, 'text/html');
  const imgs = Array.from(doc.querySelectorAll('img'));
  await Promise.all(imgs.map(async img => {
    const idx = parseInt(img.getAttribute('recindex') || img.getAttribute('hirecindex') || img.getAttribute('lorecindex') || '', 10);
    const url = Number.isFinite(idx) && idx > 0 ? await inlineImage(imageRecord(idx - 1)) : undefined;
    for (const a of ['recindex', 'hirecindex', 'lorecindex']) img.removeAttribute(a);
    if (url) img.setAttribute('src', url); else img.removeAttribute('src');
  }));
  // filepos links point at byte offsets in the raw file; they can't be resolved after conversion.
  doc.querySelectorAll('a[filepos]').forEach(a => { a.removeAttribute('filepos'); a.removeAttribute('href'); });

  sanitizeTree(doc.body);
  const html = doc.body.innerHTML.trim() || `<p>${escapeHtml(rawText)}</p>`;

  return { text: html, coverUrl, title, author, language };
}
