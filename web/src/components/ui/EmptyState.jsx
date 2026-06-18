import React from 'react';
import { cn } from '../../lib/utils';

// 空态/占位（阶段 2）：统一 .prompt-empty / .prompt-history-empty / workspaceFallback / .task-ai-empty 等。
export function EmptyState({ icon, title, description, action, className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/50 p-8 text-center',
        className
      )}
      {...props}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
      {description && <div className="max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
