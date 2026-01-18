import React, { useState, useEffect } from 'react';
import { LanguageCode, Translation } from '../types';
import { LIBRARY } from '../utils/library';
import { readFileContent } from '../utils/fileProcessor';
import { readEpubFile } from '../utils/epubProcessor';

interface ReaderInputProps {
  currentLang: LanguageCode;
  availableLanguages: LanguageCode[];
  t: Translation;
  onContentReady: (text: string, lang: LanguageCode) => void;
  onLanguageChange: (lang: LanguageCode) => void;
}

const ReaderInput: React.FC<ReaderInputProps> = ({ currentLang, availableLanguages, t, onContentReady, onLanguageChange }) => {
  const [mode, setMode] = useState<'library' | 'paste' | 'upload'>('library');
  const [text, setText] = useState('');
  const [selectedBookIndex, setSelectedBookIndex] = useState<number | null>(null);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Reset selection when language changes
  useEffect(() => {
    setSelectedBookIndex(null);
    setSelectedChapterIndex(null);
    setUploadedFileName(null);
  }, [currentLang]);

  const handleChapterClick = (bookIndex: number, chapterIndex: number, chapterText: string) => {
    setSelectedBookIndex(bookIndex);
    setSelectedChapterIndex(chapterIndex);
    onContentReady(chapterText, currentLang);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (e.target.value.trim()) {
      onContentReady(e.target.value, currentLang);
      setSelectedBookIndex(null);
      setSelectedChapterIndex(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessing(true);
      setUploadedFileName(null);
      const file = e.target.files[0];

      // Yield to main thread to ensure spinner renders
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        let content = '';
        if (file.name.toLowerCase().endsWith('.epub')) {
          const result = await readEpubFile(file);
          content = result.text;
        } else {
          content = await readFileContent(file);
        }
        setUploadedFileName(file.name);
        onContentReady(content, currentLang);
        setSelectedBookIndex(null);
        setSelectedChapterIndex(null);
      } catch (error) {
        console.error("File upload failed", error);
        alert(t.fileError || "Error reading file");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const books = LIBRARY[currentLang] || [];

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header with Language Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">{t.library}</h2>
        <select
          value={currentLang}
          onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {availableLanguages.map(lang => (
            <option key={lang} value={lang}>{lang.toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-xl">
        <button
          onClick={() => setMode('library')}
          className={`flex-1 py-2 text-sm font-bold uppercase tracking-wide rounded-lg transition-all ${
            mode === 'library' 
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t.library}
        </button>
        <button
          onClick={() => setMode('paste')}
          className={`flex-1 py-2 text-sm font-bold uppercase tracking-wide rounded-lg transition-all ${
            mode === 'paste' 
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t.paste}
        </button>
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 py-2 text-sm font-bold uppercase tracking-wide rounded-lg transition-all ${
            mode === 'upload' 
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5' 
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          {t.upload}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {mode === 'paste' && (
          <textarea
            className="w-full h-full p-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-500 transition-colors text-slate-800 dark:text-slate-200 placeholder-slate-400 font-mono text-sm"
            placeholder={t.pastePlaceholder}
            value={text}
            onChange={handleTextChange}
          />
        )}

        {mode === 'upload' && (
          <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mb-3"></div>
                  <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">{t.processing}</span></p>
                </>
              ) : uploadedFileName ? (
                <>
                  <svg className="w-10 h-10 mb-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <p className="mb-1 text-sm font-bold text-slate-800 dark:text-white text-center px-4">{uploadedFileName}</p>
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">Ready to read</p>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 mb-3 text-slate-400 group-hover:text-cyan-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                  <p className="mb-2 text-sm text-slate-500 dark:text-slate-400"><span className="font-semibold">{t.uploadPlaceholder}</span></p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">{t.uploadFormats}</p>
                </>
              )}
            </div>
            <input type="file" className="hidden" accept=".txt,.pdf,.epub" onChange={handleFileUpload} disabled={isProcessing} />
          </label>
        )}

        {mode === 'library' && (
          <div className="h-full overflow-y-auto pr-1 space-y-6">
          {books.length > 0 ? (
            books.map((book, bIndex) => (
              <div key={bIndex} className="space-y-3">
                <div className="sticky top-0 bg-white dark:bg-slate-800 py-2 z-10 border-b border-slate-100 dark:border-slate-700/50">
                  <h3 className="font-bold text-slate-900 dark:text-white">{book.title}</h3>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{book.author}</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {book.chapters.map((chapter, cIndex) => {
                    const isSelected = selectedBookIndex === bIndex && selectedChapterIndex === cIndex;
                    return (
                      <button
                        key={cIndex}
                        onClick={() => handleChapterClick(bIndex, cIndex, chapter.text)}
                        className={`text-left px-4 py-3 rounded-lg border-2 transition-all group relative overflow-hidden ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-900 dark:text-cyan-100'
                            : 'border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-600 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between relative z-10">
                          <span className="font-medium text-sm line-clamp-1">{chapter.title}</span>
                          {isSelected && (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-cyan-600 dark:text-cyan-400">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <p className="text-sm">{t.emptyState}</p>
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReaderInput;