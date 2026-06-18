import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// 桌面侧栏导航项（阶段 2）：统一 .md-nav-item / .md-nav-item-active / .md-nav-item-idle。
// 移动端底部 nav 结构不同，暂不合并（仅换 token）。
const navItemVariants = cva(
  'flex min-h-9 min-w-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  {
    variants: {
      active: {
        true: 'bg-accent font-semibold text-foreground',
        false: 'text-muted-foreground hover:bg-muted hover:text-foreground',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

const NavItem = React.forwardRef(({ className, active, ...props }, ref) => (
  <div ref={ref} role="navigation-item" className={cn(navItemVariants({ active }), className)} {...props} />
));
NavItem.displayName = 'NavItem';

export { NavItem, navItemVariants };
