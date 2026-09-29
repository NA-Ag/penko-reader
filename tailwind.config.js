/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        dyslexic: ['OpenDyslexic', 'Comic Sans MS', 'sans-serif'],
      },
      // Semantic colour tokens. Values live in index.css and switch per theme,
      // so components rarely need dark: variants.
      colors: {
        canvas: token('canvas'),       // page background
        surface: token('surface'),     // cards, panels, dialogs
        sunken: token('sunken'),       // wells, hovers, inactive tracks
        line: token('line'),           // hairline borders
        ink: {
          DEFAULT: token('ink'),       // primary text
          soft: token('ink-soft'),     // secondary text
        },
        muted: token('muted'),         // tertiary text, captions
        accent: {
          DEFAULT: token('accent'),    // primary actions, progress, focus
          soft: token('accent-soft'),  // tinted backgrounds
          ink: token('accent-ink'),    // accent-coloured text on canvas
        },
        'on-accent': token('on-accent'),
        penko: token('penko'),         // Penko's slate blue, used sparingly
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 1px rgb(0 0 0 / 0.02)',
        lift: '0 8px 24px -8px rgb(0 0 0 / 0.18), 0 2px 6px -2px rgb(0 0 0 / 0.08)',
        cover: '0 1px 2px rgb(0 0 0 / 0.12), 0 6px 16px -6px rgb(0 0 0 / 0.25)',
        dialog: '0 24px 64px -16px rgb(0 0 0 / 0.35)',
      },
      keyframes: {
        enter: {
          from: {
            opacity: 'var(--pk-enter-opacity, 1)',
            transform: 'translate3d(var(--pk-enter-x, 0), var(--pk-enter-y, 0), 0) scale3d(var(--pk-enter-scale, 1), var(--pk-enter-scale, 1), 1)',
          },
        },
        'penko-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
      },
      animation: {
        'penko-bob': 'penko-bob 2.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
