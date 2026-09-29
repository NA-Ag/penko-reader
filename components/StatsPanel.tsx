import React, { useMemo } from 'react';
import { Translation } from '../types';
import { loadSessions, summarize } from '../utils/stats';
import { PenkoMascot } from './PenkoMascot';

interface StatsPanelProps {
  t: Translation;
  /** Bump to force a re-read of stored sessions. */
  refreshKey?: number;
  /** Omit the built-in "Your progress" heading when the parent renders its own. */
  hideHeading?: boolean;
}

const formatNumber = (n: number) => n.toLocaleString();

const parseKey = (dateKey: string): Date => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const weekdayInitial = (dateKey: string): string =>
  parseKey(dateKey).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 1).toUpperCase();

const formatDate = (dateKey: string): string =>
  parseKey(dateKey).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

const StatTile: React.FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <div className="card p-4 flex flex-col gap-1 min-w-0">
    <span className="text-xs text-muted truncate">{label}</span>
    <span className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-2xl font-semibold tabular text-ink leading-tight truncate">{value}</span>
      {unit && <span className="text-xs text-muted">{unit}</span>}
    </span>
  </div>
);

/** Reading & training progress: stat tiles plus a dependency-free 7-day bar chart. */
const StatsPanel: React.FC<StatsPanelProps> = React.memo(({ t, refreshKey = 0, hideHeading = false }) => {
  // Sessions live in localStorage; re-read only when the parent bumps refreshKey.
  const summary = useMemo(() => summarize(loadSessions()), [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...summary.last7.map(d => d.words));
  const hasData = summary.sessions > 0;
  const todayKey = summary.last7[summary.last7.length - 1]?.date;

  return (
    <section className="w-full flex flex-col gap-4" aria-label={t.yourProgress}>
      {!hideHeading && <h2 className="text-lg font-semibold text-ink">{t.yourProgress}</h2>}

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-line p-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-sunken flex items-center justify-center">
            <PenkoMascot size={44} pose="talk" showBook={false} />
          </div>
          <p className="text-sm text-ink-soft leading-relaxed max-w-prose">{t.statsEmpty}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label={t.statsSessions} value={formatNumber(summary.sessions)} />
            <StatTile label={t.statsTotalWords} value={formatNumber(summary.totalWords)} />
            <StatTile label={t.statsBestWpm} value={formatNumber(summary.bestWpm)} unit="wpm" />
            <StatTile label={t.statsStreak} value={formatNumber(summary.streakDays)} unit={t.days} />
          </div>

          <figure className="card p-5 flex flex-col gap-3 min-w-0">
            <figcaption className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{t.statsLast7}</span>
              <span className="text-xs text-muted tabular">{formatNumber(max)} {t.words}</span>
            </figcaption>
            <div className="flex items-end gap-2 sm:gap-3 h-28" role="img" aria-label={t.statsLast7}>
              {summary.last7.map((day) => {
                const heightPct = day.words > 0 ? Math.max(6, (day.words / max) * 100) : 0;
                const isToday = day.date === todayKey;
                const label = `${formatDate(day.date)}: ${formatNumber(day.words)} ${t.words}`;
                return (
                  <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1.5 group" title={label}>
                    <span className="text-[10px] tabular text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity leading-none select-none">
                      {day.words > 0 ? formatNumber(day.words) : ''}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      {day.words > 0 ? (
                        <div
                          className={`w-full rounded-t-md transition-colors ${isToday ? 'bg-accent' : 'bg-accent/40 group-hover:bg-accent/60'}`}
                          style={{ height: `${heightPct}%` }}
                          aria-hidden="true"
                        />
                      ) : (
                        <div className="w-full h-1 rounded-full bg-sunken" aria-hidden="true" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 sm:gap-3">
              {summary.last7.map((day) => (
                <span
                  key={day.date}
                  className={`flex-1 text-center text-[11px] select-none ${day.date === todayKey ? 'text-ink font-medium' : 'text-muted'}`}
                >
                  {weekdayInitial(day.date)}
                </span>
              ))}
            </div>
          </figure>
        </>
      )}
    </section>
  );
});

StatsPanel.displayName = 'StatsPanel';

export default StatsPanel;
