import React, { useEffect, useState } from 'react';
import { Translation } from '../types';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, t }) => {
  const [platform, setPlatform] = useState<'desktop' | 'ios' | 'android'>('desktop');
  const [browser, setBrowser] = useState<'chrome' | 'firefox' | 'samsung'>('chrome');

  useEffect(() => {
    if (isOpen) {
      // Initial guess, but user can change it via dropdowns
      const ua = navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(ua)) {
        setPlatform('ios');
      } else if (/android/.test(ua)) {
        setPlatform('android');
      } else {
        setPlatform('desktop');
      }

      if (ua.includes('samsungbrowser')) {
        setBrowser('samsung');
      } else if (ua.includes('firefox') || ua.includes('fxios')) {
        setBrowser('firefox');
      } else {
        setBrowser('chrome');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'var(--bg-color, #ffffff)',
        color: 'var(--text-color, #333333)',
        padding: '2rem',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '90%',
        position: 'relative',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }} onClick={e => e.stopPropagation()}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: 'inherit',
            opacity: 0.6
          }}
        >
          ×
        </button>

        <img src="/penguin-reader-logo.svg" alt="Penko Reader" style={{ width: '64px', height: '64px', marginBottom: '1rem' }} />

        <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.5rem' }}>
          {t.installModalTitle || t.installPwa}
        </h2>

        <div className="w-full mb-4 flex flex-col gap-3">
           <div className="flex flex-col text-left">
             <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Device</label>
             <select 
               value={platform} 
               onChange={(e) => setPlatform(e.target.value as any)}
               className="p-2 border-2 border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
             >
               <option value="desktop">Desktop / Laptop</option>
               <option value="android">Android</option>
               <option value="ios">iOS</option>
             </select>
           </div>
           
           {platform === 'android' && (
             <div className="flex flex-col text-left">
               <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Browser</label>
               <select 
                 value={browser} 
                 onChange={(e) => setBrowser(e.target.value as any)}
                 className="p-2 border-2 border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
               >
                 <option value="chrome">Chrome / Default</option>
                 <option value="firefox">Firefox</option>
                 <option value="samsung">Samsung Internet</option>
               </select>
             </div>
           )}
        </div>

        {(platform === 'desktop') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <p>{t.installInstructionsDesktop || "Download the offline-capable app for your computer."}</p>
            <a 
              href="https://github.com/NA-Ag/penko-reader/releases/latest" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex justify-center items-center gap-2 px-4 py-2 bg-cyan-600 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
              style={{ textDecoration: 'none' }}
            >
              Go to Downloads
            </a>
          </div>
        )}

        {platform === 'ios' && (
          <div style={{ width: '100%' }}>
            <p style={{ marginBottom: '1rem' }}>{t.installModalDesc || "Install Penko Reader on your home screen for the best offline experience:"}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0,0,0,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
              {(t.installInstructionsIOS || "1. Tap the Share button\n2. Select 'Add to Home Screen'\n3. Tap 'Add'").split('\n').map((line: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {platform === 'android' && (
          <div style={{ width: '100%' }}>
            <p style={{ marginBottom: '1rem' }}>{t.installModalDesc || "Install the app for a local offline private experience."}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0,0,0,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
              {(() => {
                let instructions = t.installInstructionsAndroid;
                if (browser === 'firefox') instructions = t.installInstructionsFirefox || instructions;
                if (browser === 'samsung') instructions = t.installInstructionsSamsung || instructions;
                return instructions || "1. Tap menu\n2. Install App\n3. Confirm";
              })().split('\n').map((line: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};