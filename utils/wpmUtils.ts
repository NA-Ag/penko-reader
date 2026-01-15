import { Translation } from "../types";

export const getWpmLabel = (wpm: number, t: Translation): string => {
  if (wpm < 200) return t.wpmLabels.slow;
  if (wpm < 250) return t.wpmLabels.normal;
  if (wpm < 300) return t.wpmLabels.average;
  if (wpm < 450) return t.wpmLabels.good;
  if (wpm < 600) return t.wpmLabels.fast;
  if (wpm < 800) return t.wpmLabels.speed;
  return t.wpmLabels.superhuman;
};