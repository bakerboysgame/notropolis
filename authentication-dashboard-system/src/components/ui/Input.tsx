import React from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

export function Input({
  error,
  label,
  helperText,
  className = '',
  ...props
}: InputProps) {
  const baseClasses = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-0 placeholder-neutral-400 dark:placeholder-neutral-500';
  const errorClasses = error
    ? 'border-red-500 focus:ring-red-500'
    : 'border-neutral-300 dark:border-neutral-700 focus:ring-primary-500 focus:border-primary-500 dark:focus:ring-offset-neutral-900';

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </label>
      )}
      <input
        className={clsx(baseClasses, errorClasses, className)}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{helperText}</p>
      )}
    </div>
  );
}
