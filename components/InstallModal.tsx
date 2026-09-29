import React, { useEffect, useState } from 'react';
import { Translation } from '../types';
import Dialog from './ui/Dialog';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
}

type Platform = 'desktop' | 'android' | 'ios';
type Browser = 'chrome' | 'firefox' | 'samsung';

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'android', label: 'Android' },
  { id: 'ios', label: 'iOS' },
];

/** Numbered install steps with small accent step markers. */
const Steps: React.FC<{ text: string }> = ({ text }) => (
  <ol className="flex flex-col gap-3">
    {text.split('\n').filter(Boolean).map((line, i) => (
      <li key={i} className="flex gap-3 text-sm text-ink-soft leading-relaxed">
        <span className="shrink-0 w-6 h-6 rounded-full bg-accent-soft text-accent-ink text-xs font-semibold flex items-center justify-center tabular">{i + 1}</span>
        <span className="pt-0.5">{line.replace(/^\s*\d+\.\s*/, '')}</span>
      </li>
    ))}
  </ol>
);

/** Explains how to install the web app on the current platform. */
export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, t }) => {
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [browser, setBrowser] = useState<Browser>('chrome');

  useEffect(() => {
    if (!isOpen) return;
    const ua = navigator.userAgent.toLowerCase();
    setPlatform(/iphone|ipad|ipod/.test(ua) ? 'ios' : /android/.test(ua) ? 'android' : 'desktop');
    setBrowser(ua.includes('samsungbrowser') ? 'samsung' : (ua.includes('firefox') || ua.includes('fxios')) ? 'firefox' : 'chrome');
  }, [isOpen]);

  const steps =
    platform === 'desktop' ? t.installInstructionsDesktop
    : platform === 'ios' ? t.installInstructionsIOS
    : browser === 'firefox' ? t.installInstructionsFirefox
    : browser === 'samsung' ? t.installInstructionsSamsung
    : t.installInstructionsAndroid;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t.installModalTitle}
      description={t.installModalDesc}
      mascot="talk"
      size="md"
      closeLabel={t.close}
      footer={<button onClick={onClose} className="btn btn-secondary">{t.close}</button>}
    >
      <div className="segmented w-full" role="tablist" aria-label="Device">
        {PLATFORMS.map(p => (
          <button key={p.id} role="tab" aria-selected={platform === p.id} onClick={() => setPlatform(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {platform === 'android' && (
        <label className="flex flex-col gap-1.5">
          <span className="label">Browser</span>
          <select value={browser} onChange={(e) => setBrowser(e.target.value as Browser)} className="input">
            <option value="chrome">Chrome / Default</option>
            <option value="firefox">Firefox</option>
            <option value="samsung">Samsung Internet</option>
          </select>
        </label>
      )}

      <Steps text={steps} />
    </Dialog>
  );
};

export default InstallModal;
