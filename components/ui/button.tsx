'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const variants = {
  primary: 'bg-accent text-white hover:bg-accent-hover active:scale-[0.98]',
  secondary: 'bg-bg-muted text-text-primary border border-border hover:bg-bg-subtle active:scale-[0.98]',
  ghost: 'text-text-secondary hover:bg-bg-muted hover:text-text-primary active:scale-[0.98]',
  destructive: 'bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]',
  outline: 'border border-border text-text-primary hover:bg-bg-subtle active:scale-[0.98]',
};

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-3.5 py-2 text-sm rounded-md gap-2',
  lg: 'px-5 py-2.5 text-sm rounded-lg gap-2',
  icon: 'p-2 rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'secondary', size = 'md', className, children, ...props
}, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';
