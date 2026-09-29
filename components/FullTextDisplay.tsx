import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WordToken, Translation } from '../types';

interface FullTextDisplayProps {
  tokens: WordToken[];
  currentIndex: number;
  t: Translation;
  onWordClick: (index: number) => void;
  onDefine?: (word: string) => void;
  clickToDefine: boolean;
  verticalMode: boolean;
}

/** Words rendered on each side of the playhead. */
const WINDOW_SIZE = 800;
/** Re-window once the playhead gets this close to either edge of the rendered range. */
const EDGE_MARGIN = 200;
/** After the user scrolls by hand, don't auto-follow for this long. */
const USER_SCROLL_GRACE_MS = 4000;

const ACTIVE_CLASSES = ['bg-accent-soft', 'text-ink'];

const makeWindow = (index: number, length: number) => ({
  start: Math.max(0, index - WINDOW_SIZE),
  end: Math.min(length, index + WINDOW_SIZE)
});

/**
 * The words in [start, end). Memoized so it renders once per window, not once per word;
 * the playhead highlight is moved imperatively by the parent.
 */
const TranscriptSegment = React.memo(({ tokens, start, end }: { tokens: WordToken[]; start: number; end: number }) => {
  const out: React.ReactNode[] = [];
  for (let i = start; i < end; i++) {
    const token = tokens[i];
    if (!token) break;
    if (token.isParagraphStart && i > start) out.push(<br key={`b1-${i}`} />, <br key={`b2-${i}`} />);
    out.push(
      <span key={token.id} data-index={i} className="cursor-pointer px-0.5 rounded transition-colors duration-150 hover:bg-sunken hover:text-ink">
        {token.word}
      </span>,
      ' '
    );
  }
  return <>{out}</>;
});
TranscriptSegment.displayName = 'TranscriptSegment';

/** Scrollable transcript that follows the RSVP playhead. Click a word to jump; double-click to define. */
const FullTextDisplay: React.FC<FullTextDisplayProps> = ({ tokens, currentIndex, t, onWordClick, onDefine, clickToDefine, verticalMode }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [win, setWin] = useState(() => makeWindow(currentIndex, tokens.length));
  const lastUserScrollRef = useRef(0);
  const activeRef = useRef<HTMLElement | null>(null);

  // Latest callbacks, so the delegated handlers never need re-binding.
  const handlersRef = useRef({ onWordClick, onDefine, clickToDefine, tokens });
  handlersRef.current = { onWordClick, onDefine, clickToDefine, tokens };

  // New text: start a fresh window.
  useEffect(() => {
    setWin(makeWindow(currentIndex, tokens.length));
  }, [tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slide the window only when the playhead nears an edge (or jumps outside it).
  useEffect(() => {
    const nearStart = currentIndex < win.start + EDGE_MARGIN && win.start > 0;
    const nearEnd = currentIndex >= win.end - EDGE_MARGIN && win.end < tokens.length;
    if (nearStart || nearEnd || currentIndex < win.start || currentIndex >= win.end) {
      setWin(makeWindow(currentIndex, tokens.length));
    }
  }, [currentIndex, win, tokens.length]);

  // Move the highlight and keep it in view, without re-rendering the words.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (activeRef.current) activeRef.current.classList.remove(...ACTIVE_CLASSES);
    const el = container.querySelector<HTMLElement>(`[data-index="${currentIndex}"]`);
    activeRef.current = el;
    if (!el) return;
    el.classList.add(...ACTIVE_CLASSES);

    if (Date.now() - lastUserScrollRef.current < USER_SCROLL_GRACE_MS) return;
    const c = container.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    // Scroll only this panel (scrollIntoView would also scroll the page).
    if (verticalMode) {
      if (e.left < c.left || e.right > c.right) {
        container.scrollLeft += (e.left + e.width / 2) - (c.left + c.width / 2);
      }
    } else if (e.top < c.top || e.bottom > c.bottom) {
      container.scrollTop += (e.top + e.height / 2) - (c.top + c.height / 2);
    }
  }, [currentIndex, win, verticalMode]);

  const markUserScroll = useCallback(() => { lastUserScrollRef.current = Date.now(); }, []);

  const indexFromEvent = (e: React.MouseEvent): number | null => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-index]');
    if (!target) return null;
    const i = Number(target.dataset.index);
    return Number.isFinite(i) ? i : null;
  };

  const handleClick = useCallback((e: React.MouseEvent) => {
    const i = indexFromEvent(e);
    if (i === null) return;
    lastUserScrollRef.current = 0; // an explicit jump should follow the playhead again
    handlersRef.current.onWordClick(i);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { clickToDefine: enabled, onDefine: define, tokens: list } = handlersRef.current;
    if (!enabled || !define) return;
    const i = indexFromEvent(e);
    if (i !== null && list[i]) define(list[i].word);
  }, []);

  if (tokens.length === 0) return null;

  // The window state can lag one render behind a new token list; clamp so we never read past the end.
  const start = Math.min(win.start, tokens.length);
  const end = Math.min(win.end, tokens.length);

  return (
    <div className={`w-full card flex flex-col overflow-hidden ${verticalMode ? 'h-full' : 'max-w-3xl mx-auto h-[380px] lg:h-[520px]'}`}>
      <div className="px-5 py-3 border-b border-line flex justify-between items-center gap-3">
        <h3 className="text-sm font-medium text-ink">{t.fullText}</h3>
        {clickToDefine && <span className="hint truncate">{t.clickToDefine}</span>}
      </div>

      <div
        ref={scrollRef}
        className={`flex-1 px-6 py-5 overflow-y-auto scroll-thin leading-relaxed text-ink-soft text-lg font-serif ${verticalMode ? 'overflow-x-auto h-full' : ''}`}
        style={verticalMode ? { writingMode: 'vertical-rl' } : undefined}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        onKeyDown={markUserScroll}
        tabIndex={0}
        aria-label={t.fullText}
      >
        {start > 0 && <div className="text-center p-2 text-muted text-sm select-none">…</div>}
        <TranscriptSegment tokens={tokens} start={start} end={end} />
        {end < tokens.length && <div className="text-center p-2 text-muted text-sm select-none">…</div>}
      </div>
    </div>
  );
};

export default React.memo(FullTextDisplay);
