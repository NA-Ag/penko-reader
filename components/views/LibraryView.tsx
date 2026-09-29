import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { BookMeta, LanguageCode, Translation } from '../../types';
import { fmt } from '../../utils/translations';
import { ACCEPT_STRING } from '../../utils/formats';
import { PenkoMascot } from '../PenkoMascot';
import BookCover from '../library/BookCover';
import { formatLabel, progressPercent, relativeTime } from '../library/bookVisuals';
import { CloseIcon, DownloadIcon, GridIcon, PlusIcon, RowsIcon, SearchIcon, SpinnerIcon, StarIcon } from '../ui/Icons';

export type LibrarySort = 'recent' | 'title' | 'author' | 'progress';
export type LibraryLayout = 'grid' | 'list';

interface LibraryViewProps {
  t: Translation;
  language: LanguageCode;
  books: BookMeta[];
  categories: string[];
  importing: boolean;
  layout: LibraryLayout;
  sort: LibrarySort;
  onLayoutChange: (layout: LibraryLayout) => void;
  onSortChange: (sort: LibrarySort) => void;
  onSelectBook: (book: BookMeta) => void;
  onImportFiles: (files: File[]) => void;
  onOpenBackup: () => void;
  onAddCategory: () => void;
  onDeleteCategory: (category: string) => void;
}

type Filter = { kind: 'all' } | { kind: 'favorites' } | { kind: 'uncategorized' } | { kind: 'category'; name: string };
const sameFilter = (a: Filter, b: Filter) => a.kind === b.kind && (a.kind !== 'category' || a.name === (b as { name: string }).name);

/** A book plus values derived once per library change, so search and sort stay cheap. */
interface Row { book: BookMeta; haystack: string; pct: number }

const collators = new Map<string, Intl.Collator>();
const collatorFor = (lang: string) => {
  let c = collators.get(lang);
  if (!c) { c = new Intl.Collator(lang, { sensitivity: 'base', numeric: true }); collators.set(lang, c); }
  return c;
};

/** Your books as a cover grid (or a compact list), with search, sort and shelves. */
const LibraryView: React.FC<LibraryViewProps> = ({
  t, language, books, categories, importing, layout, sort, onLayoutChange, onSortChange,
  onSelectBook, onImportFiles, onOpenBackup, onAddCategory, onDeleteCategory
}) => {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });

  // If the selected category disappears (deleted here or elsewhere), fall back to "All".
  useEffect(() => {
    if (filter.kind === 'category' && !categories.includes(filter.name)) setFilter({ kind: 'all' });
  }, [categories, filter]);

  const rows = useMemo<Row[]>(() => books.map(book => ({
    book,
    haystack: `${book.title}\u0000${book.author || ''}`.toLocaleLowerCase(language),
    pct: progressPercent(book)
  })), [books, language]);

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLocaleLowerCase(language);
    const collator = collatorFor(language);
    const filtered = rows.filter(({ book, haystack }) => {
      if (q && !haystack.includes(q)) return false;
      switch (filter.kind) {
        case 'favorites': return Boolean(book.isFavorite);
        case 'uncategorized': return !book.category;
        case 'category': return book.category === filter.name;
        default: return true;
      }
    });
    const byTitle = (a: Row, b: Row) => collator.compare(a.book.title, b.book.title);
    return filtered.sort((a, b) => {
      switch (sort) {
        case 'title': return byTitle(a, b);
        case 'author': {
          // Books without an author go last.
          if (!a.book.author !== !b.book.author) return a.book.author ? -1 : 1;
          return collator.compare(a.book.author || '', b.book.author || '') || byTitle(a, b);
        }
        case 'progress': return b.pct - a.pct || b.book.lastRead - a.book.lastRead;
        default: return b.book.lastRead - a.book.lastRead;
      }
    });
  }, [rows, deferredQuery, filter, sort, language]);

  const handleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) onImportFiles(files);
  }, [onImportFiles]);

  // A plain element (not an inner component) so the file input isn't remounted every render.
  const importButton = (
    <label className={`btn btn-primary cursor-pointer focus-within:ring-2 focus-within:ring-accent/40 focus-within:ring-offset-2 focus-within:ring-offset-canvas ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
      {importing ? <SpinnerIcon size={16} /> : <PlusIcon size={16} />}
      {importing ? t.importing : t.importBooks}
      <input type="file" className="sr-only" multiple accept={ACCEPT_STRING} disabled={importing} onChange={handleFiles} />
    </label>
  );

  // ---------------------------------------------------------------- empty
  if (books.length === 0) {
    return (
      <div className="animate-in fade-in duration-300">
        <h1 className="display text-3xl">{t.library}</h1>
        <div className="mt-10 border-2 border-dashed border-line rounded-2xl p-10 sm:p-16 flex flex-col items-center text-center gap-4">
          <PenkoMascot size={80} pose="talk" />
          <h2 className="display text-2xl">{t.emptyLibraryTitle}</h2>
          <p className="text-sm text-ink-soft max-w-md leading-relaxed">{t.emptyLibraryDesc}</p>
          <div className="mt-2">{importButton}</div>
          <p className="hint">{t.dropToImport} · {t.supportedFormats}</p>
          <button onClick={onOpenBackup} className="btn btn-ghost btn-sm">{t.backupRestoreBtn}</button>
        </div>
      </div>
    );
  }

  const staticFilters: { f: Filter; label: React.ReactNode }[] = [
    { f: { kind: 'all' }, label: t.allBooks },
    { f: { kind: 'favorites' }, label: <><StarIcon size={13} filled /> {t.favorites}</> },
    { f: { kind: 'uncategorized' }, label: t.uncategorized },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl">{t.library}</h1>
          <p className="text-sm text-muted mt-1 tabular">{fmt(t.booksCount, { count: books.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenBackup} className="btn btn-secondary btn-icon" title={t.backupModalTitle} aria-label={t.backupModalTitle}>
            <DownloadIcon size={18} />
          </button>
          {importButton}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} className="input pl-9" aria-label={t.search} />
        </div>
        <select value={sort} onChange={(e) => onSortChange(e.target.value as LibrarySort)} className="input flex-1 sm:flex-none sm:w-auto" aria-label={t.sortBy}>
          <option value="recent">{t.sortRecent}</option>
          <option value="title">{t.sortTitle}</option>
          <option value="author">{t.author}</option>
          <option value="progress">{t.progress}</option>
        </select>
        <div className="segmented" role="group" aria-label={`${t.gridView} / ${t.listView}`}>
          <button aria-pressed={layout === 'grid'} onClick={() => onLayoutChange('grid')} title={t.gridView} aria-label={t.gridView}><GridIcon size={16} /></button>
          <button aria-pressed={layout === 'list'} onClick={() => onLayoutChange('list')} title={t.listView} aria-label={t.listView}><RowsIcon size={16} /></button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" role="group" aria-label={t.category}>
        {staticFilters.map(({ f, label }) => (
          <button key={f.kind} onClick={() => setFilter(f)} aria-pressed={sameFilter(filter, f)} className={`chip ${sameFilter(filter, f) ? 'chip-active' : ''}`}>{label}</button>
        ))}
        {categories.map(cat => {
          const f: Filter = { kind: 'category', name: cat };
          const active = sameFilter(filter, f);
          return (
            <span key={cat} className={`chip pr-1 ${active ? 'chip-active' : ''}`}>
              <button onClick={() => setFilter(f)} aria-pressed={active} className="max-w-[12rem] truncate">{cat}</button>
              <button
                onClick={() => onDeleteCategory(cat)}
                className={`w-5 h-5 rounded-full flex items-center justify-center ${active ? 'hover:bg-canvas/20' : 'text-muted hover:bg-sunken hover:text-ink'}`}
                aria-label={`${t.deleteCategory}: ${cat}`}
              >
                <CloseIcon size={12} />
              </button>
            </span>
          );
        })}
        <button onClick={onAddCategory} className="chip border-dashed text-muted"><PlusIcon size={13} /> {t.addCategory}</button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted py-16 text-center">{t.noResults}</p>
      ) : layout === 'grid' ? (
        <ul className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 sm:gap-x-5 gap-y-6 sm:gap-y-8">
          {visible.map(({ book, pct }) => <GridItem key={book.id} book={book} pct={pct} t={t} onSelect={onSelectBook} />)}
        </ul>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {visible.map(({ book, pct }) => <ListItem key={book.id} book={book} pct={pct} t={t} language={language} onSelect={onSelectBook} />)}
        </ul>
      )}

      <p className="hint text-center pt-4">{t.dropToImport}</p>
    </div>
  );
};

const ProgressLine: React.FC<{ pct: number; t: Translation }> = ({ pct, t }) => {
  if (pct >= 100) return <span className="text-xs text-accent-ink font-medium">{t.finished}</span>;
  if (pct <= 0) return null;
  return (
    <span className="flex items-center gap-2">
      <span className="progress flex-1 h-0.5"><span style={{ width: `${pct}%` }} /></span>
      <span className="text-[11px] text-muted tabular">{pct}%</span>
    </span>
  );
};

// Off-screen tiles skip layout and paint; the intrinsic size keeps the scrollbar stable.
const TILE_STYLE: React.CSSProperties = { contentVisibility: 'auto', containIntrinsicSize: 'auto 320px' } as React.CSSProperties;
const ROW_STYLE: React.CSSProperties = { contentVisibility: 'auto', containIntrinsicSize: 'auto 84px' } as React.CSSProperties;

interface ItemProps { book: BookMeta; pct: number; t: Translation; onSelect: (book: BookMeta) => void }

const GridItem = React.memo<ItemProps>(({ book, pct, t, onSelect }) => (
  <li style={TILE_STYLE}>
    <button onClick={() => onSelect(book)} className="group w-full text-left flex flex-col" aria-label={`${book.title}, ${book.author || t.unknownAuthor}`}>
      <div className="relative transition-transform duration-200 group-hover:-translate-y-1">
        <BookCover book={book} size="sm" className="group-hover:shadow-lift transition-shadow" />
        {book.isFavorite && (
          <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/45 backdrop-blur-sm text-white flex items-center justify-center">
            <StarIcon size={12} filled />
          </span>
        )}
      </div>
      <p className="text-[13px] sm:text-sm font-medium text-ink mt-2.5 leading-snug line-clamp-2">{book.title}</p>
      <p className="text-xs text-muted mt-0.5 truncate">{book.author || formatLabel(book.fileType)}</p>
      <div className="mt-2 min-h-[14px]"><ProgressLine pct={pct} t={t} /></div>
    </button>
  </li>
));
GridItem.displayName = 'GridItem';

const ListItem = React.memo<ItemProps & { language: LanguageCode }>(({ book, pct, t, language, onSelect }) => (
  <li style={ROW_STYLE}>
    <button onClick={() => onSelect(book)} className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-sunken/60 transition-colors">
      <div className="w-10 shrink-0"><BookCover book={book} size="xs" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate flex items-center gap-1.5">
          {book.isFavorite && <StarIcon size={12} filled className="text-accent shrink-0" />}
          <span className="truncate">{book.title}</span>
        </p>
        <p className="text-xs text-muted truncate mt-0.5">{book.author || t.unknownAuthor} · {formatLabel(book.fileType)}</p>
      </div>
      <div className="hidden sm:block w-32"><ProgressLine pct={pct} t={t} /></div>
      <span className="hidden md:block w-32 text-right text-xs text-muted">{relativeTime(book.lastRead, language)}</span>
    </button>
  </li>
));
ListItem.displayName = 'ListItem';

export default LibraryView;
