import React from 'react';
import { getPivotIndex } from '../utils/textProcessor';
import { Translation, LanguageCode } from '../types';

interface OrpDisplayProps {
  word: string;
  fontSize: number;
  t: Translation;
  verticalMode?: boolean;
  contentLanguage?: LanguageCode;
}

const OrpDisplay: React.FC<OrpDisplayProps> = ({ word, fontSize, t, verticalMode = false, contentLanguage = 'en' }) => {
  if (!word) {
    return (
      <div className="flex items-center justify-center h-full w-full text-slate-400 dark:text-slate-500 select-none">
        <span style={{ fontSize: `${fontSize * 0.4}px` }}>{t.emptyState}</span>
      </div>
    );
  }

  const pivotIndex = getPivotIndex(word);
  const leftPart = word.slice(0, pivotIndex);
  const pivotChar = word[pivotIndex];
  const rightPart = word.slice(pivotIndex + 1);

  const isCJK = contentLanguage === 'ja' || contentLanguage === 'zh';

  return (
    <div 
      className={`relative flex items-baseline justify-center select-none ${verticalMode ? 'h-full' : 'w-full'}`}
      style={{ 
        fontSize: `${fontSize}px`, 
        lineHeight: verticalMode ? 1.6 : 1.2,
        writingMode: verticalMode ? 'vertical-rl' : 'horizontal-tb'
      }}
    >
      {/* Container for alignment */}
      <div className={`flex relative justify-center items-center ${verticalMode ? 'h-full max-h-[80vh]' : 'w-full max-w-5xl'} ${isCJK ? 'tracking-widest' : ''}`}>
        
        {/* Left Side */}
        <div className={`text-slate-900 dark:text-slate-100 whitespace-nowrap overflow-hidden text-right`} style={{ [verticalMode ? 'height' : 'width']: '45%' }}>
          {leftPart}
        </div>

        {/* Pivot Character - Red Accent */}
        <div className="text-center font-bold text-red-500 dark:text-red-400" style={{ [verticalMode ? 'height' : 'width']: '1ch' }}>
           {pivotChar}
        </div>

        {/* Right Side */}
        <div className="text-left text-slate-900 dark:text-slate-100 whitespace-nowrap overflow-hidden" style={{ [verticalMode ? 'height' : 'width']: '45%' }}>
          {rightPart}
        </div>
        
        {/* Guides (Visual cues) - Updated colors for dark mode */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-slate-200 dark:border-slate-700 -ml-[1px] pointer-events-none h-full" />
        <div className="absolute top-0 bottom-0 left-1/2 w-[1ch] -ml-[0.5ch] border-t-2 border-b-2 border-slate-100 dark:border-slate-800 pointer-events-none h-full" />
      </div>
    </div>
  );
};

export default OrpDisplay;