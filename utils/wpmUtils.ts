import { Translation } from '../types';

export const getWpmLabel = (wpm: number, t: Translation): string => {
  if (wpm < 200) return t.wpmLabels.slow;
  if (wpm < 250) return t.wpmLabels.normal;
  if (wpm < 300) return t.wpmLabels.average;
  if (wpm < 450) return t.wpmLabels.good;
  if (wpm < 600) return t.wpmLabels.fast;
  if (wpm < 800) return t.wpmLabels.speed;
  return t.wpmLabels.superhuman;
};

/** Milliseconds a token should stay on screen. Longer words and punctuation get more time. */
export const tokenDelayMs = (word: string, wpm: number, hasPause: boolean, pauseOnPunctuation: boolean): number => {
  const base = 60000 / Math.max(50, wpm);
  let words = 1;
  let longest = 0;
  let run = 0;
  for (let i = 0; i < word.length; i++) {
    if (word.charCodeAt(i) === 32) {
      if (run > 0) words++;
      longest = Math.max(longest, run);
      run = 0;
    } else {
      run++;
    }
  }
  longest = Math.max(longest, run);
  let delay = base * words;
  // Long words need a little extra time to recognise.
  if (longest > 8) delay *= 1.15;
  if (longest > 12) delay *= 1.15;
  if (hasPause && pauseOnPunctuation) delay *= 2.0;
  return delay;
};
