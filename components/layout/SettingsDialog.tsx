import React from 'react';
import { LanguageCode, LANGUAGE_CODES, LANGUAGE_NAMES, Theme, Translation } from '../../types';
import Dialog from '../ui/Dialog';
import Toggle from '../ui/Toggle';
import { EclipseIcon, MoonIcon, SunIcon } from '../ui/Icons';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
  theme: Theme;
  language: LanguageCode;
  globalFontSize: number;
  dyslexicMode: boolean;
  showInstall: boolean;
  onThemeChange: (theme: Theme) => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onGlobalFontSizeChange: (size: number) => void;
  onToggleDyslexic: () => void;
  onInstall: () => void;
}

/** App-wide preferences: theme, language, interface text size, dyslexic font, install. */
const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen, onClose, t, theme, language, globalFontSize, dyslexicMode, showInstall,
  onThemeChange, onLanguageChange, onGlobalFontSizeChange, onToggleDyslexic, onInstall
}) => {
  const themes: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: t.themeCosy, icon: <SunIcon size={16} /> },
    { id: 'dark', label: t.themeDim, icon: <MoonIcon size={16} /> },
    { id: 'oled', label: t.themeOled, icon: <EclipseIcon size={16} /> }
  ];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={t.settings} closeLabel={t.close}>
      <section className="flex flex-col gap-2">
        <span className="label">{t.theme}</span>
        <div className="segmented w-full" role="group" aria-label={t.theme}>
          {themes.map(th => (
            <button key={th.id} aria-pressed={theme === th.id} onClick={() => onThemeChange(th.id)}>
              {th.icon}{th.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <label className="label" htmlFor="settings-language">{t.selectLang}</label>
        <select id="settings-language" className="input" value={language} onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}>
          {LANGUAGE_CODES.map(code => <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>)}
        </select>
      </section>

      <section className="flex items-center justify-between gap-4">
        <span className="label">{t.textSize}</span>
        <div className="flex items-center gap-1">
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onGlobalFontSizeChange(Math.max(14, globalFontSize - 1))} aria-label="Smaller text">
            <span className="text-xs font-semibold">A</span>
          </button>
          <span className="w-14 text-center text-sm tabular text-ink-soft">{Math.round((globalFontSize / 16) * 100)}%</span>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => onGlobalFontSizeChange(Math.min(24, globalFontSize + 1))} aria-label="Larger text">
            <span className="text-base font-semibold">A</span>
          </button>
        </div>
      </section>

      <Toggle label={t.dyslexicFont} checked={dyslexicMode} onChange={onToggleDyslexic} />

      {showInstall && (
        <button className="btn btn-secondary w-full" onClick={() => { onClose(); onInstall(); }}>{t.installPwa}</button>
      )}

      <p className="hint border-t border-line pt-4">{t.privacyNote}</p>
    </Dialog>
  );
};

export default SettingsDialog;
