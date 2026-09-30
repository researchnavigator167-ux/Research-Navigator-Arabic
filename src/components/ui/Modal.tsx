import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full h-full',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative w-full ${sizes[size]} bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-10">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
