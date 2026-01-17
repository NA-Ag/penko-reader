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
export type Theme = 'light' | 'dark';

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
