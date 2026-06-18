// 任务快速编辑器共享工具（阶段 3）：recurrence / category 相关纯函数，
// 从 TaskList.jsx / TaskModal.jsx 两份重复定义中去重。供 TaskQuickEditor 及调用方共用。
// 已逐字核对两份实现完全一致；buildRecurrenceSummaryLabel / getRecurrenceIntervalForType
// 因数据模型差异（单 interval 字段 vs 双 weekly/monthly 字段）暂留在各自组件。

export const RECURRENCE_INTERVAL_MAX = 99;

export function buildCategorySummaryLabel(selectedCategoryIDs, categories, showEmoji, fallbackLabel) {
  const ids = Array.isArray(selectedCategoryIDs) ? selectedCategoryIDs.map(String) : [];
  if (ids.length === 0) return fallbackLabel;
  const selected = categories.filter((cat) => ids.includes(String(cat.id)));
  if (selected.length === 0) return `${fallbackLabel}+${ids.length}`;
  const first = selected[0];
  const firstLabel = showEmoji && first?.emoji ? `${first.emoji}${first.name}` : String(first?.name || fallbackLabel);
  if (selected.length === 1) return firstLabel;
  return `${firstLabel}+${selected.length - 1}`;
}

export function normalizeByDayList(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((day) => String(day || '').trim().toUpperCase())
    .filter((day) => day.length > 0);
}

export function clampMonthlyDate(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(31, Math.max(1, parsed));
}

export function clampRecurrenceInterval(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(RECURRENCE_INTERVAL_MAX, Math.max(1, parsed));
}

export function clampCustomRecurrenceInterval(value) {
  return Math.max(2, clampRecurrenceInterval(value, 2));
}

export function isWeeklyRecurrenceType(value) {
  const type = String(value || 'daily');
  return type === 'weekly' || type === 'biweekly' || type === 'custom_weekly';
}

export function isMonthlyRecurrenceType(value) {
  const type = String(value || 'daily');
  return type === 'monthly' || type === 'custom_monthly';
}

export function isCustomRecurrenceTypeValue(value) {
  const type = String(value || 'daily');
  return type === 'biweekly' || type === 'custom_weekly' || type === 'custom_monthly' || type === 'lunar';
}
