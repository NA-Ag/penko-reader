import React, { useEffect, useState } from 'react';
import { Translation } from '../../types';
import {
  BackIcon, BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, EraserIcon,
  HighlighterIcon, ListIcon, PenIcon, SpeakerIcon, StopIcon
} from '../ui/Icons';
import { AnnotationTool } from './pageThemes';

const ICON_BTN = 'btn btn-ghost btn-icon';
const TOOL_ON = 'bg-accent-soft text-accent-ink hover:bg-accent-soft hover:text-accent-ink';
const CHROME = 'bg-surface/90 backdrop-blur-md border-line text-ink';

interface TopBarProps {
  t: Translation;
  title: string;
  visible: boolean;
  isPdf: boolean;
  bookmarked: boolean;
  tool: AnnotationTool;
  settingsOpen: boolean;
  onOpenSidebar: () => void;
  onBack: () => void;
  onToggleBookmark: () => void;
  onToolChange: (tool: AnnotationTool) => void;
  onToggleSettings: () => void;
  /** The settings popover, anchored under the Aa button. */
  children?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({
  t, title, visible, isPdf, bookmarked, tool, settingsOpen,
  onOpenSidebar, onBack, onToggleBookmark, onToolChange, onToggleSettings, children
}) => {
  const toolButton = (id: Exclude<AnnotationTool, 'none'>, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => onToolChange(tool === id ? 'none' : id)}
      className={`${ICON_BTN} ${tool === id ? TOOL_ON : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={tool === id}
    >
      {icon}
    </button>
  );

  return (
    <div
      className={`absolute top-0 left-0 right-0 pt-safe border-b z-30 transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'} ${CHROME}`}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="h-14 flex items-center justify-between gap-2 px-2 sm:px-3">
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onOpenSidebar} className={ICON_BTN} title={t.tableOfContents} aria-label={t.tableOfContents}>
            <ListIcon size={20} />
          </button>
          <button onClick={onBack} className={ICON_BTN} title={t.back} aria-label={t.back}>
            <BackIcon size={20} />
          </button>
        </div>

        <h1 className="text-sm font-medium truncate text-center flex-1 min-w-0 px-2">{title}</h1>

        <div className="flex items-center gap-0.5 relative shrink-0">
          <button
            onClick={onToggleBookmark}
            className={`${ICON_BTN} ${bookmarked ? 'text-accent hover:text-accent' : ''}`}
            title={bookmarked ? t.removeBookmark : t.addBookmark}
            aria-label={bookmarked ? t.removeBookmark : t.addBookmark}
            aria-pressed={bookmarked}
          >
            <BookmarkIcon size={20} filled={bookmarked} />
          </button>

          {isPdf && (
            <>
              <span className="w-px h-5 bg-line mx-1" aria-hidden="true" />
              {toolButton('highlight', t.highlightTool, <HighlighterIcon size={20} />)}
              {toolButton('pen', t.penTool, <PenIcon size={20} />)}
              {toolButton('erase', t.eraserTool, <EraserIcon size={20} />)}
              <span className="w-px h-5 bg-line mx-1" aria-hidden="true" />
            </>
          )}

          <button
            onClick={onToggleSettings}
            className={`${ICON_BTN} ${settingsOpen ? 'bg-sunken text-ink' : ''}`}
            title={t.appearance}
            aria-label={t.appearance}
            aria-expanded={settingsOpen}
          >
            <span className="font-serif font-semibold text-[17px] leading-none">Aa</span>
          </button>

          {children}
        </div>
      </div>
    </div>
  );
};

/** Page number field that only navigates on Enter or blur, not on every keystroke. */
const PageInput: React.FC<{ page: number; total: number; label: string; onCommit: (page: number) => void }> = ({ page, total, label, onCommit }) => {
  const [draft, setDraft] = useState(String(page));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(String(page)); }, [page, focused]);

  const commit = () => {
    const val = parseInt(draft, 10);
    if (!Number.isNaN(val) && val !== page) onCommit(Math.min(total, Math.max(1, val)));
    else setDraft(String(page));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      onFocus={(e) => { setFocused(true); e.currentTarget.select(); }}
      onBlur={() => { setFocused(false); commit(); }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { setDraft(String(page)); e.currentTarget.blur(); e.stopPropagation(); }
      }}
      className="w-12 h-6 text-center text-xs text-ink bg-transparent rounded border border-transparent hover:border-line focus:border-accent focus:outline-none tabular"
      aria-label={label}
    />
  );
};

interface BottomBarProps {
  t: Translation;
  visible: boolean;
  page: number;
  total: number;
  canReadAloud: boolean;
  speaking: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (page: number) => void;
  onToggleReadAloud: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({ t, visible, page, total, canReadAloud, speaking, onPrev, onNext, onGoTo, onToggleReadAloud }) => {
  const safeTotal = Math.max(1, total);
  const pct = Math.min(100, (page / safeTotal) * 100);
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 pb-safe border-t z-30 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'} ${CHROME}`}
      aria-hidden={!visible}
      inert={!visible}
    >
      <div className="h-14 flex items-center justify-between gap-2 px-2 sm:px-3">
        <button onClick={onPrev} disabled={page <= 1} className={ICON_BTN} aria-label="Previous page">
          <ChevronLeftIcon size={22} />
        </button>

        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0 max-w-sm">
          <div className="flex items-center gap-1 text-xs text-muted tabular">
            <span>{t.page}</span>
            <PageInput page={page} total={safeTotal} label={t.page} onCommit={onGoTo} />
            <span>{t.of} {safeTotal}</span>
          </div>
          <div className="progress !h-0.5" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          {canReadAloud && (
            <button
              onClick={onToggleReadAloud}
              className={`${ICON_BTN} ${speaking ? TOOL_ON : ''}`}
              title={speaking ? t.stopReading : t.readAloud}
              aria-label={speaking ? t.stopReading : t.readAloud}
              aria-pressed={speaking}
            >
              {speaking ? <StopIcon size={20} /> : <SpeakerIcon size={20} />}
            </button>
          )}
          <button onClick={onNext} disabled={page >= safeTotal} className={ICON_BTN} aria-label="Next page">
            <ChevronRightIcon size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
