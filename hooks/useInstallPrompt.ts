import { useCallback, useEffect, useState } from 'react';

const IS_MOBILE = typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);

/** Tracks the PWA install prompt and whether the app already runs installed. */
export const useInstallPrompt = () => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const installed = () => setInstallPrompt(null);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  useEffect(() => {
    const check = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(Boolean(standalone));
    };
    check();
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', check);
    return () => mq.removeEventListener?.('change', check);
  }, []);

  /** Returns true if the native prompt was shown, false if the caller should show manual instructions. */
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!installPrompt) return false;
    // A deferred prompt can only be shown once; drop it whatever the user chooses.
    setInstallPrompt(null);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch { /* ignore */ }
    return true;
  }, [installPrompt]);

  const isMobile = IS_MOBILE;

  return { canPrompt: Boolean(installPrompt), isStandalone, isMobile, promptInstall };
};
