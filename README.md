# Penko Reader

**Penko Reader** is an offline-first, privacy-respecting reading app. It is part of the **Penko Software Education Branch**.

Bring your own books, read them in a cozy paged reader, flash them word by word with RSVP (Rapid Serial Visual Presentation) for deep focus, and train your reading speed with timed drills. Everything stays on your device.

## Features

### Library
- Import **EPUB, PDF, MOBI, TXT, Markdown, HTML, DOCX and FB2** files (drag and drop or file picker, several at once).
- Title, author, cover and language are read from the file's metadata when available.
- Favourites, custom categories, search by title or author, and a one-file backup you can restore on any device.

### Book reader
- Paged reading for text-based books with adjustable font, size, line spacing and margins, in four page themes (light, sepia, dark, black) plus the OpenDyslexic font.
- Table of contents, bookmarks, and remembered position for every book.
- **Read aloud** with the browser's built-in voices, starting from the current page.
- PDF rendering with pinch zoom, highlighter, pen and eraser tools.
- Double-tap a word to look it up in the dictionary.

### Speed reader (RSVP)
- Reads any library book, pasted text, an uploaded file, or the built-in sample passages in ten languages.
- Adjustable speed (100–1200 wpm), font size, and words per flash; pauses at punctuation and paragraph ends.
- Optimal Recognition Point display, a follow-along full-text view, and keyboard shortcuts.
- Vertical text mode for Japanese and Chinese.

### Training
- Three drills: **Ramp** (speed increases across the passage), **Sprint** (hold a pace for a set time) and **Chunking** (2–4 words per flash).
- Session results with effective and peak speed, personal bests, day streaks and a seven-day chart.

### Dictionary
- Built-in mini lexicon works offline. Optional online lookups via Wiktionary can be switched on in Reading Options (off by default; nothing else ever leaves the device).
- Larger offline dictionaries can be bundled: see `scripts/generate-dictionaries.js`.

### Accessibility and privacy
- OpenDyslexic font, adjustable UI scale, high-contrast dark and OLED themes, keyboard navigation.
- Interface in English, Spanish, French, German, Italian, Portuguese, Russian, Ukrainian, Japanese and Chinese.
- No accounts, no tracking, no servers. Books live in your browser's IndexedDB; settings and progress in local storage.

## Install

Penko Reader is a Progressive Web App. Open the hosted site and use **Install App** (or your browser's "Add to Home Screen" / "Install" option) to get an offline, standalone app on desktop, Android and iOS.

## Development

```bash
npm install
npm run dev        # start the dev server
npm run typecheck  # TypeScript check
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Fonts, Tailwind CSS and the PDF worker are bundled at build time, so the app has no runtime dependency on any CDN. Pushes to `main` are deployed to GitHub Pages by the workflow in `.github/workflows/deploy.yml`.

### Project layout

```
App.tsx               view routing, global modals, wiring
hooks/                settings, library (IndexedDB), install prompt, RSVP engine
components/views/     Home, Library, Reader (RSVP), Training
components/BookReader.tsx  paged book reader
components/modals/    dialogs (definition, backup, categories, book actions)
components/ui/        shared cabin-styled primitives and icons
utils/importers.ts    file format importers
utils/dictionaryService.ts, utils/stats.ts, utils/tokenizer.ts
scripts/              icon and offline dictionary generation
```

---
*Part of the Penko Software Ecosystem.*
