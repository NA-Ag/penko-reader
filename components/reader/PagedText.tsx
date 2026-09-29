import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FontFamily, MarginSize, MARGINS, MAX_MEASURE_EM } from './pageThemes';
import { ProcessedContent } from './processContent';
import { useTouchGestures } from './useTouchGestures';
import { visibleTextSnippet, wordAtPoint } from './readerUtils';

export type PageChangeReason = 'layout' | 'nav';

export interface PagedTextHandle {
  goTo: (page: number, smooth?: boolean) => void;
  turn: (direction: 'next' | 'prev') => void;
  goToChapter: (tocIndex: number) => void;
  /** Text at the top of the current page (bookmark label). */
  snippet: () => string | null;
  /** Reading position as 0..1 through the book. */
  fraction: () => number;
}

interface PagedTextProps {
  content: ProcessedContent;
  fontSize: number;
  lineHeight: number;
  fontFamily: FontFamily;
  marginSize: MarginSize;
  /** Where to open the book (0..1). Read once on mount / content change. */
  initialFraction: number;
  /** Must be stable. `layout` reports come from re-pagination, `nav` from the reader turning a page. */
  onPageChange: (page: number, total: number, chapterIndex: number, reason: PageChangeReason) => void;
  /** Called before any page turn the user initiates inside the text (swipe, wheel, link). Must be stable. */
  onUserNavigate: () => void;
  onTap: () => void;
  onDefine?: (word: string) => void;
}

const FONT_CLASS: Record<FontFamily, string> = { serif: 'font-serif', sans: 'font-sans', dyslexic: 'font-dyslexic' };
const TAP_DELAY_MS = 230;
const WHEEL_THRESHOLD = 60;
const WHEEL_COOLDOWN_MS = 450;

/** The book's HTML. Memoised on the string so unrelated reader state never touches this DOM. */
const BookHtml = memo(({ html }: { html: string }) => {
  const inner = useMemo(() => ({ __html: html }), [html]);
  return <div className="book-content" dangerouslySetInnerHTML={inner} />;
});

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Column-paginated text. Each page is exactly one container width (the column gap equals the
 * horizontal padding), so page N starts at (N-1) * clientWidth. Navigation is programmatic only:
 * the container doesn't free-scroll, so a swipe can never leave the view between two pages.
 */
const PagedText = forwardRef<PagedTextHandle, PagedTextProps>((props, ref) => {
  const { content, fontSize, lineHeight, fontFamily, marginSize, initialFraction } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const cb = useRef(props);
  cb.current = props;

  const [width, setWidth] = useState(0);
  const pageRef = useRef(1);
  const totalRef = useRef(1);
  const fractionRef = useRef(initialFraction);
  const chapterPagesRef = useRef<{ index: number; page: number }[]>([]);
  const relayoutTimer = useRef<number | null>(null);
  const scrollTimer = useRef<number | null>(null);
  const tapTimer = useRef<number | null>(null);
  const suppressClickUntil = useRef(0);
  const wheel = useRef({ acc: 0, lastTurn: 0, resetTimer: 0 as number | 0 });

  // Reset position when a different book's content arrives.
  const contentRef = useRef(content);
  if (contentRef.current !== content) {
    contentRef.current = content;
    fractionRef.current = initialFraction;
  }

  // Cap the line length on wide screens: extra space becomes side padding.
  const minPadX = MARGINS[marginSize].x;
  const padY = MARGINS[marginSize].y;
  const measure = Math.min(Math.max(0, width - 2 * minPadX), fontSize * MAX_MEASURE_EM);
  const padX = width > 0 ? Math.max(minPadX, Math.floor((width - measure) / 2)) : minPadX;
  const padXRef = useRef(padX);
  padXRef.current = padX;

  const chapterFor = (page: number) => {
    let idx = -1;
    for (const c of chapterPagesRef.current) {
      if (c.page <= page) idx = c.index; else break;
    }
    return idx;
  };

  const report = useCallback((reason: PageChangeReason) => {
    cb.current.onPageChange(pageRef.current, totalRef.current, chapterFor(pageRef.current), reason);
  }, []);

  const pageOfElement = (el: Element): number => {
    const container = containerRef.current;
    if (!container) return 1;
    const stride = container.clientWidth || 1;
    const offset = el.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft - padXRef.current;
    return Math.max(1, Math.floor(offset / stride + 0.02) + 1);
  };

  const relayout = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const stride = el.clientWidth || 1;
    const total = Math.max(1, Math.ceil(el.scrollWidth / stride - 0.05));
    totalRef.current = total;

    const chapters: { index: number; page: number }[] = [];
    el.querySelectorAll('[data-toc-index]').forEach(h => {
      chapters.push({ index: Number(h.getAttribute('data-toc-index')), page: pageOfElement(h) });
    });
    chapters.sort((a, b) => a.page - b.page || a.index - b.index);
    chapterPagesRef.current = chapters;

    const target = Math.min(total, Math.max(1, Math.round(fractionRef.current * (total - 1)) + 1));
    el.scrollLeft = (target - 1) * stride;
    pageRef.current = target;
    report('layout');
  }, [report]);

  const scheduleRelayout = useCallback(() => {
    if (relayoutTimer.current) window.clearTimeout(relayoutTimer.current);
    relayoutTimer.current = window.setTimeout(relayout, 120);
  }, [relayout]);

  // Re-paginate synchronously whenever anything that affects layout changes (no flash of the wrong page).
  useLayoutEffect(() => {
    relayout();
  }, [content, fontSize, lineHeight, fontFamily, padX, padY, width, relayout]);

  // Container width (debounced through React state), late web fonts, and late-loading images.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setWidth(el.clientWidth));
    });
    ro.observe(el);
    setWidth(el.clientWidth);

    const onAssetLoad = (e: Event) => { if ((e.target as Element)?.tagName === 'IMG') scheduleRelayout(); };
    el.addEventListener('load', onAssetLoad, true);
    const fonts = (document as any).fonts as FontFaceSet | undefined;
    fonts?.ready.then(() => scheduleRelayout());
    fonts?.addEventListener?.('loadingdone', scheduleRelayout);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      el.removeEventListener('load', onAssetLoad, true);
      fonts?.removeEventListener?.('loadingdone', scheduleRelayout);
      [relayoutTimer, scrollTimer, tapTimer].forEach(r => { if (r.current) window.clearTimeout(r.current); });
      window.clearTimeout(wheel.current.resetTimer);
    };
  }, [scheduleRelayout]);

  const goTo = useCallback((page: number, smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    const stride = el.clientWidth || 1;
    const total = totalRef.current;
    const target = Math.min(total, Math.max(1, Math.round(page)));
    el.scrollTo({ left: (target - 1) * stride, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
    const changed = target !== pageRef.current;
    pageRef.current = target;
    fractionRef.current = total > 1 ? (target - 1) / (total - 1) : 0;
    if (changed) report('nav');
  }, [report]);

  const userTurn = useCallback((direction: 'next' | 'prev') => {
    cb.current.onUserNavigate();
    goTo(pageRef.current + (direction === 'next' ? 1 : -1));
  }, [goTo]);

  useImperativeHandle(ref, () => ({
    goTo,
    turn: (direction) => goTo(pageRef.current + (direction === 'next' ? 1 : -1)),
    goToChapter: (tocIndex) => {
      const known = chapterPagesRef.current.find(c => c.index === tocIndex);
      const el = containerRef.current?.querySelector(`[data-toc-index="${tocIndex}"]`);
      const page = known?.page ?? (el ? pageOfElement(el) : null);
      if (page !== null) goTo(page, false);
    },
    snippet: () => {
      const el = containerRef.current;
      if (!el) return null;
      try { return visibleTextSnippet(el, 40); } catch { return null; }
    },
    fraction: () => fractionRef.current,
  }), [goTo]);

  // Focus navigation or find-in-page can still move the scroll position: snap back to a page boundary.
  const onScroll = () => {
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const stride = el.clientWidth || 1;
      const page = Math.min(totalRef.current, Math.max(1, Math.round(el.scrollLeft / stride) + 1));
      if (Math.abs(el.scrollLeft - (page - 1) * stride) > 1) el.scrollLeft = (page - 1) * stride;
      if (page !== pageRef.current) {
        pageRef.current = page;
        fractionRef.current = totalRef.current > 1 ? (page - 1) / (totalRef.current - 1) : 0;
        report('nav');
      }
    }, 150);
  };

  const onWheel = (e: React.WheelEvent) => {
    const w = wheel.current;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    w.acc += delta;
    window.clearTimeout(w.resetTimer);
    w.resetTimer = window.setTimeout(() => { w.acc = 0; }, 200);
    const now = Date.now();
    if (Math.abs(w.acc) > WHEEL_THRESHOLD && now - w.lastTurn > WHEEL_COOLDOWN_MS) {
      w.lastTurn = now;
      userTurn(w.acc > 0 ? 'next' : 'prev');
      w.acc = 0;
    }
  };

  const followLink = (href: string) => {
    if (/^(https?:|mailto:)/i.test(href)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    const fragment = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
    if (!fragment) return;
    let id = fragment;
    try { id = decodeURIComponent(fragment); } catch { /* keep raw */ }
    const esc = CSS.escape(`bk-${id}`);
    const target = containerRef.current?.querySelector(`[id="${esc}"], [name="${esc}"]`);
    if (target) {
      cb.current.onUserNavigate();
      goTo(pageOfElement(target), false);
    }
  };

  const define = (x: number, y: number) => {
    const onDefine = cb.current.onDefine;
    if (!onDefine) return;
    const word = wordAtPoint(x, y);
    if (word) onDefine(word);
  };

  const onClick = (e: React.MouseEvent) => {
    const link = (e.target as Element).closest?.('a[href]');
    if (link && containerRef.current?.contains(link)) {
      e.preventDefault();
      followLink(link.getAttribute('href') || '');
      return;
    }
    if (Date.now() < suppressClickUntil.current) return;
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    if (e.detail > 1) return; // second click of a double-click: don't toggle chrome
    if (window.getSelection()?.toString()) return; // finishing a text selection
    // Delay so a double-click (define) doesn't also toggle the chrome twice.
    tapTimer.current = window.setTimeout(() => cb.current.onTap(), cb.current.onDefine ? TAP_DELAY_MS : 0);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    define(e.clientX, e.clientY);
  };

  const gestures = useTouchGestures({
    onSwipe: userTurn,
    onDoubleTap: (x, y) => {
      if (tapTimer.current) window.clearTimeout(tapTimer.current);
      suppressClickUntil.current = Date.now() + 400;
      define(x, y);
    },
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden"
      style={{
        columnWidth: '100vw',
        columnGap: `${padX * 2}px`,
        columnFill: 'auto',
        height: '100%',
        padding: `${padY}px ${padX}px`,
        touchAction: 'manipulation',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      onScroll={onScroll}
      {...gestures}
    >
      <div
        className={`h-full ${FONT_CLASS[fontFamily]}`}
        style={{ fontSize: `${fontSize}px`, lineHeight, textAlign: 'justify', hyphens: 'auto' }}
      >
        {content.isHtml ? <BookHtml html={content.html} /> : <div className="whitespace-pre-wrap">{content.html}</div>}
      </div>
    </div>
  );
});

PagedText.displayName = 'PagedText';

export default memo(PagedText);
