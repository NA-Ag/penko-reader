import React from 'react';
import { ReaderStatus, Translation, LanguageCode } from '../types';
import { getWpmLabel } from '../utils/wpmUtils';

interface ControlsProps {
  status: ReaderStatus;
  wpm: number;
  fontSize: number;
  progress: number;
  t: Translation;
  onTogglePlay: () => void;
  onRestart: () => void;
  onWpmChange: (val: number) => void;
  onFontSizeChange: (val: number) => void;
  onSeek: (val: number) => void;
  dyslexicMode: boolean;
  pauseOnPunctuation: boolean;
  clickToDefine: boolean;
  onToggleDyslexic: () => void;
  onTogglePauseOnPunctuation: () => void;
  onToggleClickToDefine: () => void;
  verticalMode: boolean;
  contentLanguage: LanguageCode;
  onToggleVerticalMode: () => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  status,
  wpm,
  fontSize,
  progress,
  t,
  onTogglePlay,
  onRestart,
  onWpmChange,
  onFontSizeChange,
  onSeek,
  dyslexicMode,
  pauseOnPunctuation,
  clickToDefine,
  onToggleDyslexic,
  onTogglePauseOnPunctuation,
  onToggleClickToDefine,
  verticalMode,
  contentLanguage,
  onToggleVerticalMode,
  focusMode,
  onToggleFocusMode
}) => {
  const isPlaying = status === ReaderStatus.PLAYING;

  // Helper for Retro Toggle
  const Toggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
    <label className="flex items-center justify-between cursor-pointer group w-full sm:w-auto gap-4">
      <span className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors select-none">{label}</span>
      <div className="relative">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} />
        <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-none border-2 border-slate-900 dark:border-slate-400 peer dark:bg-slate-700 peer-checked:bg-cyan-600 transition-colors"></div>
        <div className={`absolute top-[4px] left-[4px] bg-white border-2 border-slate-900 h-4 w-4 transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-0'}`}></div>
      </div>
    </label>
  );

  // Custom Retro Slider CSS
  const sliderStyle = `
    input[type=range] {
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      height: 24px;
      width: 100%;
    }
    input[type=range]:focus {
      outline: none;
    }

    /* WebKit Track */
    input[type=range]::-webkit-slider-runnable-track {
      width: 100%;
      height: 6px;
      cursor: pointer;
      background: #94a3b8; /* slate-400 */
      border-radius: 3px;
    }
    .dark input[type=range]::-webkit-slider-runnable-track {
      background: #475569; /* slate-600 */
    }

    /* Firefox Track */
    input[type=range]::-moz-range-track {
      width: 100%;
      height: 6px;
      cursor: pointer;
      background: #94a3b8; /* slate-400 */
      border-radius: 3px;
    }
    .dark input[type=range]::-moz-range-track {
      background: #475569; /* slate-600 */
    }

    /* WebKit Thumb */
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      height: 18px;
      width: 18px;
      background: #2563eb; /* blue-600 */
      border: 2px solid #0f172a; /* slate-900 */
      border-radius: 2px; /* Slight rounding for modern feel */
      cursor: pointer;
      margin-top: -6px; /* (6 - 18) / 2 = -6 */
      transition: transform 0.1s ease, background-color 0.1s;
    }
    input[type=range]:hover::-webkit-slider-thumb {
      transform: scale(1.1);
      background: #3b82f6; /* blue-500 */
    }
    .dark input[type=range]::-webkit-slider-thumb {
      background: #22d3ee; /* cyan-400 */
      border-color: #f8fafc; /* slate-50 */
    }

    /* Firefox Thumb */
    input[type=range]::-moz-range-thumb {
      height: 18px;
      width: 18px;
      background: #2563eb; /* blue-600 */
      border: 2px solid #0f172a; /* slate-900 */
      border-radius: 2px;
      cursor: pointer;
      transition: transform 0.1s ease, background-color 0.1s;
    }
    input[type=range]:hover::-moz-range-thumb {
      transform: scale(1.1);
      background: #3b82f6; /* blue-500 */
    }
    .dark input[type=range]::-moz-range-thumb {
      background: #22d3ee; /* cyan-400 */
      border-color: #f8fafc; /* slate-50 */
    }
  `;

  return (
    <div className="w-full flex flex-col gap-6 text-slate-600 dark:text-slate-300 transition-opacity duration-300">
      <style>{sliderStyle}</style>
      
      {/* Playback Controls Row */}
      <div className="flex items-center justify-center gap-8 mb-4">
        <button
          onClick={onRestart}
          className="group flex flex-col items-center gap-1 hover:text-primary dark:hover:text-blue-400 transition-colors outline-none focus-ring rounded p-2"
          title={t.restart}
        >
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
        </button>

        <button
          onClick={onTogglePlay}
          className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all outline-none focus-ring ${
            isPlaying 
              ? 'bg-white dark:bg-slate-800 text-red-500 hover:bg-red-50 dark:hover:bg-slate-700' 
              : 'bg-cyan-600 text-white hover:bg-cyan-700 hover:shadow-cyan-600/50'
          }`}
          title="Play/Pause"
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8 pl-1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          )}
        </button>
      </div>

      {/* Settings Grid */}
      <div className="flex flex-col gap-6">
        
        {/* Speed */}
        <div className="space-y-4">
           <div className="flex justify-between items-baseline">
             <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t.speed}</span>
             <div className="text-right">
                <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400 block leading-none">{wpm} wpm</span>
                <span className="text-[10px] text-slate-400 font-medium">{getWpmLabel(wpm, t)}</span>
             </div>
           </div>
           <input
              type="range"
              min="100"
              max="1200"
              step="25"
              value={wpm}
              onChange={(e) => onWpmChange(Number(e.target.value))}
              className="w-full"
            />
        </div>

        {/* Font Size */}
        <div className="space-y-4">
           <div className="flex justify-between items-baseline">
             <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t.size}</span>
             <span className="text-lg font-bold text-slate-700 dark:text-slate-200">{fontSize}px</span>
           </div>
           <input
              type="range"
              min="24"
              max="128"
              step="4"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
              className="w-full"
            />
        </div>

        {/* Progress - Full Width */}
        <div className="sm:col-span-2 space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex justify-between items-baseline">
             <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{t.progress}</span>
             <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{Math.round(progress)}%</span>
           </div>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Comprehension Aids */}
        <div className="sm:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-700/50">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Comprehension Aids</h4>
          <div className="flex flex-col gap-4">
            <Toggle label="Pause at Punctuation" checked={pauseOnPunctuation} onChange={onTogglePauseOnPunctuation} />
            {/* Dictionary feature pending future update */}
            {/* <Toggle label="Click to Define" checked={clickToDefine} onChange={onToggleClickToDefine} /> */}
          </div>
        </div>

        {/* Accessibility */}
        <div className="sm:col-span-2 pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Accessibility</h4>
          <div className="flex flex-col gap-4">
            <Toggle label="OpenDyslexic Font" checked={dyslexicMode} onChange={onToggleDyslexic} />
            <Toggle label={t.focusMode} checked={focusMode} onChange={onToggleFocusMode} />

            {(contentLanguage === 'ja' || contentLanguage === 'zh') && (
              <Toggle label={t.verticalMode} checked={verticalMode} onChange={onToggleVerticalMode} />
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Controls;
