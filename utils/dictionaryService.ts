import { DictionaryEntry, LanguageCode } from '../types';

export interface LookupOptions {
  allowOnline: boolean;
  /** Abort an in-flight lookup (e.g. the dialog closed or the word changed). */
  signal?: AbortSignal;
}

const CACHE_KEY = 'penko-dict-cache';
const CACHE_LIMIT = 500;
const ONLINE_TIMEOUT_MS = 6000;
const MAX_DEFINITIONS = 6;

// ---------------------------------------------------------------------------
// Embedded mini lexicon (always available offline)
// ---------------------------------------------------------------------------

const EMBEDDED_DICTIONARIES: Partial<Record<LanguageCode, Record<string, string>>> = {
  en: {
    "the": "Denoting one or more people or things already mentioned or assumed to be common knowledge.",
    "be": "Exist, occur, or take place.",
    "to": "Expressing motion in the direction of (a particular location).",
    "of": "Expressing the relationship between a part and a whole.",
    "and": "Used to connect words of the same part of speech, clauses, or sentences.",
    "have": "Possess, own, or hold.",
    "read": "Look at and comprehend the meaning of written or printed matter.",
    "book": "A written or printed work consisting of pages glued or sewn together along one side.",
    "focus": "The center of interest or activity.",
    "learn": "Acquire knowledge of or skill in something by study, experience, or being taught.",
    "speed": "The rate at which someone or something is able to move or operate.",
    "dyslexia": "A general term for disorders that involve difficulty in learning to read or interpret words, letters, and other symbols.",
    "attention": "Notice taken of someone or something; regarding something as important.",
    "cognitive": "Relating to, being, or involving conscious intellectual activity (such as thinking or reasoning).",
    "pwa": "Progressive Web App - an application software delivered through the web.",
    "offline": "Not connected to a computer, network, or the internet.",
    "accessibility": "The quality of being able to be reached, entered, or used by people with disabilities.",
    "dictionary": "A resource that lists the words of a language and gives their meaning.",
    "comprehension": "The action or capability of understanding something.",
    "rhythm": "A strong, regular, repeated pattern of movement or sound.",
    "rsvp": "Rapid Serial Visual Presentation - a reading display method.",
    "orp": "Optimal Recognition Point - the specific letter in a word that the eye focuses on.",
    "penguin": "A large flightless seabird of southern hemisphere cold waters.",
    "software": "The programs and other operating information used by a computer."
  },
  es: {
    "hola": "Expresión con que se saluda.",
    "mundo": "Conjunto de todas las cosas creadas.",
    "gracias": "Expresión que se usa para agradecer algo.",
    "libro": "Conjunto de hojas de papel manuscritas o impresas que forman un volumen.",
    "leer": "Pasar la vista por lo escrito comprendiendo la significación de los caracteres.",
    "velocidad": "Relación entre el espacio recorrido y el tiempo empleado.",
    "atencion": "Acción de atender o concentrar la mente.",
    "enfoque": "Manera de valorar o considerar una cosa."
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Leading/trailing punctuation to strip, including CJK brackets and full-width marks. */
const EDGE_PUNCT = `\\s"'“”‘’«»„‟()\\[\\]{}<>.,;:!?¡¿…\\-–—*_~\`「」『』（）【】〈〉《》〔〕［］｛｝。、，．！？：；・〜～　`;
const LEADING = new RegExp(`^[${EDGE_PUNCT}]+`);
const TRAILING = new RegExp(`[${EDGE_PUNCT}]+$`);

/** Trim and strip surrounding quotes/punctuation; keep internal apostrophes and hyphens. */
export const normalizeWord = (word: string): string => word.trim().replace(LEADING, '').replace(TRAILING, '').trim();

/** Spelling variants worth trying, most specific first. */
const candidatesFor = (clean: string, lang: LanguageCode): string[] => {
  const straight = clean.replace(/[’‘ʼ]/g, "'");
  const list = [clean, straight, clean.toLowerCase(), straight.toLowerCase()];
  if (lang === 'en') {
    const possessive = straight.toLowerCase().replace(/'s$/, '');
    if (possessive !== straight.toLowerCase()) list.push(possessive);
  }
  return Array.from(new Set(list.filter(Boolean)));
};

const stripTags = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

const cacheKey = (word: string, lang: LanguageCode) => `${lang}:${word.toLowerCase()}`;

/** Lazily-decoded local dictionary: words are indexed at load, definitions decoded on hit. */
class LocalDictionary {
  private index = new Map<string, number>(); // word -> offset of the definition length field
  private decoder = new TextDecoder();
  constructor(private buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    const count = view.getUint32(4, true);
    let offset = 8;
    for (let i = 0; i < count && offset < buffer.byteLength; i++) {
      const wordLen = view.getUint8(offset);
      offset += 1;
      const word = this.decoder.decode(new Uint8Array(buffer, offset, wordLen));
      offset += wordLen;
      if (!this.index.has(word)) this.index.set(word, offset);
      if (!this.index.has(word.toLowerCase())) this.index.set(word.toLowerCase(), offset);
      offset += 2 + view.getUint16(offset, true);
    }
  }
  get(word: string): string | undefined {
    const at = this.index.get(word);
    if (at === undefined) return undefined;
    const len = new DataView(this.buffer).getUint16(at, true);
    return this.decoder.decode(new Uint8Array(this.buffer, at + 2, len));
  }
}

const MISS_TTL_MS = 10 * 60 * 1000;
const PERSIST_DELAY_MS = 1500;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class DictionaryService {
  private memoryCache: Map<string, DictionaryEntry> = new Map();
  private localDicts: Map<LanguageCode, LocalDictionary> = new Map();
  private missingLocal: Set<LanguageCode> = new Set();
  private loading: Map<LanguageCode, Promise<void>> = new Map();
  /** Recent online misses, so repeated taps on an unknown word don't refetch. */
  private onlineMisses: Map<string, number> = new Map();
  private cacheLoaded = false;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  async lookup(word: string, lang: LanguageCode, options: LookupOptions): Promise<DictionaryEntry | null> {
    try {
      const clean = normalizeWord(word);
      if (!clean) return null;
      const candidates = candidatesFor(clean, lang);

      // 1. Cache
      this.ensureCacheLoaded();
      for (const c of candidates) {
        const hit = this.memoryCache.get(cacheKey(c, lang));
        if (hit) {
          this.touch(cacheKey(c, lang), hit);
          this.schedulePersist();
          return { ...hit, source: 'cache' };
        }
      }

      // 2. Local binary dictionary (fetched once per language; a failure is remembered)
      await this.loadLocalDictionary(lang);
      if (options.signal?.aborted) return null;
      const local = this.localDicts.get(lang);
      if (local) {
        for (const c of candidates) {
          const def = local.get(c);
          if (def) return { word: c, language: lang, definitions: [def], source: 'local' };
        }
      }

      // 3. Embedded lexicon
      const embedded = EMBEDDED_DICTIONARIES[lang];
      if (embedded) {
        for (const c of candidates) {
          const def = embedded[c.toLowerCase()];
          if (def) return { word: c, language: lang, definitions: [def], source: 'embedded' };
        }
      }

      // 4. Online (opt-in)
      if (options.allowOnline && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        const missKey = cacheKey(clean, lang);
        const missedAt = this.onlineMisses.get(missKey);
        if (missedAt && Date.now() - missedAt < MISS_TTL_MS) return null;
        for (const c of candidates) {
          if (options.signal?.aborted) return null;
          const entry = await this.lookupOnline(c, lang, options.signal);
          if (entry) {
            this.remember(entry);
            return entry;
          }
        }
        if (!options.signal?.aborted) this.onlineMisses.set(missKey, Date.now());
      }

      return null;
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') console.warn('Dictionary lookup failed', e);
      return null;
    }
  }

  canPronounce(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  /** Speak a word. Waits briefly for voices, which some browsers load asynchronously. */
  pronounce(word: string, lang: LanguageCode): void {
    if (!this.canPronounce()) return;
    const synth = window.speechSynthesis;
    const speak = () => {
      try {
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(normalizeWord(word) || word);
        const voices = synth.getVoices();
        const lower = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-');
        const match = voices.find(v => lower(v) === lang) || voices.find(v => lower(v).startsWith(`${lang}-`));
        utterance.lang = match?.lang || lang;
        if (match) utterance.voice = match;
        utterance.rate = 0.9;
        synth.speak(utterance);
      } catch (e) {
        console.warn('Pronunciation failed', e);
      }
    };
    if (synth.getVoices().length > 0) {
      speak();
      return;
    }
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      synth.removeEventListener?.('voiceschanged', once);
      speak();
    };
    synth.addEventListener?.('voiceschanged', once);
    setTimeout(once, 400);
  }

  /** Stop any pronunciation in progress. */
  stopSpeaking(): void {
    if (this.canPronounce()) window.speechSynthesis.cancel();
  }

  // --- online ---------------------------------------------------------------

  private async lookupOnline(word: string, lang: LanguageCode, signal?: AbortSignal): Promise<DictionaryEntry | null> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timer = setTimeout(abort, ONLINE_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const data = await response.json();
      if (!data || typeof data !== 'object') return null;

      // Use only the section for the reading language: falling back to English would give
      // a Spanish "sin" the meaning of the English word.
      const block = data[lang] as { partOfSpeech?: string; definitions?: { definition?: string }[] }[] | undefined;
      if (!Array.isArray(block) || block.length === 0) return null;

      const definitions: string[] = [];
      const partsOfSpeech: string[] = [];
      for (const section of block) {
        if (!Array.isArray(section.definitions)) continue;
        for (const d of section.definitions) {
          if (definitions.length >= MAX_DEFINITIONS) break;
          const text = stripTags(d?.definition || '');
          if (text) {
            definitions.push(text);
            if (section.partOfSpeech && !partsOfSpeech.includes(section.partOfSpeech)) partsOfSpeech.push(section.partOfSpeech);
          }
        }
        if (definitions.length >= MAX_DEFINITIONS) break;
      }
      if (definitions.length === 0) return null;

      return { word, language: lang, partOfSpeech: partsOfSpeech.join(', ') || undefined, definitions, source: 'online' };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  // --- local binary dictionaries -------------------------------------------

  private async loadLocalDictionary(lang: LanguageCode): Promise<void> {
    if (this.localDicts.has(lang) || this.missingLocal.has(lang)) return;
    let pending = this.loading.get(lang);
    if (!pending) {
      pending = this.fetchLocalDictionary(lang)
        .catch(() => { this.missingLocal.add(lang); })
        .finally(() => { this.loading.delete(lang); });
      this.loading.set(lang, pending);
    }
    await pending;
  }

  private async fetchLocalDictionary(lang: LanguageCode): Promise<void> {
    if (typeof fetch === 'undefined') throw new Error('fetch unavailable');
    const response = await fetch(`./dicts/${lang}.bin`);
    if (!response.ok) throw new Error('Dictionary not found');
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) throw new Error('Dictionary not found'); // SPA fallback page

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength < 8) throw new Error('Invalid dictionary');
    const view = new DataView(buffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== 'DICT') throw new Error('Invalid dictionary');
    this.localDicts.set(lang, new LocalDictionary(buffer));
  }

  // --- cache ----------------------------------------------------------------

  private ensureCacheLoaded(): void {
    if (this.cacheLoaded) return;
    this.cacheLoaded = true;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.key === 'string' && item.entry && Array.isArray(item.entry.definitions)) {
            this.memoryCache.set(item.key, item.entry);
          }
        }
      }
    } catch {
      /* ignore corrupt cache */
    }
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => this.flushPersist());
  }

  private touch(key: string, entry: DictionaryEntry): void {
    // Re-insert to move to the "most recent" end of the Map.
    this.memoryCache.delete(key);
    this.memoryCache.set(key, entry);
  }

  private remember(entry: DictionaryEntry): void {
    this.ensureCacheLoaded();
    this.touch(cacheKey(entry.word, entry.language), entry);
    while (this.memoryCache.size > CACHE_LIMIT) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest === undefined) break;
      this.memoryCache.delete(oldest);
    }
    this.schedulePersist();
  }

  /** Writing the whole cache is costly; batch writes instead of doing it on every lookup. */
  private schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => this.flushPersist(), PERSIST_DELAY_MS);
  }

  private flushPersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
    }
    try {
      if (typeof localStorage === 'undefined') return;
      const items = Array.from(this.memoryCache.entries()).map(([key, entry]) => ({ key, entry }));
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Could not persist dictionary cache', e);
    }
  }
}

export const dictionaryService = new DictionaryService();
export default dictionaryService;
