import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Drawing, Highlight, StoredBook, Translation } from '../types';
import { stripHtml } from '../utils/tokenizer';
import { AnnotationTool, PAGE_THEMES, useReaderPrefs } from './reader/pageThemes';
import { processContent } from './reader/processContent';
import PagedText, { PageChangeReason, PagedTextHandle } from './reader/PagedText';
import PdfView from './reader/PdfView';
import { BottomBar, TopBar } from './reader/ReaderChrome';
import SettingsPopover from './reader/SettingsPopover';
import ReaderSidebar, { SidebarTab } from './reader/ReaderSidebar';
import { splitSentences } from './reader/readerUtils';
import { useReadAloud } from './reader/useReadAloud';

interface BookReaderProps {
  book: StoredBook;
  onBack: () => void;
  onUpdateBook: (book: StoredBook) => void;
  t: Translation;
  onDefine?: (word: string) => void;
}

const EMPTY_HIGHLIGHTS: Highlight[] = [];
const EMPTY_DRAWINGS: Drawing[] = [];
const EMPTY_BOOKMARKS: Bookmark[] = [];
const PROGRESS_DEBOUNCE_MS = 600;
/** How much text to queue for read-aloud at once (~5 hours of speech). */
const READ_ALOUD_WINDOW = 300_000;

/**
 * The full-screen book reader. Orchestrates page state, progress saving, bookmarks and
 * read-aloud; rendering lives in reader/PagedText (EPUB, text, …) and reader/PdfView.
 */
const BookReader: React.FC<BookReaderProps> = ({ book, onBack, onUpdateBook, t, onDefine }) => {
  const isPdf = book.fileType === 'pdf';

  // Always-current references so callbacks can stay stable (keeps PagedText from re-rendering).
  const bookRef = useRef(book);
  bookRef.current = book;
  const updateRef = useRef(onUpdateBook);
  updateRef.current = onUpdateBook;
  const defineRef = useRef(onDefine);
  defineRef.current = onDefine;

  const { prefs, setPref } = useReaderPrefs();
  const theme = PAGE_THEMES[prefs.readerTheme];

  // --- chrome ------------------------------------------------------------------
  const [showControls, setShowControls] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sideTab, setSideTab] = useState<SidebarTab>('toc');
  const [showSettings, setShowSettings] = useState(false);

  // --- position ----------------------------------------------------------------
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(-1);
  const pageRef = useRef(page);
  pageRef.current = page;
  const totalRef = useRef(total);
  totalRef.current = total;

  // --- PDF ---------------------------------------------------------------------
  const [scale, setScale] = useState<number | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('none');
  const [error, setError] = useState<string | null>(null);

  const readAloud = useReadAloud();
  const readAloudRef = useRef(readAloud);
  readAloudRef.current = readAloud;

  const pagedRef = useRef<PagedTextHandle>(null);

  // Sanitised HTML + table of contents, cached per book.
  const content = useMemo(() => (isPdf ? null : processContent(book.id, book.content)), [isPdf, book.id, book.content]);
  // Where to open: read once per book so later progress saves don't move the page.
  const initialFraction = useMemo(
    () => (book.totalTokens > 0 && book.progress > 0 ? Math.min(1, Math.max(0, book.progress / book.totalTokens)) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book.id]
  );

  // Reset per-book state when a different book is opened in the same reader instance.
  // (Not on mount: the text view has already reported its opening page by then.)
  const openedBookId = useRef(book.id);
  useEffect(() => {
    if (openedBookId.current === book.id) return;
    openedBookId.current = book.id;
    setPage(1);
    setTotal(0);
    setChapterIndex(-1);
    setScale(null);
    setTool('none');
    setError(null);
    readAloudRef.current.stop();
  }, [book.id]);

  // --- progress saving -----------------------------------------------------------
  const pendingProgress = useRef<number | null>(null);
  const progressTimer = useRef<number | null>(null);

  const flushProgress = useCallback(() => {
    if (progressTimer.current) window.clearTimeout(progressTimer.current);
    progressTimer.current = null;
    const progress = pendingProgress.current;
    pendingProgress.current = null;
    if (progress !== null && progress !== bookRef.current.progress) {
      updateRef.current({ ...bookRef.current, progress, lastRead: Date.now() });
    }
  }, []);

  const queueProgress = useCallback((progress: number) => {
    pendingProgress.current = progress;
    if (progressTimer.current) window.clearTimeout(progressTimer.current);
    progressTimer.current = window.setTimeout(flushProgress, PROGRESS_DEBOUNCE_MS);
  }, [flushProgress]);

  // Save the last position when leaving, instead of dropping a pending save.
  useEffect(() => flushProgress, [flushProgress]);

  const handleTextPageChange = useCallback((p: number, tot: number, chapter: number, reason: PageChangeReason) => {
    setPage(p);
    setTotal(tot);
    setChapterIndex(chapter);
    // Re-pagination (font size, resize, images) must not rewrite progress: that would drift the position.
    if (reason !== 'nav') return;
    const fraction = tot > 1 ? (p - 1) / (tot - 1) : 0;
    queueProgress(Math.floor(fraction * bookRef.current.totalTokens));
  }, [queueProgress]);

  // --- navigation ------------------------------------------------------------------
  const stopReading = useCallback(() => readAloudRef.current.stop(), []);

  const goTo = useCallback((target: number) => {
    stopReading();
    if (!isPdf) {
      pagedRef.current?.goTo(target);
      return;
    }
    const p = Math.min(Math.max(1, totalRef.current), Math.max(1, Math.round(target)));
    if (p === pageRef.current) return;
    setPage(p);
    queueProgress(p); // for PDFs, progress = page number
  }, [isPdf, queueProgress, stopReading]);

  const turn = useCallback((direction: 'next' | 'prev') => {
    goTo(pageRef.current + (direction === 'next' ? 1 : -1));
  }, [goTo]);

  const toggleChrome = useCallback(() => {
    setShowControls(v => !v);
    setShowSettings(false);
  }, []);

  const handleDefine = useCallback((word: string) => defineRef.current?.(word), []);

  const handleBack = useCallback(() => {
    stopReading();
    flushProgress();
    onBack();
  }, [flushProgress, onBack, stopReading]);

  // --- PDF callbacks -----------------------------------------------------------------
  const handlePdfLoaded = useCallback((numPages: number) => {
    setError(null);
    setTotal(numPages);
    setPage(Math.min(numPages, Math.max(1, Math.floor(bookRef.current.progress) || 1)));
    // Keep library progress meaningful: for PDFs, progress = page, total = page count.
    if (bookRef.current.totalTokens !== numPages) updateRef.current({ ...bookRef.current, totalTokens: numPages });
  }, []);

  const handleAnnotations = useCallback((patch: { highlights?: Highlight[]; drawings?: Drawing[] }) => {
    const next = { ...bookRef.current };
    if (patch.highlights) next.highlights = patch.highlights;
    if (patch.drawings) next.drawings = patch.drawings;
    updateRef.current(next);
  }, []);

  // --- bookmarks -----------------------------------------------------------------------
  const storedBookmarks = book.bookmarks || EMPTY_BOOKMARKS;
  // Text books: map each bookmark's saved position onto the current pagination.
  const bookmarks = useMemo<Bookmark[]>(() => {
    if (isPdf || total < 1) return storedBookmarks;
    return storedBookmarks
      .map(b => (b.fraction === undefined ? b : { ...b, page: Math.min(total, Math.max(1, Math.round(b.fraction * Math.max(0, total - 1)) + 1)) }))
      .sort((a, b) => a.page - b.page);
  }, [storedBookmarks, total, isPdf]);
  const bookmarksRef = useRef(bookmarks);
  bookmarksRef.current = bookmarks;
  const bookmarked = bookmarks.some(b => b.page === page);

  const toggleBookmark = useCallback(() => {
    const current = bookRef.current;
    const p = pageRef.current;
    const list = current.bookmarks || [];
    const existing = bookmarksRef.current.filter(b => b.page === p).map(b => b.id);
    if (existing.length > 0) {
      updateRef.current({ ...current, bookmarks: list.filter(b => !existing.includes(b.id)) });
      return;
    }
    const tot = totalRef.current;
    const label = (!isPdf && pagedRef.current?.snippet()) || `${t.page} ${p}`;
    const bookmark: Bookmark = {
      id: crypto.randomUUID(),
      page: p,
      ...(isPdf ? {} : { fraction: tot > 1 ? (p - 1) / (tot - 1) : 0 }),
      label,
      createdAt: Date.now()
    };
    updateRef.current({ ...current, bookmarks: [...list, bookmark] });
  }, [isPdf, t.page]);

  const removeBookmark = useCallback((id: string) => {
    const current = bookRef.current;
    updateRef.current({ ...current, bookmarks: (current.bookmarks || []).filter(b => b.id !== id) });
  }, []);

  // --- read aloud --------------------------------------------------------------------
  const plainTextRef = useRef<{ html: string; text: string } | null>(null);

  const startReadAloud = () => {
    if (!content) return;
    if (plainTextRef.current?.html !== content.html) {
      plainTextRef.current = { html: content.html, text: content.isHtml ? stripHtml(content.html) : content.html };
    }
    const text = plainTextRef.current.text;
    const fraction = pagedRef.current?.fraction() ?? 0;
    let startChar = Math.floor(fraction * text.length);
    if (startChar > 0) {
      // Start at the next sentence boundary so speech never begins mid-sentence.
      const rest = text.slice(startChar, startChar + 2000);
      const m = rest.search(/[.!?。！？]["'”’)\]]*\s/);
      if (m >= 0) startChar += m + 1;
    }
    const sentences = splitSentences(text.slice(startChar, startChar + READ_ALOUD_WINDOW));
    if (sentences.length === 0) return;
    const lang = book.language || document.documentElement.lang || navigator.language;
    readAloud.start(sentences, { rate: prefs.ttsRate, lang });
  };

  // --- keyboard (bound once; reads the latest state through a ref) -------------------
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    // A dialog (e.g. the dictionary) is on top of the reader: leave its keys alone.
    if (document.querySelector('[aria-modal="true"]')) return;
    switch (e.key) {
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        turn('prev');
        break;
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        turn('next');
        break;
      case 'b':
      case 'B':
        toggleBookmark();
        break;
      case 'Escape':
        if (showSidebar) setShowSidebar(false);
        else if (showSettings) setShowSettings(false);
        else if (tool !== 'none') setTool('none');
        else handleBack();
        break;
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const canReadAloud = !isPdf && readAloud.supported;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-canvas text-ink transition-colors duration-300" style={theme.style}>
      <TopBar
        t={t}
        title={book.title}
        visible={showControls}
        isPdf={isPdf}
        bookmarked={bookmarked}
        tool={tool}
        settingsOpen={showSettings}
        onOpenSidebar={() => { setShowSidebar(true); setShowSettings(false); }}
        onBack={handleBack}
        onToggleBookmark={toggleBookmark}
        onToolChange={setTool}
        onToggleSettings={() => setShowSettings(v => !v)}
      >
        {showSettings && (
          <SettingsPopover
            t={t}
            prefs={prefs}
            setPref={setPref}
            isPdf={isPdf}
            scale={scale ?? 1}
            onScaleChange={setScale}
            canReadAloud={canReadAloud}
            onReadAloudRate={readAloud.setRate}
            onClose={() => setShowSettings(false)}
          />
        )}
      </TopBar>

      <ReaderSidebar
        t={t}
        open={showSidebar}
        tab={sideTab}
        toc={content?.toc || []}
        chapterIndex={chapterIndex}
        bookmarks={bookmarks}
        currentPage={page}
        onTabChange={setSideTab}
        onSelectChapter={(index) => {
          stopReading();
          pagedRef.current?.goToChapter(index);
          setShowSidebar(false);
          setShowControls(false);
        }}
        onSelectBookmark={(p) => { goTo(p); setShowSidebar(false); }}
        onRemoveBookmark={removeBookmark}
        onClose={() => setShowSidebar(false)}
      />

      {isPdf ? (
        <PdfView
          bookId={book.id}
          content={book.content}
          page={page}
          scale={scale}
          onScaleChange={setScale}
          tool={tool}
          highlightColor={prefs.highlightColor}
          highlights={book.highlights || EMPTY_HIGHLIGHTS}
          drawings={book.drawings || EMPTY_DRAWINGS}
          onLoaded={handlePdfLoaded}
          onError={setError}
          onAnnotationsChange={handleAnnotations}
          onTap={toggleChrome}
          onSwipe={turn}
          backdrop={theme.pdfBackdrop}
          error={error}
          errorTitle={t.pdfLoadError}
        />
      ) : content && (
        <PagedText
          ref={pagedRef}
          content={content}
          fontSize={prefs.fontSize}
          lineHeight={prefs.lineHeight}
          fontFamily={prefs.fontFamily}
          marginSize={prefs.marginSize}
          initialFraction={initialFraction}
          onPageChange={handleTextPageChange}
          onUserNavigate={stopReading}
          onTap={toggleChrome}
          onDefine={onDefine ? handleDefine : undefined}
        />
      )}

      <BottomBar
        t={t}
        visible={showControls}
        page={page}
        total={total}
        canReadAloud={canReadAloud}
        speaking={readAloud.speaking}
        onPrev={() => turn('prev')}
        onNext={() => turn('next')}
        onGoTo={goTo}
        onToggleReadAloud={() => (readAloud.speaking ? readAloud.stop() : startReadAloud())}
      />
    </div>
  );
};

export default BookReader;
