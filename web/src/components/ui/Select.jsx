import React, { useState, useRef, useEffect } from 'react';

/**
 * 自定义下拉框，替代原生 <select>。
 *
 * 用法与原生 select 完全兼容：
 *   <Select value={x} onChange={(e) => setX(e.target.value)} className="form-select">
 *     <option value="a">Label A</option>
 *   </Select>
 */
export default function Select({
  value,
  onChange,
  onBlur,
  children,
  className = 'form-select',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // 从 <option> children 解析选项列表
  const options = React.Children.toArray(children)
    .filter((c) => c.type === 'option')
    .map((c) => ({ value: String(c.props.value ?? ''), label: c.props.children }));

  const selected = options.find((o) => o.value === String(value ?? '')) ?? options[0];

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onBlur]);

  // Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleSelect = (optValue) => {
    setOpen(false);
    onChange?.({ target: { value: optValue } });
    onBlur?.();
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${className} flex w-full items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 text-left text-sm transition-colors
                  ${opt.value === String(value ?? '')
                    ? 'bg-accent font-medium text-primary'
                    : 'text-foreground hover:bg-muted'
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
