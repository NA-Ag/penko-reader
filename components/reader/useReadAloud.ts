import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/** Voices load asynchronously in most browsers; keep a live list. */
let voiceCache: SpeechSynthesisVoice[] = [];
if (supported) {
  const refresh = () => { voiceCache = window.speechSynthesis.getVoices(); };
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

const pickVoice = (lang?: string): SpeechSynthesisVoice | null => {
  if (!lang) return null;
  if (voiceCache.length === 0 && supported) voiceCache = window.speechSynthesis.getVoices();
  const l = lang.toLowerCase();
  const short = l.split('-')[0];
  return (
    voiceCache.find(v => v.lang.toLowerCase() === l && v.localService) ||
    voiceCache.find(v => v.lang.toLowerCase() === l) ||
    voiceCache.find(v => v.lang.toLowerCase().startsWith(short)) ||
    null
  );
};

/**
 * Small wrapper around the Web Speech API that speaks a queue of sentences one at a time,
 * so long books never hit the per-utterance limits some browsers impose.
 */
export const useReadAloud = () => {
  const [speaking, setSpeaking] = useState(false);
  const queueRef = useRef<string[]>([]);
  const indexRef = useRef(0);
  const activeRef = useRef(false);
  const rateRef = useRef(1);
  const langRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  // Chrome garbage-collects in-flight utterances, after which `onend` never fires. Keep a reference.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const startTimerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
    utteranceRef.current = null;
    if (supported) window.speechSynthesis.cancel();
    if (mountedRef.current) setSpeaking(false);
  }, []);

  const speakNext = useCallback(() => {
    if (!activeRef.current) return;
    const i = indexRef.current;
    if (i >= queueRef.current.length) {
      stop();
      return;
    }
    const u = new SpeechSynthesisUtterance(queueRef.current[i]);
    u.rate = rateRef.current;
    if (langRef.current) u.lang = langRef.current;
    const voice = pickVoice(langRef.current);
    if (voice) u.voice = voice;
    const advance = () => {
      if (!activeRef.current || utteranceRef.current !== u) return;
      indexRef.current += 1;
      speakNext();
    };
    u.onend = advance;
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      advance();
    };
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, [stop]);

  const start = useCallback((sentences: string[], opts: { rate?: number; lang?: string } = {}) => {
    if (!supported || sentences.length === 0) return;
    window.speechSynthesis.cancel();
    queueRef.current = sentences;
    indexRef.current = 0;
    if (opts.rate) rateRef.current = opts.rate;
    langRef.current = opts.lang;
    activeRef.current = true;
    setSpeaking(true);
    // Some engines drop a speak() issued in the same tick as cancel().
    if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
    startTimerRef.current = window.setTimeout(speakNext, 60);
  }, [speakNext]);

  const setRate = useCallback((rate: number) => {
    rateRef.current = rate;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current = false;
      if (startTimerRef.current) window.clearTimeout(startTimerRef.current);
      if (supported) window.speechSynthesis.cancel();
    };
  }, []);

  return useMemo(() => ({ supported, speaking, start, stop, setRate }), [speaking, start, stop, setRate]);
};
