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
  const baseClasses = 'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500';
  const errorClasses = error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-[#0194F9] focus:border-[#0194F9]';

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-[#666666] dark:text-gray-400">
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
        <p className="text-sm text-[#666666] dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
}
