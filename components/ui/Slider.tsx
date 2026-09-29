import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Formatted value shown at the right, e.g. "300 wpm". */
  display?: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}

/** Labelled range input with the filled-track style from index.css. */
const Slider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, display, hint, disabled }) => {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-baseline gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-sm tabular text-ink-soft">
          {display}
          {hint && <span className="text-muted"> · {hint}</span>}
        </span>
      </div>
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        style={{ ['--fill' as any]: `${fill}%` }}
      />
    </div>
  );
};

export default Slider;
