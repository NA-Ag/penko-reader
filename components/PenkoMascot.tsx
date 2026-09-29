import React from 'react';
import { PENKO_ANIMATIONS } from '../penko_anim';

type MascotTheme = 'cozy' | 'cyan' | 'violet';
type Pose = 'idle' | 'talk' | 'hurt' | 'jump' | 'walk' | 'walk_right' | 'jump_right';

interface PenkoMascotProps {
  pose?: Pose;
  size?: number;
  className?: string;
  /** 'cozy' is the default palette used across the app. */
  themeColor?: MascotTheme;
  showBook?: boolean;
}

type Palette = Record<number, string>;

const COLORS_CYAN: Palette = {
  1: '#1e293b', 2: '#ffffff', 3: '#38bdf8', 4: '#fb923c', 5: '#f43f5e', 6: '#fbbf24',
  7: '#60a5fa', 8: '#34d399', 9: '#c084fc', 10: '#f472b6', 11: '#a16207', 12: '#22d3ee', 13: '#94a3b8',
};

const COLORS_VIOLET: Palette = {
  1: '#0f172a', 2: '#ffffff', 3: '#818cf8', 4: '#fb923c', 5: '#f43f5e', 6: '#fbbf24',
  7: '#c084fc', 8: '#34d399', 9: '#a78bfa', 10: '#f472b6', 11: '#a16207', 12: '#a78bfa', 13: '#94a3b8',
};

// Slate-blue penguin with an orange beak and feet.
const COLORS_COZY: Palette = {
  1: '#2b1e17', 2: '#fffdf9', 3: '#3f4f63', 4: '#d97706', 5: '#f43f5e', 6: '#fbbf24',
  7: '#b45309', 8: '#34d399', 9: '#c084fc', 10: '#f472b6', 11: '#7a4e2e', 12: '#f59e0b', 13: '#a8998a',
};

const PALETTES: Record<MascotTheme, Palette> = { cozy: COLORS_COZY, cyan: COLORS_CYAN, violet: COLORS_VIOLET };

/** Colour of the open book Penko holds at (x, y), or null when the book doesn't cover that pixel. */
const bookColor = (x: number, y: number, theme: MascotTheme): string | null => {
  const cover = theme === 'cozy' ? '#b45309' : theme === 'violet' ? '#06b6d4' : '#7c3aed';
  const spine = theme === 'cozy' ? '#7a4e2e' : theme === 'violet' ? '#0891b2' : '#581c87';
  const page = theme === 'cozy' ? '#fffdf9' : '#ffffff';
  const line = theme === 'cozy' ? '#c4a484' : '#94a3b8';

  if ((x === 2 || x === 12) && y >= 9 && y <= 11) return cover;
  if (y === 12 && x >= 2 && x <= 12) return x === 7 ? spine : cover;
  if (x === 7 && y >= 9 && y <= 11) return spine;
  if (x >= 3 && x <= 6 && y >= 9 && y <= 11) return y === 10 && x >= 4 && x <= 5 ? line : page;
  if (x >= 8 && x <= 11 && y >= 9 && y <= 11) return y === 10 && x >= 9 && x <= 10 ? line : page;
  return null;
};

interface Run { x: number; y: number; w: number; fill: string }

interface Sprite {
  /** data: URL of an SVG with every frame laid side by side (16px apart). */
  url: string;
  frames: number;
}

/**
 * Each (pose, palette, book) combination is rendered once into a horizontal sprite strip.
 * The component is then a single element whose CSS animation steps through the strip:
 * no timers, no React re-renders, no DOM mutations while Penko moves.
 */
const SPRITE_CACHE = new Map<string, Sprite>();

const toRuns = (matrix: number[][], palette: Palette, theme: MascotTheme, showBook: boolean, offsetX: number): Run[] => {
  const runs: Run[] = [];
  matrix.forEach((row, y) => {
    let current: Run | null = null;
    row.forEach((cell, x) => {
      const fill = (showBook && bookColor(x, y, theme)) || palette[cell] || null;
      if (current && fill === current.fill && current.x + current.w === x + offsetX) {
        current.w++;
        return;
      }
      if (current) runs.push(current);
      current = fill ? { x: x + offsetX, y, w: 1, fill } : null;
    });
    if (current) runs.push(current);
  });
  return runs;
};

const getSprite = (pose: Pose, theme: MascotTheme, showBook: boolean): Sprite => {
  const key = `${pose}|${theme}|${showBook ? 1 : 0}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const palette = PALETTES[theme];
  const source = (PENKO_ANIMATIONS as Record<string, number[][][]>)[pose] || PENKO_ANIMATIONS.idle;
  const rects = source
    .flatMap((matrix, i) => toRuns(matrix, palette, theme, showBook, i * 16))
    .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');
  const width = source.length * 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 16" width="${width}" height="16" shape-rendering="crispEdges">${rects}</svg>`;
  const sprite = { url: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, frames: source.length };
  SPRITE_CACHE.set(key, sprite);
  return sprite;
};

const FRAME_MS: Partial<Record<Pose, number>> = { talk: 250, hurt: 200 };

/**
 * Penko, drawn as crisp pixel art. The animation is pure CSS (see `.penko-sprite` in
 * index.css), so browsers pause it in background tabs and it honours reduced motion.
 */
export const PenkoMascot: React.FC<PenkoMascotProps> = React.memo(({ pose = 'idle', size = 64, className = '', themeColor = 'cozy', showBook = true }: PenkoMascotProps) => {
  const safePose: Pose = pose in PENKO_ANIMATIONS ? pose : 'idle';
  const sprite = getSprite(safePose, themeColor, showBook);
  const style = {
    width: size,
    height: size,
    backgroundImage: sprite.url,
    backgroundSize: `${size * sprite.frames}px ${size}px`,
    ['--pk-sprite-w' as string]: `${size * sprite.frames}px`,
    ['--pk-sprite-steps' as string]: sprite.frames,
    ['--pk-sprite-ms' as string]: `${(FRAME_MS[safePose] ?? 350) * sprite.frames}ms`
  } as React.CSSProperties;

  return (
    <span
      className={`penko-sprite block shrink-0 select-none pointer-events-none ${sprite.frames > 1 ? 'penko-sprite-animated' : ''} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
});

PenkoMascot.displayName = 'PenkoMascot';

export default PenkoMascot;
