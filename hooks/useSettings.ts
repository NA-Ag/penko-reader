import { useCallback, useEffect, useRef, useState } from 'react';
import { AppView, LANGUAGE_CODES, LanguageCode, Theme } from '../types';

export interface AppSettings {
  theme: Theme;
  language: LanguageCode;
  contentLanguage: LanguageCode;
  wpm: number;
  fontSize: number;
  chunkSize: number;
  dyslexicMode: boolean;
  pauseOnPunctuation: boolean;
  clickToDefine: boolean;
  onlineDictionary: boolean;
  verticalMode: boolean;
  focusMode: boolean;
  categories: string[];
  globalFontSize: number;
  lastView: AppView;
  lastBookId: string | null;
  libraryLayout: 'grid' | 'list';
  librarySort: 'recent' | 'title' | 'author' | 'progress';
}

const KEY = 'penko-settings';
const FONT_KEY = 'penko-global-font-size';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  contentLanguage: 'en',
  wpm: 300,
  fontSize: 64,
  chunkSize: 1,
  dyslexicMode: false,
  pauseOnPunctuation: true,
  clickToDefine: true,
  onlineDictionary: false,
  verticalMode: false,
  focusMode: false,
  categories: [],
  globalFontSize: 16,
  lastView: 'home',
  lastBookId: null,
  libraryLayout: 'grid',
  librarySort: 'recent'
};

const VALID_VIEWS: AppView[] = ['home', 'library', 'reader', 'training', 'book-reader'];

const THEMES: Theme[] = ['light', 'dark', 'oled'];
const clampNum = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const oneOf = <T,>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

const readSettings = (): AppSettings => {
  let parsed: Record<string, unknown> = {};
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) parsed = raw;
  } catch (e) {
    console.warn('Could not read settings', e);
  }
  let legacyFont: number | undefined;
  try {
    const fs = Number(localStorage.getItem(FONT_KEY));
    if (fs >= 14 && fs <= 24) legacyFont = fs;
  } catch { /* ignore */ }

  const prefersDark = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const d = DEFAULT_SETTINGS;
  // Migrate keys from the 2.x settings shape.
  const lastView = parsed.lastView ?? parsed.view;
  const lastBookId = parsed.lastBookId !== undefined ? parsed.lastBookId : parsed.currentBookId;

  // Every field is validated so a corrupt or hand-edited value can't break the app.
  return {
    theme: oneOf(parsed.theme, THEMES, prefersDark ? 'dark' : 'light'),
    language: oneOf(parsed.language, LANGUAGE_CODES, d.language),
    contentLanguage: oneOf(parsed.contentLanguage, LANGUAGE_CODES, d.contentLanguage),
    wpm: Math.round(clampNum(parsed.wpm, 100, 1200, d.wpm)),
    fontSize: Math.round(clampNum(parsed.fontSize, 24, 128, d.fontSize)),
    chunkSize: Math.round(clampNum(parsed.chunkSize, 1, 4, d.chunkSize)),
    dyslexicMode: bool(parsed.dyslexicMode, d.dyslexicMode),
    pauseOnPunctuation: bool(parsed.pauseOnPunctuation, d.pauseOnPunctuation),
    clickToDefine: bool(parsed.clickToDefine, d.clickToDefine),
    onlineDictionary: bool(parsed.onlineDictionary, d.onlineDictionary),
    verticalMode: bool(parsed.verticalMode, d.verticalMode),
    focusMode: bool(parsed.focusMode, d.focusMode),
    categories: Array.isArray(parsed.categories)
      ? [...new Set(parsed.categories.filter((c): c is string => typeof c === 'string' && c.trim().length > 0))]
      : [],
    globalFontSize: Math.round(clampNum(parsed.globalFontSize, 14, 24, legacyFont ?? d.globalFontSize)),
    lastView: oneOf(lastView, VALID_VIEWS, 'home'),
    lastBookId: typeof lastBookId === 'string' ? lastBookId : null,
    libraryLayout: oneOf(parsed.libraryLayout, ['grid', 'list'] as const, d.libraryLayout),
    librarySort: oneOf(parsed.librarySort, ['recent', 'title', 'author', 'progress'] as const, d.librarySort)
  };
};

const SAVE_DELAY_MS = 250;

/** Persistent app settings, applied to the document (theme classes, base font size). */
export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(readSettings);
  const latestRef = useRef(settings);
  latestRef.current = settings;
  const timerRef = useRef<number | null>(null);

  const persist = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(latestRef.current));
      localStorage.setItem(FONT_KEY, String(latestRef.current.globalFontSize));
    } catch (e) {
      console.warn('Could not save settings', e);
    }
  }, []);

  // Debounced so dragging a slider doesn't serialise settings on every tick.
  useEffect(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(persist, SAVE_DELAY_MS);
  }, [settings, persist]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', persist);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, [persist]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark' || settings.theme === 'oled');
    root.classList.toggle('oled', settings.theme === 'oled');
    root.style.fontSize = `${settings.globalFontSize}px`;
    root.lang = settings.language;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', settings.theme === 'light' ? '#FAF9F6' : settings.theme === 'dark' ? '#141413' : '#000000');
  }, [settings.theme, settings.globalFontSize, settings.language]);

  const update = useCallback((patch: Partial<AppSettings> | ((prev: AppSettings) => Partial<AppSettings>)) => {
    setSettings(prev => {
      const changes = typeof patch === 'function' ? patch(prev) : patch;
      // Skip the re-render entirely when nothing actually changed.
      const keys = Object.keys(changes) as (keyof AppSettings)[];
      if (keys.every(k => Object.is(prev[k], changes[k]))) return prev;
      return { ...prev, ...changes };
    });
  }, []);

  return { settings, update };
};

export type SettingsUpdater = ReturnType<typeof useSettings>['update'];
