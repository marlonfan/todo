import React from 'react';
import { useTranslation } from 'react-i18next';
import { IconCheck, IconFlag } from '../icons/TaskIcons';
import { cn } from '../../lib/utils';
import { resolveCategoryColor } from '../../lib/theme';

// 任务快速编辑器（阶段 3）：把 TaskList / TaskModal 各自重复的 task-quick-* 浮层抽成共享组件。
// 受控 + 无业务状态：组件只渲染 task-quick-* DOM 并在交互时回调，写入/提交/显隐全部由调用方决定。
// 定位由调用方透传 className/style —— TaskModal 用 absolute inline，TaskList 用 fixed popover + floatingStyle。

const PRIORITY_OPTIONS = [
  { value: '1', tone: 'high', labelKey: 'task.priorityHigh' },
  { value: '0', tone: 'medium', labelKey: 'task.priorityMedium' },
  { value: '-1', tone: 'low', labelKey: 'task.priorityLow' },
];

export function PriorityPanel({ value, onChange, onClose, className, style }) {
  const { t } = useTranslation();
  return (
    <div className={cn('task-quick-popover', className)} style={style}>
      <div className="task-quick-menu">
        {PRIORITY_OPTIONS.map((option) => {
          const active = String(value ?? '0') === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              className={cn('task-quick-option', active && 'task-quick-option--active')}
              onClick={() => {
                onChange?.(option.value);
                onClose?.();
              }}
            >
              <span className={cn('task-quick-option-icon', `task-quick-option-icon--${option.tone}`)}>
                <IconFlag className="h-4 w-4" />
              </span>
              <span className="task-quick-option-label">{t(option.labelKey)}</span>
              <IconCheck className="task-quick-option-check h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryPanel({
  categories = [],
  selectedIds = [],
  showCategoryEmoji = false,
  onToggle,
  onClose,
  className,
  style,
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('task-quick-popover', 'task-quick-popover-scroll', className)} style={style}>
      <div className="task-quick-menu">
        {categories.map((cat) => {
          const active = selectedIds.includes(String(cat.id));
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={active}
              className={cn('task-quick-option', active && 'task-quick-option--active')}
              onClick={() => {
                onToggle?.(cat.id);
                onClose?.();
              }}
            >
              <span className="task-quick-option-icon">
                {showCategoryEmoji && cat.emoji ? (
                  <span className="task-quick-category-emoji">{cat.emoji}</span>
                ) : (
                  <span
                    className="task-quick-category-swatch"
                    style={{ backgroundColor: resolveCategoryColor(cat) }}
                  />
                )}
              </span>
              <span className="task-quick-option-label">{cat.name}</span>
              <IconCheck className="task-quick-option-check h-4 w-4" />
            </button>
          );
        })}
      </div>
      {categories.length === 0 && (
        <p className="task-quick-empty">{t('category.noCategories')}</p>
      )}
    </div>
  );
}
