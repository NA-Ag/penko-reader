import React, { useRef, useState } from 'react';
import { Translation } from '../../types';
import Dialog from '../ui/Dialog';
import { CheckIcon, DownloadIcon, InfoIcon, SpinnerIcon, UploadIcon } from '../ui/Icons';

interface BackupModalProps {
  isOpen: boolean;
  t: Translation;
  onExport: () => void;
  onRestore: (file: File) => Promise<number>;
  onClose: () => void;
}

/** Export the library to a JSON file, or merge a previous export back in. */
const BackupModal: React.FC<BackupModalProps> = ({ isOpen, t, onExport, onRestore, onClose }) => {
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const count = await onRestore(file);
      setMessage({ kind: 'ok', text: `${count} ${t.saved.toLowerCase()}` });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err?.message === 'invalid' ? t.restoreInvalid : t.restoreError });
    } finally {
      setBusy(false);
    }
  };

  const close = () => { setMessage(null); onClose(); };

  return (
    <Dialog isOpen={isOpen} onClose={close} title={t.backupModalTitle} description={t.backupModalDesc} size="md" closeLabel={t.close}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 p-4 rounded-xl border border-line">
          <div className="w-10 h-10 rounded-lg bg-sunken flex items-center justify-center shrink-0 text-ink-soft">
            <DownloadIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink">{t.backupExportBtn}</div>
            <div className="hint">JSON · {t.localFiles}</div>
          </div>
          <button onClick={() => { onExport(); close(); }} className="btn btn-primary btn-sm shrink-0" data-autofocus>
            {t.download}
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl border border-line">
          <div className="w-10 h-10 rounded-lg bg-sunken flex items-center justify-center shrink-0 text-ink-soft">
            <UploadIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-ink">{t.backupRestoreBtn}</div>
            <div className="hint">{t.backupRestoreHelper}</div>
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="btn btn-secondary btn-sm shrink-0">
            {busy ? <SpinnerIcon size={14} /> : null}
            {t.upload}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={handleRestore} className="hidden" />
        </div>

        {message && (
          <p
            role="status"
            className={`flex items-center gap-2 text-sm ${message.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {message.kind === 'ok' ? <CheckIcon size={16} /> : <InfoIcon size={16} />}
            {message.text}
          </p>
        )}
      </div>
    </Dialog>
  );
};

export default BackupModal;
