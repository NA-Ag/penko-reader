import React from 'react';
import { BookMeta, LanguageCode, Translation } from '../../types';
import { fmt } from '../../utils/translations';
import Dialog from '../ui/Dialog';
import BookCover from '../library/BookCover';
import { formatLabel, minutesLeft, progressPercent, relativeTime } from '../library/bookVisuals';
import { BoltIcon, BookOpenIcon, FolderIcon, StarIcon, TrashIcon } from '../ui/Icons';

interface BookDetailModalProps {
  book: BookMeta | null;
  t: Translation;
  language: LanguageCode;
  onClose: () => void;
  onOpen: (book: BookMeta) => void;
  onSpeedRead: (book: BookMeta) => void;
  onToggleFavorite: (book: BookMeta) => void;
  onCategory: (book: BookMeta) => void;
  onDelete: (book: BookMeta) => void;
}

/** A book's details and every action you can take on it. */
const BookDetailModal: React.FC<BookDetailModalProps> = ({ book, t, language, onClose, onOpen, onSpeedRead, onToggleFavorite, onCategory, onDelete }) => {
  if (!book) return null;
  const pct = progressPercent(book);
  const left = minutesLeft(book);

  return (
    <Dialog isOpen onClose={onClose} size="md" closeLabel={t.close}>
      <div className="flex gap-5 pt-2">
        <div className="w-28 sm:w-32 shrink-0"><BookCover book={book} size="sm" /></div>
        <div className="flex-1 min-w-0 flex flex-col pr-6">
          <h2 className="display text-xl sm:text-2xl leading-tight line-clamp-3">{book.title}</h2>
          <p className="text-sm text-ink-soft mt-1">{book.author || t.unknownAuthor}</p>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted">{t.format}</dt><dd className="text-ink">{formatLabel(book.fileType)}</dd>
            <dt className="text-muted">{t.lastOpened}</dt><dd className="text-ink">{relativeTime(book.lastRead, language)}</dd>
            {book.category && (<><dt className="text-muted">{t.category}</dt><dd className="text-ink truncate">{book.category}</dd></>)}
          </dl>
          <div className="mt-auto pt-4">
            <div className="progress"><span style={{ width: `${pct}%` }} /></div>
            <p className="text-xs text-muted mt-1.5 tabular">
              {pct >= 100 ? t.finished : `${pct}%`}{left !== null && pct > 0 && pct < 100 && <> · {fmt(t.minutesLeft, { count: left })}</>}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2">
        <button onClick={() => onOpen(book)} className="btn btn-primary" data-autofocus>
          <BookOpenIcon size={16} /> {pct > 0 && pct < 100 ? t.continueAction : t.openBook}
        </button>
        <button onClick={() => onSpeedRead(book)} className="btn btn-secondary">
          <BoltIcon size={16} /> {t.speedRead}
        </button>
      </div>

      <div className="flex items-center gap-1 border-t border-line pt-3 -mx-2">
        <button onClick={() => onToggleFavorite(book)} className={`btn btn-ghost btn-sm ${book.isFavorite ? 'text-accent-ink' : ''}`} aria-pressed={Boolean(book.isFavorite)}>
          <StarIcon size={15} filled={Boolean(book.isFavorite)} /> {t.favorites}
        </button>
        <button onClick={() => onCategory(book)} className="btn btn-ghost btn-sm">
          <FolderIcon size={15} /> {book.category || t.category}
        </button>
        <button onClick={() => onDelete(book)} className="btn btn-danger-ghost btn-sm ml-auto">
          <TrashIcon size={15} /> {t.delete}
        </button>
      </div>
    </Dialog>
  );
};

export default BookDetailModal;
