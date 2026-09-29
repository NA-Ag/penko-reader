import { useRef } from 'react';
import type React from 'react';

interface GestureOptions {
  /** Called for a horizontal swipe; `next` is a right-to-left swipe. */
  onSwipe?: (direction: 'next' | 'prev') => void;
  onDoubleTap?: (x: number, y: number) => void;
  /** Return false to ignore swipes right now (e.g. an annotation tool is active, or the page is zoomed and pannable). */
  canSwipe?: () => boolean;
}

const SWIPE_MIN_PX = 50;
const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_SLOP_PX = 30;

/**
 * Swipe and double-tap detection for single-finger touches. Multi-touch gestures are
 * ignored here (the PDF view handles pinch itself). Uses refs only, so it never re-renders.
 */
export const useTouchGestures = ({ onSwipe, onDoubleTap, canSwipe }: GestureOptions) => {
  const start = useRef<{ x: number; y: number } | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const multi = useRef(false);
  const lastTap = useRef<{ x: number; y: number; time: number } | null>(null);
  const opts = useRef({ onSwipe, onDoubleTap, canSwipe });
  opts.current = { onSwipe, onDoubleTap, canSwipe };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      multi.current = true;
      return;
    }
    multi.current = false;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
    last.current = start.current;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 1) { multi.current = true; return; }
    const t = e.touches[0];
    last.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = () => {
    const s = start.current;
    const l = last.current;
    start.current = null;
    if (multi.current || !s || !l) return;
    const dx = s.x - l.x;
    const dy = s.y - l.y;

    if (Math.abs(dx) > SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      lastTap.current = null;
      if (opts.current.canSwipe && !opts.current.canSwipe()) return;
      opts.current.onSwipe?.(dx > 0 ? 'next' : 'prev');
      return;
    }
    if (Math.hypot(dx, dy) > DOUBLE_TAP_SLOP_PX) return; // a drag, not a tap

    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.time < DOUBLE_TAP_MS && Math.hypot(prev.x - s.x, prev.y - s.y) < DOUBLE_TAP_SLOP_PX) {
      lastTap.current = null;
      opts.current.onDoubleTap?.(s.x, s.y);
      return;
    }
    lastTap.current = { x: s.x, y: s.y, time: now };
  };

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd };
};
