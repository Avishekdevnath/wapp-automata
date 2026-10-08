import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  size?: 'sm' | 'md';
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  size = 'md',
}) => {
  const isSm = size === 'sm';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/40 select-none ${
        isSm ? 'h-5 w-9 p-0.5' : 'h-6 w-11 p-0.5'
      } ${
        checked
          ? 'bg-emerald-600 hover:bg-emerald-500 shadow-xs'
          : 'bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
          isSm ? 'h-4 w-4' : 'h-5 w-5'
        } ${checked ? (isSm ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0'}`}
      />
    </button>
  );
};
