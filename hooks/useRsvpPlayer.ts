import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageCode, ReaderStatus, WordToken } from '../types';
import { chunkTokensWithStarts, stripHtml, tokenize } from '../utils/tokenizer';
import { tokenDelayMs } from '../utils/wpmUtils';

export interface RsvpSessionSnapshot {
  words: number;
  durationMs: number;
  wpm: number;
  peakWpm: number;
}

export interface UseRsvpPlayerOptions {
  initialWpm?: number;
  pauseOnPunctuation?: boolean;
  chunkSize?: number;
  onComplete?: () => void;
}

const WPM_MIN = 50;
const WPM_MAX = 1500;

const wordCount = (s: string): number => {
  let n = 0;
  let inWord = false;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 32) inWord = false;
    else if (!inWord) { inWord = true; n++; }
  }
  return n;
};

/** Index of the last chunk whose start is <= raw position. `starts` is ascending. */
const chunkIndexFor = (starts: number[], rawPos: number): number => {
  let lo = 0;
  let hi = starts.length - 1;
  if (hi < 0) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= rawPos) lo = mid; else hi = mid - 1;
  }
  return lo;
};

/**
 * The RSVP engine: owns tokens, playhead, playback timer and session accounting.
 * Shared by the speed reader and the training drills.
 *
 * The playhead is stored in raw-word space, so changing the chunk size never loses
 * your place. Every control function is referentially stable, so consumers can put
 * them in effect dependency lists without re-running effects on every word.
 */
export const useRsvpPlayer = (options: UseRsvpPlayerOptions = {}) => {
  const { initialWpm = 300, pauseOnPunctuation = true, chunkSize = 1, onComplete } = options;

  const [rawTokens, setRawTokens] = useState<WordToken[]>([]);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [rawPos, setRawPos] = useState(0);
  const [status, setStatusState] = useState<ReaderStatus>(ReaderStatus.IDLE);
  const [wpm, setWpmState] = useState(() => Math.round(Math.min(WPM_MAX, Math.max(WPM_MIN, initialWpm))));

  const { tokens, starts } = useMemo(() => chunkTokensWithStarts(rawTokens, chunkSize), [rawTokens, chunkSize]);
  const currentIndex = useMemo(() => chunkIndexFor(starts, rawPos), [starts, rawPos]);

  // --- synchronously readable mirrors (so controls can be stable callbacks) ----
  const statusRef = useRef(status);
  const rawLenRef = useRef(0);
  const startsRef = useRef(starts);
  const currentIndexRef = useRef(currentIndex);
  const wpmRef = useRef(wpm);
  startsRef.current = starts;
  currentIndexRef.current = currentIndex;
  wpmRef.current = wpm;

  // --- session accounting ---------------------------------------------------
  const sessionRef = useRef({ words: 0, activeMs: 0, playingSince: null as number | null, peakWpm: wpm });
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** All status changes go through here so the ref and the session clock never drift. */
  const setStatus = useCallback((next: ReaderStatus) => {
    const prev = statusRef.current;
    if (prev === next) return;
    const s = sessionRef.current;
    const now = performance.now();
    if (next === ReaderStatus.PLAYING && s.playingSince === null) s.playingSince = now;
    if (next !== ReaderStatus.PLAYING && s.playingSince !== null) {
      s.activeMs += now - s.playingSince;
      s.playingSince = null;
    }
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const resetSession = useCallback(() => {
    sessionRef.current = {
      words: 0,
      activeMs: 0,
      playingSince: statusRef.current === ReaderStatus.PLAYING ? performance.now() : null,
      peakWpm: wpmRef.current
    };
  }, []);

  const getSession = useCallback((): RsvpSessionSnapshot => {
    const s = sessionRef.current;
    const live = s.playingSince !== null ? performance.now() - s.playingSince : 0;
    const durationMs = s.activeMs + live;
    const minutes = durationMs / 60000;
    return {
      words: s.words,
      durationMs,
      wpm: minutes > 0 ? Math.round(s.words / minutes) : 0,
      peakWpm: Math.round(s.peakWpm)
    };
  }, []);

  // --- playback loop --------------------------------------------------------
  useEffect(() => {
    if (status !== ReaderStatus.PLAYING) return;
    const token = tokens[currentIndex];
    if (!token) {
      if (tokens.length === 0) setStatus(ReaderStatus.IDLE);
      return;
    }
    let delay = tokenDelayMs(token.word, wpm, token.hasPause, pauseOnPunctuation);
    const next = tokens[currentIndex + 1];
    if (next?.isParagraphStart) delay += (60000 / wpm) * 1.5;

    const id = window.setTimeout(() => {
      sessionRef.current.words += wordCount(token.word);
      if (!next) {
        setStatus(ReaderStatus.COMPLETED);
        onCompleteRef.current?.();
      } else {
        setRawPos(starts[currentIndex + 1]);
      }
    }, delay);
    return () => window.clearTimeout(id);
  }, [status, currentIndex, wpm, tokens, starts, pauseOnPunctuation, setStatus]);

  // --- controls (all stable) --------------------------------------------------
  const setWpm = useCallback((value: number) => {
    const clamped = Math.round(Math.min(WPM_MAX, Math.max(WPM_MIN, Number.isFinite(value) ? value : 300)));
    wpmRef.current = clamped;
    setWpmState(clamped);
    if (clamped > sessionRef.current.peakWpm) sessionRef.current.peakWpm = clamped;
  }, []);

  /** Load tokens. `startIndex` is in raw-token space (what `rawIndex` reports). */
  const loadTokens = useCallback((next: WordToken[], lang: LanguageCode = 'en', startIndex = 0) => {
    rawLenRef.current = next.length;
    setRawTokens(next);
    setLanguage(lang);
    setRawPos(Math.min(Math.max(0, Math.floor(startIndex) || 0), Math.max(0, next.length - 1)));
    setStatus(ReaderStatus.IDLE);
    resetSession();
  }, [setStatus, resetSession]);

  const load = useCallback((text: string, lang: LanguageCode = 'en', startIndex = 0) => {
    loadTokens(tokenize(stripHtml(text), lang), lang, startIndex);
  }, [loadTokens]);

  const clear = useCallback(() => loadTokens([], 'en', 0), [loadTokens]);

  /** Works immediately after `load()` in the same event handler. */
  const play = useCallback(() => {
    if (rawLenRef.current === 0) return;
    if (statusRef.current === ReaderStatus.COMPLETED) {
      setRawPos(0);
      setStatus(ReaderStatus.IDLE);
      resetSession();
    }
    setStatus(ReaderStatus.PLAYING);
  }, [setStatus, resetSession]);

  const pause = useCallback(() => {
    if (statusRef.current === ReaderStatus.PLAYING) setStatus(ReaderStatus.PAUSED);
  }, [setStatus]);

  const toggle = useCallback(() => {
    if (statusRef.current === ReaderStatus.PLAYING) setStatus(ReaderStatus.PAUSED);
    else play();
  }, [play, setStatus]);

  const stop = useCallback(() => setStatus(ReaderStatus.IDLE), [setStatus]);

  const restart = useCallback(() => {
    setRawPos(0);
    setStatus(ReaderStatus.PAUSED);
    resetSession();
  }, [setStatus, resetSession]);

  /** Jump to a chunk index (what `currentIndex` reports). */
  const seekTo = useCallback((index: number) => {
    const s = startsRef.current;
    if (s.length === 0) return;
    const i = Math.min(Math.max(0, Math.floor(index) || 0), s.length - 1);
    setRawPos(s[i]);
    if (statusRef.current === ReaderStatus.COMPLETED) setStatus(ReaderStatus.PAUSED);
  }, [setStatus]);

  const seekPercent = useCallback((percent: number) => {
    seekTo(Math.floor((percent / 100) * startsRef.current.length));
  }, [seekTo]);

  const step = useCallback((delta: number) => {
    seekTo(currentIndexRef.current + delta);
  }, [seekTo]);

  const progress = tokens.length > 0 ? (currentIndex / tokens.length) * 100 : 0;
  const currentWord = tokens[currentIndex]?.word || '';
  /** Playhead position in raw (unchunked) token space, for persistence. */
  const rawIndex = rawTokens.length > 0 ? Math.min(rawPos, rawTokens.length - 1) : 0;

  return useMemo(() => ({
    tokens,
    rawTokens,
    language,
    currentIndex,
    rawIndex,
    status,
    wpm,
    setWpm,
    progress,
    currentWord,
    isPlaying: status === ReaderStatus.PLAYING,
    load,
    loadTokens,
    clear,
    play,
    pause,
    toggle,
    stop,
    restart,
    seekTo,
    seekPercent,
    step,
    getSession,
    resetSession
  }), [tokens, rawTokens, language, currentIndex, rawIndex, status, wpm, progress, currentWord,
    setWpm, load, loadTokens, clear, play, pause, toggle, stop, restart, seekTo, seekPercent, step, getSession, resetSession]);
};

export type RsvpPlayer = ReturnType<typeof useRsvpPlayer>;
