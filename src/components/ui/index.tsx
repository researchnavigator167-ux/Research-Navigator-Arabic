import type { ReactNode } from 'react';

export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <div className={`${sizes[size]} ${className}`}>
      <div className="w-full h-full border-2 border-primary-200 border-t-primary-700 rounded-full animate-spin dark:border-primary-900 dark:border-t-primary-400" />
    </div>
  );
}

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 min-h-[60vh]">
      <Spinner size="lg" />
      {message && <p className="text-sm text-neutral-500">{message}</p>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 bg-neutral-200 rounded w-3/4 mb-3 dark:bg-neutral-800" />
      <div className="h-3 bg-neutral-200 rounded w-1/2 mb-2 dark:bg-neutral-800" />
      <div className="h-3 bg-neutral-200 rounded w-2/3 dark:bg-neutral-800" />
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4 dark:bg-primary-900/30">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-neutral-900 mb-1 dark:text-neutral-100">{title}</h3>
      <p className="text-sm text-neutral-500 mb-6 max-w-xs">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-error-50 flex items-center justify-center mb-4 dark:bg-error-900/30">
        <svg className="w-7 h-7 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-sm text-neutral-600 mb-4 dark:text-neutral-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
