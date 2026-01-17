import React, { useEffect, useState } from 'react';
import { Translation } from '../types';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: Translation;
}

export const InstallModal: React.FC<InstallModalProps> = ({ isOpen, onClose, t }) => {
  const [platform, setPlatform] = useState<'desktop' | 'ios' | 'android'>('desktop');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setPlatform('ios');
    } else if (/android/.test(ua)) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }
  }, []);

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
          {platform === 'desktop' ? t.download : t.installPwa}
        </h2>

        {(platform === 'desktop') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <p>Download the offline-capable app for your computer.</p>
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
              On a mobile device? Click here.
            </button>
          </div>
        )}

        {platform === 'ios' && (
          <div style={{ width: '100%' }}>
            <p style={{ marginBottom: '1rem' }}>Install Penko Reader on your home screen for the best offline experience:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0,0,0,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>1.</span>
                <span>Tap the <strong>Share</strong> button (square with arrow)</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>2.</span>
                <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>3.</span>
                <span>Tap <strong>Add</strong> in the top right corner</span>
              </div>
            </div>
          </div>
        )}

        {platform === 'android' && (
          <div style={{ width: '100%' }}>
            <p style={{ marginBottom: '1rem' }}>Install Penko Reader for offline access:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(0,0,0,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>1.</span>
                <span>Tap the browser menu (three dots icon)</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>2.</span>
                <span>Select <strong>Install App</strong> or <strong>Add to Home Screen</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>3.</span>
                <span>Follow the on-screen prompt to confirm</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
