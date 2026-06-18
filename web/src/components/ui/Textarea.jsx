import React from 'react';
import { cn } from '../../lib/utils';

// 多行输入（阶段 1）：与 <Input> 同一套 focus token（--ring-focus）。
const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary/60 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));

Textarea.displayName = 'Textarea';

export { Textarea };
