import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppView, BookMeta, LanguageCode, ReaderStatus, StoredBook } from './types';
import { fmt, getTranslation, loadTranslation } from './utils/translations';
import { ACCEPT_STRING } from './utils/formats';
import { stripHtml, tokenize } from './utils/tokenizer';
import { useSettings } from './hooks/useSettings';
import { useLibrary } from './hooks/useLibrary';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { useRsvpPlayer } from './hooks/useRsvpPlayer';
import AppShell from './components/layout/AppShell';
import SettingsDialog from './components/layout/SettingsDialog';
import Toasts, { Toast } from './components/ui/Toasts';
import { UploadIcon } from './components/ui/Icons';
import HomeView from './components/views/HomeView';
import LibraryView from './components/views/LibraryView';
import InstallModal from './components/InstallModal';
import ConfirmModal from './components/modals/ConfirmModal';
import BackupModal from './components/modals/BackupModal';
import BookDetailModal from './components/modals/BookDetailModal';
import { AddCategoryModal, AssignCategoryModal } from './components/modals/CategoryModals';

// Views and dialogs that are only needed after navigation load as separate chunks.
const ReaderView = lazy(() => import('./components/views/ReaderView'));
const TrainingView = lazy(() => import('./components/views/TrainingView'));
const BookReader = lazy(() => import('./components/BookReader'));
const DefinitionModal = lazy(() => import('./components/modals/DefinitionModal'));

const RESUME_KEY = 'penko-resume';
const RESUME_INDEX_KEY = 'penko-resume-index';
const RESUME_MAX_CHARS = 400_000;

interface ResumeState { text: string; lang: LanguageCode; index: number }

const readResume = (): ResumeState | null => {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.text !== 'string' || !parsed.text.trim()) return null;
    const storedIndex = Number(localStorage.getItem(RESUME_INDEX_KEY));
    const index = Number.isFinite(storedIndex) && storedIndex > 0 ? storedIndex : Number(parsed.index) || 0;
    return { text: parsed.text, lang: parsed.lang || 'en', index };
  } catch {
    return null;
  }
};

const saveResumeText = (text: string, lang: LanguageCode) => {
  try {
    if (text.trim() && text.length <= RESUME_MAX_CHARS) {
      localStorage.setItem(RESUME_KEY, JSON.stringify({ text, lang }));
      localStorage.setItem(RESUME_INDEX_KEY, '0');
    } else {
      localStorage.removeItem(RESUME_KEY);
      localStorage.removeItem(RESUME_INDEX_KEY);
    }
  } catch { /* quota exceeded: skip */ }
};

/** What the speed reader currently holds, so progress is saved to the right place. */
type RsvpSource = { kind: 'book'; id: string } | { kind: 'text' } | null;

const PageFallback = () => <div className="min-h-[40vh]" aria-hidden="true" />;
const ReaderFallback = () => <div className="fixed inset-0 z-50 bg-canvas" aria-hidden="true" />;

const App: React.FC = () => {
  const { settings, update } = useSettings();
  // English is bundled; other languages load on demand (index.tsx preloads the saved one before first paint).
  const [t, setT] = useState(() => getTranslation(settings.language));
  useEffect(() => {
    let cancelled = false;
    loadTranslation(settings.language).then(next => { if (!cancelled) setT(next); });
    return () => { cancelled = true; };
  }, [settings.language]);
  const library = useLibrary();
  const install = useInstallPrompt();

  const [view, setView] = useState<AppView>(settings.lastView);
  const [currentBookId, setCurrentBookId] = useState<string | null>(settings.lastView === 'book-reader' ? settings.lastBookId : null);
  const [openedBook, setOpenedBook] = useState<StoredBook | null>(null);
  const [rsvpBookId, setRsvpBookId] = useState<string | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [statsVersion, setStatsVersion] = useState(0);

  // Dialogs
  const [selectedBook, setSelectedBook] = useState<BookMeta | null>(null);
  const [bookToDelete, setBookToDelete] = useState<BookMeta | null>(null);
  const [bookToCategorize, setBookToCategorize] = useState<BookMeta | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isAddCategoryOpen, setAddCategoryOpen] = useState(false);
  const [isBackupOpen, setBackupOpen] = useState(false);
  const [isInstallOpen, setInstallOpen] = useState(false);
  const [defineWord, setDefineWord] = useState<string | null>(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragging, setDragging] = useState(false);
  const toastId = useRef(0);
  const toastTimers = useRef(new Set<number>());
  const importInputRef = useRef<HTMLInputElement>(null);
  const openRequest = useRef(0);
  const rsvpRequest = useRef(0);
  const rsvpSource = useRef<RsvpSource>(null);

  // --- RSVP engine ----------------------------------------------------------
  const player = useRsvpPlayer({ initialWpm: settings.wpm, pauseOnPunctuation: settings.pauseOnPunctuation, chunkSize: settings.chunkSize });
  const { setWpm, load: playerLoad, loadTokens, pause: playerPause, clear: playerClear } = player;
  useEffect(() => { setWpm(settings.wpm); }, [settings.wpm, setWpm]);

  const currentBook = useMemo(() => library.books.find(b => b.id === currentBookId) || null, [library.books, currentBookId]);
  const rsvpBook = useMemo(() => library.books.find(b => b.id === rsvpBookId) || null, [library.books, rsvpBookId]);

  // --- notifications --------------------------------------------------------
  const pushToasts = useCallback((items: Omit<Toast, 'id'>[]) => {
    const next = items.map(i => ({ ...i, id: ++toastId.current }));
    setToasts(prev => [...prev, ...next].slice(-5));
    next.forEach(n => {
      const timer = window.setTimeout(() => {
        toastTimers.current.delete(timer);
        setToasts(prev => prev.filter(x => x.id !== n.id));
      }, n.kind === 'error' ? 9000 : 4500);
      toastTimers.current.add(timer);
    });
  }, []);
  useEffect(() => {
    const timers = toastTimers.current;
    return () => timers.forEach(id => window.clearTimeout(id));
  }, []);

  // --- navigation -----------------------------------------------------------
  const navigate = useCallback((next: AppView) => {
    if (next !== 'reader') playerPause();
    setView(next);
    window.scrollTo({ top: 0 });
  }, [playerPause]);

  // Restore pasted text from the previous visit (once).
  useEffect(() => {
    const saved = readResume();
    if (!saved) return;
    rsvpSource.current = { kind: 'text' };
    setResumeText(saved.text);
    playerLoad(saved.text, saved.lang, saved.index);
    update({ contentLanguage: saved.lang });
  }, [playerLoad, update]);

  /** Load a book's content into the paged reader. */
  const loadIntoReader = useCallback((id: string) => {
    const request = ++openRequest.current;
    setOpenedBook(null);
    library.loadBook(id).then(book => {
      if (request !== openRequest.current) return;
      if (book) {
        setOpenedBook(book);
      } else {
        setCurrentBookId(null);
        setView('library');
      }
    }).catch(err => {
      console.error('Could not open book', err);
      if (request !== openRequest.current) return;
      setCurrentBookId(null);
      setView('library');
    });
  }, [library.loadBook]);

  // After a reload, reopen the book that was on screen (or fall back to home if it's gone).
  const reopenedRef = useRef(false);
  useEffect(() => {
    if (library.loading || reopenedRef.current) return;
    reopenedRef.current = true;
    if (view !== 'book-reader') return;
    if (currentBookId && library.books.some(b => b.id === currentBookId)) loadIntoReader(currentBookId);
    else { setCurrentBookId(null); setView('home'); }
  }, [library.loading, library.books, view, currentBookId, loadIntoReader]);

  // Persist where we are.
  useEffect(() => { update({ lastView: view, lastBookId: currentBookId }); }, [view, currentBookId, update]);

  // Persist the RSVP position whenever reading pauses or finishes.
  const { status: rsvpStatus, rawIndex, rawTokens } = player;
  const libraryRef = useRef(library);
  libraryRef.current = library;
  useEffect(() => {
    const source = rsvpSource.current;
    if (!source || rsvpStatus === ReaderStatus.PLAYING || rawTokens.length === 0) return;
    if (source.kind === 'book') {
      const lib = libraryRef.current;
      const meta = lib.books.find(b => b.id === source.id);
      if (!meta) return;
      // Stored in the book's own word-count scale so it's comparable with paged progress.
      const done = rsvpStatus === ReaderStatus.COMPLETED;
      const scaled = done ? meta.totalTokens : Math.round((rawIndex / rawTokens.length) * meta.totalTokens);
      if (scaled !== meta.rsvpProgress) lib.patchBook(meta.id, { rsvpProgress: scaled, lastRead: Date.now() });
      return;
    }
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(RESUME_INDEX_KEY, String(rawIndex)); } catch { /* ignore */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [rsvpStatus, rawIndex, rawTokens]);

  const openBook = useCallback((book: BookMeta) => {
    setSelectedBook(null);
    setCurrentBookId(book.id);
    library.touch(book.id);
    loadIntoReader(book.id);
    navigate('book-reader');
  }, [library, loadIntoReader, navigate]);

  const handleBookUpdate = useCallback((book: StoredBook) => {
    setOpenedBook(book);
    library.updateBook(book);
  }, [library]);

  const speedReadBook = useCallback(async (meta: BookMeta) => {
    const request = ++rsvpRequest.current;
    setSelectedBook(null);
    setRsvpBookId(meta.id);
    setLoadingBook(true);
    navigate('reader');
    try {
      const book = await library.loadBook(meta.id);
      if (!book) throw new Error('Book not found');
      let text: string;
      if (book.fileType === 'pdf') {
        const { extractPdfText } = await import('./utils/importers');
        text = await extractPdfText(book.content);
      } else {
        text = stripHtml(book.content);
      }
      if (request !== rsvpRequest.current) return;
      const lang = book.language || settings.contentLanguage;
      update(s => ({ contentLanguage: lang, verticalMode: lang === 'ja' || lang === 'zh' ? s.verticalMode : false }));
      const tokens = tokenize(text, lang);
      const ratio = book.rsvpProgress && book.totalTokens && book.rsvpProgress < book.totalTokens ? book.rsvpProgress / book.totalTokens : 0;
      rsvpSource.current = { kind: 'book', id: book.id };
      loadTokens(tokens, lang, Math.round(ratio * tokens.length));
      library.touch(book.id);
    } catch (err) {
      console.error('Could not prepare book for speed reading', err);
      if (request !== rsvpRequest.current) return;
      setRsvpBookId(null);
      pushToasts([{ kind: 'error', text: fmt(t.importFailed, { name: meta.title }) }]);
    } finally {
      if (request === rsvpRequest.current) setLoadingBook(false);
    }
  }, [navigate, library, settings.contentLanguage, update, loadTokens, pushToasts, t]);

  const handleContentReady = useCallback((text: string, lang: LanguageCode) => {
    ++rsvpRequest.current; // cancel any book that is still loading
    setLoadingBook(false);
    setRsvpBookId(null);
    setResumeText(text);
    rsvpSource.current = { kind: 'text' };
    saveResumeText(text, lang);
    update(s => ({ contentLanguage: lang, verticalMode: lang === 'ja' || lang === 'zh' ? s.verticalMode : false }));
    playerLoad(text, lang, 0);
  }, [playerLoad, update]);

  const openReader = useCallback(() => navigate('reader'), [navigate]);

  const continueBook = useCallback((book: BookMeta) => {
    if (book.fileType !== 'pdf' && (book.rsvpProgress || 0) > (book.progress || 0)) speedReadBook(book);
    else openBook(book);
  }, [openBook, speedReadBook]);

  const definitionLanguage: LanguageCode =
    view === 'book-reader' ? (openedBook?.language || settings.contentLanguage)
    : view === 'reader' && rawTokens.length > 0 ? player.language
    : settings.contentLanguage;

  const isRsvpReading = view === 'reader' && rsvpStatus !== ReaderStatus.IDLE && player.tokens.length > 0;
  const bookPending = view === 'book-reader' && Boolean(currentBookId) && (library.loading || Boolean(currentBook));
  const immersive = bookPending || isRsvpReading;
  const showInstall = !install.isStandalone && (install.canPrompt || install.isMobile);

  const handleInstall = async () => {
    const prompted = await install.promptInstall();
    if (!prompted) setInstallOpen(true);
  };

  // --- import ---------------------------------------------------------------
  const importFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const results = await library.importFiles(files);
    const added = results.filter(r => r.status === 'added');
    const items: Omit<Toast, 'id'>[] = [];
    if (added.length === 1) items.push({ kind: 'ok', text: `${t.saved}: ${added[0].name}` });
    else if (added.length > 1) items.push({ kind: 'ok', text: `${t.saved}: ${fmt(t.booksCount, { count: added.length })}` });
    results.filter(r => r.status === 'duplicate').forEach(r => items.push({ kind: 'warn', text: fmt(t.duplicateSkipped, { name: r.name }) }));
    results.filter(r => r.status === 'failed').forEach(r => items.push({ kind: 'error', text: `${fmt(t.importFailed, { name: r.name })}${r.error ? ` (${r.error})` : ''}` }));
    pushToasts(items);
  }, [library, pushToasts, t]);

  // Drop files anywhere (outside the immersive readers) to import them.
  const dropRef = useRef({ importFiles, navigate, view });
  dropRef.current = { importFiles, navigate, view };
  useEffect(() => {
    if (immersive) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDragging(true); };
    const onOver = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      const { importFiles: doImport, navigate: go, view: current } = dropRef.current;
      doImport(files);
      if (current !== 'library') go('library');
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('drop', onDrop);
      setDragging(false);
    };
  }, [immersive]);

  const libraryView = (
    <LibraryView
      t={t}
      language={settings.language}
      books={library.books}
      categories={settings.categories}
      importing={library.importing}
      layout={settings.libraryLayout}
      sort={settings.librarySort}
      onLayoutChange={(libraryLayout) => update({ libraryLayout })}
      onSortChange={(librarySort) => update({ librarySort })}
      onSelectBook={setSelectedBook}
      onImportFiles={importFiles}
      onOpenBackup={() => setBackupOpen(true)}
      onAddCategory={() => setAddCategoryOpen(true)}
      onDeleteCategory={setCategoryToDelete}
    />
  );

  const bookReaderBody = openedBook && openedBook.id === currentBookId ? (
    <Suspense fallback={<ReaderFallback />}>
      <BookReader
        key={openedBook.id}
        book={openedBook}
        onBack={() => { setOpenedBook(null); navigate('library'); }}
        onUpdateBook={handleBookUpdate}
        t={t}
        onDefine={settings.clickToDefine ? setDefineWord : undefined}
      />
    </Suspense>
  ) : bookPending ? <ReaderFallback /> : libraryView;

  return (
    <div className={settings.dyslexicMode ? 'font-dyslexic' : ''}>
      <AppShell t={t} view={view} immersive={immersive} onNavigate={(v) => (v === 'reader' ? openReader() : navigate(v))} onOpenSettings={() => setSettingsOpen(true)}>
        {view === 'home' && (
          <HomeView
            t={t}
            language={settings.language}
            books={library.books}
            statsVersion={statsVersion}
            onContinue={continueBook}
            onSpeedRead={speedReadBook}
            onSelectBook={setSelectedBook}
            onOpenLibrary={() => navigate('library')}
            onOpenReader={openReader}
            onOpenTraining={() => navigate('training')}
            onImportClick={() => importInputRef.current?.click()}
          />
        )}

        {view === 'library' && libraryView}

        {view === 'reader' && (
          <Suspense fallback={<PageFallback />}>
            <ReaderView
              t={t}
              settings={settings}
              update={update}
              player={player}
              currentBook={rsvpBook}
              loadingBook={loadingBook}
              resumeText={resumeText}
              onBack={() => navigate(rsvpBook ? 'library' : 'home')}
              onContentReady={handleContentReady}
              onDefine={setDefineWord}
              onSessionSaved={() => setStatsVersion(v => v + 1)}
            />
          </Suspense>
        )}

        {view === 'training' && (
          <Suspense fallback={<PageFallback />}>
            <TrainingView
              t={t}
              contentLanguage={settings.contentLanguage}
              fontSize={settings.fontSize}
              dyslexicMode={settings.dyslexicMode}
              pauseOnPunctuation={settings.pauseOnPunctuation}
              onBack={() => navigate('home')}
              onSessionSaved={() => setStatsVersion(v => v + 1)}
            />
          </Suspense>
        )}

        {view === 'book-reader' && bookReaderBody}
      </AppShell>

      <input ref={importInputRef} type="file" className="hidden" multiple accept={ACCEPT_STRING}
        onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length) { importFiles(files); navigate('library'); } }} />

      {dragging && (
        <div className="fixed inset-0 z-[120] bg-canvas/85 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none animate-in fade-in duration-150">
          <div className="border-2 border-dashed border-accent rounded-2xl px-10 py-12 flex flex-col items-center gap-3 text-center bg-surface shadow-lift">
            <UploadIcon size={32} className="text-accent" />
            <p className="text-base font-medium text-ink">{t.dropToImport}</p>
            <p className="hint">{t.supportedFormats}</p>
          </div>
        </div>
      )}

      <Toasts toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(x => x.id !== id))} />

      {/* ---------------------------------------------------------- dialogs */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        t={t}
        theme={settings.theme}
        language={settings.language}
        globalFontSize={settings.globalFontSize}
        dyslexicMode={settings.dyslexicMode}
        showInstall={showInstall}
        onThemeChange={(theme) => update({ theme })}
        onLanguageChange={(language) => update({ language })}
        onGlobalFontSizeChange={(globalFontSize) => update({ globalFontSize })}
        onToggleDyslexic={() => update(s => ({ dyslexicMode: !s.dyslexicMode }))}
        onInstall={handleInstall}
      />

      <BookDetailModal
        book={selectedBook}
        t={t}
        language={settings.language}
        onClose={() => setSelectedBook(null)}
        onOpen={openBook}
        onSpeedRead={speedReadBook}
        onToggleFavorite={(book) => { library.toggleFavorite(book.id); setSelectedBook({ ...book, isFavorite: !book.isFavorite }); }}
        onCategory={(book) => { setSelectedBook(null); setBookToCategorize(book); }}
        onDelete={(book) => { setSelectedBook(null); setBookToDelete(book); }}
      />

      <ConfirmModal
        isOpen={Boolean(bookToDelete)}
        title={t.deleteConfirmTitle}
        message={bookToDelete ? `${bookToDelete.title}. ${t.deleteConfirmMessage}` : ''}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        onCancel={() => setBookToDelete(null)}
        onConfirm={async () => {
          if (!bookToDelete) return;
          await library.removeBook(bookToDelete.id);
          if (currentBookId === bookToDelete.id) { setCurrentBookId(null); setOpenedBook(null); }
          if (rsvpBookId === bookToDelete.id) { setRsvpBookId(null); rsvpSource.current = null; playerClear(); }
          setBookToDelete(null);
        }}
      />

      <ConfirmModal
        isOpen={Boolean(categoryToDelete)}
        title={t.deleteCategory}
        message={categoryToDelete ? `${categoryToDelete}. ${t.deleteCategoryConfirm}` : ''}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        onCancel={() => setCategoryToDelete(null)}
        onConfirm={() => {
          if (!categoryToDelete) return;
          library.clearCategory(categoryToDelete);
          update(s => ({ categories: s.categories.filter(c => c !== categoryToDelete) }));
          setCategoryToDelete(null);
        }}
      />

      <AssignCategoryModal
        isOpen={Boolean(bookToCategorize)}
        t={t}
        categories={settings.categories}
        currentCategory={bookToCategorize?.category}
        onAssign={(category) => { if (bookToCategorize) library.assignCategory(bookToCategorize.id, category); setBookToCategorize(null); }}
        onCreateNew={() => { setBookToCategorize(null); setAddCategoryOpen(true); }}
        onClose={() => setBookToCategorize(null)}
      />

      <AddCategoryModal
        isOpen={isAddCategoryOpen}
        t={t}
        existing={settings.categories}
        onAdd={(name) => update(s => ({ categories: [...s.categories, name] }))}
        onClose={() => setAddCategoryOpen(false)}
      />

      <BackupModal
        isOpen={isBackupOpen}
        t={t}
        onExport={library.exportBackup}
        onRestore={library.restoreBackup}
        onClose={() => setBackupOpen(false)}
      />

      <InstallModal isOpen={isInstallOpen} onClose={() => setInstallOpen(false)} t={t} />

      {defineWord !== null && (
        <Suspense fallback={null}>
          <DefinitionModal
            word={defineWord}
            language={definitionLanguage}
            onClose={() => setDefineWord(null)}
            t={t}
            allowOnline={settings.onlineDictionary}
            onEnableOnline={() => update({ onlineDictionary: true })}
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;
