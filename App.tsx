import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WordToken, ReaderStatus, LanguageCode, Theme, AppView, StoredBook } from './types';
import { TRANSLATIONS } from './utils/translations';
import Controls from './components/Controls';
import OrpDisplay from './components/OrpDisplay';
import ReaderInput from './components/ReaderInput';
import FullTextDisplay from './components/FullTextDisplay';
import Modal from './components/Modal';
import { InstallModal } from './components/InstallModal';
import logo from './penguin-reader-logo.svg';
import BookReader from './components/BookReader';
import { saveBook, loadBooks, deleteBook } from './utils/persistence';
import { readFileContent } from './utils/fileProcessor';
import { readEpubFile } from './utils/epubProcessor';

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

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('home');
  const [library, setLibrary] = useState<StoredBook[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<WordToken[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<ReaderStatus>(ReaderStatus.IDLE);
  const [wpm, setWpm] = useState(300);
  const [fontSize, setFontSize] = useState(64);
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
      let fileType: 'pdf' | 'epub' | null = null;

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
          : book.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return b.lastRead - a.lastRead;
      return a.title.localeCompare(b.title);
    });

  return (
    <div className={`min-h-screen flex flex-col p-6 transition-colors duration-300 ${theme === 'oled' ? 'bg-black' : 'bg-slate-50 dark:bg-slate-900'} ${dyslexicMode ? 'font-dyslexic' : ''}`}>
      
      {/* Navbar / Header - Hide when reading */}
      {(view !== 'reader' || status === ReaderStatus.IDLE) && (
      <div className={`w-full flex flex-col md:flex-row items-center justify-between mb-8 gap-4 transition-all duration-500`}>
        <div className="flex items-center gap-2">
          <img src={logo} alt="Penko" className="w-20 h-20" />
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Penko Reader</h1>
        </div>

        <div className="flex items-center gap-4">
           {/* PWA Install Button (Mobile/Web) - Hidden if already installed */}
           {!isStandalone && (installPrompt || /iPad|iPhone|iPod|Android/.test(navigator.userAgent)) && (
             <button
               onClick={handleInstall}
               className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
             >
               {t.installPwa}
             </button>
           )}

           {/* Electron Download Button (Desktop) - Hidden if already installed */}
           {!isStandalone && (
             <button
               onClick={handleDownload}
               className="hidden md:flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
             >
               {t.download}
             </button>
           )}

           {/* Theme Toggle */}
           <button 
             onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'oled' : 'light')}
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
      )}

      {view === 'home' && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <button 
              onClick={() => setView('library')}
              className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:border-cyan-500 dark:hover:border-cyan-500 transition-all group"
            >
              <div className="w-20 h-20 mb-6 text-slate-400 group-hover:text-cyan-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.967 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t.library}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center">{t.libraryDesc}</p>
            </button>

            <button 
              onClick={() => { setView('reader'); setCurrentBookId(null); }}
              className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:border-cyan-500 dark:hover:border-cyan-500 transition-all group"
            >
              <div className="w-20 h-20 mb-6 text-slate-400 group-hover:text-cyan-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">{t.training}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-center">{t.trainingDesc}</p>
            </button>
          </div>
        </div>
      )}

      {view === 'library' ? (
        <div className="flex-1 w-full max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
            <button 
              onClick={() => setView('home')}
              className="self-start md:self-auto flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors font-medium"
            >
              ← {t.back}
            </button>
            
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button
                onClick={() => setIsBackupModalOpen(true)}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                title="Export Library Backup"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </button>
              <div className="relative flex-1 md:w-64">
                <input 
                  type="text" 
                  placeholder={t.search} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 dark:text-white"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'title')}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-800 dark:text-white"
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
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${selectedCategory === null ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {t.allBooks}
            </button>
            <button
              onClick={() => setSelectedCategory('uncategorized')}
              className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all ${selectedCategory === 'uncategorized' ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {t.uncategorized}
            </button>
            {categories.map(cat => (
              <div key={cat} className="relative group">
                <button
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all pr-8 ${selectedCategory === cat ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {cat}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
              className="px-3 py-1.5 rounded-full text-sm font-bold bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-all flex items-center gap-1"
            >
              + {t.addCategory}
            </button>
          </div>

          {/* Drag & Drop Import Area */}
          <label 
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors mb-8 group"
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
              <svg className="w-8 h-8 mb-3 text-slate-400 group-hover:text-cyan-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">{t.uploadPlaceholder}</span></p>
              <p className="text-xs text-slate-500 dark:text-slate-500">EPUB, PDF</p>
            </div>
            <input type="file" className="hidden" multiple accept=".pdf,.epub" onChange={handleImportBook} />
          </label>

          {/* Book Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredLibrary.map((book) => (
              <div 
                key={book.id}
                onClick={() => openBook(book)}
                className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-cyan-500 dark:hover:border-cyan-500 transition-all cursor-pointer flex flex-col gap-2 overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-16 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${book.coverUrl ? 'bg-slate-100 dark:bg-slate-700' : getBookColorClass(book.id)}`}>
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold opacity-50 uppercase">{book.title.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={(e) => toggleFavorite(e, book)}
                      className={`p-1.5 rounded-lg transition-colors ${book.isFavorite ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' : 'text-slate-300 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'}`}
                      title="Toggle Favorite"
                    >
                      <svg className="w-5 h-5" fill={book.isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setBookToCategorize(book.id); }}
                      className="p-1.5 text-slate-300 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-lg transition-colors"
                      title={t.category}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
                    </button>
                    <button 
                      onClick={(e) => handleDeleteBook(e, book.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white truncate" title={book.title}>{book.title}</h3>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(book.lastRead).toLocaleDateString()}
                    </p>
                    {book.totalTokens > 0 && (
                      <span className="text-xs font-mono text-slate-400">
                        {Math.round((book.progress / book.totalTokens) * 100)}%
                      </span>
                    )}
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${book.totalTokens > 0 ? (book.progress / book.totalTokens) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {library.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                <p>{t.emptyState}</p>
              </div>
            )}
          </div>
        </div>
      ) : view === 'reader' ? (

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
      ) : view === 'book-reader' && currentBookId ? (
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
      ) : null }

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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-400 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] rounded-xl overflow-hidden">
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative">
                   <img src={logo} alt="Penko" className="w-24 h-24 animate-bounce" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  {t.deleteConfirmTitle}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {t.deleteConfirmMessage}
                </p>

                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setBookToDelete(null)}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-500 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-400 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] rounded-xl overflow-hidden">
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative">
                   <img src={logo} alt="Penko" className="w-24 h-24 animate-bounce" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  {t.deleteCategory}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {t.deleteCategoryConfirm}
                </p>

                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setCategoryToDelete(null)}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    className="flex-1 px-4 py-2 bg-red-500 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setBookToCategorize(null)}>
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-400 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] rounded-xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
              
              <div className="p-6 pb-4 flex flex-col items-center text-center gap-4 shrink-0">
                <div className="relative">
                   <img src={logo} alt="Penko" className="w-24 h-24 animate-bounce" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
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
                        className={`w-full text-left px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-bold border-2 ${!currentCategory ? 'border-cyan-500 dark:border-cyan-400' : 'border-slate-900 dark:border-white'} shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none rounded-lg transition-all flex items-center gap-3`}
                      >
                        <div className={`w-3 h-3 rounded-full ${!currentCategory ? 'bg-cyan-500' : 'bg-slate-400'} border border-slate-900 dark:border-white`}></div>
                        {t.uncategorized}
                      </button>
                      
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => handleAssignCategory(bookToCategorize, cat)}
                          className={`w-full text-left px-4 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold border-2 ${currentCategory === cat ? 'border-cyan-500 dark:border-cyan-400' : 'border-slate-900 dark:border-white'} shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none rounded-lg transition-all flex items-center gap-3`}
                        >
                          <div className={`w-3 h-3 rounded-full ${currentCategory === cat ? 'bg-cyan-500' : 'bg-slate-200 dark:bg-slate-600'} border border-slate-900 dark:border-white`}></div>
                          {cat}
                        </button>
                      ))}
                    </>
                  );
                })()}
                
                {categories.length === 0 && (
                  <div className="text-center py-6 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 font-medium">No categories created yet.</p>
                    <button 
                        onClick={() => { setBookToCategorize(null); handleAddCategory(); }}
                        className="px-4 py-2 bg-cyan-500 text-white font-bold border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none rounded-lg transition-all"
                    >
                        + {t.addCategory}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 shrink-0">
                <button
                    onClick={() => setBookToCategorize(null)}
                    className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-lg transition-all"
                  >
                    {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Category Modal */}
        {isAddCategoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-400 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] rounded-xl overflow-hidden">
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative">
                   <img src={logo} alt="Penko" className="w-24 h-24 animate-bounce" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  {t.addCategory}
                </h3>
                
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={t.newCategoryPlaceholder}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 text-slate-900 dark:text-white font-bold text-center"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && confirmAddCategory()}
                />

                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => setIsAddCategoryModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-lg transition-all"
                  >
                    {t.cancel}
                  </button>
                  <button
                    onClick={confirmAddCategory}
                    className="flex-1 px-4 py-2 bg-cyan-600 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-lg transition-all"
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setIsBackupModalOpen(false)}>
            <div className="w-full max-w-sm bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-400 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="relative">
                   <img src={logo} alt="Penko" className="w-20 h-20 animate-bounce" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                  {t.backupModalTitle}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t.backupModalDesc}
                </p>

                <div className="w-full flex flex-col gap-3 mt-2">
                  <button
                    onClick={performExport}
                    className="w-full px-4 py-3 bg-cyan-500 text-white font-bold border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                    {t.backupExportBtn}
                  </button>

                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-300 dark:border-slate-600"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-800 px-2 text-slate-500">OR</span></div>
                  </div>

                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.backupRestoreHelper}</div>
                  
                  <label className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-bold border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" transform="rotate(180 12 12)" /></svg>
                    {t.backupRestoreBtn}
                    <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
                  </label>
                </div>

                <button onClick={() => setIsBackupModalOpen(false)} className="mt-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline">
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
