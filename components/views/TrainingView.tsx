import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LANGUAGE_CODES, LANGUAGE_NAMES, LanguageCode, ReaderStatus, ReadingSession, TrainingDrill, Translation } from '../../types';
import { LIBRARY } from '../../utils/library';
import { addSession, loadSessions, summarize } from '../../utils/stats';
import { useRsvpPlayer } from '../../hooks/useRsvpPlayer';
import OrpDisplay from '../OrpDisplay';
import StatsPanel from '../StatsPanel';
import Slider from '../ui/Slider';
import Toggle from '../ui/Toggle';
import { PenkoMascot } from '../PenkoMascot';
import { BackIcon, BoltIcon, BookOpenIcon, CheckIcon, PauseIcon, PlayIcon, RestartIcon, StopIcon } from '../ui/Icons';

interface TrainingViewProps {
  t: Translation;
  contentLanguage: LanguageCode;
  fontSize: number;
  dyslexicMode: boolean;
  pauseOnPunctuation: boolean;
  onBack: () => void;
  onSessionSaved?: (session: ReadingSession) => void;
}

type Screen = 'setup' | 'running' | 'results';

interface DrillResult {
  words: number;
  durationMs: number;
  wpm: number;
  peakWpm: number;
  isRecord: boolean;
}

const SPRINT_DURATIONS = [30, 60, 90, 120];

const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const DrillCard: React.FC<{ title: string; desc: string; selected: boolean; onClick: () => void; icon: React.ReactNode }> = ({ title, desc, selected, onClick, icon }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={selected}
    className={`text-left rounded-xl p-4 border transition-colors flex gap-3 items-start w-full ${
      selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-sunken'
    }`}
  >
    <span className={`shrink-0 mt-0.5 ${selected ? 'text-accent-ink' : 'text-muted'}`}>{icon}</span>
    <span className="flex flex-col gap-0.5 min-w-0">
      <span className={`text-sm font-semibold ${selected ? 'text-accent-ink' : 'text-ink'}`}>{title}</span>
      <span className="text-[13px] text-ink-soft leading-snug">{desc}</span>
    </span>
  </button>
);

const ResultTile: React.FC<{ label: string; value: string; unit?: string }> = ({ label, value, unit }) => (
  <div className="well px-4 py-4 flex flex-col gap-1 min-w-0 text-left">
    <span className="text-xs text-muted truncate">{label}</span>
    <span className="flex items-baseline gap-1.5">
      <span className="text-3xl font-semibold tabular text-ink leading-none">{value}</span>
      {unit && <span className="text-xs text-muted">{unit}</span>}
    </span>
  </div>
);

const StepHeading: React.FC<{ n: number; label: string }> = ({ n, label }) => (
  <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
    <span className="w-5 h-5 rounded-full bg-sunken text-ink-soft text-[11px] font-semibold tabular flex items-center justify-center">{n}</span>
    {label}
  </h2>
);

const TrainingView: React.FC<TrainingViewProps> = ({ t, contentLanguage, fontSize, dyslexicMode, pauseOnPunctuation, onBack, onSessionSaved }) => {
  const [screen, setScreen] = useState<Screen>('setup');
  const [drill, setDrill] = useState<TrainingDrill>('ramp');

  // Drill settings
  const [rampStart, setRampStart] = useState(200);
  const [rampTarget, setRampTarget] = useState(400);
  const [sprintWpm, setSprintWpm] = useState(500);
  const [sprintDuration, setSprintDuration] = useState(60);
  const [chunkSize, setChunkSize] = useState(2);
  const [chunkWpm, setChunkWpm] = useState(300);

  // Passage
  const [passageLang, setPassageLang] = useState<LanguageCode>(contentLanguage);
  const [bookIndex, setBookIndex] = useState(0);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [useOwnText, setUseOwnText] = useState(false);
  const [ownText, setOwnText] = useState('');

  const [result, setResult] = useState<DrillResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [statsKey, setStatsKey] = useState(0);

  const pendingStartRef = useRef(false);
  const finishedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const backToSetupRef = useRef<() => void>(() => {});

  const books = LIBRARY[passageLang] || [];

  const passageText = useMemo(() => {
    if (useOwnText) return ownText.trim();
    return books[bookIndex]?.chapters[chapterIndex]?.text || '';
  }, [useOwnText, ownText, books, bookIndex, chapterIndex]);

  const activeChunk = drill === 'chunk' ? chunkSize : 1;
  const initialWpm = drill === 'ramp' ? rampStart : drill === 'sprint' ? sprintWpm : chunkWpm;

  const finishRef = useRef<() => void>(() => {});

  const player = useRsvpPlayer({
    initialWpm,
    pauseOnPunctuation,
    chunkSize: activeChunk,
    onComplete: () => finishRef.current()
  });

  const { status, currentIndex, tokens, getSession, setWpm, load, play, toggle, stop, pause, progress } = player;

  // --- finishing a drill ------------------------------------------------------
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const snap = getSession();
    pause(); // no-op unless playing

    const previousBest = summarize(loadSessions()).bestTrainingWpm;
    const isRecord = snap.words >= 30 && snap.wpm > previousBest;

    if (snap.words >= 10) {
      const saved = addSession({
        date: Date.now(),
        words: snap.words,
        durationMs: snap.durationMs,
        wpm: snap.wpm,
        peakWpm: snap.peakWpm,
        mode: 'training',
        drill,
        language: passageLang
      });
      onSessionSaved?.(saved);
      setStatsKey(k => k + 1);
    }

    setResult({ words: snap.words, durationMs: snap.durationMs, wpm: snap.wpm, peakWpm: snap.peakWpm, isRecord });
    setScreen('results');
  }, [getSession, pause, drill, passageLang, onSessionSaved]);
  finishRef.current = finish;

  // --- starting a drill -------------------------------------------------------
  const startDrill = useCallback(() => {
    if (!passageText) return;
    finishedRef.current = false;
    setResult(null);
    setElapsedMs(0);
    setWpm(initialWpm);
    load(passageText, passageLang);
    pendingStartRef.current = true;
    setScreen('running');
  }, [passageText, passageLang, initialWpm, setWpm, load]);

  // Tokens arrive on the render after load(); begin playback once they are there.
  useEffect(() => {
    if (screen === 'running' && pendingStartRef.current && status === ReaderStatus.IDLE && tokens.length > 0) {
      pendingStartRef.current = false;
      play();
    }
  }, [screen, status, tokens.length, play]);

  // Ramp: speed rises linearly with progress through the passage.
  useEffect(() => {
    if (screen !== 'running' || drill !== 'ramp' || tokens.length === 0) return;
    const p = currentIndex / tokens.length;
    // Quantized to 5 wpm so the player only re-renders when the speed actually steps.
    setWpm(Math.round((rampStart + (rampTarget - rampStart) * p) / 5) * 5);
  }, [screen, drill, currentIndex, tokens.length, rampStart, rampTarget, setWpm]);

  // Live clock; sprint ends when the time is up.
  useEffect(() => {
    if (screen !== 'running') return;
    const id = window.setInterval(() => {
      const { durationMs } = getSession();
      setElapsedMs(prev => (Math.floor(prev / 1000) === Math.floor(durationMs / 1000) ? prev : durationMs));
      if (drill === 'sprint' && durationMs >= sprintDuration * 1000) finishRef.current();
    }, 200);
    return () => window.clearInterval(id);
  }, [screen, drill, sprintDuration, getSession]);

  // Keyboard: Space pause/resume, Escape stop.
  useEffect(() => {
    if (screen !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (e.target instanceof HTMLButtonElement) e.target.blur();
        toggle();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, toggle]);

  // The Start button unmounts; put focus on the word stage instead of losing it.
  useEffect(() => {
    if (screen === 'running') stageRef.current?.focus({ preventScroll: true });
  }, [screen]);

  // Escape on the results screen returns to setup.
  useEffect(() => {
    if (screen !== 'results') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) backToSetupRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  // Escape leaves the view from the setup screen.
  useEffect(() => {
    if (screen !== 'setup') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (e.key === 'Escape' && !e.defaultPrevented) onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, onBack]);

  const backToSetup = () => {
    stop();
    setScreen('setup');
    setStatsKey(k => k + 1);
  };
  backToSetupRef.current = backToSetup;

  const changeLang = (lang: LanguageCode) => {
    setPassageLang(lang);
    setBookIndex(0);
    setChapterIndex(0);
  };

  const drillTitle = drill === 'ramp' ? t.drillRamp : drill === 'sprint' ? t.drillSprint : t.drillChunk;

  // ============================================================================
  if (screen === 'running') {
    const isPlaying = status === ReaderStatus.PLAYING;
    const remaining = drill === 'sprint' ? Math.max(0, sprintDuration * 1000 - elapsedMs) : null;
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col gap-5 justify-center py-6 animate-in fade-in duration-300">
        <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-ink">
            <BoltIcon size={16} className="text-accent" />
            {drillTitle}
          </span>
          <span className="flex items-center gap-4 tabular text-muted">
            <span><span className="text-ink font-semibold">{Math.round(player.wpm)}</span> wpm</span>
            <span className="text-ink-soft">{remaining !== null ? formatTime(remaining) : formatTime(elapsedMs)}</span>
            <span>{Math.round(progress)}%</span>
          </span>
        </div>

        <div
          className={`card relative flex items-center justify-center min-h-[280px] md:min-h-[360px] p-8 overflow-hidden cursor-pointer ${dyslexicMode ? 'font-dyslexic' : ''}`}
          ref={stageRef}
          onClick={toggle}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); toggle(); } }}
          role="button"
          tabIndex={0}
          aria-label={isPlaying ? 'Pause' : t.resume}
        >
          <div className="absolute left-0 right-0 top-1/2 h-px bg-line pointer-events-none" />
          <OrpDisplay word={player.currentWord} fontSize={fontSize} t={t} contentLanguage={passageLang} />
          {!isPlaying && status !== ReaderStatus.COMPLETED && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-[2px] animate-in fade-in duration-150">
              <span className="btn btn-secondary shadow-lift">
                <PlayIcon size={16} /> {t.resume}
              </span>
            </div>
          )}
        </div>

        <div className="progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button type="button" onClick={toggle} aria-label={isPlaying ? 'Pause' : t.resume} className="btn btn-secondary">
            {isPlaying ? <><PauseIcon size={16} /> Pause</> : <><PlayIcon size={16} /> {t.resume}</>}
          </button>
          <button type="button" onClick={() => finishRef.current()} className="btn btn-secondary">
            <StopIcon size={16} /> {t.stopDrill}
          </button>
        </div>
        <p className="hint text-center">{t.keyboardHints}</p>
      </div>
    );
  }

  // ============================================================================
  if (screen === 'results' && result) {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center py-8 animate-in fade-in duration-300">
        <div className="card w-full max-w-lg p-6 md:p-8 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-sunken flex items-center justify-center">
            <PenkoMascot size={52} pose="jump" showBook={false} />
          </div>
          <div className="flex flex-col gap-1.5 items-center">
            <h1 className="display text-2xl md:text-3xl">{t.drillComplete}</h1>
            <span className="text-sm text-muted">{drillTitle}</span>
            {result.isRecord && (
              <span className="mt-2 inline-flex items-center gap-1.5 bg-accent-soft text-accent-ink rounded-full px-3 py-1 text-xs font-medium animate-in fade-in zoom-in-95 duration-300">
                <BoltIcon size={13} /> {t.newRecord}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <ResultTile label={t.resultWords} value={result.words.toLocaleString()} />
            <ResultTile label={t.resultTime} value={formatTime(result.durationMs)} />
            <ResultTile label={t.resultWpm} value={String(result.wpm)} unit="wpm" />
            <ResultTile label={t.resultPeak} value={String(result.peakWpm)} unit="wpm" />
          </div>

          <div className="flex gap-2 w-full flex-col-reverse sm:flex-row">
            <button type="button" onClick={backToSetup} className="btn btn-secondary flex-1">
              <BackIcon size={16} /> {t.back}
            </button>
            <button type="button" onClick={startDrill} className="btn btn-primary flex-1" autoFocus>
              <RestartIcon size={16} /> {t.tryAgain}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  return (
    <div className="flex-1 w-full flex flex-col gap-8 animate-in fade-in duration-300">
      <header className="flex flex-col gap-1.5">
        <h1 className="display text-3xl">{t.speedTraining}</h1>
        <p className="text-sm text-ink-soft max-w-prose">{t.trainingIntro}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        {/* Drill column */}
        <section className="flex flex-col gap-3 min-w-0">
          <StepHeading n={1} label={t.drill} />
          <div className="flex flex-col gap-2">
            <DrillCard title={t.drillRamp} desc={t.drillRampDesc} selected={drill === 'ramp'} onClick={() => setDrill('ramp')} icon={<BoltIcon size={20} />} />
            <DrillCard title={t.drillSprint} desc={t.drillSprintDesc} selected={drill === 'sprint'} onClick={() => setDrill('sprint')} icon={<PlayIcon size={20} />} />
            <DrillCard title={t.drillChunk} desc={t.drillChunkDesc} selected={drill === 'chunk'} onClick={() => setDrill('chunk')} icon={<BookOpenIcon size={20} />} />
          </div>

          <div className="card p-5 flex flex-col gap-5 mt-1">
            {drill === 'ramp' && (
              <>
                <Slider label={t.startWpm} value={rampStart} min={100} max={600} step={25} onChange={(v) => { setRampStart(v); if (v > rampTarget) setRampTarget(v); }} display={`${rampStart} wpm`} />
                <Slider label={t.targetWpm} value={rampTarget} min={200} max={1200} step={25} onChange={(v) => { setRampTarget(v); if (v < rampStart) setRampStart(v); }} display={`${rampTarget} wpm`} />
              </>
            )}
            {drill === 'sprint' && (
              <>
                <Slider label={t.targetWpm} value={sprintWpm} min={200} max={1500} step={25} onChange={setSprintWpm} display={`${sprintWpm} wpm`} />
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm font-medium text-ink">{t.duration}</span>
                    <span className="text-sm tabular text-ink-soft">{sprintDuration} {t.seconds}</span>
                  </div>
                  <div className="segmented w-full" role="group" aria-label={t.duration}>
                    {SPRINT_DURATIONS.map((d) => (
                      <button key={d} type="button" onClick={() => setSprintDuration(d)} aria-pressed={sprintDuration === d} className="tabular">
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {drill === 'chunk' && (
              <>
                <Slider label={t.wordsPerFlash} value={chunkSize} min={2} max={4} step={1} onChange={setChunkSize} display={String(chunkSize)} hint={t.words} />
                <Slider label={t.targetWpm} value={chunkWpm} min={150} max={900} step={25} onChange={setChunkWpm} display={`${chunkWpm} wpm`} />
              </>
            )}
          </div>
        </section>

        {/* Passage column */}
        <section className="flex flex-col gap-3 min-w-0">
          <StepHeading n={2} label={t.passage} />
          <div className="card p-5 flex flex-col gap-4">
            <Toggle label={t.useOwnText} checked={useOwnText} onChange={() => setUseOwnText(v => !v)} />

            {useOwnText ? (
              <textarea
                className="input min-h-[240px] resize-y font-serif text-[15px]"
                placeholder={t.pastePlaceholder}
                value={ownText}
                onChange={(e) => setOwnText(e.target.value)}
              />
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">{t.selectLang}</span>
                  <select className="input" value={passageLang} onChange={(e) => changeLang(e.target.value as LanguageCode)}>
                    {LANGUAGE_CODES.map((code) => (
                      <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-ink">{t.pickPassage}</span>
                  <div className="flex flex-col gap-4 max-h-[320px] overflow-y-auto scroll-thin -mx-2 px-2">
                    {books.length === 0 && <p className="text-sm text-muted">{t.emptyState}</p>}
                    {books.map((book, bIdx) => (
                      <div key={bIdx} className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2 min-w-0 px-2 pt-1">
                          <span className="text-sm font-semibold text-ink truncate">{book.title}</span>
                          <span className="text-xs text-muted truncate">{book.author}</span>
                        </div>
                        {book.chapters.map((ch, cIdx) => {
                          const selected = bIdx === bookIndex && cIdx === chapterIndex;
                          return (
                            <button
                              key={cIdx}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => { setBookIndex(bIdx); setChapterIndex(cIdx); }}
                              className={`text-left px-2 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                                selected ? 'bg-accent-soft text-accent-ink font-medium' : 'text-ink-soft hover:bg-sunken hover:text-ink'
                              }`}
                            >
                              <span className="line-clamp-1">{ch.title}</span>
                              {selected && <CheckIcon size={16} className="shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button type="button" onClick={startDrill} disabled={!passageText} className="btn btn-primary btn-lg w-full mt-1">
            <PlayIcon size={18} /> {t.startDrill}
          </button>
        </section>
      </div>

      <div className="border-t border-line pt-8">
        <StatsPanel t={t} refreshKey={statsKey} />
      </div>
    </div>
  );
};

export default TrainingView;
