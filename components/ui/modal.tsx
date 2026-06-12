'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  hideClose?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, size = 'md', className, hideClose = false }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className={cn(
        'relative w-full bg-bg-base border border-border rounded-xl shadow-2xl animate-scale-in max-h-[90vh] flex flex-col',
        sizes[size], className
      )}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-base font-semibold text-text-primary">{title}</h2>
            {!hideClose && (
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors">
                <X size={16} />
              </button>
            )}
          </div>
        )}
        {!title && !hideClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1.5 rounded-md hover:bg-bg-muted text-text-muted hover:text-text-primary transition-colors z-10"
          >
            <X size={16} />
          </button>
        )}
        <div className="overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
