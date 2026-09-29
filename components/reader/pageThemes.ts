import { useEffect, useState } from 'react';
import type React from 'react';

export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'black';
export type FontFamily = 'serif' | 'sans' | 'dyslexic';
export type MarginSize = 'narrow' | 'medium' | 'wide';
export type AnnotationTool = 'none' | 'highlight' | 'pen' | 'erase';

/** Minimum horizontal padding per side and vertical padding for each margin preset. */
export const MARGINS: Record<MarginSize, { x: number; y: number }> = {
  narrow: { x: 16, y: 60 },
  medium: { x: 24, y: 70 },
  wide: { x: 48, y: 80 },
};

/** Longest comfortable line, in em. Wide screens get extra side padding instead of 200-character lines. */
export const MAX_MEASURE_EM = 36;

export const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#facc15' },
  { name: 'Green', value: '#4ade80' },
  { name: 'Blue', value: '#60a5fa' },
  { name: 'Red', value: '#f87171' },
  { name: 'Purple', value: '#c084fc' },
];

export const ERASER_CURSOR = `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyNCcgaGVpZ2h0PScyNCcgdmlld0JveD0nMCAwIDI0IDI0JyBmaWxsPSd3aGl0ZScgc3Ryb2tlPSdibGFjaycgc3Ryb2tlLXdpZHRoPScyJyBzdHJva2UtbGluZWNhcD0ncm91bmQnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnPjxwYXRoIGQ9J203IDIxLTQuMy00LjNjLTEtMS0xLTIuNSAwLTMuNGw5LjYtOS42YzEtMSAyLjUtMSAzLjQgMGw1LjYgNS42YzEgMSAxIDIuNSAwIDMuNEwxMyAyMScvPjxwYXRoIGQ9J00yMiAyMUg3Jy8+PHBhdGggZD0nbTUgMTEgOSA5Jy8+PC9zdmc+") 6 18, auto`;
export const PEN_CURSOR = `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyNCcgaGVpZ2h0PScyNCcgdmlld0JveD0nMCAwIDI0IDI0JyBmaWxsPSd3aGl0ZScgc3Ryb2tlPSdibGFjaycgc3Ryb2tlLXdpZHRoPScyJyBzdHJva2UtbGluZWNhcD0ncm91bmQnIHN0cm9rZS1saW5lam9pbj0ncm91bmQnPjxwYXRoIGQ9J20xOC41IDIuNSAzIDMgLTExIDExIC0zIDAgMCAtMyAxMSAtMTF6Jy8+PC9zdmc+") 0 24, auto`;

interface PageTheme {
  label: string;
  swatch: string;
  swatchInk: string;
  pdfBackdrop: string;
  /** Root style that redefines the app's colour tokens so shared classes follow the page theme. */
  style: React.CSSProperties;
}

const makeTheme = (label: string, swatch: string, swatchInk: string, scheme: 'light' | 'dark', pdfBackdrop: string, vars: Record<string, string>): PageTheme => {
  const style: Record<string, string> = { colorScheme: scheme };
  for (const [k, v] of Object.entries(vars)) style[`--${k}`] = v;
  return { label, swatch, swatchInk, pdfBackdrop, style: style as React.CSSProperties };
};

/**
 * Page themes. The reader is independent of the app theme, so it redefines the app's
 * colour tokens on its root element. Styles are built once at module load.
 */
export const PAGE_THEMES: Record<ReaderTheme, PageTheme> = {
  light: makeTheme('Light', '#FFFFFF', '#1C1B19', 'light', '#EDEAE4',
    { canvas: '255 255 255', surface: '255 255 255', sunken: '243 241 236', line: '229 225 218', ink: '28 27 25', 'ink-soft': '82 78 72', muted: '117 112 105', accent: '194 87 26', 'accent-soft': '252 238 228', 'accent-ink': '168 72 18', 'on-accent': '255 255 255' }),
  sepia: makeTheme('Sepia', '#F6EEDF', '#433422', 'light', '#E6DAC3',
    { canvas: '246 238 223', surface: '250 244 232', sunken: '236 225 204', line: '222 208 182', ink: '67 52 34', 'ink-soft': '98 80 58', muted: '128 108 82', accent: '194 87 26', 'accent-soft': '243 222 200', 'accent-ink': '160 70 18', 'on-accent': '255 255 255' }),
  dark: makeTheme('Dark', '#1A1A19', '#DCD7CE', 'dark', '#111110',
    { canvas: '26 26 25', surface: '33 33 31', sunken: '44 43 41', line: '55 53 50', ink: '220 215 206', 'ink-soft': '190 185 176', muted: '145 140 132', accent: '240 140 70', 'accent-soft': '61 40 27', 'accent-ink': '245 160 100', 'on-accent': '24 20 17' }),
  black: makeTheme('Black', '#000000', '#B9B3A9', 'dark', '#000000',
    { canvas: '0 0 0', surface: '14 14 14', sunken: '26 26 26', line: '40 40 40', ink: '185 179 169', 'ink-soft': '165 159 150', muted: '125 120 113', accent: '240 140 70', 'accent-soft': '50 32 20', 'accent-ink': '245 160 100', 'on-accent': '20 16 12' }),
};

export const READER_THEMES = Object.keys(PAGE_THEMES) as ReaderTheme[];

// ------------------------------------------------------------------ prefs

const SETTINGS_KEY = 'penko-reader-settings';

export interface ReaderPrefs {
  fontSize: number;
  lineHeight: number;
  readerTheme: ReaderTheme;
  highlightColor: string;
  fontFamily: FontFamily;
  marginSize: MarginSize;
  ttsRate: number;
}

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const loadPrefs = (): ReaderPrefs => {
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const defaults: ReaderPrefs = {
    fontSize: 18,
    lineHeight: 1.6,
    readerTheme: prefersDark ? 'dark' : 'light',
    highlightColor: HIGHLIGHT_COLORS[0].value,
    fontFamily: 'serif',
    marginSize: 'medium',
    ttsRate: 1,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    // Validate every field: a corrupted or older settings blob must never break the reader.
    return {
      fontSize: clamp(saved.fontSize, 12, 32, defaults.fontSize),
      lineHeight: clamp(saved.lineHeight, 1, 2.5, defaults.lineHeight),
      readerTheme: saved.readerTheme in PAGE_THEMES ? saved.readerTheme : defaults.readerTheme,
      highlightColor: HIGHLIGHT_COLORS.some(c => c.value === saved.highlightColor) ? saved.highlightColor : defaults.highlightColor,
      fontFamily: ['serif', 'sans', 'dyslexic'].includes(saved.fontFamily) ? saved.fontFamily : defaults.fontFamily,
      marginSize: saved.marginSize in MARGINS ? saved.marginSize : defaults.marginSize,
      ttsRate: clamp(saved.ttsRate, 0.6, 1.6, defaults.ttsRate),
    };
  } catch {
    return defaults;
  }
};

/** Reader preferences, persisted (debounced, so dragging a slider doesn't write on every tick). */
export const useReaderPrefs = () => {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  useEffect(() => {
    const id = window.setTimeout(() => {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch { /* storage full or unavailable */ }
    }, 250);
    return () => window.clearTimeout(id);
  }, [prefs]);
  const setPref = <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) =>
    setPrefs(p => (p[key] === value ? p : { ...p, [key]: value }));
  return { prefs, setPref };
};
