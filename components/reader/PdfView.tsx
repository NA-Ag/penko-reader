import React, { useEffect, useRef, useState } from 'react';
import { Drawing, Highlight } from '../../types';
import { AnnotationTool, ERASER_CURSOR, PEN_CURSOR } from './pageThemes';
import { useTouchGestures } from './useTouchGestures';

interface PdfViewProps {
  bookId: string;
  /** The PDF as a data: URL (how the library stores it). */
  content: string;
  page: number;
  /** null until the first page loads; then the view picks a fit-to-width scale via onScaleChange. */
  scale: number | null;
  onScaleChange: (scale: number) => void;
  tool: AnnotationTool;
  highlightColor: string;
  highlights: Highlight[];
  drawings: Drawing[];
  onLoaded: (numPages: number) => void;
  onError: (message: string) => void;
  onAnnotationsChange: (patch: { highlights?: Highlight[]; drawings?: Drawing[] }) => void;
  onTap: () => void;
  onSwipe: (direction: 'next' | 'prev') => void;
  backdrop: string;
  error: string | null;
  errorTitle: string;
}

interface RenderedSize { w: number; h: number; dpr: number; scale: number }

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

/** Decode a data: URL (or fetchable URL) to bytes. Faster and lighter than handing pdf.js a URL string. */
const toBytes = async (src: string): Promise<Uint8Array> => {
  try {
    const res = await fetch(src);
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    const base64 = src.slice(src.indexOf(',') + 1);
    const bin = atob(base64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
};

/**
 * One PDF page. pdf.js is imported lazily, the page is rasterised at device-pixel resolution
 * into an offscreen canvas (no blank flash on page turns), and annotations live on a separate
 * overlay canvas so drawing or erasing never re-renders the PDF itself.
 */
const PdfView: React.FC<PdfViewProps> = (props) => {
  const { bookId, content, page, scale, tool, highlightColor, highlights, drawings, backdrop, error, errorTitle } = props;
  const cb = useRef(props);
  cb.current = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);

  const [doc, setDoc] = useState<any>(null);
  const [size, setSize] = useState<RenderedSize | null>(null);

  // --- load (lazy pdf.js) ---------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let task: any = null;
    setDoc(null);
    setSize(null);
    (async () => {
      const [{ pdfjs }, data] = await Promise.all([import('../../utils/pdf'), toBytes(content)]);
      if (cancelled) return;
      task = pdfjs.getDocument({ data });
      const pdf = await task.promise;
      if (cancelled) return;
      setDoc(pdf);
      cb.current.onLoaded(pdf.numPages);
    })().catch((err: any) => {
      if (cancelled) return;
      console.error('PDF load error:', err);
      cb.current.onError(err?.message || 'Unknown error');
    });
    return () => {
      cancelled = true;
      try { task?.destroy(); } catch { /* ignore */ }
    };
  }, [bookId, content]);

  // --- render the page --------------------------------------------------------
  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let renderTask: any = null;
    let pdfPage: any = null;
    const pageNumber = Math.min(doc.numPages, Math.max(1, page));

    doc.getPage(pageNumber).then((p: any) => {
      if (cancelled) return;
      pdfPage = p;
      if (scale === null) {
        // First page: fit the page width to the screen (capped so desktop pages aren't gigantic).
        const base = p.getViewport({ scale: 1 });
        const avail = (scrollRef.current?.clientWidth || window.innerWidth) - 32;
        cb.current.onScaleChange(Math.round(clampScale(Math.min(1.6, avail / base.width)) * 100) / 100);
        return;
      }
      const viewport = p.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const off = document.createElement('canvas');
      off.width = Math.floor(viewport.width * dpr);
      off.height = Math.floor(viewport.height * dpr);
      const offCtx = off.getContext('2d');
      if (!offCtx) return;
      renderTask = p.render({ canvasContext: offCtx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined });
      return renderTask.promise.then(() => {
        renderTask = null;
        const canvas = pdfCanvasRef.current;
        if (cancelled || !canvas) return;
        canvas.width = off.width;
        canvas.height = off.height;
        canvas.getContext('2d')?.drawImage(off, 0, 0);
        setSize({ w: viewport.width, h: viewport.height, dpr, scale });
      });
    }).catch((err: any) => {
      if (!cancelled && err?.name !== 'RenderingCancelledException') console.error('PDF render error:', err);
    });

    return () => {
      cancelled = true;
      try { renderTask?.cancel(); } catch { /* ignore */ }
      try { pdfPage?.cleanup(); } catch { /* ignore */ }
    };
  }, [doc, page, scale]);

  // --- annotations overlay ----------------------------------------------------
  const drawAnnotations = () => {
    const ov = overlayRef.current;
    if (!ov || !size) return;
    const { w, h, dpr } = size;
    ov.width = Math.floor(w * dpr);
    ov.height = Math.floor(h * dpr);
    const ctx = ov.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 0.75;
    for (const hl of highlights) {
      if (hl.page !== page) continue;
      ctx.fillStyle = hl.color || '#facc15';
      ctx.fillRect(hl.x * w, hl.y * h, hl.width * w, hl.height * h);
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const d of drawings) {
      if (d.page !== page || d.points.length === 0) continue;
      ctx.beginPath();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = d.strokeWidth * size.scale;
      ctx.moveTo(d.points[0].x * w, d.points[0].y * h);
      for (let i = 1; i < d.points.length; i++) ctx.lineTo(d.points[i].x * w, d.points[i].y * h);
      ctx.stroke();
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(drawAnnotations, [size, highlights, drawings, page]);

  const stroke = useRef<{ x: number; y: number }[] | null>(null);
  const selStart = useRef<{ x: number; y: number } | null>(null);

  const point = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const showSelection = (a: { x: number; y: number } | null, b?: { x: number; y: number }) => {
    const el = selectionRef.current;
    if (!el) return;
    if (!a || !b) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = `${Math.min(a.x, b.x) * 100}%`;
    el.style.top = `${Math.min(a.y, b.y) * 100}%`;
    el.style.width = `${Math.abs(b.x - a.x) * 100}%`;
    el.style.height = `${Math.abs(b.y - a.y) * 100}%`;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === 'none' || !overlayRef.current || !size) return;
    e.stopPropagation();
    // Keep receiving moves/up even if the pointer leaves the page.
    overlayRef.current.setPointerCapture(e.pointerId);
    const p = point(e);

    if (tool === 'erase') {
      let nextHighlights: Highlight[] | undefined;
      let nextDrawings: Drawing[] | undefined;
      for (let i = highlights.length - 1; i >= 0; i--) {
        const hl = highlights[i];
        if (hl.page === page && p.x >= hl.x && p.x <= hl.x + hl.width && p.y >= hl.y && p.y <= hl.y + hl.height) {
          nextHighlights = highlights.filter((_, j) => j !== i);
          break;
        }
      }
      const tol = 0.02;
      const di = drawings.findIndex(d => d.page === page && d.points.some(q => Math.hypot(q.x - p.x, q.y - p.y) < tol));
      if (di !== -1) nextDrawings = drawings.filter((_, j) => j !== di);
      if (nextHighlights || nextDrawings) cb.current.onAnnotationsChange({ highlights: nextHighlights, drawings: nextDrawings });
      return;
    }

    if (tool === 'pen') {
      stroke.current = [p];
      const ctx = overlayRef.current.getContext('2d');
      if (ctx) {
        ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
        ctx.beginPath();
        ctx.strokeStyle = highlightColor;
        ctx.lineWidth = 2 * size.scale;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(p.x * size.w, p.y * size.h);
      }
      return;
    }

    selStart.current = p;
    showSelection(p, p);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!size) return;
    if (tool === 'pen' && stroke.current) {
      const p = point(e);
      stroke.current.push(p);
      const ctx = overlayRef.current?.getContext('2d');
      if (ctx) {
        ctx.lineTo(p.x * size.w, p.y * size.h);
        ctx.stroke();
      }
      return;
    }
    if (tool === 'highlight' && selStart.current) showSelection(selStart.current, point(e));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (tool === 'pen' && stroke.current) {
      const points = stroke.current;
      stroke.current = null;
      if (points.length > 1) {
        cb.current.onAnnotationsChange({ drawings: [...drawings, { page, color: highlightColor, strokeWidth: 2, points }] });
      } else {
        drawAnnotations(); // discard a stray dot
      }
      return;
    }
    if (tool === 'highlight' && selStart.current) {
      const a = selStart.current;
      const b = point(e);
      selStart.current = null;
      showSelection(null);
      const hl: Highlight = { page, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), color: highlightColor };
      if (hl.width > 0.002 && hl.height > 0.002) cb.current.onAnnotationsChange({ highlights: [...highlights, hl] });
    }
  };

  // --- gestures: pinch (CSS transform while pinching, one re-render at the end), swipe, tap ----
  const pinch = useRef<{ dist: number; ratio: number } | null>(null);
  const justPinched = useRef(0);
  const touchDist = (e: React.TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);

  const gestures = useTouchGestures({
    onSwipe: (dir) => cb.current.onSwipe(dir),
    canSwipe: () => {
      const el = scrollRef.current;
      // A zoomed page pans horizontally instead of turning.
      return cb.current.tool === 'none' && (!el || el.scrollWidth <= el.clientWidth + 2);
    },
  });

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { dist: touchDist(e), ratio: 1 };
    gestures.onTouchStart(e);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current && wrapRef.current) {
      const current = scale ?? 1;
      const ratio = clampScale(current * (touchDist(e) / pinch.current.dist)) / current;
      pinch.current.ratio = ratio;
      wrapRef.current.style.transform = `scale(${ratio})`;
    }
    gestures.onTouchMove(e);
  };
  const onTouchEnd = () => {
    if (pinch.current) {
      const { ratio } = pinch.current;
      pinch.current = null;
      if (wrapRef.current) wrapRef.current.style.transform = '';
      justPinched.current = Date.now();
      if (Math.abs(ratio - 1) > 0.02) cb.current.onScaleChange(Math.round(clampScale((scale ?? 1) * ratio) * 100) / 100);
    }
    gestures.onTouchEnd();
  };

  const onClick = () => {
    if (tool !== 'none' || Date.now() - justPinched.current < 400) return;
    cb.current.onTap();
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto relative"
      style={{ backgroundColor: backdrop, touchAction: tool === 'none' ? 'pan-x pan-y' : 'none' }}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="min-h-full min-w-full w-max mx-auto flex items-center justify-center p-4 sm:p-8 pt-20 pb-24">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-sm">
            <p className="font-medium text-ink mb-1">{errorTitle}</p>
            <p className="text-sm text-muted">{error}</p>
          </div>
        ) : !size ? (
          <div className="w-10 h-10 rounded-full border-2 border-line border-t-accent animate-spin" aria-label="Loading" />
        ) : null}
        <div
          ref={wrapRef}
          className={`relative shadow-lift select-none origin-center ${error || !size ? 'hidden' : ''}`}
          style={size ? { width: size.w, height: size.h } : undefined}
        >
          <canvas ref={pdfCanvasRef} className="block bg-white" style={size ? { width: size.w, height: size.h } : undefined} />
          <canvas
            ref={overlayRef}
            className={`absolute inset-0 ${tool === 'none' ? 'pointer-events-none' : ''} ${tool === 'highlight' ? 'cursor-crosshair' : ''}`}
            style={{
              width: size?.w, height: size?.h, mixBlendMode: 'multiply',
              cursor: tool === 'erase' ? ERASER_CURSOR : tool === 'pen' ? PEN_CURSOR : undefined,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          <div ref={selectionRef} className="absolute pointer-events-none mix-blend-multiply hidden" style={{ backgroundColor: highlightColor, opacity: 0.75 }} />
        </div>
      </div>
    </div>
  );
};

export default PdfView;
