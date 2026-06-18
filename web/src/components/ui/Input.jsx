import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// 输入框组件（阶段 1）：focus 统一走 --ring-focus token，
// 消除散落的 ring-blue-200 / #93c5fd / #bfdbfe / ring-0 等多种 focus 实现。
const inputVariants = cva(
  'flex w-full rounded-md border bg-muted text-foreground transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary/60 focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-input',
        filled: 'border-transparent',
      },
      size: {
        default: 'h-9 px-3 py-1 text-sm',
        sm: 'h-8 px-2.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Input = React.forwardRef(({ className, variant, size, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(inputVariants({ variant, size }), className)}
    {...props}
  />
));

Input.displayName = 'Input';

export { Input, inputVariants };
