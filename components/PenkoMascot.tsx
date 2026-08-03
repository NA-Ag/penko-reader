import React, { useState, useEffect, useMemo } from 'react';
import { PENKO_ANIMATIONS } from '../penko_anim';

interface PenkoMascotProps {
  pose?: 'idle' | 'talk' | 'hurt' | 'jump' | 'walk' | 'walk_right' | 'jump_right';
  size?: number;
  className?: string;
  themeColor?: 'cyan' | 'violet';
  showBook?: boolean;
}

const COLORS_CYAN = {
  0: 'transparent',
  1: '#1e293b',  // Slate-800
  2: '#ffffff',  // White
  3: '#38bdf8',  // Sky-400
  4: '#fb923c',  // Orange-400
  5: '#f43f5e',
  6: '#fbbf24',
  7: '#60a5fa',
  8: '#34d399',
  9: '#c084fc',
  10: '#f472b6',
  11: '#a16207',
  12: '#22d3ee',
  13: '#94a3b8',
};

const COLORS_VIOLET = {
  0: 'transparent',
  1: '#0f172a',  // Slate-900 (Outline)
  2: '#ffffff',  // White (Belly / Eyes)
  3: '#818cf8',  // Indigo-400 (Body - Reader Purple theme)
  4: '#fb923c',  // Orange-400 (Beak / Feet)
  5: '#f43f5e',  // Rose-500
  6: '#fbbf24',  // Amber-400
  7: '#c084fc',  // Purple-400
  8: '#34d399',  // Emerald-400
  9: '#a78bfa',  // Violet-400
  10: '#f472b6', // Pink-400
  11: '#a16207', // Brown
  12: '#a78bfa', // Purple highlight
  13: '#94a3b8', // Gray
};

// Open Book geometry helper
const getBookColor = (x: number, y: number, themeColor: 'cyan' | 'violet'): string | null => {
  const primaryCover = themeColor === 'violet' ? '#06b6d4' : '#7c3aed';
  const darkCover = themeColor === 'violet' ? '#0891b2' : '#581c87';
  const pageBg = '#ffffff';
  const textLine = '#94a3b8';

  // 1. Cover outlines (wrapping the pages)
  // Left cover edge
  if (x === 2 && y >= 9 && y <= 11) return primaryCover;
  // Right cover edge
  if (x === 12 && y >= 9 && y <= 11) return primaryCover;
  // Bottom cover edge
  if (x >= 2 && x <= 12 && y === 12) {
    if (x === 7) return darkCover; // Spine bottom
    return primaryCover;
  }
  
  // 2. Spine column
  if (x === 7 && y >= 9 && y <= 11) return darkCover;

  // 3. Pages
  // Left page flap
  if (x >= 3 && x <= 6 && y >= 9 && y <= 11) {
    // Text lines in the middle
    if (y === 10 && x >= 4 && x <= 5) return textLine;
    return pageBg;
  }
  // Right page flap
  if (x >= 8 && x <= 11 && y >= 9 && y <= 11) {
    // Text lines in the middle
    if (y === 10 && x >= 9 && x <= 10) return textLine;
    return pageBg;
  }

  return null;
};

export const PenkoMascot: React.FC<PenkoMascotProps> = React.memo(({ pose = 'idle', size = 64, className = '', themeColor = 'violet', showBook = true }) => {
  const pixelSize = size / 16;
  const [frameIndex, setFrameIndex] = useState(0);

  const activePose = pose in PENKO_ANIMATIONS ? pose : 'idle';
  const frames = PENKO_ANIMATIONS[activePose];
  const palette = themeColor === 'violet' ? COLORS_VIOLET : COLORS_CYAN;

  // Cycle animation frames
  useEffect(() => {
    setFrameIndex(0);
    if (!frames || frames.length <= 1) return;

    const fps = activePose === 'talk' ? 250 : activePose === 'hurt' ? 200 : 350;
    const interval = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, fps);

    return () => clearInterval(interval);
  }, [frames, activePose]);

  const matrix = useMemo(() => {
    const currentFrame = frames[frameIndex] || frames[0];
    return currentFrame;
  }, [frames, frameIndex]);

  return (
    <div
      className={`select-none pointer-events-none will-change-transform ${className}`}
      style={{
        width: size,
        height: size,
        display: 'grid',
        gridTemplateColumns: `repeat(16, ${pixelSize}px)`,
        gridTemplateRows: `repeat(16, ${pixelSize}px)`,
        imageRendering: 'pixelated',
      }}
    >
      {matrix.map((row: number[], y: number) =>
        row.map((cell: number, x: number) => {
          let color = palette[cell as keyof typeof palette] || 'transparent';
          
          // Apply dynamic open book overlay on top of the mascot
          if (showBook) {
            const activeTheme: 'cyan' | 'violet' = themeColor === 'cyan' ? 'cyan' : 'violet';
            const bookColor = getBookColor(x, y, activeTheme);
            if (bookColor) color = bookColor;
          }

          return (
            <div
              key={`${x}-${y}`}
              style={{
                backgroundColor: color,
                width: pixelSize,
                height: pixelSize,
              }}
            />
          );
        })
      )}
    </div>
  );
});

export default PenkoMascot;
