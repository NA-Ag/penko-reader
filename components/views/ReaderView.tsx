import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageCode, LANGUAGE_CODES, ReaderStatus, ReadingSession, StoredBook, Translation } from '../../types';
import { AppSettings, SettingsUpdater } from '../../hooks/useSettings';
import { RsvpPlayer, useRsvpPlayer } from '../../hooks/useRsvpPlayer';
import { DEMO_TEXTS } from '../../utils/translations';
import { addSession } from '../../utils/stats';
import { getWpmLabel } from '../../utils/wpmUtils';
import Controls from '../Controls';
import OrpDisplay from '../OrpDisplay';
import ReaderInput from '../ReaderInput';
import FullTextDisplay from '../FullTextDisplay';
import { PenkoMascot } from '../PenkoMascot';
import { BackIcon, KeyboardIcon, PauseIcon, PlayIcon, RestartIcon, SpinnerIcon } from '../ui/Icons';

interface ReaderViewProps {
  t: Translation;
  settings: AppSettings;
  update: SettingsUpdater;
  player: RsvpPlayer;
  currentBook: Pick<StoredBook, 'id' | 'title' | 'author'> | null;
  loadingBook: boolean;
  resumeText: string;
  onBack: () => void;
  onContentReady: (text: string, lang: LanguageCode) => void;
  onDefine: (word: string) => void;
  onSessionSaved?: (session: ReadingSession) => void;
}

const formatTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** True for elements where keys should type or adjust a value rather than drive the reader. */
const isTextEntry = (el: HTMLElement | null): boolean => {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
};

interface DemoPreviewProps {
  t: Translation;
  lang: LanguageCode;
  wpm: number;
  fontSize: number;
  pauseOnPunctuation: boolean;
  chunkSize: number;
  /** Receives the demo's toggle so the parent's Space shortcut can drive it. */
  toggleRef: React.MutableRefObject<(() => void) | null>;
}

/**
 * The live preview on the setup screen. It owns its own player so its ticks re-render
 * only this card, and it unmounts (stopping its timer) as soon as reading starts.
 */
const DemoPreview: React.FC<DemoPreviewProps> = React.memo(({ t, lang, wpm, fontSize, pauseOnPunctuation, chunkSize, toggleRef }) => {
  const demo = useRsvpPlayer({ initialWpm: wpm, pauseOnPunctuation, chunkSize });
  const { load, setWpm, restart, toggle, status, currentWord } = demo;
  const demoText = DEMO_TEXTS[lang] || DEMO_TEXTS.en;

  useEffect(() => { load(demoText, lang); }, [demoText, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setWpm(wpm); }, [wpm, setWpm]);
  // Rewind when the sentence ends so the next press replays it.
  useEffect(() => { if (status === ReaderStatus.COMPLETED) restart(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  toggleRef.current = toggle;
  useEffect(() => () => { toggleRef.current = null; }, [toggleRef]);

  const isPlaying = status === ReaderStatus.PLAYING;
  return (
    <div className="flex flex-col gap-4">
      <div className="well h-28 flex items-center justify-center relative overflow-hidden">
        <div className="absolute left-0 right-0 top-1/2 h-px bg-red-500/15 pointer-events-none" />
        <OrpDisplay word={currentWord} fontSize={Math.min(fontSize, 44)} t={t} contentLanguage={lang} />
      </div>
      <div className="flex items-center justify-center gap-3">
        <button onClick={restart} className="btn btn-secondary btn-icon rounded-full" title={t.restart} aria-label={t.restart}>
          <RestartIcon size={18} />
        </button>
        <button onClick={toggle} className="btn btn-primary h-12 w-12 px-0 rounded-full" title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} className="pl-0.5" />}
        </button>
      </div>
    </div>
  );
});
DemoPreview.displayName = 'DemoPreview';

/** The RSVP speed reader: a setup screen, then a distraction-free reading screen. */
const ReaderView: React.FC<ReaderViewProps> = ({ t, settings, update, player, currentBook, loadingBook, resumeText, onBack, onContentReady, onDefine, onSessionSaved }) => {
  const [showFullText, setShowFullText] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const isReading = player.status !== ReaderStatus.IDLE && player.tokens.length > 0;
  const demoToggleRef = useRef<(() => void) | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Latest values for handlers that are bound once.
  const live = useRef({ player, isReading, update, focusMode: settings.focusMode, onBack, currentBook, onSessionSaved });
  live.current = { player, isReading, update, focusMode: settings.focusMode, onBack, currentBook, onSessionSaved };

  // Save a reading session once per completed run.
  const savedRef = useRef(false);
  useEffect(() => {
    const { player: p, currentBook: book, onSessionSaved: onSaved } = live.current;
    if (p.status === ReaderStatus.PLAYING) {
      savedRef.current = false;
      return;
    }
    if (p.status !== ReaderStatus.COMPLETED || savedRef.current) return;
    savedRef.current = true;
    const snap = p.getSession();
    if (snap.words >= 30) {
      const session = addSession({ date: Date.now(), words: snap.words, durationMs: snap.durationMs, wpm: snap.wpm, peakWpm: snap.peakWpm, mode: 'reader', bookId: book?.id, language: p.language });
      onSaved?.(session);
    }
  }, [player.status]);

  // Move focus into the reading stage when reading starts (the Start button unmounts).
  useEffect(() => {
    if (isReading) stageRef.current?.focus({ preventScroll: true });
  }, [isReading]);

  // Keyboard shortcuts, bound once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { player: p, isReading: reading, update: set, focusMode, onBack: back } = live.current;
      const target = e.target as HTMLElement | null;
      if (isTextEntry(target)) {
        if (e.key === 'Escape') target!.blur();
        return;
      }
      const onRange = target instanceof HTMLInputElement && target.type === 'range';
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          // Drop focus from a clicked button so the keyup doesn't "click" it a second time.
          if (target instanceof HTMLButtonElement) target.blur();
          if (reading) p.toggle(); else demoToggleRef.current?.();
          break;
        case 'KeyR':
          if (reading && !e.metaKey && !e.ctrlKey) p.restart();
          break;
        case 'ArrowLeft':
          if (reading && !onRange) { e.preventDefault(); p.pause(); p.step(-5); }
          break;
        case 'ArrowRight':
          if (reading && !onRange) { e.preventDefault(); p.pause(); p.step(5); }
          break;
        case 'ArrowUp':
        case 'Equal':
        case 'NumpadAdd':
          if (onRange) break;
          e.preventDefault();
          set(s => ({ wpm: Math.min(1200, s.wpm + 25) }));
          break;
        case 'ArrowDown':
        case 'Minus':
        case 'NumpadSubtract':
          if (onRange) break;
          e.preventDefault();
          set(s => ({ wpm: Math.max(100, s.wpm - 25) }));
          break;
        case 'KeyF':
          if (reading && !e.metaKey && !e.ctrlKey) set(s => ({ focusMode: !s.focusMode }));
          break;
        case 'Escape':
          if (e.defaultPrevented) break;
          if (focusMode) set({ focusMode: false });
          else if (reading) p.stop();
          else back();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Stable callbacks so memoized children (Controls, ReaderInput, FullTextDisplay) skip re-renders.
  const controlsProps = useMemo(() => ({
    wpm: settings.wpm,
    fontSize: settings.fontSize,
    chunkSize: settings.chunkSize,
    t,
    contentLanguage: settings.contentLanguage,
    onWpmChange: (v: number) => update({ wpm: v }),
    onFontSizeChange: (v: number) => update({ fontSize: v }),
    onChunkSizeChange: (v: number) => update({ chunkSize: v }),
    dyslexicMode: settings.dyslexicMode,
    pauseOnPunctuation: settings.pauseOnPunctuation,
    clickToDefine: settings.clickToDefine,
    onlineDictionary: settings.onlineDictionary,
    verticalMode: settings.verticalMode,
    focusMode: settings.focusMode,
    onToggleDyslexic: () => update(s => ({ dyslexicMode: !s.dyslexicMode })),
    onTogglePauseOnPunctuation: () => update(s => ({ pauseOnPunctuation: !s.pauseOnPunctuation })),
    onToggleClickToDefine: () => update(s => ({ clickToDefine: !s.clickToDefine })),
    onToggleOnlineDictionary: () => update(s => ({ onlineDictionary: !s.onlineDictionary })),
    onToggleVerticalMode: () => update(s => ({ verticalMode: !s.verticalMode })),
    onToggleFocusMode: () => update(s => ({ focusMode: !s.focusMode })),
    // The setup screen renders its own transport inside DemoPreview.
    status: ReaderStatus.IDLE,
    progress: 0,
    onTogglePlay: () => demoToggleRef.current?.(),
    onRestart: () => {},
    hideTransport: true
  }), [t, update, settings.wpm, settings.fontSize, settings.chunkSize, settings.contentLanguage, settings.dyslexicMode,
    settings.pauseOnPunctuation, settings.clickToDefine, settings.onlineDictionary, settings.verticalMode, settings.focusMode]);

  const handleLanguageChange = useCallback((lang: LanguageCode) => {
    update(s => ({ contentLanguage: lang, verticalMode: lang === 'ja' || lang === 'zh' ? s.verticalMode : false }));
  }, [update]);

  const handleWordClick = useCallback((i: number) => {
    live.current.player.pause();
    live.current.player.seekTo(i);
  }, []);

  const startOver = useCallback(() => {
    live.current.player.restart();
    live.current.player.play();
  }, []);

  // ---------------------------------------------------------------- setup
  if (!isReading) {
    const hasText = player.tokens.length > 0;
    const atEnd = player.currentIndex >= player.tokens.length - 1;
    const canResume = hasText && player.currentIndex > 0 && !atEnd;
    return (
      <div className="flex-1 w-full flex flex-col gap-8 py-2 animate-in fade-in duration-300">
        <header className="flex flex-col gap-1">
          <h1 className="display text-3xl">{t.speedReader}</h1>
          <p className="text-ink-soft">{t.speedReaderDesc}</p>
          {currentBook && (
            <div className="mt-3 inline-flex items-center gap-3 self-start rounded-lg bg-sunken px-3 py-2 max-w-full">
              <span className="eyebrow shrink-0">{t.speedRead}</span>
              <span className="font-serif font-semibold text-ink truncate">{currentBook.title}</span>
              {currentBook.author && <span className="text-sm text-muted truncate hidden sm:inline">{currentBook.author}</span>}
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] gap-6 items-start">
          <div className="card p-5 md:p-6 flex flex-col gap-5">
            {loadingBook ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-ink-soft min-h-[320px]" role="status">
                <SpinnerIcon size={28} className="text-accent" />
                {t.processing}
              </div>
            ) : (
              <ReaderInput
                currentLang={settings.contentLanguage}
                availableLanguages={LANGUAGE_CODES}
                t={t}
                initialText={currentBook ? '' : resumeText}
                onContentReady={onContentReady}
                onLanguageChange={handleLanguageChange}
              />
            )}

            {hasText && !loadingBook && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-5 border-t border-line">
                <span className="text-sm text-muted tabular sm:mr-auto">
                  {player.rawTokens.length.toLocaleString()} {t.words} · ~{Math.max(1, Math.ceil(player.rawTokens.length / settings.wpm))} {t.minutes}
                </span>
                <div className="flex gap-2">
                  {canResume && (
                    <button onClick={startOver} className="btn btn-secondary btn-lg flex-1 sm:flex-none">
                      {t.startOver}
                    </button>
                  )}
                  <button onClick={canResume ? player.play : startOver} className="btn btn-primary btn-lg flex-1 sm:flex-none">
                    <PlayIcon size={18} />
                    {canResume ? t.resume : t.start}
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="card p-5 md:p-6 flex flex-col gap-6 lg:sticky lg:top-6">
            <DemoPreview
              t={t}
              lang={settings.contentLanguage}
              wpm={settings.wpm}
              fontSize={settings.fontSize}
              pauseOnPunctuation={settings.pauseOnPunctuation}
              chunkSize={settings.chunkSize}
              toggleRef={demoToggleRef}
            />
            <Controls {...controlsProps} />
          </aside>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------- reading
  const isPlaying = player.status === ReaderStatus.PLAYING;
  const isDone = player.status === ReaderStatus.COMPLETED;
  const snap = isDone ? player.getSession() : null;
  const vertical = settings.verticalMode && (settings.contentLanguage === 'ja' || settings.contentLanguage === 'zh');
  const splitVertical = vertical && showFullText && !settings.focusMode;

  return (
    <div className={`w-full flex flex-col flex-1 animate-in fade-in duration-300 ${settings.dyslexicMode ? 'font-dyslexic' : ''}`}>
      {/* Minimal top bar */}
      <div className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-1">
          <button onClick={player.stop} className="btn btn-ghost btn-icon" title={t.back} aria-label={t.back}><BackIcon size={18} /></button>
          <button onClick={player.toggle} className="btn btn-ghost btn-icon" title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} className="pl-0.5" />}
          </button>
          <button onClick={player.restart} className="btn btn-ghost btn-icon" title={t.restart} aria-label={t.restart}><RestartIcon size={18} /></button>
        </div>
        {currentBook && <span className="hidden md:block text-sm text-muted truncate font-serif">{currentBook.title}</span>}
        <div className="flex items-center gap-1">
          <button onClick={() => update(s => ({ wpm: Math.max(100, s.wpm - 25) }))} className="btn btn-ghost btn-sm btn-icon text-base" aria-label="Slower">−</button>
          <div className="text-center min-w-[5.5rem]" title={getWpmLabel(settings.wpm, t)}>
            <div className="text-sm font-medium text-ink tabular leading-tight">{settings.wpm} wpm</div>
            <div className="text-[11px] text-muted truncate leading-tight">{getWpmLabel(settings.wpm, t)}</div>
          </div>
          <button onClick={() => update(s => ({ wpm: Math.min(1200, s.wpm + 25) }))} className="btn btn-ghost btn-sm btn-icon text-base" aria-label="Faster">+</button>
        </div>
      </div>

      <main className={`w-full flex gap-6 min-w-0 flex-1 ${splitVertical ? 'flex-row-reverse h-[calc(100vh-8rem)]' : 'flex-col'}`}>
        {/* Word stage */}
        <div
          ref={stageRef}
          tabIndex={-1}
          aria-label={t.speedReader}
          className={`relative flex flex-col items-center justify-center outline-none ${splitVertical ? 'w-1/3 h-full' : 'w-full min-h-[60vh]'}`}
        >
          <div className={`absolute bg-red-500/10 pointer-events-none ${vertical ? 'h-full w-px left-1/2' : 'w-full h-px top-1/2'}`}></div>
          {isDone && snap ? (
            <div className="relative flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in-95 duration-300 py-6 bg-canvas px-6" role="status">
              <PenkoMascot size={64} pose="jump" showBook={false} />
              <div>
                <h2 className="display text-2xl">{t.readingComplete}</h2>
                <p className="text-sm text-ink-soft mt-1">{t.readingCompleteDesc}</p>
              </div>
              <dl className="grid grid-cols-3 gap-8 mt-2">
                <div className="flex flex-col-reverse"><dt className="text-xs text-muted mt-0.5">{t.resultWords}</dt><dd className="text-2xl font-semibold text-ink tabular">{snap.words.toLocaleString()}</dd></div>
                <div className="flex flex-col-reverse"><dt className="text-xs text-muted mt-0.5">{t.resultTime}</dt><dd className="text-2xl font-semibold text-ink tabular">{formatTime(snap.durationMs)}</dd></div>
                <div className="flex flex-col-reverse"><dt className="text-xs text-muted mt-0.5">{t.resultWpm}</dt><dd className="text-2xl font-semibold text-ink tabular">{snap.wpm}</dd></div>
              </dl>
              <div className="flex gap-2 mt-2">
                <button onClick={player.stop} className="btn btn-secondary">{t.back}</button>
                <button onClick={startOver} className="btn btn-primary" autoFocus>{t.startOver}</button>
              </div>
            </div>
          ) : (
            <OrpDisplay word={player.currentWord} fontSize={settings.fontSize} t={t} verticalMode={vertical} contentLanguage={settings.contentLanguage} />
          )}
        </div>

        {/* Progress */}
        {!isDone && !splitVertical && (
          <div className="w-full max-w-3xl mx-auto flex items-center gap-3">
            <span className="text-xs text-muted tabular w-20 text-right">{(player.rawIndex + 1).toLocaleString()} / {player.rawTokens.length.toLocaleString()}</span>
            <input
              type="range"
              className="range flex-1"
              min={0}
              max={100}
              step={0.1}
              value={player.progress}
              onChange={(e) => { player.pause(); player.seekPercent(Number(e.target.value)); }}
              aria-label={t.progress}
              aria-valuetext={`${Math.round(player.progress)}%`}
              style={{ ['--fill' as any]: `${player.progress}%` }}
            />
            <span className="text-xs text-muted tabular w-10">{Math.round(player.progress)}%</span>
          </div>
        )}

        {/* Secondary row */}
        {!settings.focusMode && (
          <div className={`flex items-center justify-center gap-2 flex-wrap ${splitVertical ? 'flex-col h-full w-auto' : 'w-full'}`}>
            <button onClick={() => setShowFullText(v => !v)} className="btn btn-ghost btn-sm" aria-expanded={showFullText}>
              {showFullText ? t.hideFullText : t.fullText}
            </button>
            <button onClick={() => setShowHints(v => !v)} className="btn btn-ghost btn-sm" aria-expanded={showHints} aria-label={showHints ? undefined : t.keyboardHints}>
              <KeyboardIcon size={16} /> {showHints && <span className="text-muted font-normal whitespace-normal text-left">{t.keyboardHints}</span>}
            </button>
          </div>
        )}

        {showFullText && !settings.focusMode && (
          <div className={`animate-in fade-in duration-300 pb-6 ${vertical ? 'w-2/3 h-full' : 'w-full'}`}>
            <FullTextDisplay
              tokens={player.tokens}
              currentIndex={player.currentIndex}
              t={t}
              onWordClick={handleWordClick}
              onDefine={onDefine}
              clickToDefine={settings.clickToDefine}
              verticalMode={vertical}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default ReaderView;
