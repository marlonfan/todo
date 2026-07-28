import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { IconCheck, IconRepeat } from '../icons/TaskIcons';
import {
  clampMonthlyDate,
  clampCustomRecurrenceInterval,
  isWeeklyRecurrenceType,
  isMonthlyRecurrenceType,
  isCustomRecurrenceTypeValue,
  RECURRENCE_INTERVAL_MAX,
} from '../../utils/quickEditor';
import {
  coerceLunarSelection,
  lunarSelectionFromLocalInput,
  solarDateFromLunarSelection,
  LUNAR_TIMEZONE,
} from '../../utils/lunar';
import { cn } from '../../lib/utils';

// Recurrence（重复任务）快速面板（阶段 3）。
// 受控 + 纯 UI：value 扁平（对齐 TaskList draft），单字段 onChange 上抛；
// 切 type 的副作用（重置 interval / 默认 days / 推 monthly date / lunar fallback）
// 由调用方在 onChange 里按 field==='type' 实现，以保持 TaskList（单 interval）与 TaskModal（双字段）各自语义。
// lunar 解析两份逐字一致，内置在此。显隐（custom 子菜单 / monthly 日期网格）组件内部 state。
// footer 只上抛 onCancel/onConfirm/onEditSeries，不内置提交语义。

const FREQUENCY_OPTIONS = [
  { value: 'daily', labelKey: 'task.daily' },
  { value: 'weekly', labelKey: 'task.weekly' },
  { value: 'monthly', labelKey: 'task.monthly' },
  { value: 'yearly', labelKey: 'task.yearly' },
];

const CUSTOM_CHIPS = [
  { value: 'biweekly', labelKey: 'task.biweekly' },
  { value: 'custom_weekly', labelKey: 'task.customWeekly' },
  { value: 'custom_monthly', labelKey: 'task.customMonthly' },
  { value: 'lunar', labelKey: 'task.lunarYearly' },
];

function splitDatePart(value) {
  return value && value.includes('T') ? value.split('T')[0] : value || '';
}

export function RecurrencePanel({
  value,
  onChange,            // (field, value) => void
  onChangeBatch,       // (changes: {field, value}[]) => void；缺省则循环 onChange
  onToggleDay,         // (dayKey) => void
  renderDatePicker,    // ({ value, onChange }) => ReactNode
  startInput = '',
  workDayKeys = [],
  weekDays = [],
  onCancel,            // () => void
  onConfirm,           // () => void
  onEditSeries,        // () => void | undefined（undefined 则不渲染）
  className,
  style,
}) {
  const { t } = useTranslation();
  const enabled = !!value?.enabled;
  const type = value?.type || 'daily';
  const interval = value?.interval ?? 1;
  const days = Array.isArray(value?.days) ? value.days : [];
  const monthlyDate = clampMonthlyDate(value?.date, 1);
  const lunar = value?.lunar || {};

  const [customMenuOpen, setCustomMenuOpen] = useState(() => isCustomRecurrenceTypeValue(type));
  const [monthlyPickerOpen, setMonthlyPickerOpen] = useState(false);

  const batch = (changes) => {
    if (typeof onChangeBatch === 'function') onChangeBatch(changes);
    else changes.forEach((c) => onChange?.(c.field, c.value));
  };

  const lunarPickerDate =
    solarDateFromLunarSelection({
      year: lunar.year,
      month: Number.parseInt(lunar.month, 10) || 1,
      day: Number.parseInt(lunar.day, 10) || 1,
      isLeapMonth: !!lunar.isLeapMonth,
    }) ||
    splitDatePart(startInput) ||
    dayjs().format('YYYY-MM-DD');

  const handleLunarPickerChange = (nextValue) => {
    const value = String(nextValue || '').trim();
    if (!value) return;
    const lunarSelection = lunarSelectionFromLocalInput(value, true, LUNAR_TIMEZONE);
    if (!lunarSelection) return;
    const nextSelection = coerceLunarSelection({
      year: lunarSelection.year,
      month: lunarSelection.month,
      day: lunarSelection.day,
      isLeapMonth: lunarSelection.isLeapMonth,
    });
    batch([
      { field: 'lunarYear', value: nextSelection.year },
      { field: 'lunarMonth', value: nextSelection.month },
      { field: 'lunarDay', value: nextSelection.day },
      { field: 'lunarIsLeapMonth', value: nextSelection.isLeapMonth },
    ]);
  };

  const customVisible = customMenuOpen || isCustomRecurrenceTypeValue(type);
  const showWeeklyStepper = type === 'custom_weekly' || type === 'custom_monthly';

  return (
    <div
      className={cn('task-quick-popover', 'task-quick-popover-scroll', 'task-recurrence-popover', className)}
      style={style}
    >
      <div className="task-quick-header">
        <div className="task-quick-title">{t('task.repeat')}</div>
        <div className="task-quick-toggle">
          <button
            type="button"
            aria-pressed={!enabled}
            className={cn('task-quick-toggle-btn', !enabled && 'task-quick-toggle-btn--active')}
            onClick={() => onChange?.('enabled', false)}
          >
            {t('task.repeatOff')}
          </button>
          <button
            type="button"
            aria-pressed={enabled}
            className={cn('task-quick-toggle-btn', enabled && 'task-quick-toggle-btn--active')}
            onClick={() => onChange?.('enabled', true)}
          >
            {t('task.repeatOn')}
          </button>
        </div>
      </div>

      {enabled && (
        <div className="task-quick-content space-y-2">
          <div className="task-quick-menu">
            {FREQUENCY_OPTIONS.map((option) => {
              const active = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  className={cn('task-quick-option', active && 'task-quick-option--active')}
                  onClick={() => {
                    onChange?.('type', option.value);
                    setCustomMenuOpen(false);
                  }}
                >
                  <span className="task-quick-option-icon">
                    <IconRepeat className="h-4 w-4" />
                  </span>
                  <span className="task-quick-option-label">{t(option.labelKey)}</span>
                  <IconCheck className="task-quick-option-check h-4 w-4" />
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={customVisible}
              className={cn('task-quick-option', customVisible && 'task-quick-option--active')}
              onClick={() => setCustomMenuOpen((prev) => !prev)}
            >
              <span className="task-quick-option-icon">
                <IconRepeat className="h-4 w-4" />
              </span>
              <span className="task-quick-option-label">{t('task.customRepeat')}</span>
              <IconCheck className="task-quick-option-check h-4 w-4" />
            </button>
          </div>

          {customVisible && (
            <div className="task-quick-section task-quick-subpanel">
              <div className="task-quick-section-title">{t('task.customRepeat')}</div>
              <div className="task-quick-chip-row">
                {CUSTOM_CHIPS.map((chip) => {
                  const active = type === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      aria-pressed={active}
                      className={cn('task-quick-chip', active && 'task-quick-chip--active')}
                      onClick={() => onChange?.('type', chip.value)}
                    >
                      {t(chip.labelKey)}
                    </button>
                  );
                })}
              </div>

              {showWeeklyStepper && (
                <div className="task-quick-interval-row">
                  <span>{t('task.repeatEvery')}</span>
                  <div className="task-quick-stepper">
                    <button
                      type="button"
                      title={t('task.decreaseInterval')}
                      aria-label={t('task.decreaseInterval')}
                      className="task-quick-stepper-btn"
                      onClick={() => onChange?.('interval', Math.max(2, clampCustomRecurrenceInterval(interval) - 1))}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="2"
                      max={RECURRENCE_INTERVAL_MAX}
                      value={clampCustomRecurrenceInterval(interval)}
                      onChange={(event) => onChange?.('interval', clampCustomRecurrenceInterval(event.target.value))}
                      className="task-quick-stepper-input"
                    />
                    <button
                      type="button"
                      title={t('task.increaseInterval')}
                      aria-label={t('task.increaseInterval')}
                      className="task-quick-stepper-btn"
                      onClick={() => onChange?.('interval', Math.min(RECURRENCE_INTERVAL_MAX, clampCustomRecurrenceInterval(interval) + 1))}
                    >
                      +
                    </button>
                  </div>
                  <span>{type === 'custom_weekly' ? t('task.repeatWeeksUnit') : t('task.repeatMonthsUnit')}</span>
                </div>
              )}
            </div>
          )}

          {type === 'lunar' && (
            <div className="task-quick-section task-quick-subpanel">
              <div className="task-quick-section-title">{t('task.lunarYearly')}</div>
              {renderDatePicker?.({ value: lunarPickerDate, onChange: handleLunarPickerChange })}
              <div className="mt-2 rounded-xl bg-card px-2 py-1.5 text-xs text-muted-foreground">
                {`${t('task.lunarYearly')} ${lunar.isLeapMonth ? t('task.lunarLeapPrefix') : ''}${Number.parseInt(lunar.month, 10) || 1}/${Number.parseInt(lunar.day, 10) || 1}`}
              </div>
            </div>
          )}

          {isWeeklyRecurrenceType(type) && (
            <div className="task-quick-section">
              <p className="task-quick-section-title">{t('task.selectWeekdays')}</p>
              <div className="task-quick-chip-row mb-2">
                <button type="button" className="task-quick-chip" onClick={() => onChange?.('days', workDayKeys)}>
                  {t('task.weekdaysWorkdays')}
                </button>
                <button type="button" className="task-quick-chip" onClick={() => onChange?.('days', weekDays.map((d) => d.key))}>
                  {t('task.weekdaysAll')}
                </button>
                <button type="button" className="task-quick-chip" onClick={() => onChange?.('days', [])}>
                  {t('task.weekdaysClear')}
                </button>
              </div>
              <div className="task-quick-weekday-grid">
                {weekDays.map((day) => {
                  const active = days.includes(day.key);
                  return (
                    <button
                      key={day.key}
                      type="button"
                      aria-pressed={active}
                      className={cn('task-quick-weekday', active && 'task-quick-weekday--active')}
                      onClick={() => onToggleDay?.(day.key)}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isMonthlyRecurrenceType(type) && (
            <div className="task-quick-section">
              <button
                type="button"
                className="task-quick-date-trigger"
                onClick={() => setMonthlyPickerOpen((prev) => !prev)}
              >
                <span>{t('task.monthlyOnDate')}</span>
                <span className="task-quick-date-value">{monthlyDate}</span>
              </button>
              {monthlyPickerOpen && (
                <div className="task-quick-date-grid">
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => {
                      const active = monthlyDate === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={active}
                          className={cn('task-quick-date-cell', active && 'task-quick-date-cell--active')}
                          onClick={() => {
                            onChange?.('date', day);
                            setMonthlyPickerOpen(false);
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="task-quick-footer">
        <button type="button" className="task-quick-action task-quick-action--ghost" onClick={() => onCancel?.()}>
          {t('common.cancel')}
        </button>
        {typeof onEditSeries === 'function' && (
          <button
            type="button"
            className="task-quick-action task-quick-action--secondary"
            title={t('task.editSeriesTemplate')}
            onClick={() => onEditSeries?.()}
          >
            {t('task.editSeriesTemplateShort')}
          </button>
        )}
        <button type="button" className="task-quick-action task-quick-action--primary" onClick={() => onConfirm?.()}>
          {t('common.confirm')}
        </button>
      </div>
    </div>
  );
}
