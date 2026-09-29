import React, { useEffect, useState } from 'react';
import Dialog from '../ui/Dialog';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  danger?: boolean;
}

/** Yes/no confirmation. Destructive confirmations get Penko looking worried. */
const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger = true }) => {
  // Guard against a double click running an async confirm (e.g. delete) twice.
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (isOpen) setBusy(false); }, [isOpen]);
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onConfirm(); } finally { setBusy(false); }
  };

  return (
  <Dialog
    isOpen={isOpen}
    onClose={onCancel}
    title={title}
    description={message}
    mascot={danger ? 'hurt' : false}
    closeLabel={cancelLabel}
    footer={
      <>
        <button onClick={onCancel} className="btn btn-secondary">{cancelLabel}</button>
        <button onClick={confirm} disabled={busy} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} data-autofocus>{confirmLabel}</button>
      </>
    }
  />
  );
};

export default ConfirmModal;
