'use client';

import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'subtle';
}

export function Badge({ children, color, className, variant = 'subtle' }: BadgeProps) {
  const style = color ? {
    backgroundColor: variant === 'subtle' ? `${color}18` : color,
    color: variant === 'subtle' ? color : '#fff',
    borderColor: variant === 'outline' ? color : 'transparent',
  } : {};

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border',
        !color && 'bg-bg-muted text-text-secondary border-transparent',
        className
      )}
      style={style}
    >
      {children}
    </span>
  );
}
