'use client';

import { getInitials, cn } from '@/lib/utils';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#f97316', '#14b8a6',
];

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const color = getAvatarColor(name);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn('rounded-full object-cover flex-shrink-0', sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn('rounded-full flex items-center justify-center flex-shrink-0 font-semibold text-white', sizes[size], className)}
      style={{ backgroundColor: color }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

interface AvatarGroupProps {
  names: string[];
  max?: number;
  size?: AvatarProps['size'];
}

export function AvatarGroup({ names, max = 3, size = 'sm' }: AvatarGroupProps) {
  const visible = names.slice(0, max);
  const rest = names.length - max;

  return (
    <div className="flex -space-x-1.5">
      {visible.map((name) => (
        <Avatar key={name} name={name} size={size} className="ring-2 ring-bg-base" />
      ))}
      {rest > 0 && (
        <div className={cn(
          'rounded-full flex items-center justify-center ring-2 ring-bg-base bg-bg-muted text-text-muted font-medium flex-shrink-0',
          sizes[size]
        )}>
          +{rest}
        </div>
      )}
    </div>
  );
}
