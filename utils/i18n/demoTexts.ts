import type { LanguageCode } from '../../types';

/** The one-line speed-reader demo in every language (kept tiny so it can stay in the main bundle). */
export const DEMO_TEXTS: Record<LanguageCode, string> = {
  en: "Welcome to Penko Reader. Adjust the speed and font size to your liking.",
  es: "Bienvenido a Penko Reader. Ajusta la velocidad y el tamaño de fuente a tu gusto.",
  fr: "Bienvenue sur Penko Reader. Ajustez la vitesse et la taille de la police.",
  de: "Willkommen bei Penko Reader. Passen Sie Geschwindigkeit und Schriftgröße an.",
  ja: "Penko Readerへようこそ。速度とフォントサイズを好みに合わせて調整してください。",
  ru: "Добро пожаловать в Penko Reader. Настройте скорость и размер шрифта.",
  uk: "Ласкаво просимо до Penko Reader. Налаштуйте швидкість та розмір шрифту.",
  it: "Benvenuto in Penko Reader. Regola la velocità e la dimensione del carattere.",
  pt: "Bem-vindo ao Penko Reader. Ajuste a velocidade e o tamanho da fonte.",
  zh: "欢迎使用 Penko Reader。请根据您的喜好调整速度和字体大小。",
};
