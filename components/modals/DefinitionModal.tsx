import React, { useEffect, useState } from 'react';
import { DictionaryEntry, LanguageCode, Translation } from '../../types';
import dictionaryService from '../../utils/dictionaryService';
import Dialog from '../ui/Dialog';
import { SpeakerIcon, SpinnerIcon } from '../ui/Icons';

interface DefinitionModalProps {
  word: string | null;
  language: LanguageCode;
  onClose: () => void;
  t: Translation;
  allowOnline: boolean;
  onEnableOnline?: () => void;
}

const sourceLabel = (source: DictionaryEntry['source']): string => {
  switch (source) {
    case 'local': return 'Local dictionary';
    case 'embedded': return 'Built-in word list';
    case 'online': return 'Wiktionary';
    case 'cache': return 'Saved lookup';
    default: return source;
  }
};

const DefinitionModal: React.FC<DefinitionModalProps> = ({ word, language, onClose, t, allowOnline, onEnableOnline }) => {
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);

  // One lookup per (word, language, online) combination. Changing any of them, closing the
  // dialog or unmounting aborts the in-flight request, so stale results never land.
  useEffect(() => {
    if (!word) {
      setEntry(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setEntry(null);
    dictionaryService.lookup(word, language, { allowOnline, signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setEntry(result);
      setLoading(false);
    });
    return () => controller.abort();
  }, [word, language, allowOnline]);

  // Stop any pronunciation when the dialog closes or unmounts.
  useEffect(() => {
    if (!word) return;
    return () => dictionaryService.stopSpeaking();
  }, [word]);

  // Turning the online dictionary on changes `allowOnline`, which re-runs the lookup above.
  const handleEnableOnline = () => onEnableOnline?.();

  const canPronounce = dictionaryService.canPronounce();
  const isOpen = word !== null;
  const notFound = !loading && !entry && isOpen;
  const headword = entry?.word || word || t.definition;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeLabel={t.close}
      size="md"
      mascot={notFound ? 'talk' : false}
      title={<span className="font-serif text-2xl font-semibold tracking-tight break-words">{headword}</span>}
      description={notFound ? (allowOnline ? t.definitionNotFound : `${t.definitionNotFound} ${t.offlineDictionaryHint}`) : undefined}
      footer={notFound && !allowOnline && onEnableOnline ? (
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary">{t.close}</button>
          <button type="button" onClick={handleEnableOnline} className="btn btn-primary" data-autofocus>{t.onlineDictionary}</button>
        </>
      ) : undefined}
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted py-2" role="status" aria-live="polite">
          <SpinnerIcon size={16} />
          <span>{t.lookingUp}</span>
        </div>
      )}

      {!loading && entry && (
        <div className="flex flex-col gap-4 w-full">
          {(entry.partOfSpeech || entry.pronunciation || canPronounce) && (
            <div className="flex items-center justify-between gap-3 flex-wrap -mt-2">
              <div className="flex items-baseline gap-3 min-w-0">
                {entry.partOfSpeech && <span className="eyebrow">{entry.partOfSpeech}</span>}
                {entry.pronunciation && <span className="text-sm text-muted font-mono">{entry.pronunciation}</span>}
              </div>
              {canPronounce && (
                <button
                  type="button"
                  onClick={() => dictionaryService.pronounce(entry.word, language)}
                  className="btn btn-secondary btn-sm"
                >
                  <SpeakerIcon size={15} />
                  {t.pronounce}
                </button>
              )}
            </div>
          )}
          <ol className="flex flex-col gap-3">
            {entry.definitions.map((d, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="shrink-0 w-5 text-right tabular text-muted">{i + 1}.</span>
                <span className="min-w-0">{d}</span>
              </li>
            ))}
          </ol>
          <p className="hint pt-3 border-t border-line">{t.source}: {sourceLabel(entry.source)}</p>
        </div>
      )}
    </Dialog>
  );
};

export default DefinitionModal;
