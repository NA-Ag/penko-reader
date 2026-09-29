import React from 'react';
import { getPivotIndex } from '../utils/tokenizer';
import { Translation, LanguageCode } from '../types';

interface OrpDisplayProps {
  word: string;
  fontSize: number;
  t: Translation;
  verticalMode?: boolean;
  contentLanguage?: LanguageCode;
  /** Text shown when there is no word (defaults to the empty-library hint). */
  emptyText?: string;
}

/**
 * Rapid Serial Visual Presentation word display. The pivot letter (Optimal Recognition
 * Point) is fixed at the centre so the eye never has to move.
 */
const OrpDisplay: React.FC<OrpDisplayProps> = React.memo(({ word, fontSize, t, verticalMode = false, contentLanguage = 'en', emptyText }) => {
  if (!word) {
    return (
      <div className="flex items-center justify-center h-full w-full text-muted select-none text-center px-4">
        <span style={{ fontSize: `${Math.max(14, fontSize * 0.28)}px` }}>{emptyText ?? t.emptyState}</span>
      </div>
    );
  }

  // For multi-word chunks pivot on the middle word so the whole phrase stays centred.
  const words = word.split(' ');
  const middle = Math.floor((words.length - 1) / 2);
  const before = words.slice(0, middle).join(' ');
  const pivotWord = words[middle];
  const after = words.slice(middle + 1).join(' ');
  const pivotIndex = getPivotIndex(pivotWord);

  const leftPart = (before ? before + ' ' : '') + pivotWord.slice(0, pivotIndex);
  const pivotChar = pivotWord[pivotIndex] ?? '';
  const rightPart = pivotWord.slice(pivotIndex + 1) + (after ? ' ' + after : '');

  const isCJK = contentLanguage === 'ja' || contentLanguage === 'zh';
  const axis = verticalMode ? 'height' : 'width';

  return (
    <div
      className={`relative flex items-baseline justify-center select-none ${verticalMode ? 'h-full' : 'w-full'}`}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: verticalMode ? 1.6 : 1.2,
        writingMode: verticalMode ? 'vertical-rl' : 'horizontal-tb'
      }}
      aria-live="off"
    >
      <div className={`flex relative justify-center items-center ${verticalMode ? 'h-full max-h-[80vh]' : 'w-full max-w-5xl'} ${isCJK ? 'tracking-widest' : ''}`}>
        <div className="text-ink whitespace-pre overflow-hidden text-right" style={{ [axis]: '45%' }}>
          {leftPart}
        </div>
        <div className="text-center font-semibold text-red-600 dark:text-red-400" style={{ [axis]: '1ch' }}>
          {pivotChar}
        </div>
        <div className="text-left text-ink whitespace-pre overflow-hidden" style={{ [axis]: '45%' }}>
          {rightPart}
        </div>

        {/* Alignment guide */}
        <div className={`absolute pointer-events-none border-line ${verticalMode ? 'left-0 right-0 top-1/2 h-0 border-t -mt-px' : 'top-0 bottom-0 left-1/2 w-0 border-l -ml-px h-full'}`} />
      </div>
    </div>
  );
});

OrpDisplay.displayName = 'OrpDisplay';

export default OrpDisplay;
