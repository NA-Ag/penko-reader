import React, { useMemo } from 'react';
import { BookMeta, LanguageCode, Translation } from '../../types';
import { fmt } from '../../utils/translations';
import { loadSessions, summarize } from '../../utils/stats';
import { PenkoMascot } from '../PenkoMascot';
import BookCover from '../library/BookCover';
import { formatLabel, minutesLeft, progressPercent } from '../library/bookVisuals';
import { ArrowRightIcon, BoltIcon, BookOpenIcon, FlameIcon, PlusIcon, TargetIcon } from '../ui/Icons';

interface HomeViewProps {
  t: Translation;
  language: LanguageCode;
  books: BookMeta[];
  statsVersion: number;
  onContinue: (book: BookMeta) => void;
  onSpeedRead: (book: BookMeta) => void;
  onSelectBook: (book: BookMeta) => void;
  onOpenLibrary: () => void;
  onOpenReader: () => void;
  onOpenTraining: () => void;
  onImportClick: () => void;
}

const greeting = (t: Translation): string => {
  const h = new Date().getHours();
  return h < 12 ? t.goodMorning : h < 18 ? t.goodAfternoon : t.goodEvening;
};

/** Opens on what you're reading, then what you read recently, then your habits. */
const HomeView: React.FC<HomeViewProps> = ({ t, language, books, statsVersion, onContinue, onSpeedRead, onSelectBook, onOpenLibrary, onOpenReader, onOpenTraining, onImportClick }) => {
  const { current, shelf } = useMemo(() => {
    const recent = [...books].sort((a, b) => b.lastRead - a.lastRead);
    // Prefer a book you're partway through over one you just imported (import time also
    // counts as "last read"), then any unfinished book, then whatever was opened last.
    const current =
      recent.find(b => { const p = progressPercent(b); return p > 0 && p < 100; }) ||
      recent.find(b => progressPercent(b) < 100) ||
      recent[0] || null;
    return { current, shelf: recent.filter(b => b.id !== current?.id).slice(0, 10) };
  }, [books]);
  const currentPct = current ? progressPercent(current) : 0;
  const currentLeft = current ? minutesLeft(current) : null;
  const stats = useMemo(() => summarize(loadSessions()), [statsVersion]);
  const wordsThisWeek = stats.last7.reduce((sum, d) => sum + d.words, 0);
  const today = new Date().toLocaleDateString(language, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="flex flex-col gap-10 animate-in fade-in duration-300">
      {/* Greeting */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted capitalize">{today}</p>
          <h1 className="display text-3xl md:text-4xl mt-1">{greeting(t)}</h1>
        </div>
        <div className="shrink-0 animate-penko-bob hidden sm:block">
          <PenkoMascot size={56} pose="idle" />
        </div>
      </header>

      {/* Continue reading, or the first-run welcome */}
      {current ? (
        <section className="card p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:gap-8" aria-label={t.continueReading}>
          <button onClick={() => onSelectBook(current)} className="w-28 sm:w-36 shrink-0 self-center sm:self-start transition-transform hover:-translate-y-0.5" aria-label={current.title}>
            <BookCover book={current} size="md" />
          </button>
          <div className="flex-1 min-w-0 flex flex-col">
            <span className="eyebrow">{t.continueReading}</span>
            <h2 className="display text-2xl md:text-[28px] leading-tight mt-2 line-clamp-2">{current.title}</h2>
            <p className="text-sm text-ink-soft mt-1">{current.author || t.unknownAuthor}</p>

            <div className="mt-5 max-w-md">
              <div className="progress"><span style={{ width: `${currentPct}%` }} /></div>
              <p className="text-xs text-muted mt-2 tabular">
                {currentPct >= 100 ? t.finished : `${currentPct}%`}
                {currentLeft !== null && currentPct < 100 && <> · {fmt(t.minutesLeft, { count: currentLeft })}</>}
                <> · {formatLabel(current.fileType)}</>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 mt-auto pt-6">
              <button onClick={() => onContinue(current)} className="btn btn-primary">
                <BookOpenIcon size={16} /> {t.continueAction}
              </button>
              <button onClick={() => onSpeedRead(current)} className="btn btn-secondary">
                <BoltIcon size={16} /> {t.speedRead}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="card p-8 sm:p-10 flex flex-col items-center text-center gap-4">
          <PenkoMascot size={88} pose="talk" />
          <div>
            <h2 className="display text-2xl">{t.emptyLibraryTitle}</h2>
            <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto leading-relaxed">{t.emptyLibraryDesc}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            <button onClick={onImportClick} className="btn btn-primary"><PlusIcon size={16} /> {t.importBooks}</button>
            <button onClick={onOpenReader} className="btn btn-secondary"><BoltIcon size={16} /> {t.trySample}</button>
          </div>
        </section>
      )}

      {/* Recently opened */}
      {shelf.length > 0 && (
        <section aria-labelledby="home-recent">
          <div className="flex items-center justify-between mb-4">
            <h2 id="home-recent" className="text-base font-semibold text-ink">{t.recentlyOpened}</h2>
            <button onClick={onOpenLibrary} className="btn btn-ghost btn-sm">{t.viewAll} <ArrowRightIcon size={14} /></button>
          </div>
          <div className="flex gap-4 sm:gap-5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 pb-2">
            {shelf.map(book => <ShelfItem key={book.id} book={book} onSelect={onSelectBook} />)}
          </div>
        </section>
      )}

      {/* Habits and tools */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 card p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-ink">{t.yourProgress}</h2>
            <button onClick={onOpenTraining} className="btn btn-ghost btn-sm">{t.viewAll} <ArrowRightIcon size={14} /></button>
          </div>
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-xs text-muted flex items-center gap-1"><FlameIcon size={14} className="text-accent" /> {t.statsStreak}</dt>
              <dd className="text-2xl font-semibold tabular text-ink mt-1">{stats.streakDays}<span className="text-sm font-normal text-muted"> {t.days}</span></dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t.wordsThisWeek}</dt>
              <dd className="text-2xl font-semibold tabular text-ink mt-1">{wordsThisWeek.toLocaleString(language)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t.statsBestWpm}</dt>
              <dd className="text-2xl font-semibold tabular text-ink mt-1">{stats.bestWpm || '—'}<span className="text-sm font-normal text-muted"> wpm</span></dd>
            </div>
          </dl>
          <WeekBars days={stats.last7} language={language} />
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
          <ToolCard icon={<BoltIcon size={20} />} title={t.speedReader} desc={t.speedReaderDesc} onClick={onOpenReader} />
          <ToolCard icon={<TargetIcon size={20} />} title={t.speedTraining} desc={t.trainingDesc} onClick={onOpenTraining} />
        </div>
      </section>
    </div>
  );
};

const ShelfItem = React.memo<{ book: BookMeta; onSelect: (book: BookMeta) => void }>(({ book, onSelect }) => {
  const pct = progressPercent(book);
  return (
    <button onClick={() => onSelect(book)} className="group w-24 sm:w-28 shrink-0 self-start text-left flex flex-col" title={book.title}>
      <div className="transition-transform duration-200 group-hover:-translate-y-1">
        <BookCover book={book} size="sm" />
      </div>
      <p className="text-[13px] font-medium text-ink mt-2.5 leading-snug line-clamp-2">{book.title}</p>
      {pct > 0 && <div className="progress mt-1.5 h-0.5"><span style={{ width: `${pct}%` }} /></div>}
    </button>
  );
});
ShelfItem.displayName = 'ShelfItem';

const ToolCard: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void }> = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} className="card p-5 flex items-start gap-4 text-left hover:border-ink/20 hover:shadow-lift transition-all group">
    <span className="w-10 h-10 shrink-0 rounded-lg bg-accent-soft text-accent-ink flex items-center justify-center">{icon}</span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="block text-sm text-ink-soft mt-0.5 leading-snug">{desc}</span>
    </span>
    <ArrowRightIcon size={16} className="text-muted group-hover:text-ink group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
  </button>
);

/** Seven small bars, today highlighted. */
const WeekBars: React.FC<{ days: { date: string; words: number }[]; language: LanguageCode }> = ({ days, language }) => {
  const max = Math.max(1, ...days.map(d => d.words));
  return (
    <div className="mt-6 flex items-end gap-2 h-20" role="img" aria-label={days.map(d => `${d.date}: ${d.words}`).join(', ')}>
      {days.map((d, i) => {
        const isToday = i === days.length - 1;
        const h = d.words > 0 ? Math.max(6, (d.words / max) * 64) : 3;
        const weekday = new Date(d.date + 'T12:00:00').toLocaleDateString(language, { weekday: 'narrow' });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.words}`}>
            <div className={`w-full max-w-[28px] rounded-t-[3px] ${d.words === 0 ? 'bg-sunken' : isToday ? 'bg-accent' : 'bg-accent/35'}`} style={{ height: h }} />
            <span className={`text-[10px] ${isToday ? 'text-ink font-semibold' : 'text-muted'}`}>{weekday}</span>
          </div>
        );
      })}
    </div>
  );
};

export default HomeView;
