import { ReadingSession } from '../types';

const KEY = 'penko-sessions';
const MAX_SESSIONS = 2000;

export const loadSessions = (): ReadingSession[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop corrupt entries so one bad record can't break the stats screens.
    return parsed.filter((s): s is ReadingSession =>
      s && typeof s === 'object' &&
      Number.isFinite(s.date) && Number.isFinite(s.words) && s.words >= 0 &&
      Number.isFinite(s.durationMs) && s.durationMs >= 0 &&
      Number.isFinite(s.wpm) && Number.isFinite(s.peakWpm));
  } catch {
    return [];
  }
};

export const saveSessions = (sessions: ReadingSession[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(sessions.slice(-MAX_SESSIONS)));
  } catch (e) {
    console.warn('Could not save reading sessions', e);
  }
};

export const addSession = (session: Omit<ReadingSession, 'id'>): ReadingSession => {
  const full: ReadingSession = {
    ...session,
    words: Math.max(0, Math.round(session.words)),
    durationMs: Math.max(0, Math.round(session.durationMs)),
    wpm: Number.isFinite(session.wpm) ? Math.round(session.wpm) : 0,
    peakWpm: Number.isFinite(session.peakWpm) ? Math.round(session.peakWpm) : 0,
    id: crypto.randomUUID()
  };
  const sessions = loadSessions();
  sessions.push(full);
  saveSessions(sessions);
  return full;
};

export interface StatsSummary {
  sessions: number;
  totalWords: number;
  totalMinutes: number;
  bestWpm: number;
  bestTrainingWpm: number;
  streakDays: number;
  /** Words read per day for the last 7 days, oldest first. */
  last7: { date: string; words: number }[];
}

const dayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const summarize = (sessions: ReadingSession[], now: number = Date.now()): StatsSummary => {
  const byDay = new Map<string, number>();
  let totalWords = 0;
  let totalMs = 0;
  let bestWpm = 0;
  let bestTrainingWpm = 0;

  for (const s of sessions) {
    totalWords += s.words;
    totalMs += s.durationMs;
    // Ignore trivially short sessions for "best" so a 3-word blip doesn't count.
    if (s.words >= 30) {
      bestWpm = Math.max(bestWpm, s.wpm);
      if (s.mode === 'training') bestTrainingWpm = Math.max(bestTrainingWpm, s.wpm);
    }
    const k = dayKey(s.date);
    byDay.set(k, (byDay.get(k) || 0) + s.words);
  }

  // Streak: consecutive days ending today or yesterday.
  let streak = 0;
  const cursor = new Date(now);
  if (!byDay.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (byDay.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const last7: { date: string; words: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const k = dayKey(d.getTime());
    last7.push({ date: k, words: byDay.get(k) || 0 });
  }

  return {
    sessions: sessions.length,
    totalWords,
    totalMinutes: Math.round(totalMs / 60000),
    bestWpm: Math.round(bestWpm),
    bestTrainingWpm: Math.round(bestTrainingWpm),
    streakDays: streak,
    last7
  };
};
