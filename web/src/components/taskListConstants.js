// 从 TaskList.jsx 抽出的模块级常量。纯配置，无运行时依赖。

export const WEEKDAY_ONLY_RE = /^(MO|TU|WE|TH|FR|SA|SU)$/;
export const ORDINAL_WEEKDAY_RE = /^(-?\d)(MO|TU|WE|TH|FR|SA|SU)$/;
export const DRAFT_IDLE_SUBMIT_MS = 3000;
export const DRAFT_TEXT_AUTOSAVE_MS = 2500;
export const DRAFT_DESCRIPTION_RENDER_DELAY_MS = 120;
export const DEFAULT_WORKDAY_KEYS = ['MO', 'TU', 'WE', 'TH', 'FR'];
export const RECURRENCE_INTERVAL_MAX = 99;
export const OCCURRENCE_STATUS_OPTIMISTIC_TTL_MS = 5 * 60 * 1000;
export const PINNED_NEXT_OCCURRENCE_TTL_MS = 4000;
export const TASK_ROW_COMPLETE_FEEDBACK_MS = 100;
export const TASK_ROW_COMPLETE_EXIT_MS = 140;
export const RECURRING_SEARCH_STATUSES = 'pending,completed,cancelled,skipped';
export const DELETE_DIALOG_KIND_RECURRING_CHOICE = 'recurring-choice';
export const DELETE_DIALOG_KIND_RECURRING_SERIES = 'recurring-series';
export const DELETE_DIALOG_KIND_TASK = 'task';
export const DETAIL_PANELS_REQUIRING_CONFIRM = new Set(['time', 'recurrence']);
export const DETAIL_PANEL_FLOATING_WIDTH_REMS = {
  activity: 30,
  priority: 12.25,
  category: 14.75,
  recurrence: 18.25,
};
export const TASK_PULL_REFRESH_TRIGGER_PX = 58;
export const TASK_PULL_REFRESH_MAX_PX = 76;
export const TASK_PULL_REFRESH_HOLD_PX = 54;
export const TASK_PULL_REFRESH_RESISTANCE = 0.46;
export const TASK_COMPACT_MOBILE_BREAKPOINT = 768;
export const TASK_DETAIL_SPLIT_MIN_WIDTH = 800;
export const TASK_SPLIT_STORAGE_KEY = 'todo:taskListDetailSplitRatio';
export const TASK_SPLIT_DEFAULT_RATIO = 0.55;
export const TASK_SPLIT_MIN_LIST_WIDTH = 320;
export const TASK_SPLIT_MIN_DETAIL_WIDTH = 340;
export const TASK_SPLIT_DIVIDER_WIDTH = 8;
export const TASK_SPLIT_KEYBOARD_STEP = 0.03;
export const TIME_PANEL_DRAFT_FIELDS = ['all_day', 'start_time', 'end_time'];
export const RECURRENCE_PANEL_DRAFT_FIELDS = [
  'recurrence_enabled',
  'recurrence_type',
  'recurrence_interval',
  'recurrence_days',
  'recurrence_date',
  'recurrence_lunar_month',
  'recurrence_lunar_day',
  'recurrence_lunar_is_leap_month',
];
