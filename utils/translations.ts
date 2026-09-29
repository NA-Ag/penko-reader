import type { LanguageCode, Translation } from '../types';
import en from './i18n/en';

export { DEMO_TEXTS } from './i18n/demoTexts';

/**
 * English is bundled and is the complete reference set. Every other language is a separate
 * lazily-loaded chunk that may omit keys; missing keys fall back to English per key.
 */
export const EN: Translation = en;

const LOADERS: Record<Exclude<LanguageCode, 'en'>, () => Promise<{ default: Partial<Translation> }>> = {
  es: () => import('./i18n/es'),
  fr: () => import('./i18n/fr'),
  de: () => import('./i18n/de'),
  ja: () => import('./i18n/ja'),
  ru: () => import('./i18n/ru'),
  uk: () => import('./i18n/uk'),
  it: () => import('./i18n/it'),
  pt: () => import('./i18n/pt'),
  zh: () => import('./i18n/zh')
};

const merge = (overrides: Partial<Translation>): Translation => ({
  ...en,
  ...overrides,
  wpmLabels: { ...en.wpmLabels, ...(overrides.wpmLabels || {}) }
});

const cache = new Map<LanguageCode, Translation>([['en', en]]);

/** Loads (once) and returns the full translation for a language. Never rejects: falls back to English. */
export const loadTranslation = async (lang: LanguageCode): Promise<Translation> => {
  const hit = cache.get(lang);
  if (hit) return hit;
  const loader = LOADERS[lang as Exclude<LanguageCode, 'en'>];
  if (!loader) return en;
  try {
    const t = merge((await loader()).default);
    cache.set(lang, t);
    return t;
  } catch (e) {
    console.warn(`Could not load translation "${lang}"`, e);
    return en;
  }
};

/** Synchronous access: the translation if already loaded, otherwise English. */
export const getTranslation = (lang: LanguageCode): Translation => cache.get(lang) || en;

/** Simple `{name}` placeholder interpolation for translated strings. */
export const fmt = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
