import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const Checkbox = React.forwardRef(({
  checked = false,
  disabled = false,
  className = '',
  inputClassName = '',
  onChange,
  ...props
}, ref) => (
  <span className={cn('relative inline-grid h-5 w-5 shrink-0 place-items-center', className)}>
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className={cn('peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed', inputClassName)}
      {...props}
    />
    <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] border border-border bg-card text-transparent shadow-sm transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-[hsl(var(--primary)/0.2)] peer-disabled:opacity-45">
      <Check className="h-3.5 w-3.5 stroke-[3]" />
    </span>
  </span>
));

Checkbox.displayName = 'Checkbox';

export { Checkbox };
