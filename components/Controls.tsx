import React from 'react';
import { ReaderStatus, Translation, LanguageCode } from '../types';
import { getWpmLabel } from '../utils/wpmUtils';
import Toggle from './ui/Toggle';
import Slider from './ui/Slider';
import { PauseIcon, PlayIcon, RestartIcon } from './ui/Icons';

export interface ControlsProps {
  status: ReaderStatus;
  wpm: number;
  fontSize: number;
  chunkSize: number;
  progress: number;
  t: Translation;
  contentLanguage: LanguageCode;
  onTogglePlay: () => void;
  onRestart: () => void;
  onWpmChange: (val: number) => void;
  onFontSizeChange: (val: number) => void;
  onChunkSizeChange: (val: number) => void;
  onSeek?: (percent: number) => void;
  dyslexicMode: boolean;
  pauseOnPunctuation: boolean;
  clickToDefine: boolean;
  onlineDictionary: boolean;
  verticalMode: boolean;
  focusMode: boolean;
  onToggleDyslexic: () => void;
  onTogglePauseOnPunctuation: () => void;
  onToggleClickToDefine: () => void;
  onToggleOnlineDictionary: () => void;
  onToggleVerticalMode: () => void;
  onToggleFocusMode: () => void;
  /** Hide the transport row (used when the parent renders its own play button). */
  hideTransport?: boolean;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-4 pt-5 border-t border-line first:border-t-0 first:pt-0">
    <h3 className="eyebrow">{title}</h3>
    {children}
  </section>
);

/** Reading options panel for the RSVP reader. */
const Controls: React.FC<ControlsProps> = React.memo(({
  status, wpm, fontSize, chunkSize, progress, t, contentLanguage,
  onTogglePlay, onRestart, onWpmChange, onFontSizeChange, onChunkSizeChange, onSeek,
  dyslexicMode, pauseOnPunctuation, clickToDefine, onlineDictionary, verticalMode, focusMode,
  onToggleDyslexic, onTogglePauseOnPunctuation, onToggleClickToDefine, onToggleOnlineDictionary, onToggleVerticalMode, onToggleFocusMode,
  hideTransport = false
}) => {
  const isPlaying = status === ReaderStatus.PLAYING;

  return (
    <div className="w-full flex flex-col gap-5">
      {!hideTransport && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={onRestart} className="btn btn-secondary btn-icon rounded-full" title={t.restart} aria-label={t.restart}>
            <RestartIcon size={18} />
          </button>
          <button
            onClick={onTogglePlay}
            className="btn btn-primary h-12 w-12 px-0 rounded-full"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} className="pl-0.5" />}
          </button>
        </div>
      )}

      <Section title={t.readingOptions}>
        <Slider label={t.speed} value={wpm} min={100} max={1200} step={25} onChange={onWpmChange} display={`${wpm} wpm`} hint={getWpmLabel(wpm, t)} />
        <Slider label={t.size} value={fontSize} min={24} max={128} step={4} onChange={onFontSizeChange} display={`${fontSize}px`} />
        <Slider label={t.wordsPerFlash} value={chunkSize} min={1} max={4} step={1} onChange={onChunkSizeChange} display={String(chunkSize)} />
        {onSeek && (
          <Slider label={t.progress} value={Math.round(progress)} min={0} max={100} step={1} onChange={onSeek} display={`${Math.round(progress)}%`} />
        )}
      </Section>

      <Section title={t.comprehensionAids}>
        <Toggle label={t.pauseAtPunctuation} checked={pauseOnPunctuation} onChange={onTogglePauseOnPunctuation} />
        <Toggle label={t.clickToDefine} checked={clickToDefine} onChange={onToggleClickToDefine} />
        <Toggle label={t.onlineDictionary} description={t.onlineDictionaryDesc} checked={onlineDictionary} onChange={onToggleOnlineDictionary} />
      </Section>

      <Section title={t.accessibility}>
        <Toggle label={t.dyslexicFont} checked={dyslexicMode} onChange={onToggleDyslexic} />
        <Toggle label={t.focusMode} checked={focusMode} onChange={onToggleFocusMode} />
        {(contentLanguage === 'ja' || contentLanguage === 'zh') && (
          <Toggle label={t.verticalMode} checked={verticalMode} onChange={onToggleVerticalMode} />
        )}
      </Section>
    </div>
  );
});

Controls.displayName = 'Controls';

export default Controls;
