import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookMeta, StoredBook } from '../types';
import {
  deleteBook, loadAllBooks, loadAllMeta, loadContent, loadMeta,
  saveBookWithContent, saveBooksWithContent, saveMetaMany, splitBook
} from '../utils/persistence';
import { countWords } from '../utils/tokenizer';

export type ImportStatus = 'added' | 'duplicate' | 'failed';
export interface ImportResult { name: string; status: ImportStatus; error?: string; book?: BookMeta }

export const sortByRecent = <T extends BookMeta>(books: T[]): T[] =>
  [...books].sort((a, b) => (Number(Boolean(b.isFavorite)) - Number(Boolean(a.isFavorite))) || b.lastRead - a.lastRead);

const SAVE_DELAY_MS = 400;

/**
 * The user's library, backed by IndexedDB. Only metadata lives in React state;
 * book content is loaded on demand with `loadBook`. Metadata writes are coalesced
 * per book and flushed after a short delay or when the page is hidden.
 */
export const useLibrary = () => {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const booksRef = useRef<BookMeta[]>([]);
  booksRef.current = books;

  // --- coalesced metadata writes ---------------------------------------------
  const pendingRef = useRef(new Map<string, BookMeta>());
  const timerRef = useRef<number | null>(null);

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const batch = [...pendingRef.current.values()];
    pendingRef.current.clear();
    return saveMetaMany(batch).catch(err => console.error('Failed to save library changes', err));
  }, []);

  const scheduleSave = useCallback((meta: BookMeta) => {
    pendingRef.current.set(meta.id, meta);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void flush(); }, SAVE_DELAY_MS);
  }, [flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    const onPageHide = () => { void flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [flush]);

  useEffect(() => {
    let cancelled = false;
    loadAllMeta()
      .then(loaded => { if (!cancelled) setBooks(sortByRecent(loaded)); })
      .catch(err => console.error('Failed to load library', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // --- mutations ---------------------------------------------------------------
  /** Update a book's metadata. Accepts a full book too; its content is ignored. */
  const updateBook = useCallback((book: BookMeta | StoredBook) => {
    const { meta } = splitBook(book);
    setBooks(prev => prev.map(b => (b.id === meta.id ? meta : b)));
    booksRef.current = booksRef.current.map(b => (b.id === meta.id ? meta : b));
    scheduleSave(meta);
  }, [scheduleSave]);

  const patchBook = useCallback((id: string, patch: Partial<BookMeta>) => {
    const existing = booksRef.current.find(b => b.id === id);
    if (!existing) return;
    const { meta } = splitBook({ ...existing, ...patch } as BookMeta);
    updateBook(meta);
  }, [updateBook]);

  const removeBook = useCallback(async (id: string) => {
    pendingRef.current.delete(id);
    await deleteBook(id);
    setBooks(prev => prev.filter(b => b.id !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const b = booksRef.current.find(x => x.id === id);
    if (b) updateBook({ ...b, isFavorite: !b.isFavorite });
  }, [updateBook]);

  const assignCategory = useCallback((id: string, category: string | undefined) => {
    patchBook(id, { category });
  }, [patchBook]);

  const clearCategory = useCallback((category: string) => {
    booksRef.current.filter(b => b.category === category).forEach(b => updateBook({ ...b, category: undefined }));
  }, [updateBook]);

  const touch = useCallback((id: string) => patchBook(id, { lastRead: Date.now() }), [patchBook]);

  /** A book with its content, or null if it no longer exists. */
  const loadBook = useCallback(async (id: string): Promise<StoredBook | null> => {
    const meta = booksRef.current.find(b => b.id === id) || await loadMeta(id);
    if (!meta) return null;
    const content = await loadContent(id);
    if (content === undefined) return null;
    return { ...meta, content };
  }, []);

  const importFiles = useCallback(async (files: File[]): Promise<ImportResult[]> => {
    setImporting(true);
    const results: ImportResult[] = [];
    const keyOf = (title: string, type: string) => `${type}:${title.trim().toLowerCase()}`;
    const seen = new Set(booksRef.current.map(b => keyOf(b.title, b.fileType)));
    try {
      // Loaded on demand so the importers (and their parsers) stay out of the startup bundle.
      const { importFile } = await import('../utils/importers');
      for (const file of files) {
        try {
          const imported = await importFile(file);
          const key = keyOf(imported.title, imported.fileType);
          if (seen.has(key)) {
            results.push({ name: imported.title, status: 'duplicate' });
            continue;
          }
          seen.add(key);
          const totalTokens = imported.fileType === 'pdf'
            ? (imported.pageCount || 1)
            : Math.max(1, countWords(imported.text));
          const book: StoredBook = {
            id: crypto.randomUUID(),
            title: imported.title,
            author: imported.author,
            content: imported.text,
            fileType: imported.fileType,
            progress: 0,
            totalTokens,
            lastRead: Date.now(),
            isFavorite: false,
            coverUrl: imported.coverUrl,
            language: imported.language,
            highlights: [],
            drawings: [],
            bookmarks: []
          };
          await saveBookWithContent(book);
          const { meta } = splitBook(book);
          booksRef.current = [meta, ...booksRef.current];
          setBooks(prev => [meta, ...prev]);
          results.push({ name: book.title, status: 'added', book: meta });
        } catch (err) {
          console.error(`Failed to import ${file.name}`, err);
          results.push({ name: file.name, status: 'failed', error: err instanceof Error ? err.message : undefined });
        }
      }
    } catch (err) {
      console.error('Could not load importers', err);
      files.forEach(f => results.push({ name: f.name, status: 'failed', error: err instanceof Error ? err.message : undefined }));
    } finally {
      setImporting(false);
    }
    return results;
  }, []);

  const exportBackup = useCallback(async () => {
    await flush();
    const all = await loadAllBooks();
    const payload = { app: 'penko-reader', version: 3, exportedAt: Date.now(), books: all };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `penko-library-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoke after the download has started; revoking synchronously can cancel it in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [flush]);

  /** Merges a backup into the library. Returns the number of books restored, or throws with 'invalid'. */
  const restoreBackup = useCallback(async (file: File): Promise<number> => {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error('invalid');
    }
    const list: unknown = Array.isArray(data) ? data : (data as { books?: unknown })?.books;
    if (!Array.isArray(list)) throw new Error('invalid');
    const valid = list.filter((raw): raw is StoredBook =>
      Boolean(raw) && typeof raw === 'object' && typeof raw.id === 'string' && typeof raw.title === 'string' && typeof raw.content === 'string');
    await saveBooksWithContent(valid);
    const merged = new Map<string, BookMeta>(booksRef.current.map(b => [b.id, b] as const));
    valid.forEach(b => merged.set(b.id, splitBook(b).meta));
    const next = sortByRecent([...merged.values()]);
    booksRef.current = next;
    setBooks(next);
    return valid.length;
  }, []);

  return useMemo(() => ({
    books, loading, importing,
    updateBook, patchBook, removeBook, toggleFavorite, assignCategory, clearCategory, touch,
    loadBook, importFiles, exportBackup, restoreBackup, flush
  }), [books, loading, importing, updateBook, patchBook, removeBook, toggleFavorite, assignCategory, clearCategory, touch,
    loadBook, importFiles, exportBackup, restoreBackup, flush]);
};

export type Library = ReturnType<typeof useLibrary>;
