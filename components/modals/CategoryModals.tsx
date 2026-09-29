import React, { useEffect, useState } from 'react';
import { Translation } from '../../types';
import Dialog from '../ui/Dialog';
import { CheckIcon, FolderIcon } from '../ui/Icons';

interface AssignCategoryModalProps {
  isOpen: boolean;
  t: Translation;
  categories: string[];
  currentCategory?: string;
  onAssign: (category: string | undefined) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

/** Pick which category (shelf) a book belongs to. */
export const AssignCategoryModal: React.FC<AssignCategoryModalProps> = ({ isOpen, t, categories, currentCategory, onAssign, onCreateNew, onClose }) => {
  const options: { label: string; value: string | undefined }[] = [
    { label: t.uncategorized, value: undefined },
    ...categories.map(c => ({ label: c, value: c })),
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t.category}
      closeLabel={t.close}
      footer={
        <>
          <button onClick={onCreateNew} className="btn btn-ghost mr-auto">+ {t.addCategory}</button>
          <button onClick={onClose} className="btn btn-secondary">{t.cancel}</button>
        </>
      }
    >
      <div role="radiogroup" aria-label={t.category} className="flex flex-col -mx-2">
        {options.map(opt => {
          const active = currentCategory === opt.value;
          return (
            <button
              key={opt.value ?? '__none'}
              role="radio"
              aria-checked={active}
              onClick={() => onAssign(opt.value)}
              className={`flex items-center gap-3 w-full text-left px-3 h-11 rounded-lg text-sm transition-colors ${active ? 'bg-accent-soft text-accent-ink font-medium' : 'text-ink hover:bg-sunken'}`}
            >
              <FolderIcon size={16} className={active ? 'text-accent' : 'text-muted'} />
              <span className="flex-1 truncate">{opt.label}</span>
              {active && <CheckIcon size={16} className="text-accent shrink-0" />}
            </button>
          );
        })}
      </div>
      {categories.length === 0 && <p className="hint">{t.noCategories}</p>}
    </Dialog>
  );
};

interface AddCategoryModalProps {
  isOpen: boolean;
  t: Translation;
  existing: string[];
  onAdd: (name: string) => void;
  onClose: () => void;
}

/** Create a new category. */
export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, t, existing, onAdd, onClose }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (isOpen) setName(''); }, [isOpen]);
  const trimmed = name.trim();
  const valid = trimmed.length > 0 && !existing.some(c => c.toLowerCase() === trimmed.toLowerCase());

  const submit = () => {
    if (!valid) return;
    onAdd(trimmed);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t.addCategory}
      closeLabel={t.cancel}
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary">{t.cancel}</button>
          <button onClick={submit} disabled={!valid} className="btn btn-primary">{t.addCategory}</button>
        </>
      }
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.newCategoryPlaceholder}
        className="input"
        data-autofocus
        maxLength={40}
        aria-label={t.newCategoryPlaceholder}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }}
      />
    </Dialog>
  );
};
