import React, { useEffect, useRef, useState } from 'react';
import { ACCEPT_STRING } from '../utils/formats';
import { LanguageCode, Translation, LANGUAGE_NAMES } from '../types';
import { LIBRARY } from '../utils/library';
import { stripHtml } from '../utils/tokenizer';
import { CheckIcon, SpinnerIcon, UploadIcon } from './ui/Icons';

interface ReaderInputProps {
  currentLang: LanguageCode;
  availableLanguages: LanguageCode[];
  t: Translation;
  /** Text the reader currently holds (used to prefill the editor). */
  initialText?: string;
  onContentReady: (text: string, lang: LanguageCode) => void;
  onLanguageChange: (lang: LanguageCode) => void;
}

type Mode = 'library' | 'paste' | 'upload';


/** Source picker for the speed reader: sample passages, pasted text, or a file. */
const ReaderInput: React.FC<ReaderInputProps> = React.memo(({ currentLang, availableLanguages, t, initialText = '', onContentReady, onLanguageChange }) => {
  const [mode, setMode] = useState<Mode>(initialText ? 'paste' : 'library');
  const [text, setText] = useState(initialText);
  const [selected, setSelected] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  /** Set when an upload itself changes the language, so the reset below keeps the file name. */
  const keepUploadRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setSelected(null);
    if (keepUploadRef.current) keepUploadRef.current = false;
    else setUploadedFileName(null);
  }, [currentLang]);

  const handleChapterClick = (key: string, chapterText: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setSelected(key);
    setUploadedFileName(null);
    onContentReady(chapterText, currentLang);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);
    setSelected(null);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      if (value.trim()) onContentReady(value, currentLang);
    }, 250);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsProcessing(true);
    setUploadedFileName(null);
    setError(null);
    await new Promise(r => setTimeout(r, 50));
    try {
      const { importFile, extractPdfText } = await import('../utils/importers');
      const imported = await importFile(file);
      const content = imported.fileType === 'pdf' ? await extractPdfText(imported.text) : stripHtml(imported.text);
      if (!content.trim()) throw new Error(t.fileError);
      if (!mountedRef.current) return;
      const lang = imported.language || currentLang;
      if (lang !== currentLang) keepUploadRef.current = true;
      setUploadedFileName(imported.title);
      setSelected(null);
      // onContentReady also switches the reader to the detected language.
      onContentReady(content, lang);
    } catch (err: any) {
      console.error('File upload failed', err);
      if (mountedRef.current) setError(err?.message || t.fileError);
    } finally {
      if (mountedRef.current) setIsProcessing(false);
    }
  };

  const books = LIBRARY[currentLang] || [];
  const tabs: { id: Mode; label: string }[] = [
    { id: 'library', label: t.library },
    { id: 'paste', label: t.paste },
    { id: 'upload', label: t.upload }
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">{t.passage}</h2>
        <select
          value={currentLang}
          onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
          className="input h-9 w-auto min-w-[8.5rem]"
          aria-label={t.selectLang}
        >
          {availableLanguages.map(lang => (
            <option key={lang} value={lang}>{LANGUAGE_NAMES[lang]}</option>
          ))}
        </select>
      </div>

      <div className="segmented w-full" role="tablist">
        {tabs.map(tab => (
          <button key={tab.id} role="tab" aria-selected={mode === tab.id} onClick={() => setMode(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-[320px] relative">
        {mode === 'paste' && (
          <textarea
            className="input h-full min-h-[320px] resize-none font-serif text-base"
            placeholder={t.pastePlaceholder}
            value={text}
            onChange={handleTextChange}
            spellCheck={false}
          />
        )}

        {mode === 'upload' && (
          <label className="flex flex-col items-center justify-center w-full h-full min-h-[320px] border border-dashed border-line rounded-xl cursor-pointer bg-sunken/50 hover:bg-sunken transition-colors p-6 text-center gap-2">
            {isProcessing ? (
              <>
                <SpinnerIcon size={28} className="text-accent" />
                <p className="text-sm text-ink-soft">{t.processing}</p>
              </>
            ) : uploadedFileName ? (
              <>
                <span className="w-10 h-10 rounded-full bg-accent-soft text-accent-ink flex items-center justify-center"><CheckIcon size={20} /></span>
                <p className="text-sm font-medium text-ink">{uploadedFileName}</p>
              </>
            ) : (
              <>
                <span className="w-10 h-10 rounded-full bg-surface border border-line text-ink-soft flex items-center justify-center"><UploadIcon size={18} /></span>
                <p className="text-sm font-medium text-ink">{t.uploadPlaceholder}</p>
                <p className="hint">{t.supportedFormats}</p>
              </>
            )}
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
            <input type="file" className="hidden" accept={ACCEPT_STRING} onChange={handleFileUpload} disabled={isProcessing} />
          </label>
        )}

        {mode === 'library' && (
          <div className="h-full max-h-[440px] overflow-y-auto scroll-thin -mx-2 px-2 flex flex-col gap-5">
            {books.length > 0 ? books.map((book, bIndex) => (
              <div key={bIndex} className="flex flex-col gap-1">
                <div className="px-3 pb-1">
                  <h3 className="font-serif font-semibold text-ink leading-snug">{book.title}</h3>
                  <p className="text-xs text-muted">{book.author}</p>
                </div>
                {book.chapters.map((chapter, cIndex) => {
                  const key = `${bIndex}-${cIndex}`;
                  const isSelected = selected === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleChapterClick(key, chapter.text)}
                      aria-pressed={isSelected}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                        isSelected ? 'bg-accent-soft text-accent-ink font-medium' : 'text-ink-soft hover:bg-sunken hover:text-ink'
                      }`}
                    >
                      <span className="line-clamp-1">{chapter.title}</span>
                      {isSelected && <CheckIcon size={16} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )) : (
              <div className="flex items-center justify-center h-full text-sm text-muted">{t.emptyState}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ReaderInput.displayName = 'ReaderInput';

export default ReaderInput;
