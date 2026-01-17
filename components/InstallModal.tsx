import React, { useEffect, useState } from 'react';
import { Translation } from '../types';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, t }) => {
  const [platform, setPlatform] = useState<'desktop' | 'ios' | 'android'>('desktop');
  const [detectedPlatform, setDetectedPlatform] = useState<'desktop' | 'ios' | 'android'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    let p: 'desktop' | 'ios' | 'android' = 'desktop';
    if (/iphone|ipad|ipod/.test(ua)) {
      p = 'ios';
    } else if (/android/.test(ua)) {
      p = 'android';
    }
    setPlatform(p);
    setDetectedPlatform(p);
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
          {platform === 'desktop' ? t.download : (t.installModalTitle || t.installPwa)}
        </h2>

        {(platform === 'desktop') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <p>{t.installInstructionsDesktop || "Download the offline-capable app for your computer."}</p>
            <a 
              href="https://github.com/NA-Ag/penko-reader/releases/latest" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                backgroundColor: '#7c3aed',
                color: 'white',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                transition: 'background-color 0.2s'
              }}
            >
              Go to Downloads
            </a>
            <button 
              onClick={() => setPlatform('android')} 
              style={{ background: 'none', border: 'none', color: '#666', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {t.onMobile || "On a mobile device? Click here."}
            </button>
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
            <p style={{ marginBottom: '1rem' }}>{t.installModalDesc || "Install Penko Reader for offline access:"}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0,0,0,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
              {(t.installInstructionsAndroid || "1. Tap menu\n2. Install App\n3. Confirm").split('\n').map((line: string, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {detectedPlatform === 'desktop' && platform !== 'desktop' && (
          <button 
            onClick={() => setPlatform('desktop')}
            style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#666', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {t.back || "Back"}
          </button>
        )}
      </div>
    </div>
  );
};
