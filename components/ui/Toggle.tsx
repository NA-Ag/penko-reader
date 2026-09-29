import React, { useId } from 'react';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: () => void;
  description?: string;
  disabled?: boolean;
}

/** Switch row: label (and optional description) on the left, switch on the right. */
const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, description, disabled }) => {
  const descId = useId();
  return (
  <label className={`flex items-start justify-between gap-4 w-full py-1 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
    <span className="flex flex-col min-w-0">
      <span className="text-sm font-medium text-ink select-none">{label}</span>
      {description && <span id={descId} className="hint mt-0.5">{description}</span>}
    </span>
    <span className="relative shrink-0 mt-0.5">
      <input type="checkbox" role="switch" className="sr-only peer" checked={checked} onChange={onChange} disabled={disabled} aria-describedby={description ? descId : undefined} />
      <span className="block w-9 h-5 rounded-full bg-line peer-checked:bg-accent transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface"></span>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}></span>
    </span>
  </label>
  );
};

export default React.memo(Toggle);
