import React from 'react';
import { CheckIcon, CloseIcon, InfoIcon } from './Icons';

export interface Toast { id: number; text: string; kind: 'ok' | 'warn' | 'error' }

interface ToastsProps { toasts: Toast[]; onDismiss: (id: number) => void }

/** Stacked notifications, above the mobile tab bar. */
const Toasts: React.FC<ToastsProps> = ({ toasts, onDismiss }) => {
  // The live region stays mounted so screen readers announce toasts added to it.
  return (
    <div className="fixed z-[110] bottom-20 md:bottom-6 right-4 left-4 sm:left-auto flex flex-col gap-2 sm:w-96 pointer-events-none empty:hidden" role="status" aria-live="polite">
      {toasts.map(n => (
        <div key={n.id} className="pointer-events-auto card shadow-lift px-4 py-3 flex items-start gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className={`mt-0.5 shrink-0 ${n.kind === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : n.kind === 'warn' ? 'text-accent' : 'text-red-600 dark:text-red-400'}`}>
            {n.kind === 'ok' ? <CheckIcon size={16} /> : <InfoIcon size={16} />}
          </span>
          <span className="flex-1 text-ink leading-snug">{n.text}</span>
          <button className="text-muted hover:text-ink -mr-1" onClick={() => onDismiss(n.id)} aria-label="Dismiss"><CloseIcon size={14} /></button>
        </div>
      ))}
    </div>
  );
};

export default Toasts;
