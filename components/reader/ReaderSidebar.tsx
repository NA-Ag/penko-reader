import React from 'react';
import { Bookmark, Translation } from '../../types';
import { CloseIcon, TrashIcon } from '../ui/Icons';
import { TocEntry } from './processContent';

export type SidebarTab = 'toc' | 'bookmarks';

interface ReaderSidebarProps {
  t: Translation;
  open: boolean;
  tab: SidebarTab;
  toc: TocEntry[];
  chapterIndex: number;
  bookmarks: Bookmark[];
  currentPage: number;
  onTabChange: (tab: SidebarTab) => void;
  onSelectChapter: (tocIndex: number) => void;
  onSelectBookmark: (page: number) => void;
  onRemoveBookmark: (id: string) => void;
  onClose: () => void;
}

const ReaderSidebar: React.FC<ReaderSidebarProps> = ({
  t, open, tab, toc, chapterIndex, bookmarks, currentPage,
  onTabChange, onSelectChapter, onSelectBookmark, onRemoveBookmark, onClose
}) => (
  <>
    <aside
      className={`absolute top-0 left-0 bottom-0 w-80 max-w-[85vw] z-40 shadow-dialog transform transition-transform duration-300 bg-surface text-ink border-r border-line flex flex-col pt-safe ${open ? 'translate-x-0' : '-translate-x-full'}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="h-14 flex items-center justify-between gap-2 px-3 border-b border-line shrink-0">
        <div className="segmented flex-1" role="tablist">
          <button role="tab" onClick={() => onTabChange('toc')} aria-selected={tab === 'toc'}>
            {t.chapters}
          </button>
          <button role="tab" onClick={() => onTabChange('bookmarks')} aria-selected={tab === 'bookmarks'}>
            {t.bookmarks}
            {bookmarks.length > 0 && <span className="tabular text-muted">{bookmarks.length}</span>}
          </button>
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon" aria-label={t.close}>
          <CloseIcon size={18} />
        </button>
      </div>

      {/* Only build the (possibly long) lists while the drawer is open. */}
      {open && (
        <div className="overflow-y-auto scroll-thin flex-1 p-2">
          {tab === 'toc' ? (
            toc.length > 0 ? (
              <ol className="flex flex-col">
                {toc.map((item) => {
                  const current = chapterIndex === item.index;
                  return (
                    <li key={item.index}>
                      <button
                        onClick={() => onSelectChapter(item.index)}
                        className={`relative block w-full text-left text-sm py-2.5 pl-4 pr-3 rounded-md transition-colors truncate ${current ? 'text-accent-ink font-medium bg-accent-soft/60' : 'text-ink-soft hover:bg-sunken hover:text-ink'}`}
                        aria-current={current ? 'true' : undefined}
                      >
                        {current && <span className="absolute left-1 top-2 bottom-2 w-0.5 rounded-full bg-accent" aria-hidden="true" />}
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="p-6 text-center text-sm text-muted">{t.noChapters}</p>
            )
          ) : bookmarks.length > 0 ? (
            <ul className="flex flex-col">
              {bookmarks.map((bm) => (
                <li key={bm.id} className={`group flex items-center gap-1 rounded-md ${bm.page === currentPage ? 'bg-sunken' : ''}`}>
                  <button onClick={() => onSelectBookmark(bm.page)} className="flex-1 min-w-0 text-left py-2.5 px-3 rounded-md hover:bg-sunken transition-colors">
                    <div className="text-sm text-ink truncate">{bm.label}</div>
                    <div className="text-xs text-muted tabular">{t.page} {bm.page}</div>
                  </button>
                  <button
                    onClick={() => onRemoveBookmark(bm.id)}
                    className="btn btn-danger-ghost btn-sm btn-icon shrink-0 opacity-60 group-hover:opacity-100 focus:opacity-100"
                    title={t.removeBookmark}
                    aria-label={t.removeBookmark}
                  >
                    <TrashIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-muted">{t.noBookmarks}</p>
          )}
        </div>
      )}
    </aside>

    {open && <div className="absolute inset-0 bg-black/40 z-30 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose} aria-hidden="true" />}
  </>
);

export default ReaderSidebar;
