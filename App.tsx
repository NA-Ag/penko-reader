import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WordToken, ReaderStatus, LanguageCode, Theme } from './types';
import { TRANSLATIONS } from './utils/translations';
import Controls from './components/Controls';
import OrpDisplay from './components/OrpDisplay';
import ReaderInput from './components/ReaderInput';
import FullTextDisplay from './components/FullTextDisplay';
import Modal from './components/Modal';

const App: React.FC = () => {
  const [tokens, setTokens] = useState<WordToken[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<ReaderStatus>(ReaderStatus.IDLE);
  const [wpm, setWpm] = useState(300);
  const [fontSize, setFontSize] = useState(64);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [contentLanguage, setContentLanguage] = useState<LanguageCode>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [showFullText, setShowFullText] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [dyslexicMode, setDyslexicMode] = useState(false);
  const [pauseOnPunctuation, setPauseOnPunctuation] = useState(true);
  const [clickToDefine, setClickToDefine] = useState(false);
  const [verticalMode, setVerticalMode] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' });

  const timerRef = useRef<number | null>(null);

  // Get current translation object
  const t = TRANSLATIONS[language];

  // Initialize with empty state when language changes
  useEffect(() => {
    setTokens([]);
    setCurrentIndex(0);
    setStatus(ReaderStatus.IDLE);
  }, [language]);

  // Handle Theme Change
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Handle PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Timer Tick
  const tick = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= tokens.length) {
        setStatus(ReaderStatus.COMPLETED);
        return prev;
      }
      return next;
    });
  }, [tokens.length]);

  // Main Loop
  useEffect(() => {
    if (status === ReaderStatus.PLAYING) {
      const currentToken = tokens[currentIndex];
      let delay = 60000 / wpm;
      
      // Pause adjustments
      if (currentToken && currentToken.hasPause && pauseOnPunctuation) {
        delay = delay * 2.2;
      }

      timerRef.current = window.setTimeout(tick, delay);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, currentIndex, wpm, tokens, tick, pauseOnPunctuation]);

  // Handlers
  const handleTogglePlay = useCallback(() => {
    if (tokens.length === 0) return;
    setStatus(prev => {
      if (prev === ReaderStatus.COMPLETED) {
        setCurrentIndex(0);
        return ReaderStatus.PLAYING;
      }
      return prev === ReaderStatus.PLAYING ? ReaderStatus.PAUSED : ReaderStatus.PLAYING;
    });
  }, [tokens.length]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setStatus(ReaderStatus.IDLE);
  }, []);

  const handleSeek = (percentage: number) => {
    const index = Math.floor((percentage / 100) * tokens.length);
    setCurrentIndex(Math.min(index, tokens.length - 1));
  };
  
  const handleWordClick = async (index: number) => {
    // Dictionary feature pending future update
    // if (clickToDefine) {
    //   const word = tokens[index].word;
    //   // Try to lookup in binary dictionary
    //   const definition = await dictionaryService.lookup(word, contentLanguage);
    //   if (definition) {
    //     setModal({ isOpen: true, title: word, message: definition });
    //   } else {
    //     setModal({ isOpen: true, title: 'Not Found', message: `Definition not found in local dictionary (${contentLanguage}.bin).` });
    //   }
    //   return;
    // }
    setCurrentIndex(index);
    setStatus(ReaderStatus.PAUSED);
  };

  const handleInstall = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    } else {
      // Fallback for iOS or if prompt is not available
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        setModal({ isOpen: true, title: 'Install on iOS', message: "1. Tap the Share button\n2. Scroll down and tap 'Add to Home Screen'" });
      } else {
        setModal({ isOpen: true, title: 'Install App', message: "Look for the 'Install' icon in your browser's address bar, or select 'Install Penko Reader' from the browser menu." });
      }
    }
  };

  const handleDownload = () => {
    // Update this URL to your actual GitHub Releases page
    const repoUrl = 'https://github.com/NA-Ag/penko-reader/releases';
    window.open(repoUrl, '_blank');
  };

  // Smart Tokenizer that handles CJK (Chinese/Japanese/Korean) correctly
  const smartTokenize = (text: string, lang: LanguageCode): WordToken[] => {
    // Regex to detect CJK characters
    const hasCJK = /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/.test(text);

    if (hasCJK && typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      // Use browser's native segmenter for CJK
      const segmenter = new (Intl as any).Segmenter(lang, { granularity: 'word' });
      const segments = Array.from(segmenter.segment(text));
      
      return segments
        .filter((s: any) => s.isWordLike) // Filter out pure whitespace/punctuation if needed, though we might want punctuation for pauses
        .map((s: any, index: number) => {
          const word = s.segment;
          // Simple pause detection for CJK punctuation
          const hasPause = /[。、！？，：；]/.test(word); 
          return {
            id: `token-${index}`,
            word: word,
            raw: word,
            hasPause: hasPause,
            isParagraphStart: false // Segmenter doesn't easily give us this, simplifying for now
          };
        });
    } else {
      // Fallback to standard space-splitting for non-CJK
      // We recreate a simple version of processTextToTokens here to avoid dependency issues
      return text.split(/\s+/).filter(w => w.length > 0).map((word, index) => ({
        id: `token-${index}`,
        word,
        raw: word,
        hasPause: /[.,;!?]$/.test(word),
        isParagraphStart: false
      }));
    }
  };

  const handleContentReady = (text: string, lang: LanguageCode = 'en') => {
    setContentLanguage(lang);
    if (lang !== 'ja' && lang !== 'zh') {
      setVerticalMode(false);
    }
    const processedTokens = smartTokenize(text, lang);
    setTokens(processedTokens);
    setCurrentIndex(0);
    setStatus(ReaderStatus.IDLE);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }
      
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
        setSidebarOpen(true);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRestart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleRestart]);

  const progress = tokens.length > 0 ? (currentIndex / tokens.length) * 100 : 0;
  const currentWord = tokens[currentIndex]?.word || '';
  
  // Available languages
  const languages: LanguageCode[] = ['en', 'es', 'fr', 'de', 'ja', 'ru', 'uk', 'it', 'pt', 'zh'];

  return (
    <div className={`min-h-screen flex flex-col p-6 transition-colors duration-300 bg-slate-50 dark:bg-slate-900 ${dyslexicMode ? 'font-dyslexic' : ''}`}>
      
      {/* Navbar / Header */}
      <div className={`w-full flex flex-col md:flex-row items-center justify-between mb-8 gap-4 transition-all duration-500 ${focusMode ? '-mt-32 opacity-0 pointer-events-none absolute' : 'opacity-100'}`}>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-2 mr-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Toggle Sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <img src="penguin-logo.svg" alt="Penko" className="w-8 h-8" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Penko Reader</h1>
        </div>

        <div className="flex items-center gap-4">
           {/* PWA Install Button (Mobile/Web) */}
           {(installPrompt || /iPad|iPhone|iPod|Android/.test(navigator.userAgent)) && (
             <button
               onClick={handleInstall}
               className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
             >
               {t.installPwa}
             </button>
           )}

           {/* Electron Download Button (Desktop) */}
           <button
             onClick={handleDownload}
             className="hidden md:flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
           >
             {t.download}
           </button>

           {/* Theme Toggle */}
           <button 
             onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
             className="p-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
             title="Toggle Dark Mode"
           >
             {theme === 'light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
             ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
             )}
           </button>

            {/* Language Selector */}
            <div className="flex flex-wrap justify-center gap-2">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-1 text-sm font-mono font-bold border-2 transition-all ${
                    language === lang 
                      ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-800 dark:border-slate-100' 
                      : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-slate-800 dark:hover:border-slate-200 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
        </div>
      </div>

      <div className="w-full flex flex-col lg:flex-row gap-6 items-start flex-1 relative">
        
        {/* Sidebar: Controls & Input */}
        <aside className={`flex flex-col gap-6 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen && !focusMode ? 'w-full lg:w-96 opacity-100' : 'w-0 opacity-0 lg:w-0 lg:opacity-0 h-0 lg:h-auto'}`}>
          
          {/* Input & Library */}
          <div className={`${status === ReaderStatus.PLAYING ? 'opacity-50 pointer-events-none grayscale' : 'opacity-100'} transition-all duration-500`}>
             <ReaderInput currentLang={language} availableLanguages={languages} t={t} onContentReady={handleContentReady} />
          </div>

          {/* Controls */}
          <div className="bg-white dark:bg-slate-800 rounded-none border-2 border-slate-900 dark:border-slate-400 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] p-6">
            <Controls 
              status={status}
              wpm={wpm}
              fontSize={fontSize}
              progress={progress}
              t={t}
              onTogglePlay={handleTogglePlay}
              onRestart={handleRestart}
              onWpmChange={setWpm}
              onFontSizeChange={setFontSize}
              onSeek={handleSeek}
              dyslexicMode={dyslexicMode}
              pauseOnPunctuation={pauseOnPunctuation}
              clickToDefine={clickToDefine}
              onToggleDyslexic={() => setDyslexicMode(!dyslexicMode)}
              onTogglePauseOnPunctuation={() => setPauseOnPunctuation(!pauseOnPunctuation)}
              onToggleClickToDefine={() => setClickToDefine(!clickToDefine)}
              verticalMode={verticalMode}
              contentLanguage={contentLanguage}
              onToggleVerticalMode={() => setVerticalMode(!verticalMode)}
              focusMode={focusMode}
              onToggleFocusMode={() => setFocusMode(!focusMode)}
            />
          </div>
        </aside>

        {/* Main Content: Reader & Full Text */}
        <main className={`flex-1 w-full flex gap-6 min-w-0 transition-all duration-500 ${verticalMode ? 'flex-row-reverse h-[calc(100vh-8rem)]' : 'flex-col'}`}>
           
           {/* RSVP Display Area */}
          <div className={`flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative p-8 transition-all duration-500 ${verticalMode ? 'w-1/3 h-full' : 'w-full min-h-[300px]'}`}>
             <div className={`absolute bg-red-500/10 pointer-events-none ${verticalMode ? 'h-full w-[1px] left-1/2 -ml-[0.5px]' : 'w-full h-[1px] top-1/2 -mt-[0.5px]'}`}></div>
             <OrpDisplay 
               word={currentWord} 
               fontSize={fontSize} 
               t={t} 
               verticalMode={verticalMode}
               contentLanguage={contentLanguage}
             />
          </div>

          {/* Toggle Full Text Button */}
          {tokens.length > 0 && (
             <div className={`flex justify-center ${verticalMode ? 'flex-col h-full' : 'w-full'}`}>
                <button 
                  onClick={() => setShowFullText(!showFullText)}
                  className={`text-sm font-medium text-primary dark:text-blue-400 hover:underline flex items-center gap-2 ${verticalMode ? 'writing-vertical-rl' : ''}`}
                >
                  {showFullText ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      {t.hideFullText}
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {t.fullText}
                    </>
                  )}
                </button>
             </div>
          )}

          {/* Full Text Display */}
          {showFullText && tokens.length > 0 && (
             <div className={`animate-in fade-in duration-500 ${verticalMode ? 'w-2/3 h-full slide-in-from-left-4' : 'w-full slide-in-from-bottom-4'}`}>
               <FullTextDisplay 
                 tokens={tokens} 
                 currentIndex={currentIndex} 
                 t={t} 
                 onWordClick={handleWordClick}
                 clickToDefine={clickToDefine}
                 verticalMode={verticalMode}
               />
             </div>
          )}
        </main>

        {/* Focus Mode Controls */}
        {focusMode && (
          <div className="fixed bottom-6 right-6 flex flex-col gap-4 z-50">
            <button
              onClick={handleTogglePlay}
              className="p-4 bg-cyan-600 text-white rounded-full shadow-lg hover:bg-cyan-700 transition-colors opacity-50 hover:opacity-100"
              title={status === ReaderStatus.PLAYING ? "Pause" : "Play"}
            >
              {status === ReaderStatus.PLAYING ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6 pl-1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              )}
            </button>
            
            <button
              onClick={() => setFocusMode(false)}
              className="p-4 bg-slate-800 text-white rounded-full shadow-lg hover:bg-slate-700 transition-colors opacity-50 hover:opacity-100"
              title={t.exitFocus}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <Modal 
          isOpen={modal.isOpen} 
          title={modal.title} 
          message={modal.message} 
          onClose={() => setModal({ ...modal, isOpen: false })} 
        />
      </div>
    </div>
  );
};

export default App;

};

export default App;
