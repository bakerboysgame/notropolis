import React from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
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
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-[#0194F9] text-white hover:bg-[#0178D4] focus:ring-[#0194F9] disabled:bg-[#B3D9FF] disabled:text-[#666666] dark:disabled:bg-gray-600 dark:disabled:text-gray-400',
    secondary: 'bg-[#666666] dark:bg-gray-600 text-white hover:bg-[#4A4A4A] dark:hover:bg-gray-500 focus:ring-[#666666]',
    outline: 'border border-[#0194F9] text-[#0194F9] hover:bg-[#0194F9] hover:text-white focus:ring-[#0194F9]',
    ghost: 'text-[#0194F9] hover:bg-[#F0F8FF] dark:hover:bg-gray-700 focus:ring-[#0194F9]'
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
