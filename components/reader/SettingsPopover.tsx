import React from 'react';
import { Translation } from '../../types';
import Slider from '../ui/Slider';
import { HIGHLIGHT_COLORS, PAGE_THEMES, READER_THEMES, ReaderPrefs } from './pageThemes';

interface SettingsPopoverProps {
  t: Translation;
  prefs: ReaderPrefs;
  setPref: <K extends keyof ReaderPrefs>(key: K, value: ReaderPrefs[K]) => void;
  isPdf: boolean;
  scale: number;
  onScaleChange: (scale: number) => void;
  canReadAloud: boolean;
  onReadAloudRate: (rate: number) => void;
  onClose: () => void;
}

const SettingsPopover: React.FC<SettingsPopoverProps> = ({ t, prefs, setPref, isPdf, scale, onScaleChange, canReadAloud, onReadAloudRate, onClose }) => {
  const { fontSize, lineHeight, readerTheme, highlightColor, fontFamily, marginSize, ttsRate } = prefs;
  return (
    <>
      {/* Click anywhere else to close. */}
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
      <div
        className="absolute top-full right-0 mt-2 w-[19rem] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-6rem)] overflow-y-auto scroll-thin bg-surface border border-line rounded-xl shadow-lift z-40 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-line"
        role="dialog"
        aria-label={t.appearance}
      >
        <section className="p-4">
          <div className="eyebrow mb-3">{t.appearance}</div>
          <div className="flex items-center justify-between gap-2">
            {READER_THEMES.map((theme) => {
              const p = PAGE_THEMES[theme];
              const active = readerTheme === theme;
              return (
                <button
                  key={theme}
                  onClick={() => setPref('readerTheme', theme)}
                  className={`w-11 h-11 rounded-full border border-line font-serif font-semibold text-base transition-shadow ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : 'hover:ring-2 hover:ring-line hover:ring-offset-2 hover:ring-offset-surface'}`}
                  style={{ backgroundColor: p.swatch, color: p.swatchInk }}
                  title={p.label}
                  aria-label={p.label}
                  aria-pressed={active}
                >
                  Aa
                </button>
              );
            })}
          </div>
        </section>

        {isPdf ? (
          <>
            <section className="p-4">
              <Slider label={t.zoom} value={scale} min={0.5} max={5} step={0.1} onChange={(v) => onScaleChange(Number(v.toFixed(1)))} display={`${Math.round(scale * 100)}%`} />
            </section>
            <section className="p-4">
              <div className="eyebrow mb-3">{t.highlightColor}</div>
              <div className="flex justify-between gap-1">
                {HIGHLIGHT_COLORS.map((c) => {
                  const active = highlightColor === c.value;
                  return (
                    <button
                      key={c.name}
                      onClick={() => setPref('highlightColor', c.value)}
                      className={`w-8 h-8 rounded-full border border-black/10 transition-shadow ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''}`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={active}
                    />
                  );
                })}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="p-4 flex flex-col gap-4">
              <Slider label={t.size} value={fontSize} min={12} max={32} step={1} onChange={(v) => setPref('fontSize', v)} display={`${fontSize}px`} />
              <Slider label={t.spacing} value={lineHeight} min={1.0} max={2.5} step={0.1} onChange={(v) => setPref('lineHeight', Number(v.toFixed(1)))} display={lineHeight.toFixed(1)} />
            </section>

            <section className="p-4 flex flex-col gap-3">
              <div>
                <div className="label mb-2">{t.fontStyle}</div>
                <div className="segmented w-full">
                  {(['serif', 'sans', 'dyslexic'] as const).map((font) => (
                    <button
                      key={font}
                      onClick={() => setPref('fontFamily', font)}
                      aria-pressed={fontFamily === font}
                      className={font === 'serif' ? 'font-serif' : font === 'dyslexic' ? 'font-dyslexic' : 'font-sans'}
                    >
                      {font === 'serif' ? t.fontSerif : font === 'sans' ? t.fontSans : t.fontDyslexic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label mb-2">{t.margins}</div>
                <div className="segmented w-full">
                  {(['narrow', 'medium', 'wide'] as const).map((size) => (
                    <button key={size} onClick={() => setPref('marginSize', size)} aria-pressed={marginSize === size}>
                      {size === 'narrow' ? t.narrow : size === 'medium' ? t.medium : t.wide}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {canReadAloud && (
              <section className="p-4">
                <Slider
                  label={t.readAloudRate}
                  value={ttsRate}
                  min={0.6}
                  max={1.6}
                  step={0.1}
                  onChange={(v) => { const r = Number(v.toFixed(1)); setPref('ttsRate', r); onReadAloudRate(r); }}
                  display={`${ttsRate.toFixed(1)}×`}
                />
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default SettingsPopover;
