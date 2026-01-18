import React, { useEffect, useRef, useMemo } from 'react';
import { WordToken, Translation } from '../types';

interface FullTextDisplayProps {
  tokens: WordToken[];
  currentIndex: number;
  t: Translation;
  onWordClick: (index: number) => void;
  clickToDefine: boolean;
  verticalMode: boolean;
}

const FullTextDisplay: React.FC<FullTextDisplayProps> = ({ tokens, currentIndex, t, onWordClick, clickToDefine, verticalMode }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);

  // Calculate window of tokens to display to prevent DOM overload
  const { visibleTokens, startIndex } = useMemo(() => {
    const WINDOW_SIZE = 1000; // Render +/- 1000 words around current position
    const start = Math.max(0, currentIndex - WINDOW_SIZE);
    const end = Math.min(tokens.length, currentIndex + WINDOW_SIZE);
    return { visibleTokens: tokens.slice(start, end), startIndex: start };
  }, [tokens, currentIndex]);

  // Auto-scroll to keep current word in view
  useEffect(() => {
    if (currentWordRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const element = currentWordRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Check if element is out of bounds
      const isBelow = elementRect.bottom > containerRect.bottom;
      const isAbove = elementRect.top < containerRect.top;

      if (isBelow || isAbove) {
        element.scrollIntoView({
           behavior: 'smooth',
           block: 'center'
        });
      }
    }
  }, [currentIndex]);

  if (tokens.length === 0) return null;

  return (
    <div className={`w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden ${verticalMode ? 'h-full' : 'max-w-4xl mx-auto h-[400px] lg:h-[600px]'}`}>
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
        <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wide">{t.fullText}</h3>
        <span className="text-xs text-slate-400">
            {startIndex > 0 || startIndex + visibleTokens.length < tokens.length ? "Displaying partial text" : ""}
        </span>
      </div>
      
      <div 
        ref={scrollContainerRef}
        className={`flex-1 p-6 overflow-y-auto leading-relaxed text-slate-600 dark:text-slate-400 text-lg font-serif ${
          verticalMode ? 'writing-vertical-rl text-orientation-mixed h-full overflow-x-auto' : ''
        }`}
        style={verticalMode ? { writingMode: 'vertical-rl' } : {}}
      >
        {startIndex > 0 && (
            <div className="text-center p-4 text-slate-400 italic text-sm select-none">...</div>
        )}

        {visibleTokens.map((token, i) => {
          const absoluteIndex = startIndex + i;
          return (
          <React.Fragment key={token.id}>
            {/* If it's a paragraph start (and not index 0), add breaks */}
            {token.isParagraphStart && <><br /><br /></>}
            
            {token.word ? (
               <span 
                 ref={absoluteIndex === currentIndex ? currentWordRef : null}
                 onClick={() => onWordClick(absoluteIndex)}
                 className={`${clickToDefine ? 'cursor-help' : 'cursor-pointer'} transition-colors duration-150 px-0.5 rounded ${
                   absoluteIndex === currentIndex 
                     ? 'bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-slate-100 font-bold scale-105 inline-block' 
                     : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                 }`}
               >
                 {token.word}
               </span>
            ) : null}
            {' '}
          </React.Fragment>
        )})}

        {startIndex + visibleTokens.length < tokens.length && (
            <div className="text-center p-4 text-slate-400 italic text-sm select-none">...</div>
        )}
      </div>
    </div>
  );
};

export default FullTextDisplay;