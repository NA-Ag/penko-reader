import React from 'react';
import { AppView, Translation } from '../../types';
import { PenkoMascot } from '../PenkoMascot';
import { BoltIcon, BookOpenIcon, CogIcon, HomeIcon, TargetIcon } from '../ui/Icons';

interface AppShellProps {
  t: Translation;
  view: AppView;
  /** Hide all navigation chrome (immersive reading). */
  immersive: boolean;
  onNavigate: (view: AppView) => void;
  onOpenSettings: () => void;
  children: React.ReactNode;
}

type NavItem = { id: AppView; label: string; icon: (size: number) => React.ReactNode };

const Brand: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="flex items-center gap-2.5 rounded-lg -mx-1 px-1 py-1 hover:bg-sunken transition-colors" aria-label="Penko Reader">
    <PenkoMascot size={30} pose="idle" showBook={false} />
    <span className="font-serif text-[17px] font-semibold tracking-tight text-ink">Penko Reader</span>
  </button>
);

/**
 * Navigation frame: a quiet sidebar on desktop and a bottom tab bar on phones.
 * When `immersive` is set the children render full-bleed with no chrome at all.
 */
const AppShell: React.FC<AppShellProps> = ({ t, view, immersive, onNavigate, onOpenSettings, children }) => {
  const items: NavItem[] = [
    { id: 'home', label: t.home, icon: (s) => <HomeIcon size={s} /> },
    { id: 'library', label: t.library, icon: (s) => <BookOpenIcon size={s} /> },
    { id: 'reader', label: t.speedReader, icon: (s) => <BoltIcon size={s} /> },
    { id: 'training', label: t.training, icon: (s) => <TargetIcon size={s} /> }
  ];
  const isActive = (id: AppView) => view === id || (id === 'library' && view === 'book-reader');

  if (immersive) return <>{children}</>;

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] btn btn-secondary">Skip to content</a>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-line bg-canvas px-4 py-5 z-30">
        <div className="px-2"><Brand onClick={() => onNavigate('home')} /></div>
        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Main">
          {items.map(item => {
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 h-9 px-3 rounded-lg text-sm transition-colors ${
                  active ? 'bg-sunken text-ink font-medium' : 'text-ink-soft hover:bg-sunken/70 hover:text-ink'
                }`}
              >
                <span className={active ? 'text-accent' : 'text-muted'}>{item.icon(18)}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <button onClick={onOpenSettings} className="flex items-center gap-3 h-9 px-3 rounded-lg text-sm text-ink-soft hover:bg-sunken/70 hover:text-ink transition-colors">
            <span className="text-muted"><CogIcon size={18} /></span>
            {t.settings}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      {/* The safe-area padding sits outside the fixed-height row so notched phones don't squash it. */}
      <header className="md:hidden sticky top-0 z-30 bg-canvas/90 backdrop-blur border-b border-line pt-safe">
        <div className="flex items-center justify-between px-4 h-14">
          <Brand onClick={() => onNavigate('home')} />
          <button onClick={onOpenSettings} className="btn btn-ghost btn-icon" aria-label={t.settings}><CogIcon size={20} /></button>
        </div>
      </header>

      <main id="main" className="md:pl-60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 md:pt-10 pb-28 md:pb-16">
          {children}
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/95 backdrop-blur border-t border-line pb-safe" aria-label="Main">
        <div className="grid grid-cols-4">
          {items.map(item => {
            const active = isActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium transition-colors ${active ? 'text-accent' : 'text-muted'}`}
              >
                {item.icon(22)}
                <span className="truncate max-w-full px-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default React.memo(AppShell);
