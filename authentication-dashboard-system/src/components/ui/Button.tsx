import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  children,
  loading = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    // Primary: Brand green
    primary: 'bg-primary-500 text-white hover:bg-primary-400 focus:ring-primary-500 active:bg-primary-600 disabled:bg-primary-500/50 dark:focus:ring-offset-neutral-900',
    // Secondary: Neutral gray
    secondary: 'bg-neutral-700 text-white hover:bg-neutral-600 focus:ring-neutral-500 active:bg-neutral-800 dark:bg-neutral-700 dark:hover:bg-neutral-600 dark:focus:ring-offset-neutral-900',
    // Outline: Green border
    outline: 'border border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white focus:ring-primary-500 dark:border-primary-400 dark:text-primary-400 dark:hover:bg-primary-500 dark:hover:text-white dark:focus:ring-offset-neutral-900',
    // Ghost: Subtle green
    ghost: 'text-primary-500 hover:bg-primary-500/10 focus:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-500/20 dark:focus:ring-offset-neutral-900',
    // Danger: Red for destructive actions
    danger: 'bg-red-500 text-white hover:bg-red-400 focus:ring-red-500 active:bg-red-600 dark:focus:ring-offset-neutral-900'
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const widthClasses = fullWidth ? 'w-full' : '';

  const classes = clsx(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    widthClasses,
    className
  );

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}
