import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WordToken, ReaderStatus, LanguageCode, Theme, AppView, StoredBook } from './types';
import { TRANSLATIONS } from './utils/translations';
import Controls from './components/Controls';
import OrpDisplay from './components/OrpDisplay';
import ReaderInput from './components/ReaderInput';
import FullTextDisplay from './components/FullTextDisplay';
import Modal from './components/Modal';
import { InstallModal } from './components/InstallModal';
import BookReader from './components/BookReader';
import { PenkoMascot } from './components/PenkoMascot';
import { saveBook, loadBooks, deleteBook } from './utils/persistence';
import { readFileContent } from './utils/fileProcessor';
import { readEpubFile } from './utils/epubProcessor';
import { readMobiFile } from './utils/mobiProcessor';

const BOOK_COLORS = [
  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300',
  'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
];

const getBookColorClass = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BOOK_COLORS[Math.abs(hash) % BOOK_COLORS.length];
};

const getSpineStyle = (id: string) => {
  const spinePalettes = [
    { bg: '#7f1d1d', edge: '#581c1c', text: '#fca5a5' }, // Crimson
    { bg: '#064e3b', edge: '#063527', text: '#6ee7b7' }, // Spruce Green
    { bg: '#1e3a8a', edge: '#172554', text: '#93c5fd' }, // Royal Blue
    { bg: '#3b0764', edge: '#22033e', text: '#d8b4fe' }, // Purple
    { bg: '#78350f', edge: '#451a03', text: '#fde68a' }, // Gold Brown
    { bg: '#111827', edge: '#030712', text: '#d1d5db' }, // Charcoal Dark
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return spinePalettes[Math.abs(hash) % spinePalettes.length];
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  ru: 'Русский',
  uk: 'Українська',
  it: 'Italiano',
  pt: 'Português',
  zh: '中文'
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [library, setLibrary] = useState<StoredBook[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<WordToken[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<ReaderStatus>(ReaderStatus.IDLE);
  const [wpm, setWpm] = useState(300);
  const [fontSize, setFontSize] = useState(64);
  const [globalFontSize, setGlobalFontSize] = useState<number>(() => {
    return Number(localStorage.getItem('penko-global-font-size') || '16');
  });
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    document.documentElement.style.fontSize = `${globalFontSize}px`;
    localStorage.setItem('penko-global-font-size', globalFontSize.toString());
  }, [globalFontSize]);

  const [language, setLanguage] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem('penko-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.language || 'en';
      }
    } catch (e) {
      console.error("Failed to load language setting", e);
    }
    return 'en';
  });
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
  const [isInstallModalOpen, setInstallModalOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'title'>('recent');
  const [bookToDelete, setBookToDelete] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('penko-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.categories || [];
      }
    } catch (e) {
      console.error("Failed to load categories setting", e);
    }
    return [];
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [bookToCategorize, setBookToCategorize] = useState<string | null>(null);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  
  // Demo State
  const [demoStatus, setDemoStatus] = useState<ReaderStatus>(ReaderStatus.IDLE);
  const [demoIndex, setDemoIndex] = useState(0);

  const timerRef = useRef<number | null>(null);
  const demoTimerRef = useRef<number | null>(null);

  // Get current translation object
  const t = TRANSLATIONS[language];

  // Load Library on Mount
  useEffect(() => {
    loadBooks().then(books => {
      setLibrary(books.sort((a, b) => (b.isFavorite === a.isFavorite ? 0 : b.isFavorite ? 1 : -1) || b.lastRead - a.lastRead));
    }).catch(err => {
      console.error("Failed to load library", err);
    });
  }, []);

  // Load settings and state from LocalStorage on mount
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('penko-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.wpm) setWpm(parsed.wpm);
        if (parsed.fontSize) setFontSize(parsed.fontSize);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.contentLanguage) setContentLanguage(parsed.contentLanguage);
        if (parsed.dyslexicMode !== undefined) setDyslexicMode(parsed.dyslexicMode);
        if (parsed.pauseOnPunctuation !== undefined) setPauseOnPunctuation(parsed.pauseOnPunctuation);
        if (parsed.view) setView(parsed.view);
        if (parsed.currentBookId) setCurrentBookId(parsed.currentBookId);
      }

      const savedBook = localStorage.getItem('penko-book');
      if (savedBook) {
        const parsed = JSON.parse(savedBook);
        if (parsed.tokens && parsed.tokens.length > 0) {
          setTokens(parsed.tokens);
          setCurrentIndex(parsed.currentIndex || 0);
          setContentLanguage(parsed.contentLanguage || 'en');
          // Note: We don't restore currentBookId here easily without storing it, but that's okay for now
        }
      }
    } catch (e) {
      console.error("Failed to load saved state", e);
    }
  }, []);

  // Initialize with empty state when language changes
  useEffect(() => {
    setTokens([]);
    setCurrentIndex(0);
    setStatus(ReaderStatus.IDLE);
  }, [language]);

  // Handle Theme Change
  useEffect(() => {
    if (theme === 'dark' || theme === 'oled') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Save settings to LocalStorage
  useEffect(() => {
    localStorage.setItem('penko-settings', JSON.stringify({
      wpm, fontSize, theme, language, contentLanguage, dyslexicMode, pauseOnPunctuation, view, currentBookId, categories
    }));
  }, [wpm, fontSize, theme, language, contentLanguage, dyslexicMode, pauseOnPunctuation, view, currentBookId, categories]);

  // Save book progress to LocalStorage (only when paused or idle to save performance)
  useEffect(() => {
    if (tokens.length > 0 && status !== ReaderStatus.PLAYING) {
      // 1. Save "Resume" state
      try {
        localStorage.setItem('penko-book', JSON.stringify({
          tokens, currentIndex, contentLanguage
        }));
      } catch (e) {
        console.warn("Book too large to save to local storage");
      }

      // 2. Update Library Persistence (IndexedDB)
      if (currentBookId) {
        setLibrary(prev => {
          const newLibrary = prev.map(b => 
            b.id === currentBookId ? { ...b, progress: currentIndex, totalTokens: tokens.length, lastRead: Date.now() } : b
          );
          // We also need to persist this to IDB
          const bookToSave = newLibrary.find(b => b.id === currentBookId);
          if (bookToSave) saveBook(bookToSave).catch(console.error);
          return newLibrary;
        });
      }
    }
  }, [tokens, currentIndex, status, contentLanguage, currentBookId]);

  // Handle PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Check if running in standalone mode (installed)
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();
    window.addEventListener('resize', checkStandalone);
    return () => window.removeEventListener('resize', checkStandalone);
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

  // Demo Loop
  const demoTokens = React.useMemo(() => {
    const text = TRANSLATIONS[contentLanguage]?.demoText || t.demoText;
    return text.split(/\s+/).map((word, i) => ({
      id: `demo-${i}`,
      word,
      raw: word,
      hasPause: /[.,;!?]$/.test(word)
    }));
  }, [contentLanguage, t.demoText]);

  useEffect(() => {
    if (demoStatus === ReaderStatus.PLAYING) {
      const currentToken = demoTokens[demoIndex];
      let delay = 60000 / wpm;
      
      if (currentToken && currentToken.hasPause && pauseOnPunctuation) {
        delay = delay * 2.2;
      }

      demoTimerRef.current = window.setTimeout(() => {
        setDemoIndex(prev => (prev + 1) % demoTokens.length);
      }, delay);
    } else {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    }
    return () => {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    };
  }, [demoStatus, demoIndex, wpm, demoTokens, pauseOnPunctuation]);

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

  const handleToggleDemo = useCallback(() => {
    setDemoStatus(prev => prev === ReaderStatus.PLAYING ? ReaderStatus.IDLE : ReaderStatus.PLAYING);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setStatus(ReaderStatus.PAUSED);
  }, []);

  const handleRestartDemo = useCallback(() => {
    setDemoIndex(0);
    setDemoStatus(ReaderStatus.IDLE);
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
      setInstallModalOpen(true);
    }
  };

  const handleDownload = () => {
    setInstallModalOpen(true);
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

  const processFiles = async (files: File[]) => {
    const processedTitles = new Set<string>();

    for (const file of files) {
      const title = file.name.replace(/\.[^/.]+$/, "");
      
      if (library.some(b => b.title === title) || processedTitles.has(title)) {
        console.log(`Skipping duplicate: ${title}`);
        continue;
      }

      let text = '';
      let coverUrl: string | undefined;
      let fileType: 'pdf' | 'epub' | 'mobi' | null = null;

      // Detect file type via magic numbers (header)
      try {
        const buffer = await file.slice(0, 4).arrayBuffer();
        const view = new Uint8Array(buffer);
        const header = Array.from(view).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        
        if (header === '25504446') fileType = 'pdf'; // %PDF
        else if (header.startsWith('504B')) fileType = 'epub'; // PK.. (Zip)
      } catch (e) {
        console.warn("Failed to check file header", e);
      }

      // Fallback to extension if magic number check fails or is ambiguous
      if (!fileType) {
        if (file.name.toLowerCase().endsWith('.pdf')) fileType = 'pdf';
        else if (file.name.toLowerCase().endsWith('.epub')) fileType = 'epub';
        else if (file.name.toLowerCase().endsWith('.mobi')) fileType = 'mobi';
      }

      if (!fileType) continue;

      try {
        if (fileType === 'pdf') {
          // Store binary as Data URL for rendering
          text = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          
          // Use file size for token estimation (rough approximation to avoid reading text)
          const estimatedTokens = file.size / 15;
          
          const newBook: StoredBook = {
            id: crypto.randomUUID(),
            title: title,
            content: text,
            fileType,
            progress: 0,
            isFavorite: false,
            totalTokens: Math.floor(estimatedTokens),
            lastRead: Date.now(),
            coverUrl,
            highlights: []
          };

          await saveBook(newBook);
          setLibrary(prev => [newBook, ...prev]);
          processedTitles.add(title);
          continue; // Skip the default logic below
        } else if (fileType === 'epub') {
          const result = await readEpubFile(file);
          text = result.text;
          coverUrl = result.coverUrl;
      
      // Convert Blob URL to Base64 if necessary to ensure persistence across sessions
      if (coverUrl && coverUrl.startsWith('blob:')) {
        try {
          const response = await fetch(coverUrl);
          const blob = await response.blob();
          coverUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn('Failed to convert cover blob to base64', e);
        }
      }
        } else if (fileType === 'mobi') {
          const result = await readMobiFile(file);
          text = result.text;
          coverUrl = result.coverUrl;
        }

        // Estimate total tokens for progress bar (approx 5 chars per word)
        const estimatedTokens = text.length / 5;

        const newBook: StoredBook = {
          id: crypto.randomUUID(),
          title: title,
          content: text,
          fileType,
          progress: 0,
          isFavorite: false,
          totalTokens: Math.floor(estimatedTokens),
          lastRead: Date.now(),
          coverUrl
        };

        await saveBook(newBook);
        setLibrary(prev => [newBook, ...prev]);
        processedTitles.add(title);
      } catch (err) {
        console.error(`Failed to import ${file.name}`, err);
      }
    }
  };

  const handleImportBook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
    }
  };

  const performExport = () => {
    const dataStr = JSON.stringify(library);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `penko-library-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsBackupModalOpen(false);
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        alert("Invalid backup file format.");
        return;
      }

      // Merge logic: Update existing books by ID, add new ones
      const newLibrary = [...library];
      for (const book of data) {
         if (!book.id || !book.title) continue; // Skip invalid entries
         
         const existingIdx = newLibrary.findIndex(b => b.id === book.id);
         if (existingIdx >= 0) {
           newLibrary[existingIdx] = book;
         } else {
           newLibrary.push(book);
         }
         await saveBook(book); // Persist to IDB
      }
      setLibrary(newLibrary);
      setIsBackupModalOpen(false);
    } catch (err) {
      console.error("Failed to restore backup", err);
      alert("Error reading backup file.");
    }
  };

  const handleContentReady = useCallback((text: string, lang: LanguageCode = 'en') => {
    setContentLanguage(lang);
    if (lang !== 'ja' && lang !== 'zh') {
      setVerticalMode(false);
    }
    
    // Strip HTML tags if present (for Training Mode)
    // Use regex for performance on large files instead of DOMParser which can crash on huge strings
    const cleanText = /<[a-z][^>]*>/i.test(text)
      ? text.replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
      : text;

    const processedTokens = smartTokenize(cleanText, lang);
    setTokens(processedTokens);
    setCurrentIndex(0);
    setStatus(ReaderStatus.IDLE);
    setView('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBack = () => {
    if (currentBookId) {
      setView('library');
    } else {
      setView('home');
    }
  };

  const openBook = (book: StoredBook) => {
    setCurrentBookId(book.id);
    // Update last read
    const updatedBook = { ...book, lastRead: Date.now(), progress: book.progress || 0 };
    saveBook(updatedBook);
    setLibrary(prev => prev.map(b => b.id === book.id ? updatedBook : b).sort((a, b) => (b.isFavorite === a.isFavorite ? 0 : b.isFavorite ? 1 : -1) || b.lastRead - a.lastRead));
    setView('book-reader');
  };

  const handleDeleteBook = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setBookToDelete(id);
  };

  const confirmDelete = async () => {
    if (bookToDelete) {
      await deleteBook(bookToDelete);
      setLibrary(prev => prev.filter(b => b.id !== bookToDelete));
      if (currentBookId === bookToDelete) setCurrentBookId(null);
      setBookToDelete(null);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, book: StoredBook) => {
    e.stopPropagation();
    const updatedBook = { ...book, isFavorite: !book.isFavorite };
    await saveBook(updatedBook);
    setLibrary(prev => prev.map(b => b.id === book.id ? updatedBook : b).sort((a, b) => (b.isFavorite === a.isFavorite ? 0 : b.isFavorite ? 1 : -1) || b.lastRead - a.lastRead));
  };

  const handleAddCategory = () => {
    setNewCategoryName('');
    setIsAddCategoryModalOpen(true);
  };

  const confirmAddCategory = () => {
    if (newCategoryName.trim() && !categories.includes(newCategoryName.trim())) {
      setCategories([...categories, newCategoryName.trim()]);
      setIsAddCategoryModalOpen(false);
    } else if (!newCategoryName.trim()) {
      setIsAddCategoryModalOpen(false);
    }
  };

  const handleDeleteCategory = (category: string) => {
    setCategoryToDelete(category);
  };

  const confirmDeleteCategory = () => {
    if (categoryToDelete) {
      setCategories(categories.filter(c => c !== categoryToDelete));
      if (selectedCategory === categoryToDelete) setSelectedCategory(null);
      
      // Remove category from books
      const updatedLibrary = library.map(b => {
        if (b.category === categoryToDelete) {
          const updated = { ...b, category: undefined };
          saveBook(updated); // Persist change
          return updated;
        }
        return b;
      });
      setLibrary(updatedLibrary);
      setCategoryToDelete(null);
    }
  };

  const handleAssignCategory = (bookId: string, category: string | undefined) => {
    const book = library.find(b => b.id === bookId);
    if (book) {
      const updatedBook = { ...book, category };
      saveBook(updatedBook);
      setLibrary(prev => prev.map(b => b.id === bookId ? updatedBook : b));
    }
    setBookToCategorize(null);
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

  const getWpmLabel = (val: number) => {
    if (val < 200) return t.wpmLabels.slow;
    if (val < 300) return t.wpmLabels.normal;
    if (val < 400) return t.wpmLabels.average;
    if (val < 500) return t.wpmLabels.good;
    if (val < 700) return t.wpmLabels.fast;
    if (val < 1000) return t.wpmLabels.speed;
    return t.wpmLabels.superhuman;
  };

  const filteredLibrary = library
    .filter(book => {
      const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === null 
        ? true 
        : selectedCategory === 'uncategorized' 
          ? !book.category 
          : selectedCategory === 'favorites'
            ? book.isFavorite
            : book.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return b.lastRead - a.lastRead;
      return a.title.localeCompare(b.title);
    });

  return (
    <div className={`min-h-screen flex flex-col p-6 transition-colors duration-300 relative overflow-hidden ${theme === 'oled' ? 'bg-black' : theme === 'dark' ? 'bg-[#1e1611]' : 'bg-[#fff8e7]'} ${dyslexicMode ? 'font-dyslexic' : ''}`}>

      {/* Navbar / Header - Hide when reading */}
      {(view !== 'reader' || status === ReaderStatus.IDLE) && (
      <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between mb-10 gap-4 transition-all duration-500 paper-card p-5 rounded-2xl relative z-30">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 dark:bg-[#3f2314] p-1.5 rounded-xl border border-amber-900/10 dark:border-white/5 shadow-sm">
            <PenkoMascot size={48} pose="idle" themeColor="violet" showBook={true} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-2xl font-serif font-bold tracking-tight text-amber-900 dark:text-amber-500">{t.brandTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
           {/* PWA Install Button */}
           {!isStandalone && (installPrompt || /iPad|iPhone|iPod|Android/.test(navigator.userAgent)) && (
             <button
               onClick={handleInstall}
               className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition-all active:scale-95 border border-amber-900/20"
             >
               {t.installPwa}
             </button>
           )}

           {/* Font Size Quick Scale Adjusters */}
           <div className="flex items-center gap-1 bg-amber-50 dark:bg-[#342319] border border-amber-900/20 dark:border-white/5 p-1 rounded-xl shadow-sm">
             <button 
               onClick={() => setGlobalFontSize(prev => Math.max(14, prev - 1))}
               className="px-2.5 py-1 text-xs font-bold font-serif hover:bg-amber-100 dark:hover:bg-[#2b1e17] rounded-lg transition-colors text-amber-950 dark:text-amber-400"
               title="Decrease Sanctuary Scale"
             >
               A-
             </button>
             <span className="text-[10px] font-mono font-bold px-1 text-amber-900/50 dark:text-amber-500/50">
               {Math.round((globalFontSize / 16) * 100)}%
             </span>
             <button 
               onClick={() => setGlobalFontSize(prev => Math.min(24, prev + 1))}
               className="px-2.5 py-1 text-xs font-bold font-serif hover:bg-amber-100 dark:hover:bg-[#2b1e17] rounded-lg transition-colors text-amber-950 dark:text-amber-400"
               title="Increase Sanctuary Scale"
             >
               A+
             </button>
           </div>

           {/* Theme Toggle (Cosy / Dim / OLED) */}
           <button 
             onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'oled' : 'light')}
             className="p-2 py-1.5 px-3 rounded-xl bg-amber-50 dark:bg-[#342319] text-amber-950 dark:text-amber-400 border border-amber-900/20 dark:border-white/5 hover:bg-amber-100 dark:hover:bg-[#2b1e17] transition-all active:scale-90 flex items-center gap-1.5 shadow-sm"
             title="Toggle Sanctuary Ambience"
           >
             {theme === 'light' ? (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                   <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464-4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12 8.486a1 1 0 00-1.414 0l-.707.707a1 1 0 101.414 1.414l.707-.707a1 1 0 000-1.414zM10 14a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05a14.05a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zm2.12-8.485A1 1 0 015.05 7.05l-.707-.707a1 1 0 011.414-1.414l.707.707z" clipRule="evenodd"/>
                 </svg>
                 <span className="text-[10px] font-serif font-bold tracking-wider hidden md:inline">Cosy</span>
               </>
             ) : theme === 'dark' ? (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                   <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/>
                 </svg>
                 <span className="text-[10px] font-serif font-bold tracking-wider hidden md:inline">Dim</span>
               </>
             ) : (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-700/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                 </svg>
                 <span className="text-[10px] font-serif font-bold tracking-wider hidden md:inline">OLED</span>
               </>
             )}
           </button>

            {/* Custom Styled Language Dropdown Selector */}
            <div className="relative">
              <button 
                onClick={() => setLangOpen(!langOpen)}
                className="pl-3 pr-8 py-2 text-xs font-serif font-bold bg-amber-50 dark:bg-[#342319] border border-amber-900/20 dark:border-white/5 rounded-xl text-amber-950 dark:text-amber-400 focus:outline-none flex items-center shadow-sm hover:bg-amber-100 dark:hover:bg-[#2b1e17] transition-all"
              >
                <span>{LANGUAGE_NAMES[language]}</span>
                <div className="absolute inset-y-0 right-0 flex items-center px-2.5 text-amber-900/50 dark:text-amber-500/50">
                  <svg className={`fill-current h-3 w-3 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                  </svg>
                </div>
              </button>
              
              {langOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-40 bg-[#fffcf5] dark:bg-[#2c1d15] border-2 border-amber-800/40 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    {languages.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => {
                          setLanguage(lang);
                          setLangOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-xs font-serif transition-colors ${
                          language === lang 
                            ? 'bg-amber-100/70 dark:bg-[#3d291e] text-amber-950 dark:text-amber-300 font-bold border-l-4 border-amber-800' 
                            : 'text-amber-900/80 dark:text-amber-400/80 hover:bg-amber-100/30 dark:hover:bg-[#3d291e]/30'
                        }`}
                      >
                        {LANGUAGE_NAMES[lang]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
        </div>
      </div>
      )}

      {view === 'home' && (
        <div className="flex-grow flex flex-col items-center justify-center w-full max-w-4xl mx-auto py-10 px-4 relative z-10 animate-in fade-in duration-500">
          
          {/* Main Sanctuary Wooden Bookcase */}
          <div className="w-full bg-[#fdf5e2]/80 dark:bg-[#1e1611]/80 border-[12px] border-[#5c381f] rounded-3xl shadow-2xl p-6 md:p-10 flex flex-col gap-8 relative overflow-hidden">
            {/* Wooden back panel shading */}
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(90deg,#5c381f,#5c381f_4px,transparent_4px,transparent_40px)] pointer-events-none"></div>
            
            {/* Top Shelf: The Cozy Portrait Frame & Mascot */}
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 justify-between pb-4">
              <div className="flex-none p-4 bg-amber-100 dark:bg-[#3f2314] rounded-2xl border border-amber-900/20 dark:border-white/5 shadow-md self-center md:self-end">
                <PenkoMascot pose="idle" size={96} themeColor="violet" />
              </div>
              
              {/* Elegant Gold-Trimmed Picture Frame on Shelf */}
              <div className="flex-grow paper-card p-6 rounded-2xl border-4 border-amber-700 shadow-lg relative bg-[#fffdf9] dark:bg-[#2b211a]">
                <div className="absolute inset-1 border border-amber-800/20"></div>
                <span className="text-[10px] font-serif italic text-amber-800 dark:text-amber-500 tracking-wider block mb-1">{t.cozyReadingCorner}</span>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white font-serif leading-tight mb-2">
                  {t.welcomeTitle.includes("Penko's Sanctuary") ? (
                    <>
                      {t.welcomeTitle.split("Penko's Sanctuary")[0]}
                      <span className="text-amber-700 dark:text-amber-500">Penko's Sanctuary</span>
                      {t.welcomeTitle.split("Penko's Sanctuary")[1] || ""}
                    </>
                  ) : t.welcomeTitle.includes("Santuario de Penko") ? (
                    <>
                      {t.welcomeTitle.split("Santuario de Penko")[0]}
                      <span className="text-amber-700 dark:text-amber-500">Santuario de Penko</span>
                      {t.welcomeTitle.split("Santuario de Penko")[1] || ""}
                    </>
                  ) : (
                    t.welcomeTitle
                  )}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed font-serif italic">
                  {t.cozyReadingDesc}
                </p>
              </div>
            </div>
            
            {/* Shelf Plank 1 */}
            <div className="cozy-shelf w-full -mt-4 mb-4"></div>

            {/* Middle Shelf: Core Navigation Items styled as Interactive Book Spines / Elements */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-end min-h-[160px] px-4 md:px-12">
              
              {/* Library Action Book Stack */}
              <div 
                onClick={() => setView('library')}
                className="group cursor-pointer flex flex-row items-end gap-2 justify-center md:justify-start hover:-translate-y-2 transition-transform duration-300"
              >
                {/* 3 standing books that represent the library */}
                <div className="w-10 h-32 bg-amber-800 border-l-4 border-amber-900 rounded shadow-md flex items-center justify-center transition-all group-hover:scale-[1.02]">
                  <span className="font-serif font-bold text-[9px] text-amber-100 uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>L I B R A R Y</span>
                </div>
                <div className="w-12 h-36 bg-emerald-800 border-l-4 border-emerald-900 rounded shadow-md flex items-center justify-center transition-all group-hover:scale-[1.02] -ml-1">
                  <span className="font-serif font-bold text-[9px] text-emerald-100 uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>B O O K S</span>
                </div>
                <div className="w-11 h-28 bg-indigo-900 border-l-4 border-indigo-950 rounded shadow-md flex items-center justify-center transition-all group-hover:scale-[1.02] -ml-1">
                  <span className="font-serif font-bold text-[9px] text-indigo-100 uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>O P E N</span>
                </div>
                
                <div className="flex flex-col ml-3 pb-2 text-left">
                  <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-500 transition-colors">{t.enterLibrary}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.enterLibraryDesc}</p>
                </div>
              </div>

              {/* Training Action Scroll/Ink */}
              <div 
                onClick={() => { setView('reader'); setCurrentBookId(null); }}
                className="group cursor-pointer flex flex-row items-end gap-3 justify-center md:justify-start hover:-translate-y-2 transition-transform duration-300"
              >
                {/* Visual scroll & cup on shelf */}
                <div className="w-14 h-24 bg-[#eae0cd] border-2 border-amber-900/30 rounded-lg shadow-md flex items-center justify-center relative p-1 group-hover:scale-[1.02] transition-all">
                  <div className="absolute top-1 bottom-1 left-1.5 w-[2px] bg-amber-900/10"></div>
                  <div className="absolute top-1 bottom-1 right-1.5 w-[2px] bg-amber-900/10"></div>
                  <span className="font-serif font-bold text-[9px] text-amber-900/70 uppercase tracking-widest" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>T R A I N</span>
                </div>
                
                <div className="flex flex-col pb-2 text-left">
                  <h3 className="text-lg font-serif font-bold text-slate-800 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-500 transition-colors">{t.speedTraining}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.speedTrainingDesc}</p>
                </div>
              </div>

            </div>
            
            {/* Shelf Plank 2 */}
            <div className="cozy-shelf w-full -mt-4"></div>

          </div>
        </div>
      )}

      {view === 'library' && (
        <div className="flex-1 w-full max-w-6xl mx-auto z-10 relative px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <button 
              onClick={() => setView('home')}
              className="self-start md:self-auto flex items-center gap-2 text-amber-900/70 dark:text-amber-500/70 hover:text-amber-950 dark:hover:text-amber-400 transition-colors font-medium font-serif"
            >
              ← {t.back}
            </button>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button
                onClick={() => setIsBackupModalOpen(true)}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-amber-900/70 dark:text-amber-500 border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
                title="Export Library Backup"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </button>
              <div className="relative flex-1 md:w-64">
                <input 
                  type="text" 
                  placeholder={t.search} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-amber-900/20 dark:border-slate-800 rounded-xl focus:outline-none focus:border-amber-700 text-slate-800 dark:text-white text-sm"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'title')}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-amber-900/20 dark:border-slate-800 rounded-xl focus:outline-none focus:border-amber-700 text-slate-800 dark:text-white text-sm"
              >
                <option value="recent">{t.sortRecent}</option>
                <option value="title">{t.sortTitle}</option>
              </select>
            </div>
          </div>

          {/* Categories Tabs */}
          <div className="flex flex-wrap gap-2 mb-6 items-center">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-1.5 rounded-xl text-xs font-serif font-bold transition-all border ${selectedCategory === null ? 'bg-amber-700 border-amber-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-amber-900/10 text-amber-900/80 dark:text-slate-400 hover:bg-slate-50'}`}
            >
              {t.allBooks}
            </button>
            <button
              onClick={() => setSelectedCategory('favorites')}
              className={`px-4 py-1.5 rounded-xl text-xs font-serif font-bold transition-all border ${selectedCategory === 'favorites' ? 'bg-amber-700 border-amber-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-amber-900/10 text-amber-900/80 dark:text-slate-400 hover:bg-slate-50'}`}
            >
              ⭐ {t.favorites || 'Favorites'}
            </button>
            <button
              onClick={() => setSelectedCategory('uncategorized')}
              className={`px-4 py-1.5 rounded-xl text-xs font-serif font-bold transition-all border ${selectedCategory === 'uncategorized' ? 'bg-amber-700 border-amber-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-amber-900/10 text-amber-900/80 dark:text-slate-400 hover:bg-slate-50'}`}
            >
              {t.uncategorized}
            </button>
            {categories.map(cat => (
              <div key={cat} className="relative group">
                <button
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-serif font-bold transition-all pr-8 border ${selectedCategory === cat ? 'bg-amber-700 border-amber-700 text-white shadow-sm' : 'bg-white dark:bg-slate-900 border-amber-900/10 text-amber-900/80 dark:text-slate-400 hover:bg-slate-50'}`}
                >
                  {cat}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full text-amber-900/40 hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title={t.deleteCategory}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={handleAddCategory}
              className="px-4 py-1.5 rounded-xl text-xs font-serif font-bold bg-amber-50 dark:bg-amber-900/10 border border-amber-900/20 text-amber-800 dark:text-amber-400 hover:bg-amber-100 transition-all flex items-center gap-1"
            >
              + {t.addCategory}
            </button>
          </div>

          {/* Drag & Drop Import Area */}
          <label 
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-amber-900/20 rounded-2xl cursor-pointer bg-amber-900/[0.01] hover:bg-amber-900/[0.04] transition-colors mb-8 group"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFiles(Array.from(e.dataTransfer.files));
              }
            }}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-3 text-amber-800/40 group-hover:text-amber-800 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.967 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.967 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"></path></svg>
              <p className="mb-1 text-sm text-slate-600 dark:text-slate-400 font-serif"><span className="font-semibold">{t.uploadPlaceholder}</span></p>
              <p className="text-xs text-slate-500">EPUB, PDF, TXT, MOBI</p>
            </div>
            <input type="file" className="hidden" multiple accept=".pdf,.epub,.txt,.mobi" onChange={handleImportBook} />
          </label>
              {/* The Wooden Bookcase */}
          <div className="w-full bg-[#fdf5e2]/80 dark:bg-[#1e1611]/80 border-[12px] border-[#5c381f] rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-10 relative mb-12">
            {/* Back panel shading for visual wood texture */}
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(90deg,#5c381f,#5c381f_4px,transparent_4px,transparent_40px)] pointer-events-none rounded-2xl"></div>
            
            {(() => {
              // Chunk books into shelves of up to 7 books each
              const shelfCapacity = 7;
              const shelfChunks = [];
              for (let i = 0; i < filteredLibrary.length; i += shelfCapacity) {
                shelfChunks.push(filteredLibrary.slice(i, i + shelfCapacity));
              }
              
              // If no books, render at least one empty shelf
              if (shelfChunks.length === 0) shelfChunks.push([]);
              
              return shelfChunks.map((shelfBooks, idx) => (
                <div key={idx} className="relative z-10 flex flex-col justify-end min-h-[220px]">
                  {/* Standing Books Container */}
                  <div className="flex flex-row items-end gap-3 sm:gap-4 px-4 sm:px-8 justify-center sm:justify-start">
                    {shelfBooks.map((book) => {
                      const spineStyle = getSpineStyle(book.id);
                      return (
                        <div 
                          key={book.id}
                          onClick={() => openBook(book)}
                          className="group relative cursor-pointer transition-all duration-300 hover:-translate-y-8 hover:translate-x-1.5 hover:scale-[1.03] select-none shrink-0"
                          style={{
                            width: '56px',
                            height: '180px',
                            background: spineStyle.bg,
                            borderLeft: `6px solid ${spineStyle.edge}`,
                            borderRight: `2px solid ${spineStyle.edge}`,
                            borderColor: spineStyle.edge,
                            boxShadow: '4px 6px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
                            borderRadius: '4px 2px 2px 4px'
                          }}
                        >
                          {/* Floating Front Cover Preview Popover */}
                          <div className="absolute bottom-[195px] left-1/2 -translate-x-1/2 w-32 bg-[#fffdf9] dark:bg-[#251b14] border-2 border-amber-800/40 rounded-xl p-2 shadow-2xl transition-all duration-300 scale-0 group-hover:scale-100 origin-bottom z-30 pointer-events-none flex flex-col gap-1.5 items-center">
                            {book.coverUrl ? (
                              <img src={book.coverUrl} alt={book.title} className="w-full h-32 object-cover rounded-lg shadow-sm" />
                            ) : (
                              <div className="w-full h-32 rounded-lg flex flex-col justify-between p-2 text-center relative overflow-hidden" style={{ background: spineStyle.bg, border: `1px solid ${spineStyle.edge}` }}>
                                <div className="absolute top-1.5 left-0 right-0 h-0.5 opacity-30" style={{ background: '#ffd700' }}></div>
                                <span className="font-serif font-bold text-[8px] leading-tight line-clamp-4 select-none" style={{ color: spineStyle.text }}>{book.title}</span>
                                <div className="absolute bottom-1.5 left-0 right-0 h-0.5 opacity-30" style={{ background: '#ffd700' }}></div>
                              </div>
                            )}
                            <div className="text-[8px] font-mono font-bold text-amber-900/60 dark:text-amber-500/60 text-center truncate w-full">{book.title}</div>
                          </div>
                          {/* Gold Embossed Lines on Spine (Top and Bottom) */}
                          <div className="absolute top-2 left-0 right-0 h-1 opacity-60" style={{ background: 'linear-gradient(to right, #ffd700, #b8860b)' }}></div>
                          <div className="absolute top-4 left-0 right-0 h-0.5 opacity-60" style={{ background: 'linear-gradient(to right, #ffd700, #b8860b)' }}></div>
                          <div className="absolute bottom-4 left-0 right-0 h-1 opacity-60" style={{ background: 'linear-gradient(to right, #ffd700, #b8860b)' }}></div>
                          
                          {/* Bookmark Ribbon hanging from bottom */}
                          {book.totalTokens > 0 && (
                            <div 
                              className="absolute bottom-[-16px] left-[40%] w-[6px] shadow-sm transition-all duration-300 rounded-b"
                              style={{ 
                                height: '24px', 
                                opacity: (book.progress / book.totalTokens) > 0.05 ? 0.9 : 0.2,
                                background: book.progress === book.totalTokens ? '#10b981' : '#ef4444'
                              }}
                              title={`Progress: ${Math.round((book.progress / book.totalTokens) * 100)}%`}
                            ></div>
                          )}

                          {/* Spine Title (Vertical Text) */}
                          <div className="absolute inset-0 pt-6 pb-6 px-1 flex items-center justify-center">
                            <span 
                              className="font-serif font-bold text-[10px] tracking-wide text-center uppercase break-all truncate leading-none overflow-hidden max-h-[120px]"
                              style={{ 
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg)',
                                color: spineStyle.text,
                                textShadow: '1px 1px 1px rgba(0,0,0,0.5)'
                              }}
                            >
                              {book.title}
                            </span>
                          </div>

                          {/* Format Badge */}
                          <div className="absolute top-6 left-1 text-[8px] font-mono px-1 rounded opacity-50 bg-black/30 text-white select-none">
                            {book.title.toLowerCase().endsWith('.pdf') ? 'PDF' : book.title.toLowerCase().endsWith('.epub') ? 'EPUB' : book.title.toLowerCase().endsWith('.mobi') ? 'MOBI' : 'TXT'}
                          </div>

                          {/* Action Overlay popover on Hover */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform duration-200 bg-slate-900/95 text-white rounded-lg p-1 flex gap-1 z-20 shadow-md">
                            <button 
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(e, book); }}
                              className={`p-1 rounded hover:bg-white/10 ${book.isFavorite ? 'text-yellow-400' : 'text-slate-400'}`}
                              title="Favorite"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setBookToCategorize(book.id); }}
                              className="p-1 rounded hover:bg-white/10 text-slate-300 hover:text-amber-300"
                              title="Category"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteBook(e, book.id); }}
                              className="p-1 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-500"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Actual Wooden Shelf Plank */}
                  <div className="cozy-shelf w-full mt-1"></div>
                </div>
              ));
            })()}
            
            {filteredLibrary.length === 0 && (
              <div className="text-center py-16 text-amber-900/60 dark:text-amber-500/60 font-serif italic z-20 relative">
                <p>{t.emptyState}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {view === 'reader' && (
        status === ReaderStatus.IDLE ? (
          // SETUP VIEW (Centered)
          <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col gap-6 justify-center animate-in fade-in duration-500">
             <div className="flex justify-start">
                <button 
                  onClick={handleBack}
                  className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium"
                >
                  ← {t.back}
                </button>
             </div>

             <div className="flex flex-col md:flex-row gap-6 items-stretch">
                 {/* Box 1: Input */}
                 <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-900 dark:border-slate-400 p-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] flex flex-col">
                    <ReaderInput currentLang={contentLanguage} availableLanguages={languages} t={t} onContentReady={handleContentReady} onLanguageChange={setContentLanguage} />
                 </div>

                 {/* Box 2: Settings (Using Controls component for consistent styling) */}
                 <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-900 dark:border-slate-400 p-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] flex flex-col gap-6">
                    
                    {/* Demo Preview Area */}
                    <div className="h-32 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center relative overflow-hidden border border-slate-200 dark:border-slate-600">
                        <OrpDisplay 
                          word={demoTokens[demoIndex]?.word || ''} 
                          fontSize={fontSize} 
                          t={t} 
                          verticalMode={verticalMode}
                          contentLanguage={contentLanguage}
                        />
                    </div>

                    <Controls 
                      status={demoStatus}
                      wpm={wpm}
                      fontSize={fontSize}
                      progress={(demoIndex / demoTokens.length) * 100}
                      t={t}
                      onTogglePlay={handleToggleDemo}
                      onRestart={handleRestartDemo}
                      onWpmChange={setWpm}
                      onFontSizeChange={setFontSize}
                      onSeek={() => {}} // Disable seeking in demo
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
             </div>

             {/* Start Button */}
             {tokens.length > 0 && (
               <div className="flex justify-center mt-2">
                  <button 
                    onClick={handleTogglePlay}
                    className="px-12 py-4 bg-yellow-400 text-slate-900 border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-xl font-bold uppercase tracking-wide rounded-none transition-all"
                  >
                    {t.start}
                  </button>
               </div>
             )}
          </div>
        ) : (
          // READING VIEW (Distraction Free)
          <div className="w-full flex flex-col items-center justify-center flex-1 relative animate-in fade-in duration-500">
            
            {/* Main Content */}
            <main className={`w-full flex gap-6 min-w-0 transition-all duration-500 ${verticalMode ? 'flex-row-reverse h-[calc(100vh-8rem)]' : 'flex-col'}`}>
               
               {/* Reader Display */}
              <div className={`flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative p-8 transition-all duration-500 ${verticalMode ? 'w-1/3 h-full' : 'w-full min-h-[300px]'}`}>
                 
                 {/* Controls: Back, Play/Pause, Restart */}
                 <div className="absolute top-4 left-4 flex gap-2 z-10">
                    <button 
                      onClick={() => setStatus(ReaderStatus.IDLE)}
                      className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      title={t.back}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                      </svg>
                    </button>
                    <button 
                      onClick={handleTogglePlay}
                      className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      title={status === ReaderStatus.PLAYING ? "Pause" : "Play"}
                    >
                      {status === ReaderStatus.PLAYING ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 pl-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                        </svg>
                      )}
                    </button>
                    <button 
                      onClick={handleRestart}
                      className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      title="Restart"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </button>
                 </div>

                 <div className={`absolute bg-red-500/20 pointer-events-none ${verticalMode ? 'h-full w-[2px] left-1/2 -ml-[1px]' : 'w-full h-[2px] top-1/2 -mt-[1px]'}`}></div>
                 <OrpDisplay 
                   word={currentWord} 
                   fontSize={fontSize} 
                   t={t} 
                   verticalMode={verticalMode}
                   contentLanguage={contentLanguage}
                 />
              </div>

              {/* Full Text Toggle */}
              <div className={`flex justify-center ${verticalMode ? 'flex-col h-full' : 'w-full'}`}>
                <button 
                  onClick={() => setShowFullText(!showFullText)}
                  className={`text-sm font-medium text-primary dark:text-blue-400 hover:underline flex items-center gap-2 ${verticalMode ? 'writing-vertical-rl' : ''}`}
                >
                  {showFullText ? t.hideFullText : t.fullText}
                </button>
              </div>

              {/* Full Text Display */}
              {showFullText && (
                 <div className={`animate-in fade-in duration-500 ${verticalMode ? 'w-2/3 h-full' : 'w-full'}`}>
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
          </div>
        )
      )}
      
      {view === 'book-reader' && currentBookId && (
        (() => {
          const book = library.find(b => b.id === currentBookId);
          if (!book) {
            setView('library');
            return null;
          }
          return (
            <BookReader 
              book={book} 
              onBack={() => setView('library')} 
              onUpdateBook={(updatedBook) => {
                 setLibrary(prev => prev.map(b => b.id === book.id ? updatedBook : b));
                 saveBook(updatedBook).catch(console.error);
              }}
              t={t} 
            />
          );
        })()
      )}

        <Modal 
          isOpen={modal.isOpen} 
          title={modal.title} 
          message={modal.message} 
          onClose={() => setModal({ ...modal, isOpen: false })} 
        />

        <InstallModal 
          isOpen={isInstallModalOpen} 
          onClose={() => setInstallModalOpen(false)} 
          t={t} 
        />

        {/* Delete Confirmation Modal */}
        {bookToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1e1611]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#fffdf9] dark:bg-[#251b14] border-2 border-amber-800/40 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative p-3 bg-amber-100 dark:bg-[#3f2314] rounded-2xl border border-amber-900/20 shadow-sm">
                   <PenkoMascot size={80} pose="idle" themeColor="violet" showBook={true} className="mx-auto" />
                </div>
                
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-400 font-serif">
                  {t.deleteConfirmTitle}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm font-serif italic">
                  {t.deleteConfirmMessage}
                </p>

                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setBookToDelete(null)}
                    className="flex-1 px-4 py-2 bg-amber-50 dark:bg-[#342319] hover:bg-amber-100/50 dark:hover:bg-[#3d291e]/50 text-amber-950 dark:text-amber-400 border border-amber-800/20 rounded-xl text-sm font-bold uppercase transition-all shadow-sm active:scale-95"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold uppercase transition-all shadow-sm border border-red-700 active:scale-95"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Category Confirmation Modal */}
        {categoryToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1e1611]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#fffdf9] dark:bg-[#251b14] border-2 border-amber-800/40 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative p-3 bg-amber-100 dark:bg-[#3f2314] rounded-2xl border border-amber-900/20 shadow-sm">
                   <PenkoMascot size={80} pose="idle" themeColor="violet" showBook={true} className="mx-auto" />
                </div>
                
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-400 font-serif">
                  {t.deleteCategory}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm font-serif italic">
                  {t.deleteCategoryConfirm}
                </p>

                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setCategoryToDelete(null)}
                    className="flex-1 px-4 py-2 bg-amber-50 dark:bg-[#342319] hover:bg-amber-100/50 dark:hover:bg-[#3d291e]/50 text-amber-950 dark:text-amber-400 border border-amber-800/20 rounded-xl text-sm font-bold uppercase transition-all shadow-sm active:scale-95"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold uppercase transition-all shadow-sm border border-red-700 active:scale-95"
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category Assignment Modal */}
        {bookToCategorize && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1e1611]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setBookToCategorize(null)}>
            <div className="w-full max-w-sm bg-[#fffdf9] dark:bg-[#251b14] border-2 border-amber-800/40 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              
              <div className="p-6 pb-4 flex flex-col items-center text-center gap-4 shrink-0">
                <div className="relative p-3 bg-amber-100 dark:bg-[#3f2314] rounded-2xl border border-amber-900/20 shadow-sm">
                   <PenkoMascot size={80} pose="idle" themeColor="violet" showBook={true} className="mx-auto" />
                </div>
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-400 font-serif">
                  {t.category}
                </h3>
              </div>

              <div className="p-6 pt-0 overflow-y-auto flex flex-col gap-3">
                {(() => {
                  const currentCategory = library.find(b => b.id === bookToCategorize)?.category;
                  return (
                    <>
                      <button
                        onClick={() => handleAssignCategory(bookToCategorize, undefined)}
                        className={`w-full text-left px-4 py-3 bg-amber-50 dark:bg-[#342319] text-amber-950 dark:text-amber-300 font-serif rounded-xl border-2 ${!currentCategory ? 'border-amber-800' : 'border-amber-800/20'} hover:bg-amber-100 transition-all flex items-center gap-3`}
                      >
                        <div className={`w-3 h-3 rounded-full ${!currentCategory ? 'bg-amber-800' : 'bg-slate-400'} border border-amber-800/20`}></div>
                        {t.uncategorized}
                      </button>
                      
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => handleAssignCategory(bookToCategorize, cat)}
                          className={`w-full text-left px-4 py-3 bg-amber-50 dark:bg-[#342319] text-amber-950 dark:text-amber-300 font-serif rounded-xl border-2 ${currentCategory === cat ? 'border-amber-800' : 'border-amber-800/20'} hover:bg-amber-100 transition-all flex items-center gap-3`}
                        >
                          <div className={`w-3 h-3 rounded-full ${currentCategory === cat ? 'bg-amber-800' : 'bg-slate-205 dark:bg-slate-600'} border border-amber-800/20`}></div>
                          {cat}
                        </button>
                      ))}
                    </>
                  );
                })()}
                
                {categories.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-amber-800/20 rounded-xl animate-in fade-in">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 font-serif">No categories created yet.</p>
                    <button 
                        onClick={() => { setBookToCategorize(null); handleAddCategory(); }}
                        className="px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white font-serif rounded-xl border border-amber-800 transition-all active:scale-95 shadow-sm"
                    >
                        + {t.addCategory}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-amber-800/10 bg-amber-50/50 dark:bg-[#1e1611]/30 shrink-0">
                <button
                    onClick={() => setBookToCategorize(null)}
                    className="w-full px-4 py-2 bg-amber-50 dark:bg-[#342319] hover:bg-amber-100/50 dark:hover:bg-[#3d291e]/50 text-amber-950 dark:text-amber-400 border border-amber-800/20 rounded-xl text-sm font-bold uppercase transition-all shadow-sm active:scale-95"
                  >
                    {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Category Modal */}
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1e1611]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-[#fffdf9] dark:bg-[#251b14] border-2 border-amber-800/40 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative p-3 bg-amber-100 dark:bg-[#3f2314] rounded-2xl border border-amber-900/20 shadow-sm">
                   <PenkoMascot size={80} pose="idle" themeColor="violet" showBook={true} className="mx-auto" />
                </div>
                
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-400 font-serif">
                  {t.addCategory}
                </h3>
                
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t.newCategoryPlaceholder}
                  className="w-full px-4 py-2 bg-[#fffdf9] dark:bg-[#1e1611] border-2 border-amber-800/20 rounded-xl focus:outline-none focus:border-amber-800 text-slate-900 dark:text-white font-serif text-center"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmAddCategory()}
                />

                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setIsAddCategoryModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-amber-50 dark:bg-[#342319] hover:bg-amber-100/50 dark:hover:bg-[#3d291e]/50 text-amber-950 dark:text-amber-400 border border-amber-800/20 rounded-xl text-sm font-bold uppercase transition-all shadow-sm active:scale-95"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={confirmAddCategory}
                    className="flex-1 px-4 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-sm font-bold uppercase transition-all shadow-sm border border-amber-800 active:scale-95"
                  >
                    {t.addCategory}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backup & Restore Modal */}
        {isBackupModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1e1611]/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsBackupModalOpen(false)}>
            <div className="w-full max-w-sm bg-[#fffdf9] dark:bg-[#251b14] border-2 border-amber-800/40 rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative p-3 bg-amber-100 dark:bg-[#3f2314] rounded-2xl border border-amber-900/20 shadow-sm">
                   <PenkoMascot size={80} pose="idle" themeColor="violet" showBook={true} className="mx-auto" />
                </div>
                
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-400 font-serif">
                  {t.backupModalTitle}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-serif italic">
                  {t.backupModalDesc}
                </p>

                <div className="w-full flex flex-col gap-3 mt-2">
                  <button
                    onClick={performExport}
                    className="w-full px-4 py-3 bg-amber-700 hover:bg-amber-600 text-white font-serif rounded-xl border border-amber-800 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    {t.backupExportBtn}
                  </button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-amber-850/10"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#fffdf9] dark:bg-[#251b14] px-2 text-slate-500 font-serif">OR</span></div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-serif">{t.backupRestoreHelper}</div>
                  
                  <label className="w-full px-4 py-3 bg-amber-50 dark:bg-[#342319] hover:bg-amber-100/50 dark:hover:bg-[#3d291e]/50 text-amber-950 dark:text-amber-400 border border-amber-800/20 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" transform="rotate(180 12 12)" /></svg>
                    {t.backupRestoreBtn}
                    <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
                  </label>
                </div>

                <button onClick={() => setIsBackupModalOpen(false)} className="mt-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-serif">
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default App;
