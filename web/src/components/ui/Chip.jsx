import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// 标签/Chip（阶段 2）：统一 .task-quick-chip / .prompt-history-status / .prompt-mobile-tab-count 等 5 套 pill。
// 支持动态分类色：调用方传 style={{ backgroundColor: hexA(color, 0.12), color: color }}（见 lib/theme.js）。
const chipVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        primary: 'bg-accent text-primary',
        success: 'bg-emerald-50 text-emerald-700',
        warning: 'bg-amber-50 text-amber-800',
        destructive: 'bg-rose-50 text-rose-700',
        outline: 'border border-border text-muted-foreground',
      },
      size: {
        default: 'px-2.5 py-0.5 text-xs',
        sm: 'px-2 py-0 text-[11px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Chip = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <span ref={ref} className={cn(chipVariants({ variant, size }), className)} {...props} />
));
Chip.displayName = 'Chip';

export { Chip, chipVariants };
