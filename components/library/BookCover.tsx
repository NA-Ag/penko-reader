import React, { useState } from 'react';
import { BookMeta } from '../../types';
import { getCoverStyle } from './bookVisuals';

interface BookCoverProps {
  book: Pick<BookMeta, 'id' | 'title' | 'author' | 'coverUrl'>;
  /** Controls type scale of generated covers. The cover always fills its container width at 2:3. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const TITLE_SIZE = { xs: 'text-[7px]', sm: 'text-[11px]', md: 'text-[15px]', lg: 'text-xl' };
const AUTHOR_SIZE = { xs: 'hidden', sm: 'text-[8px]', md: 'text-[10px]', lg: 'text-xs' };
const PAD = { xs: 'p-1', sm: 'p-2', md: 'p-3', lg: 'p-5' };

const Spine = () => <div className="absolute inset-y-0 left-0 w-[6%] bg-gradient-to-r from-black/25 to-transparent pointer-events-none" />;

/** A book's cover image, or a generated cloth-bound cover with the title set in serif. */
const BookCover: React.FC<BookCoverProps> = ({ book, size = 'md', className = '' }) => {
  // Fall back to the generated cover if the stored image is missing or corrupt.
  const [broken, setBroken] = useState(false);
  const base = `relative aspect-[2/3] w-full overflow-hidden rounded-[4px] shadow-cover bg-sunken ${className}`;

  if (book.coverUrl && !broken) {
    return (
      <div className={base}>
        <img
          src={book.coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setBroken(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <Spine />
      </div>
    );
  }

  const c = getCoverStyle(book.id);
  return (
    <div className={base} style={{ background: c.bg, color: c.fg }} aria-hidden="true">
      <Spine />
      <div className={`absolute inset-0 flex flex-col ${PAD[size]}`}>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-[6%] px-[6%]">
          <span className="block w-1/3 h-px opacity-70" style={{ background: c.rule }} />
          <span className={`font-serif font-semibold leading-[1.15] line-clamp-5 break-words ${TITLE_SIZE[size]}`}>{book.title}</span>
          <span className="block w-1/3 h-px opacity-70" style={{ background: c.rule }} />
        </div>
        {book.author && size !== 'xs' && (
          <span className={`font-sans uppercase tracking-[0.12em] text-center truncate opacity-80 ${AUTHOR_SIZE[size]}`}>{book.author}</span>
        )}
      </div>
    </div>
  );
};

export default React.memo(BookCover);
