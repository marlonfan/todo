import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

function InlineErrorState({
  title,
  message,
  retryLabel,
  onRetry,
  className = '',
}) {
  return (
    <div
      className={cn('flex min-h-[16rem] items-center justify-center px-4 py-10 text-center', className)}
      role="alert"
      aria-live="polite"
    >
      <div className="w-full max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-[hsl(var(--accent-danger)/0.12)] bg-[hsl(var(--accent-danger)/0.08)] text-[hsl(var(--accent-danger))] shadow-sm">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        {message && <p className="mt-2 text-sm leading-6 text-muted-foreground">{message}</p>}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn-secondary mt-5 inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default InlineErrorState;
