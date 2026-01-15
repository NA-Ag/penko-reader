import React, { useState, useRef, useEffect } from 'react';
import { LanguageCode, Translation, LibraryBook, Chapter } from '../types';
import { LIBRARY } from '../utils/library';
import { readFileContent } from '../utils/fileProcessor';
import { readEpubFile } from '../utils/epubProcessor';

interface ReaderInputProps {
  currentLang: LanguageCode;
  availableLanguages: LanguageCode[];
  t: Translation;
  onContentReady: (text: string, lang?: LanguageCode) => void;
}

enum InputTab {
  PASTE = 'PASTE',
  LIBRARY = 'LIBRARY',
  UPLOAD = 'UPLOAD'
}

interface SavedFile {
  id: string;
  title: string;
  text: string;
  date: number;
}

const ReaderInput: React.FC<ReaderInputProps> = ({ currentLang, availableLanguages, t, onContentReady }) => {
  const [activeTab, setActiveTab] = useState<InputTab>(InputTab.PASTE);
  const [inputText, setInputText] = useState('');
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [libraryLang, setLibraryLang] = useState<LanguageCode>(currentLang);
  const [showSavedFiles, setShowSavedFiles] = useState(false);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved files on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('penko_saved_files');
      if (saved) {
        setSavedFiles(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load saved files", e);
    }
  }, []);

  useEffect(() => {
    setLibraryLang(currentLang);
  }, [currentLang]);

  const handleStartReading = (text: string) => {
    if (text.trim()) {
      onContentReady(text, libraryLang);
    }
  };

  const saveFileLocally = (title: string, text: string) => {
    const newFile: SavedFile = {
      id: Date.now().toString(),
      title: title || `Upload ${new Date().toLocaleDateString()}`,
      text,
      date: Date.now()
    };
    const updated = [newFile, ...savedFiles];
    setSavedFiles(updated);
    localStorage.setItem('penko_saved_files', JSON.stringify(updated));
  };

  const deleteSavedFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedFiles.filter(f => f.id !== id);
    setSavedFiles(updated);
    localStorage.setItem('penko_saved_files', JSON.stringify(updated));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.epub')) {
        text = await readEpubFile(file);
      } else {
        text = await readFileContent(file);
      }

      if (text.trim().length === 0) {
        setErrorMsg("File appears to be empty or contains no readable text.");
      } else {
        saveFileLocally(file.name, text);
        handleStartReading(text);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(t.fileError);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const books = LIBRARY[libraryLang];

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-none border-2 border-slate-900 dark:border-slate-400 shadow-[8px_8px_0px_0px_rgba(15,23,42,0.2)] overflow-hidden transition-colors duration-300">
      
      {/* Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-700">
        <button
          onClick={() => setActiveTab(InputTab.PASTE)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === InputTab.PASTE 
            ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600' 
            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {t.paste}
        </button>
        <button
          onClick={() => setActiveTab(InputTab.UPLOAD)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === InputTab.UPLOAD 
            ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600' 
            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {t.upload}
        </button>
        <button
          onClick={() => setActiveTab(InputTab.LIBRARY)}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === InputTab.LIBRARY 
            ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 border-b-2 border-cyan-600' 
            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {t.library}
        </button>
      </div>

      <div className="p-6">
        {activeTab === InputTab.PASTE && (
          <div className="relative group animate-in fade-in duration-300">
            <textarea
              className="w-full h-64 p-4 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 placeholder-slate-400 dark:placeholder-slate-600 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-600 focus:border-transparent outline-none resize-none font-mono text-sm leading-relaxed transition-all"
              placeholder={t.pastePlaceholder}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              spellCheck={false}
            />
            
            {inputText.trim() && (
              <div className="absolute bottom-6 right-6">
                <button
                  onClick={() => handleStartReading(inputText)}
                  className="px-6 py-2 bg-cyan-600 text-white border-2 border-slate-900 dark:border-white shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] active:translate-y-[4px] active:shadow-none text-sm font-bold uppercase tracking-wide rounded-none transition-all"
                >
                  {t.start}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === InputTab.UPLOAD && (
           <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800/50 animate-in fade-in duration-300 relative">
             <input 
                type="file" 
                ref={fileInputRef}
                accept=".txt,.pdf,.epub"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
             />
             
             {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-cyan-600/30 border-t-cyan-600 rounded-full animate-spin"></div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{t.processing}</p>
                </div>
             ) : (
                <div className="text-center p-6 space-y-3 pointer-events-none">
                  <div className="mx-auto w-12 h-12 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{t.uploadPlaceholder}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Supported: .txt, .pdf, .epub</p>
                  </div>
                  {errorMsg && (
                    <p className="text-red-500 text-sm mt-2">{errorMsg}</p>
                  )}
                </div>
             )}
           </div>
        )}

        {activeTab === InputTab.LIBRARY && (
          <div className="min-h-[256px]">
            {selectedBook ? (
              // Chapters View
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <button 
                    onClick={() => setSelectedBook(null)}
                    className="text-sm text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 flex items-center gap-1 font-medium"
                  >
                    ← {t.back}
                  </button>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200">{selectedBook.title}</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {selectedBook.chapters.map((chapter, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStartReading(chapter.text)}
                      className="text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-cyan-600 dark:hover:border-cyan-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all group"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">{chapter.title}</span>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{chapter.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Books View
              <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                {/* Library Controls */}
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setShowSavedFiles(!showSavedFiles)}
                    className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border transition-colors ${
                      showSavedFiles 
                        ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {showSavedFiles ? t.library : t.localFiles}
                  </button>

                  {!showSavedFiles && (
                    <select 
                      value={libraryLang}
                      onChange={(e) => setLibraryLang(e.target.value as LanguageCode)}
                      className="text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-cyan-600 outline-none"
                    >
                      {availableLanguages.map(lang => (
                        <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                      ))}
                    </select>
                  )}
                </div>

                {showSavedFiles ? (
                  // Saved Files List
                  savedFiles.length > 0 ? (
                    savedFiles.map((file) => (
                      <div 
                        key={file.id} 
                        onClick={() => handleStartReading(file.text)}
                        className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-600 dark:hover:border-cyan-500 hover:shadow-md rounded-lg cursor-pointer transition-all group flex justify-between items-center"
                      >
                        <div>
                          <h3 className="text-slate-900 dark:text-slate-100 font-semibold group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{file.title}</h3>
                          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{new Date(file.date).toLocaleDateString()}</p>
                        </div>
                        <button 
                          onClick={(e) => deleteSavedFile(file.id, e)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          title={t.delete}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-12 text-center text-slate-400 italic">
                      No saved files yet. Upload a file to save it here.
                    </div>
                  )
                ) : (
                  // Standard Library List
                  books && books.length > 0 ? (
                  books.map((book, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedBook(book)}
                      className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-cyan-600 dark:hover:border-cyan-500 hover:shadow-md rounded-lg cursor-pointer transition-all group"
                    >
                      <h3 className="text-slate-900 dark:text-slate-100 font-semibold group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{book.title}</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{book.author}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                         <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                           {book.chapters.length} {t.chapters}
                         </span>
                      </div>
                    </div>
                  ))
                ) : (
                   <div className="col-span-full py-12 text-center text-slate-400 italic">
                     No books available for this language yet.
                   </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          {t.tip}
        </div>
      </div>
    </div>
  );
};

export default ReaderInput;