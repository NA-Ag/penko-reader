export interface ReaderSettings {
  wpm: number;
  chunkSize: number;
  fontSize: number; // in pixels
}

export interface WordToken {
  id: string;
  word: string;
  raw: string;
  hasPause: boolean; // if punctuation implies a pause
  isParagraphStart?: boolean;
}

export enum ReaderStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED'
}

export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'ru' | 'uk' | 'it' | 'pt' | 'zh';
export const LANGUAGE_CODES: LanguageCode[] = ['en', 'es', 'fr', 'de', 'ja', 'ru', 'uk', 'it', 'pt', 'zh'];
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  ru: 'Русский',
  uk: 'Українська',
  it: 'Italiano',
  pt: 'Português',
  zh: '中文'
};

export type Theme = 'light' | 'dark' | 'oled';
export type AppView = 'home' | 'library' | 'reader' | 'training' | 'book-reader';

/** Every file format the importer understands. */
export type BookFileType = 'txt' | 'pdf' | 'epub' | 'mobi' | 'md' | 'html' | 'docx' | 'fb2';

export interface WpmLabels {
  slow: string;
  normal: string;
  average: string;
  good: string;
  fast: string;
  speed: string;
  superhuman: string;
}

export interface Translation {
  title: string;
  subtitle: string;
  pastePlaceholder: string;
  library: string;
  upload: string;
  uploadPlaceholder: string;
  uploadFormats: string;
  processing: string;
  fileError: string;
  paste: string;
  start: string;
  speed: string;
  size: string;
  progress: string;
  tip: string;
  selectLang: string;
  emptyState: string;
  restart: string;
  fullText: string;
  hideFullText: string;
  installPwa: string;
  download: string;
  chapters: string;
  back: string;
  verticalMode: string;
  localFiles: string;
  delete: string;
  saved: string;
  focusMode: string;
  exitFocus: string;
  wpmLabels: WpmLabels;
  installModalTitle: string;
  installModalDesc: string;
  installInstructionsIOS: string;
  installInstructionsAndroid: string;
  installInstructionsFirefox: string;
  installInstructionsSamsung: string;
  installInstructionsDesktop: string;
  onMobile: string;
  close: string;
  demoText: string;
  search: string;
  sortBy: string;
  sortRecent: string;
  sortTitle: string;
  libraryDesc: string;
  training: string;
  trainingDesc: string;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  cancel: string;
  addCategory: string;
  allBooks: string;
  uncategorized: string;
  newCategoryPlaceholder: string;
  category: string;
  rename: string;
  deleteCategory: string;
  deleteCategoryConfirm: string;
  backupModalTitle: string;
  backupModalDesc: string;
  backupExportBtn: string;
  backupRestoreBtn: string;
  backupRestoreHelper: string;
  welcomeTitle: string;
  cozyReadingCorner: string;
  cozyReadingDesc: string;
  enterLibrary: string;
  enterLibraryDesc: string;
  speedTraining: string;
  speedTrainingDesc: string;
  brandTitle: string;

  // --- v3 additions -------------------------------------------------------
  favorites: string;
  speedReader: string;
  speedReaderDesc: string;
  continueReading: string;
  noRecentBook: string;
  privacyNote: string;
  settings: string;
  themeCosy: string;
  themeDim: string;
  themeOled: string;
  author: string;
  unknownAuthor: string;
  format: string;
  openBook: string;
  speedRead: string;
  supportedFormats: string;
  importing: string;
  importFailed: string;
  duplicateSkipped: string;
  unsupportedFormat: string;
  noCategories: string;
  restoreInvalid: string;
  restoreError: string;
  page: string;
  of: string;
  bookmarks: string;
  addBookmark: string;
  removeBookmark: string;
  noBookmarks: string;
  readAloud: string;
  stopReading: string;
  readAloudRate: string;
  appearance: string;
  zoom: string;
  spacing: string;
  fontStyle: string;
  margins: string;
  narrow: string;
  medium: string;
  wide: string;
  fontSerif: string;
  fontSans: string;
  fontDyslexic: string;
  highlightColor: string;
  highlightTool: string;
  penTool: string;
  eraserTool: string;
  noChapters: string;
  tableOfContents: string;
  pdfLoadError: string;
  readingOptions: string;
  comprehensionAids: string;
  accessibility: string;
  pauseAtPunctuation: string;
  dyslexicFont: string;
  wordsPerFlash: string;
  keyboardHints: string;
  resume: string;
  startOver: string;
  readingComplete: string;
  readingCompleteDesc: string;
  clickToDefine: string;
  onlineDictionary: string;
  onlineDictionaryDesc: string;
  definition: string;
  definitionNotFound: string;
  lookingUp: string;
  offlineDictionaryHint: string;
  source: string;
  pronounce: string;
  trainingIntro: string;
  drill: string;
  drillRamp: string;
  drillRampDesc: string;
  drillSprint: string;
  drillSprintDesc: string;
  drillChunk: string;
  drillChunkDesc: string;
  startWpm: string;
  targetWpm: string;
  duration: string;
  seconds: string;
  passage: string;
  pickPassage: string;
  useOwnText: string;
  startDrill: string;
  stopDrill: string;
  drillComplete: string;
  resultWords: string;
  resultTime: string;
  resultWpm: string;
  resultPeak: string;
  newRecord: string;
  tryAgain: string;
  yourProgress: string;
  statsSessions: string;
  statsTotalWords: string;
  statsBestWpm: string;
  statsStreak: string;
  statsLast7: string;
  statsEmpty: string;
  days: string;
  minutes: string;
  words: string;

  // --- v3.1 layout ------------------------------------------------------
  home: string;
  goodMorning: string;
  goodAfternoon: string;
  goodEvening: string;
  recentlyOpened: string;
  viewAll: string;
  importBooks: string;
  booksCount: string;
  wordsThisWeek: string;
  gridView: string;
  listView: string;
  dropToImport: string;
  emptyLibraryTitle: string;
  emptyLibraryDesc: string;
  trySample: string;
  minutesLeft: string;
  finished: string;
  lastOpened: string;
  theme: string;
  textSize: string;
  noResults: string;
  continueAction: string;
}

export interface Chapter {
  title: string;
  text: string;
}

export interface LibraryBook {
  title: string;
  author: string;
  chapters: Chapter[];
}

export interface Highlight {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface Drawing {
  page: number;
  color: string;
  strokeWidth: number;
  points: { x: number; y: number }[];
}

export interface Bookmark {
  id: string;
  /** 1-based page number when the bookmark was made (PDFs: always exact). */
  page: number;
  /**
   * Text books only: position through the book (0–1). Page numbers shift when font size or
   * margins change, so the reader resolves the current page from this when present.
   */
  fraction?: number;
  label: string;
  createdAt: number;
}

export interface StoredBook {
  id: string;
  title: string;
  author?: string;
  /** Text/HTML content, or a data: URL for PDFs. */
  content: string;
  fileType: BookFileType;
  /** For PDFs: current page. For text books: token index (paged reader) or RSVP token index. */
  progress: number;
  /** For PDFs: page count. For text books: estimated word count. */
  totalTokens: number;
  lastRead: number;
  isFavorite?: boolean;
  coverUrl?: string;
  highlights?: Highlight[];
  drawings?: Drawing[];
  category?: string;
  bookmarks?: Bookmark[];
  /** Detected or user-chosen language of the book content. */
  language?: LanguageCode;
  /** Position saved by the RSVP speed reader (token index), separate from the paged reader. */
  rsvpProgress?: number;
}

export type TrainingDrill = 'ramp' | 'sprint' | 'chunk';

export interface ReadingSession {
  id: string;
  /** Epoch ms when the session ended. */
  date: number;
  words: number;
  durationMs: number;
  /** Effective words per minute over the session. */
  wpm: number;
  /** Highest WPM setting reached during the session. */
  peakWpm: number;
  mode: 'reader' | 'training';
  drill?: TrainingDrill;
  bookId?: string;
  language?: LanguageCode;
}

export interface DictionaryEntry {
  word: string;
  language: LanguageCode;
  partOfSpeech?: string;
  definitions: string[];
  /** Where the entry came from. */
  source: 'local' | 'embedded' | 'online' | 'cache';
  /** IPA or similar, if available. */
  pronunciation?: string;
}

/**
 * A library entry without its (potentially multi-megabyte) content. This is what the
 * library list, home screen and dialogs work with; content is loaded on demand when a
 * book is opened or speed-read.
 */
export type BookMeta = Omit<StoredBook, 'content'>;
