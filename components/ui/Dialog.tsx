import React, { useEffect, useId, useRef } from 'react';
import { PenkoMascot } from '../PenkoMascot';
import { CloseIcon } from './Icons';

type Pose = 'idle' | 'talk' | 'hurt' | 'jump';

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** Short supporting line under the title. */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Show a small Penko beside the title (friendly confirmations and empty results). */
  mascot?: Pose | false;
  size?: 'sm' | 'md' | 'lg';
  /** Action row at the bottom, right-aligned. */
  footer?: React.ReactNode;
  closeLabel?: string;
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, innermost last. Only the topmost one reacts to Escape and Tab.
const stack: symbol[] = [];
let scrollLocks = 0;
let savedOverflow = '';

const lockScroll = () => {
  if (scrollLocks++ === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
};
const unlockScroll = () => {
  if (--scrollLocks === 0) document.body.style.overflow = savedOverflow;
};

/**
 * The app's single dialog shell. Escape and backdrop clicks close it, focus is trapped
 * inside and restored afterwards, page scroll is locked, and stacked dialogs close one
 * at a time. On phones it docks to the bottom as a sheet.
 */
const Dialog: React.FC<DialogProps> = ({ isOpen, onClose, title, description, children, mascot = false, size = 'sm', footer, closeLabel = 'Close' }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  // Parents usually pass a fresh arrow function; keep the latest without re-running effects.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const token = Symbol('dialog');
    stack.push(token);
    lockScroll();
    const previous = document.activeElement as HTMLElement | null;
    const isTop = () => stack[stack.length - 1] === token;

    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const all = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
        const items: HTMLElement[] = [];
        all.forEach(el => { if (el.offsetParent !== null || el === document.activeElement) items.push(el); });
        if (items.length === 0) { e.preventDefault(); panel.focus(); return; }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !panel.contains(active))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (active === last || !panel.contains(active))) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      (panel.querySelector<HTMLElement>('[autofocus], [data-autofocus]') || panel).focus();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey, true);
      const i = stack.indexOf(token);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      // Only restore focus if the trigger is still in the document.
      if (previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] sm:p-4 animate-in fade-in duration-150"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
      role="presentation"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative w-full ${SIZES[size]} bg-surface border border-line shadow-dialog rounded-t-2xl sm:rounded-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] outline-none animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 pb-safe`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
      >
        {(title || mascot) ? (
          <div className="px-6 pt-6 pb-2 flex items-start gap-4 shrink-0">
            {mascot && (
              <div className="shrink-0 w-12 h-12 rounded-xl bg-sunken flex items-center justify-center">
                <PenkoMascot size={40} pose={mascot} showBook={false} />
              </div>
            )}
            <div className="flex-1 min-w-0 pt-0.5">
              {title && <h2 id={titleId} className="text-lg font-semibold text-ink leading-snug">{title}</h2>}
              {description && <p id={descId} className="text-sm text-ink-soft mt-1 leading-relaxed">{description}</p>}
            </div>
            <button onClick={() => onCloseRef.current()} className="btn btn-ghost btn-sm btn-icon -mr-2 -mt-1 shrink-0" aria-label={closeLabel}>
              <CloseIcon size={18} />
            </button>
          </div>
        ) : (
          <button onClick={() => onCloseRef.current()} className="btn btn-ghost btn-sm btn-icon absolute right-3 top-3 z-10" aria-label={closeLabel}>
            <CloseIcon size={18} />
          </button>
        )}
        {children && <div className="px-6 py-4 overflow-y-auto scroll-thin flex flex-col gap-4">{children}</div>}
        {footer && <div className="px-6 pb-6 pt-2 flex flex-wrap justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

export default Dialog;
