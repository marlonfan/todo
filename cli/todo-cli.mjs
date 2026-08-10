#!/usr/bin/env node

import { lstat, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CLI_VERSION = '0.3.0';
const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const DEFAULT_CONFIG_PATH = join(homedir(), '.todo-cli', 'config.json');
const DEFAULT_TIMEOUT_MS = 30000;
const BUNDLED_SKILL_PATH = join(dirname(fileURLToPath(import.meta.url)), 'skills', 'todo-cli', 'SKILL.md');
const NO_VALUE_FLAGS = new Set(['dry-run', 'force', 'help', 'h', 'yes']);
const RETIRED_TASK_REMINDER_FLAGS = [
  'remind-at-start',
  'notify-at-start',
  'reminder-policy',
  'reminder-minutes-before',
  'remind-before',
  'notify-at',
];
const SERVER_MANAGED_REMINDER_KEYS = new Set([
  'default_morning_time',
  'default_reminder_enabled',
  'default_reminder_minutes',
  'notify_at',
  'reminder_minutes_before',
  'reminder_policy',
  'reminder_summary',
]);

class CliError extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    let key;
    let value;
    if (eqIndex >= 0) {
      key = arg.slice(2, eqIndex);
      value = arg.slice(eqIndex + 1);
    } else {
      key = arg.slice(2);
      if (key.startsWith('no-')) {
        key = key.slice(3);
        value = false;
      } else if (NO_VALUE_FLAGS.has(key)) {
        value = true;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        value = argv[i + 1];
        i += 1;
      } else {
        value = true;
      }
    }

    if (flags[key] === undefined) {
      flags[key] = value;
    } else if (Array.isArray(flags[key])) {
      flags[key].push(value);
    } else {
      flags[key] = [flags[key], value];
    }
  }

  return { positionals, flags };
}

function getConfigPath(flags = {}) {
  return String(flags.config || process.env.TODO_CLI_CONFIG || DEFAULT_CONFIG_PATH);
}

async function readConfig(flags = {}) {
  try {
    const raw = await readFile(getConfigPath(flags), 'utf8');
    if (raw.trim() === '') return {};
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeConfig(config, flags = {}) {
  const path = getConfigPath(flags);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function requireHTTPURL(value, label = 'base URL') {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new CliError(`invalid ${label}: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new CliError(`invalid ${label}: expected http:// or https://`);
  }
  return url.toString().replace(/\/+$/, '');
}

function normalizeBaseURL(baseURL) {
  const trimmed = requireHTTPURL(baseURL || DEFAULT_BASE_URL);
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

function normalizeServerBaseURL(baseURL) {
  const trimmed = requireHTTPURL(baseURL || DEFAULT_BASE_URL);
  return trimmed.endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

function resolveBaseURL(flags, config = {}) {
  if (flags['base-url']) return { value: String(flags['base-url']), source: 'flag' };
  if (process.env.TODO_BASE_URL) return { value: process.env.TODO_BASE_URL, source: 'env' };
  if (config.baseUrl) return { value: config.baseUrl, source: 'config' };
  return { value: DEFAULT_BASE_URL, source: 'default' };
}

function resolveAuthToken(flags, config = {}) {
  if (flags.token) return { value: String(flags.token), source: 'flag' };
  if (process.env.TODO_TOKEN) return { value: process.env.TODO_TOKEN, source: 'env' };
  if (config.token) return { value: String(config.token), source: 'config' };
  return { value: '', source: 'none' };
}

function connectionHint(ctx) {
  const configure = 'Run `todo-cli init --base-url https://your-todo-server.example.com` or set TODO_BASE_URL.';
  if (ctx.baseUrlSource === 'default') {
    return `The default ${DEFAULT_BASE_URL} is only for local development. ${configure}`;
  }
  return configure;
}

function asArray(value) {
  if (value === undefined || value === null || value === false) return [];
  return Array.isArray(value) ? value : [value];
}

function firstFlag(flags, names) {
  for (const name of names) {
    if (flags[name] !== undefined) return flags[name];
  }
  return undefined;
}

function requireValue(flags, names, label = names[0]) {
  const value = firstFlag(flags, names);
  if (value === undefined || value === true || String(value).trim() === '') {
    throw new CliError(`missing required option --${label}`);
  }
  return String(value);
}

function optionalString(flags, names) {
  const value = firstFlag(flags, names);
  if (value === undefined || value === true || value === false) return undefined;
  return String(value);
}

function optionalFilePath(flags, names, label = names[0]) {
  const value = firstFlag(flags, names);
  if (value === undefined) return undefined;
  if (value === true || value === false || String(value).trim() === '') {
    throw new CliError(`missing required option --${label}`);
  }
  return String(value);
}

function optionalNumber(flags, names) {
  const value = optionalString(flags, names);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new CliError(`invalid number: ${value}`);
  return parsed;
}

function optionalBool(flags, names) {
  const value = firstFlag(flags, names);
  if (value === undefined) return undefined;
  return parseBool(value);
}

function parseBool(value) {
  if (value === true || value === false) return value;
  const normalized = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  throw new CliError(`invalid boolean: ${value}`);
}

function flagEnabled(flags, names, defaultValue = false) {
  const value = firstFlag(flags, names);
  if (value === undefined) return defaultValue;
  return parseBool(value);
}

function parsePriority(value) {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['high', 'h', '1'].includes(normalized)) return 1;
  if (['medium', 'mid', 'm', '0'].includes(normalized)) return 0;
  if (['low', 'l', '-1'].includes(normalized)) return -1;
  throw new CliError(`invalid priority: ${value}`);
}

function parseIDList(value) {
  if (value === undefined) return undefined;
  const parts = asArray(value).flatMap((item) => String(item).split(','));
  const ids = parts.map((item) => Number(String(item).trim())).filter((id) => Number.isFinite(id));
  return ids.length ? ids : undefined;
}

function parseJSONFlag(value, label) {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(String(value));
  } catch (err) {
    throw new CliError(`invalid JSON for --${label}: ${err.message}`);
  }
}

async function readTextFile(path, label) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    throw new CliError(`cannot read --${label} ${path}: ${err.message}`);
  }
}

async function optionalTextFromFileFlag(flags, valueNames, fileNames, label) {
  const value = optionalString(flags, valueNames);
  const filePath = optionalFilePath(flags, fileNames, fileNames[0]);
  if (value !== undefined && filePath !== undefined) {
    throw new CliError(`use either --${valueNames[0]} or --${fileNames[0]}, not both`);
  }
  if (filePath !== undefined) return readTextFile(filePath, fileNames[0]);
  return value;
}

async function parseJSONInput(flags, valueNames, fileNames, label) {
  const value = optionalString(flags, valueNames);
  const filePath = optionalFilePath(flags, fileNames, fileNames[0]);
  if (value !== undefined && filePath !== undefined) {
    throw new CliError(`use either --${valueNames[0]} or --${fileNames[0]}, not both`);
  }
  const raw = filePath === undefined ? value : await readTextFile(filePath, fileNames[0]);
  return parseJSONFlag(raw, label);
}

function parseTimeoutMS(flags, config = {}) {
  const raw = optionalString(flags, ['timeout-ms', 'timeout']) || process.env.TODO_CLI_TIMEOUT_MS || config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timeoutMS = Number(raw);
  if (!Number.isFinite(timeoutMS) || timeoutMS <= 0) {
    throw new CliError(`invalid timeout: ${raw}`);
  }
  return timeoutMS;
}

function timeoutMessage(ctx) {
  return `request timed out after ${ctx.timeoutMs}ms while connecting to ${ctx.serverBase}. ${connectionHint(ctx)}`;
}

async function buildTaskPayload(flags, { partial = false } = {}) {
  const payload = {};

  const retiredReminderFlag = RETIRED_TASK_REMINDER_FLAGS.find((name) => flags[name] !== undefined);
  if (retiredReminderFlag) {
    throw new CliError(`--${retiredReminderFlag} is no longer supported; set the task time and let the server apply account defaults`);
  }

  const title = optionalString(flags, ['title']);
  if (title !== undefined) payload.title = title;
  if (!partial && !payload.title) throw new CliError('missing required option --title');

  const description = await optionalTextFromFileFlag(
    flags,
    ['description', 'desc'],
    ['description-file', 'desc-file'],
    'description',
  );
  if (description !== undefined) payload.description = description;

  const priority = parsePriority(optionalString(flags, ['priority']));
  if (priority !== undefined) payload.priority = priority;

  const status = optionalString(flags, ['status']);
  if (status !== undefined) payload.status = status;

  const startTime = optionalString(flags, ['start-time']);
  if (startTime !== undefined) payload.start_time = startTime;

  const endTime = optionalString(flags, ['end-time']);
  if (endTime !== undefined) payload.end_time = endTime;

  const startTimeLocal = optionalString(flags, ['start-time-local', 'start-local']);
  if (startTimeLocal !== undefined) payload.start_time_local = startTimeLocal;

  const endTimeLocal = optionalString(flags, ['end-time-local', 'end-local']);
  if (endTimeLocal !== undefined) payload.end_time_local = endTimeLocal;

  const clientTimezone = optionalString(flags, ['client-timezone', 'timezone', 'tz']);
  if (clientTimezone !== undefined) payload.client_timezone = clientTimezone;

  const dueDate = optionalString(flags, ['due-date', 'due']);
  if (dueDate !== undefined) payload.due_date = dueDate;

  const allDay = optionalBool(flags, ['all-day']);
  if (allDay !== undefined) payload.all_day = allDay;

  const categoryIDs = parseIDList(firstFlag(flags, ['category-ids', 'categories']));
  if (categoryIDs !== undefined) payload.category_ids = categoryIDs;

  const recurrenceRule = parseJSONFlag(optionalString(flags, ['recurrence-rule']), 'recurrence-rule');
  if (recurrenceRule !== undefined) payload.recurrence_rule = recurrenceRule;

  const recurrenceEndDate = optionalString(flags, ['recurrence-end-date']);
  if (recurrenceEndDate !== undefined) payload.recurrence_end_date = recurrenceEndDate;

  const instanceID = optionalString(flags, ['instance-id']);
  if (instanceID !== undefined) payload.instance_id = instanceID;

  const occurrenceDate = optionalString(flags, ['occurrence-date']);
  if (occurrenceDate !== undefined) payload.occurrence_date = occurrenceDate;

  return payload;
}

function buildMutationHeaders(flags, source) {
  const headers = {};
  const ifMatch = optionalString(flags, ['if-match', 'revision']);
  if (ifMatch) headers['If-Match'] = ifMatch;
  headers['X-Client-Submitted-At'] = new Date().toISOString();
  headers['X-Client-Submit-Source'] = source;
  headers['X-Client-Op-Id'] = optionalString(flags, ['client-op-id', 'op-id']) || randomUUID();
  return headers;
}

function buildNotifySettingPayload(flags) {
  const payload = {
    channel: requireValue(flags, ['channel']),
    config: parseJSONFlag(requireValue(flags, ['config']), 'config'),
  };
  const isDefault = optionalBool(flags, ['default']);
  if (isDefault !== undefined) payload.is_default = isDefault;
  return payload;
}

function buildQuery(flags, names) {
  const query = {};
  for (const [key, aliases] of Object.entries(names)) {
    const value = optionalString(flags, aliases);
    if (value !== undefined) query[key] = value;
  }
  return query;
}

function addQueryParams(url, query = {}) {
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
}

async function apiRequest(ctx, method, path, { query, data, headers = {}, auth = true, autoRefresh = true } = {}) {
  if (flagEnabled(ctx.flags, ['dry-run'])) {
    return {
      dry_run: true,
      request: {
        method,
        path,
        query: query || {},
        data: data || null,
        headers,
      },
    };
  }

  const url = new URL(`${ctx.apiBase}${path.startsWith('/') ? path : `/${path}`}`);
  addQueryParams(url, query);

  const requestHeaders = { ...headers };
  if (data !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (auth) {
    if (!ctx.token) throw new CliError('missing auth token; run `todo-cli auth login` or set TODO_TOKEN');
    requestHeaders.Authorization = `Bearer ${ctx.token}`;
  }

  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs);
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: data === undefined ? undefined : JSON.stringify(data),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new CliError(timeoutMessage(ctx), 2);
    throw new CliError(`cannot connect to ${ctx.serverBase}: ${err.message}. ${connectionHint(ctx)}`, 2);
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const detail = typeof body === 'object' && body?.error ? body.error : text || response.statusText;
    if (response.status === 401 && auth && autoRefresh && path !== '/auth/refresh' && ctx.token) {
      const shouldSaveRefresh = ctx.tokenSource === 'config';
      try {
        await refreshAuthToken(ctx, { save: shouldSaveRefresh });
        return apiRequest(ctx, method, path, { query, data, headers, auth, autoRefresh: false });
      } catch {
        // Keep the original endpoint error; it is more useful for callers.
      }
    }
    throw new CliError(`HTTP ${response.status}: ${detail}`, response.status >= 500 ? 2 : 1);
  }

  return body;
}

function localRange(days = 1, offsetDays = 0) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { start: start.toISOString(), end: end.toISOString() };
}

function selectFields(item, fields) {
  const out = {};
  for (const field of fields) out[field] = item?.[field];
  return out;
}

function summarizeTask(task) {
  return selectFields(task, ['id', 'title', 'status', 'priority', 'start_time', 'end_time', 'due_date', 'revision', 'updated_at']);
}

function summarizeInstance(instance) {
  return selectFields(instance, [
    'instance_id',
    'task_id',
    'title',
    'status',
    'priority',
    'start_time',
    'end_time',
    'original_date',
    'is_recurring',
  ]);
}

function filterTaskInstances(items, flags) {
  const taskID = optionalNumber(flags, ['task-id']);
  if (taskID === undefined) return items;
  return (items || []).filter((item) => Number(item?.task_id) === taskID);
}

function normalizeDateOnly(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function occurrenceDateOnly(item) {
  return normalizeDateOnly(item?.original_date || item?.occurrence_date || item?.start_time);
}

function localDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function findOccurrenceForTask(items, taskID, date) {
  const matches = (items || []).filter((item) => Number(item?.task_id) === Number(taskID));
  if (!date) return matches[0] || null;
  return matches.find((item) => occurrenceDateOnly(item) === date) || null;
}

async function listDayTasks(ctx, offsetDays = 0) {
  const tasks = await apiRequest(ctx, 'GET', '/tasks', { query: localRange(1, offsetDays) }) || [];
  if (!flagEnabled(ctx.flags, ['include-occurrences', 'occurrences'], false)) {
    return tasks.map(summarizeTask);
  }

  const date = normalizeDateOnly(optionalString(ctx.flags, ['date'])) || localDateString(offsetDays);
  const occurrences = await apiRequest(ctx, 'GET', '/tasks/next-occurrences', {
    query: buildQuery(ctx.flags, { from: ['from'] }),
  }) || [];
  const recurringInstances = occurrences
    .filter((item) => occurrenceDateOnly(item) === date)
    .map((item) => ({ ...summarizeInstance(item), source: 'occurrence' }));
  const recurringIDs = new Set(recurringInstances.map((item) => Number(item.task_id)));
  const baseTasks = tasks
    .filter((task) => !task?.recurrence_rule || !recurringIDs.has(Number(task.id)))
    .map((task) => ({ ...summarizeTask(task), source: 'series' }));
  return [...baseTasks, ...recurringInstances];
}

function summarizeCategory(category) {
  return selectFields(category, ['id', 'name', 'color', 'created_at']);
}

function summarizeEvent(event) {
  return selectFields(event, ['id', 'title', 'start', 'end', 'allDay', 'source']);
}

function truncate(value, width) {
  const text = value === undefined || value === null ? '' : String(value);
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(0, width - 1))}…`;
}

const SENSITIVE_OUTPUT_KEY = /^(?:config|token|access_token|refresh_token|bot_token|password|secret|app_secret|api_key|apikey|authorization|cookie|webhook_url|chat_id)$/i;

function sanitizeOutput(value, key = '') {
  if (SERVER_MANAGED_REMINDER_KEYS.has(key)) return undefined;
  if (SENSITIVE_OUTPUT_KEY.test(key)) return '<redacted>';
  if (typeof value === 'string' && /^data:image\//i.test(value.trim())) return '<redacted>';
  if (Array.isArray(value)) return value.map((item) => sanitizeOutput(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([childKey]) => !SERVER_MANAGED_REMINDER_KEYS.has(childKey))
      .map(([childKey, childValue]) => [childKey, sanitizeOutput(childValue, childKey)]));
  }
  return value;
}

function sanitizeErrorText(value) {
  return String(value)
    .replace(/data:image\/[^\s"'\\]+/gi, '<redacted>')
    .replace(
      /(["']?(?:config|token|access_token|refresh_token|bot_token|password|secret|app_secret|api_key|apikey|authorization|cookie|webhook_url|chat_id)["']?\s*[:=]\s*)(?:["'][^"']*["']|[^\s,}]+)/gi,
      '$1<redacted>',
    );
}

function printTable(rows) {
  if (!Array.isArray(rows)) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (rows.length === 0) {
    console.log('(empty)');
    return;
  }

  const headers = Object.keys(rows[0]);
  const widths = headers.map((header) => Math.min(32, Math.max(header.length, ...rows.map((row) => String(row[header] ?? '').length))));
  console.log(headers.map((header, index) => truncate(header, widths[index]).padEnd(widths[index])).join('  '));
  console.log(widths.map((width) => '-'.repeat(width)).join('  '));
  for (const row of rows) {
    console.log(headers.map((header, index) => truncate(row[header], widths[index]).padEnd(widths[index])).join('  '));
  }
}

function printResult(result, flags = {}) {
  const format = String(flags.format || 'json');
  if (format === 'raw' && typeof result === 'string') {
    process.stdout.write(result);
    return;
  }

  const safeResult = sanitizeOutput(result);
  if (format === 'ndjson') {
    const rows = Array.isArray(safeResult) ? safeResult : [safeResult];
    for (const row of rows) console.log(JSON.stringify(row));
    return;
  }
  if (format === 'table') {
    printTable(safeResult);
    return;
  }
  console.log(JSON.stringify(safeResult, null, 2));
}

async function makeContext(flags) {
  const config = await readConfig(flags);
  const baseURL = resolveBaseURL(flags, config);
  const authToken = resolveAuthToken(flags, config);
  return {
    flags,
    config,
    baseUrlSource: baseURL.source,
    serverBase: normalizeServerBaseURL(baseURL.value),
    apiBase: normalizeBaseURL(baseURL.value),
    token: authToken.value,
    tokenSource: authToken.source,
    timeoutMs: parseTimeoutMS(flags, config),
  };
}

async function storeAuthToken(ctx, token) {
  const next = { ...ctx.config, baseUrl: ctx.serverBase, token };
  await writeConfig(next, ctx.flags);
  ctx.config = next;
  ctx.tokenSource = 'config';
}

async function refreshAuthToken(ctx, { save = false } = {}) {
  const result = await apiRequest(ctx, 'POST', '/auth/refresh', { autoRefresh: false });
  if (result?.dry_run) return result;
  if (!result?.token) throw new CliError('refresh response missing token');
  ctx.token = String(result.token);
  if (save) {
    await storeAuthToken(ctx, ctx.token);
  } else {
    ctx.tokenSource = 'refresh';
  }
  return result;
}

async function checkHealth(ctx) {
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ctx.timeoutMs);
  try {
    response = await fetch(`${ctx.serverBase}/health`, { signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw new CliError(timeoutMessage(ctx), 2);
    throw new CliError(`cannot connect to ${ctx.serverBase}: ${err.message}. ${connectionHint(ctx)}`, 2);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new CliError(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

async function handleInit(ctx) {
  const baseURL = optionalString(ctx.flags, ['base-url', 'url']);
  if (!baseURL) {
    throw new CliError('init requires --base-url URL, for example `todo-cli init --base-url https://your-todo-server.example.com`');
  }

  const serverBase = normalizeServerBaseURL(baseURL);
  const initCtx = {
    ...ctx,
    serverBase,
    apiBase: normalizeBaseURL(serverBase),
    baseUrlSource: 'flag',
    token: '',
  };

  let health = null;
  const shouldCheck = flagEnabled(ctx.flags, ['check'], true);
  const shouldSave = flagEnabled(ctx.flags, ['save'], true);
  if (shouldCheck) {
    health = await checkHealth(initCtx);
  }

  const next = { ...ctx.config, baseUrl: serverBase };
  const token = optionalString(ctx.flags, ['token']);
  if (token !== undefined) next.token = token;

  const username = optionalString(ctx.flags, ['username']);
  const password = optionalString(ctx.flags, ['password']);
  let user = null;
  if (username !== undefined || password !== undefined) {
    if (!username || !password) throw new CliError('login during init requires both --username and --password');
    const result = await apiRequest(initCtx, 'POST', '/auth/login', {
      auth: false,
      data: { username, password },
    });
    next.token = result.token;
    next.user = result.user;
    user = result.user;
  }

  if (shouldSave) {
    await writeConfig(next, ctx.flags);
  }

  return {
    ok: true,
    path: getConfigPath(ctx.flags),
    baseUrl: serverBase,
    checked: shouldCheck,
    health,
    authenticated: Boolean(next.token),
    user,
    saved: shouldSave,
  };
}

async function handleConfig(ctx, args) {
  const action = args[0] || 'show';
  if (action === 'show') {
    return {
      path: getConfigPath(ctx.flags),
      baseUrl: ctx.config.baseUrl || null,
      effectiveBaseUrl: ctx.serverBase,
      effectiveBaseUrlSource: ctx.baseUrlSource,
      defaultBaseUrl: DEFAULT_BASE_URL,
      hasToken: Boolean(ctx.config.token),
      user: ctx.config.user || null,
    };
  }
  if (action === 'set') {
    const next = { ...ctx.config };
    const baseURL = optionalString(ctx.flags, ['base-url']);
    if (baseURL !== undefined) next.baseUrl = normalizeServerBaseURL(baseURL);
    const token = optionalString(ctx.flags, ['token']);
    if (token !== undefined) next.token = token;
    await writeConfig(next, ctx.flags);
    return { ok: true, path: getConfigPath(ctx.flags), config: { ...next, token: next.token ? '<stored>' : undefined } };
  }
  if (action === 'reset') {
    await rm(getConfigPath(ctx.flags), { force: true });
    return { ok: true, path: getConfigPath(ctx.flags) };
  }
  throw new CliError(`unknown config action: ${action}`);
}

async function handleAuth(ctx, args) {
  const action = args[0] || 'status';
  if (action === 'login') {
    const username = requireValue(ctx.flags, ['username']);
    const password = requireValue(ctx.flags, ['password']);
    const result = await apiRequest(ctx, 'POST', '/auth/login', { auth: false, data: { username, password } });
    if (flagEnabled(ctx.flags, ['save'], true)) {
      await writeConfig({ ...ctx.config, baseUrl: ctx.serverBase, token: result.token, user: result.user }, ctx.flags);
    }
    return result;
  }
  if (action === 'refresh') {
    return refreshAuthToken(ctx, { save: flagEnabled(ctx.flags, ['save'], true) });
  }
  if (action === 'register') {
    const data = {
      username: requireValue(ctx.flags, ['username']),
      email: requireValue(ctx.flags, ['email']),
      password: requireValue(ctx.flags, ['password']),
    };
    const result = await apiRequest(ctx, 'POST', '/auth/register', { auth: false, data });
    return result;
  }
  if (action === 'me' || action === 'status') {
    if (!ctx.token) return { authenticated: false, baseUrl: ctx.serverBase };
    const me = await apiRequest(ctx, 'GET', '/auth/me');
    return action === 'status' ? { authenticated: true, baseUrl: ctx.serverBase, user: me } : me;
  }
  if (action === 'logout') {
    const next = { ...ctx.config };
    delete next.token;
    delete next.user;
    await writeConfig(next, ctx.flags);
    return { ok: true };
  }
  throw new CliError(`unknown auth action: ${action}`);
}

async function handleTask(ctx, args) {
  const action = args[0] || 'list';
  const id = args[1];

  if (action === 'list') {
    const query = buildQuery(ctx.flags, {
      status: ['status'],
      category_id: ['category-id'],
      start: ['start'],
      end: ['end'],
    });
    const tasks = await apiRequest(ctx, 'GET', '/tasks', { query }) || [];
    return flagEnabled(ctx.flags, ['summary'], true) ? tasks.map(summarizeTask) : tasks;
  }
  if (action === 'get') {
    if (!id) throw new CliError('missing task id');
    return apiRequest(ctx, 'GET', `/tasks/${id}`);
  }
  if (['detail', 'show'].includes(action)) {
    if (!id) throw new CliError('missing task id');
    const scope = optionalString(ctx.flags, ['scope']) || 'auto';
    if (!['auto', 'series', 'occurrence'].includes(scope)) {
      throw new CliError('invalid --scope: expected auto, series, or occurrence');
    }
    const series = await apiRequest(ctx, 'GET', `/tasks/${id}`);
    if (scope === 'series' || !series?.recurrence_rule) {
      return {
        source: 'series',
        effective: series,
        series,
        occurrence: null,
      };
    }

    const query = buildQuery(ctx.flags, { from: ['from'] });
    const requestedDate = normalizeDateOnly(optionalString(ctx.flags, ['date', 'occurrence-date']));
    const occurrences = await apiRequest(ctx, 'GET', '/tasks/next-occurrences', { query }) || [];
    const occurrence = findOccurrenceForTask(occurrences, id, requestedDate);
    if (occurrence) {
      return {
        source: 'occurrence',
        effective: occurrence,
        series,
        occurrence,
      };
    }
    if (scope === 'occurrence') {
      return {
        source: 'none',
        effective: null,
        series,
        occurrence: null,
        warning: requestedDate
          ? `no next occurrence found for task ${id} on ${requestedDate}`
          : `no next occurrence found for task ${id}`,
      };
    }
    return {
      source: 'series',
      effective: series,
      series,
      occurrence: null,
      warning: requestedDate
        ? `no next occurrence found for task ${id} on ${requestedDate}; fell back to series task`
        : `no next occurrence found for task ${id}; fell back to series task`,
    };
  }
  if (action === 'create' || action === '+add') {
    const payload = await buildTaskPayload(ctx.flags);
    return apiRequest(ctx, 'POST', '/tasks', {
      data: payload,
      headers: buildMutationHeaders(ctx.flags, 'cli.task.create'),
    });
  }
  if (action === 'update') {
    if (!id) throw new CliError('missing task id');
    const payload = await buildTaskPayload(ctx.flags, { partial: true });
    return apiRequest(ctx, 'PUT', `/tasks/${id}`, {
      data: payload,
      headers: buildMutationHeaders(ctx.flags, 'cli.task.update'),
    });
  }
  if (['complete', '+done'].includes(action)) {
    if (!id) throw new CliError('missing task id');
    return apiRequest(ctx, 'PATCH', `/tasks/${id}/status`, {
      data: { status: 'completed' },
      headers: buildMutationHeaders(ctx.flags, 'cli.task.status'),
    });
  }
  if (['pending', 'reopen'].includes(action)) {
    if (!id) throw new CliError('missing task id');
    return apiRequest(ctx, 'PATCH', `/tasks/${id}/status`, {
      data: { status: 'pending' },
      headers: buildMutationHeaders(ctx.flags, 'cli.task.status'),
    });
  }
  if (action === 'cancel') {
    if (!id) throw new CliError('missing task id');
    return apiRequest(ctx, 'PATCH', `/tasks/${id}/status`, {
      data: { status: 'cancelled' },
      headers: buildMutationHeaders(ctx.flags, 'cli.task.status'),
    });
  }
  if (action === 'skip') {
    if (!id) throw new CliError('missing task id');
    return apiRequest(ctx, 'PATCH', `/tasks/${id}/status`, {
      data: { status: 'skipped' },
      headers: buildMutationHeaders(ctx.flags, 'cli.task.status'),
    });
  }
  if (action === 'schedule') {
    if (!id) throw new CliError('missing task id');
    const payload = await buildTaskPayload(ctx.flags, { partial: true });
    return apiRequest(ctx, 'PATCH', `/tasks/${id}/schedule`, {
      data: payload,
      headers: buildMutationHeaders(ctx.flags, 'cli.task.schedule'),
    });
  }
  if (action === 'delete') {
    if (!id) throw new CliError('missing task id');
    if (!flagEnabled(ctx.flags, ['yes']) && !flagEnabled(ctx.flags, ['dry-run'])) throw new CliError('delete requires --yes');
    return apiRequest(ctx, 'DELETE', `/tasks/${id}`, {
      headers: buildMutationHeaders(ctx.flags, 'cli.task.delete'),
    });
  }
  if (action === 'activities') {
    if (!id) throw new CliError('missing task id');
    return apiRequest(ctx, 'GET', `/tasks/${id}/activities`, {
      query: buildQuery(ctx.flags, { limit: ['limit'], cursor: ['cursor'] }),
    });
  }
  if (['next-occurrences', 'next-instances'].includes(action)) {
    const items = await apiRequest(ctx, 'GET', '/tasks/next-occurrences', {
      query: buildQuery(ctx.flags, { from: ['from'] }),
    }) || [];
    return filterTaskInstances(items, ctx.flags);
  }
  if (['occurrences', 'instances'].includes(action)) {
    const body = await apiRequest(ctx, 'GET', '/tasks/occurrences', {
      query: buildQuery(ctx.flags, {
        status: ['status'],
        limit: ['limit'],
        cursor: ['cursor'],
      }),
    }) || { items: [] };
    return {
      ...body,
      items: filterTaskInstances(body.items || [], ctx.flags),
    };
  }
  if (action === '+today' || action === 'today') {
    return listDayTasks(ctx, 0);
  }
  if (action === '+tomorrow' || action === 'tomorrow') {
    return listDayTasks(ctx, 1);
  }
  if (action === '+inbox') {
    const tasks = await apiRequest(ctx, 'GET', '/tasks', { query: { status: 'pending' } }) || [];
    return tasks.filter((task) => !task.start_time && !task.due_date).map(summarizeTask);
  }

  throw new CliError(`unknown task action: ${action}`);
}

async function handleCategory(ctx, args) {
  const action = args[0] || 'list';
  const id = args[1];

  if (action === 'list') {
    const categories = await apiRequest(ctx, 'GET', '/categories') || [];
    return categories.map(summarizeCategory);
  }
  if (action === 'get') {
    if (!id) throw new CliError('missing category id');
    return apiRequest(ctx, 'GET', `/categories/${id}`);
  }
  if (action === 'create') {
    return apiRequest(ctx, 'POST', '/categories', {
      data: {
        name: requireValue(ctx.flags, ['name']),
        color: optionalString(ctx.flags, ['color']) || '#3b82f6',
      },
    });
  }
  if (action === 'update') {
    if (!id) throw new CliError('missing category id');
    const data = {};
    const name = optionalString(ctx.flags, ['name']);
    if (name !== undefined) data.name = name;
    const color = optionalString(ctx.flags, ['color']);
    if (color !== undefined) data.color = color;
    return apiRequest(ctx, 'PUT', `/categories/${id}`, { data });
  }
  if (action === 'delete') {
    if (!id) throw new CliError('missing category id');
    if (!flagEnabled(ctx.flags, ['yes']) && !flagEnabled(ctx.flags, ['dry-run'])) throw new CliError('delete requires --yes');
    return apiRequest(ctx, 'DELETE', `/categories/${id}`);
  }
  throw new CliError(`unknown category action: ${action}`);
}

async function handleNotify(ctx, args) {
  const action = args[0] || 'settings';
  const id = args[1];

  if (['settings', 'list'].includes(action)) {
    return apiRequest(ctx, 'GET', '/notify/settings');
  }
  if (action === 'channels') {
    return apiRequest(ctx, 'GET', '/notify/channels');
  }
  if (['create-setting', 'create'].includes(action)) {
    return apiRequest(ctx, 'POST', '/notify/settings', {
      data: buildNotifySettingPayload(ctx.flags),
      headers: buildMutationHeaders(ctx.flags, 'cli.notify.create-setting'),
    });
  }
  if (['default', 'set-default'].includes(action)) {
    if (!id) throw new CliError('missing notify setting id');
    return apiRequest(ctx, 'PATCH', `/notify/settings/${id}/default`, {
      headers: buildMutationHeaders(ctx.flags, 'cli.notify.default'),
    });
  }
  if (action === 'delete') {
    if (!id) throw new CliError('missing notify setting id');
    if (!flagEnabled(ctx.flags, ['yes']) && !flagEnabled(ctx.flags, ['dry-run'])) throw new CliError('delete requires --yes');
    return apiRequest(ctx, 'DELETE', `/notify/settings/${id}`);
  }
  if (action === 'test') {
    return apiRequest(ctx, 'POST', '/notify/test', {
      data: buildNotifySettingPayload(ctx.flags),
      headers: buildMutationHeaders(ctx.flags, 'cli.notify.test'),
    });
  }
  throw new CliError(`unknown notify action: ${action}`);
}

async function handleCalendar(ctx, args) {
  const action = args[0] || 'events';
  if (action === 'events') {
    const query = buildQuery(ctx.flags, { start: ['start'], end: ['end'] });
    if (!query.start || !query.end) throw new CliError('calendar events requires --start and --end');
    const events = await apiRequest(ctx, 'GET', '/calendar', { query }) || [];
    return flagEnabled(ctx.flags, ['summary'], true) ? events.map(summarizeEvent) : events;
  }
  if (action === '+agenda') {
    const days = optionalNumber(ctx.flags, ['days']) || 1;
    const events = await apiRequest(ctx, 'GET', '/calendar', { query: localRange(days, 0) }) || [];
    return events.map(summarizeEvent);
  }
  throw new CliError(`unknown calendar action: ${action}`);
}

async function handleRawAPI(ctx, args) {
  const method = String(args[0] || 'GET').toUpperCase();
  const path = args[1];
  if (!path) throw new CliError('api requires METHOD and PATH');
  const data = await parseJSONInput(ctx.flags, ['data', 'body'], ['data-file', 'body-file'], 'data');
  const query = await parseJSONInput(ctx.flags, ['query'], ['query-file'], 'query') || {};
  return apiRequest(ctx, method, path, { data, query, auth: flagEnabled(ctx.flags, ['auth'], true) });
}

async function handleHealth(ctx) {
  return checkHealth(ctx);
}

async function handleDoctor(ctx) {
  const report = {
    ok: false,
    ready: false,
    configPath: getConfigPath(ctx.flags),
    baseUrl: ctx.serverBase,
    baseUrlSource: ctx.baseUrlSource,
    defaultBaseUrl: DEFAULT_BASE_URL,
    server: {
      ok: false,
      health: null,
      error: null,
    },
    auth: {
      configured: Boolean(ctx.token),
      ok: false,
      user: null,
      error: null,
    },
    recommendations: [],
  };

  if (ctx.baseUrlSource === 'default') {
    report.recommendations.push(`Configure your server with: todo-cli init --base-url https://your-todo-server.example.com`);
  }

  try {
    report.server.health = await checkHealth(ctx);
    report.server.ok = true;
  } catch (err) {
    report.server.error = err.message;
    report.recommendations.push(connectionHint(ctx));
  }

  if (!ctx.token) {
    report.recommendations.push('Login with `todo-cli auth login --username USER --password PASS` or set TODO_TOKEN.');
  } else if (report.server.ok) {
    try {
      report.auth.user = await apiRequest(ctx, 'GET', '/auth/me');
      report.auth.ok = true;
    } catch (err) {
      report.auth.error = err.message;
      report.recommendations.push('Refresh credentials with `todo-cli auth refresh`, or login again with `todo-cli auth login --username USER --password PASS` if the refresh window expired.');
    }
  }

  report.ok = report.server.ok;
  report.ready = report.server.ok && report.auth.ok;
  return report;
}

function resolveSkillTargetDir(flags) {
  const explicit = optionalString(flags, ['target-dir']);
  if (explicit !== undefined) return explicit;
  const target = optionalString(flags, ['target']);
  if (!target) return undefined;
  if (target === 'minis') return '/var/minis/skills';
  if (target === 'codex') return join(homedir(), '.codex', 'skills');
  if (target === 'claude') return join(homedir(), '.claude', 'skills');
  throw new CliError('invalid --target: expected minis, codex, or claude');
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

async function bundledSkillVersion() {
  const content = await readFile(BUNDLED_SKILL_PATH, 'utf8');
  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const match = frontmatter?.[1].match(/^(?:version| {2}version):\s*["']?([^\s"']+)/m);
  return match?.[1] || null;
}

async function handleSkill(ctx, args) {
  const action = args[0] || 'doctor';
  const skillVersion = await bundledSkillVersion();
  const targetDir = resolveSkillTargetDir(ctx.flags);
  const targetPath = targetDir ? join(targetDir, 'todo-cli') : null;

  if (action === 'path') {
    return { path: BUNDLED_SKILL_PATH, version: skillVersion };
  }
  if (action === 'doctor') {
    const targetReady = targetPath ? await pathExists(join(targetPath, 'SKILL.md')) : null;
    return {
      ok: Boolean(skillVersion) && skillVersion === CLI_VERSION && targetReady !== false,
      cli_version: CLI_VERSION,
      skill_version: skillVersion,
      version_match: skillVersion === CLI_VERSION,
      skill_path: BUNDLED_SKILL_PATH,
      target_path: targetPath,
      target_ready: targetReady,
    };
  }
  if (action === 'install') {
    if (!targetDir || !targetPath) {
      throw new CliError('skill install requires --target minis|codex|claude or --target-dir PATH');
    }
    await mkdir(targetDir, { recursive: true });
    let backup = null;
    if (await pathExists(targetPath)) {
      if (!ctx.flags.force) {
        throw new CliError(`skill target already exists: ${targetPath}`);
      }
      backup = `${targetPath}.backup-${Date.now()}`;
      await rename(targetPath, backup);
    }
    await symlink(dirname(BUNDLED_SKILL_PATH), targetPath, 'dir');
    return {
      ok: true,
      installed: true,
      cli_version: CLI_VERSION,
      skill_version: skillVersion,
      source: dirname(BUNDLED_SKILL_PATH),
      target: targetPath,
      backup,
      new_session_required: true,
    };
  }
  throw new CliError(`unknown skill action: ${action}`);
}

function help(topic = []) {
  const [resource, action] = topic;
  if (resource === 'task') return taskHelp(action);
  if (resource === 'auth') return authHelp();
  if (resource === 'category') return categoryHelp();
  if (resource === 'calendar') return calendarHelp();
  if (resource === 'notify') return notifyHelp();
  if (resource === 'config') return configHelp();
  if (resource === 'api') return apiHelp();
  if (resource === 'recurrence') return recurrenceHelp();
  if (resource === 'skill' || resource === 'skills') return skillHelp();

  return `todo-cli - HTTP CLI for the Todo app

Usage:
  todo-cli [global options] <resource> <action> [args] [options]

Global options:
  --version            Print the CLI/Skill compatibility version
  --base-url URL       Server URL. Defaults to ${DEFAULT_BASE_URL} for local development.
  --token TOKEN        Auth token, or set TODO_TOKEN
  --config PATH        Config path, default ~/.todo-cli/config.json
  --format json|table|ndjson
  --dry-run            Print request without sending it
  --timeout-ms MS      HTTP timeout, default ${DEFAULT_TIMEOUT_MS}

Tips:
  Run Todo operations with the installed todo-cli binary.
  Avoid npx fallbacks for normal commands because they may run a different published version.
  Use --help after a resource for focused help, e.g. todo-cli task --help or todo-cli calendar --help.

First run:
  todo-cli init --base-url https://your-todo-server.example.com
  todo-cli init --base-url https://your-todo-server.example.com --username u --password secret123
  todo-cli doctor
  todo-cli config set --base-url https://your-todo-server.example.com

Auth:
  todo-cli auth register --username u --email u@example.com --password secret123
  todo-cli auth login --username u --password secret123
  todo-cli auth refresh
  todo-cli auth status
  todo-cli auth logout

Tasks:
  todo-cli task list --status pending --format table
  todo-cli task get <id>
  todo-cli task detail <id>
  todo-cli task today --include-occurrences
  todo-cli task create --title "Ship CLI" --description "notes" --priority high
  todo-cli task update <id> --title "New title" --if-match <revision>
  todo-cli task update <id> --description-file ./notes.md --if-match <revision>
  todo-cli task complete <id>
  todo-cli task pending <id>
  todo-cli task skip <id>
  todo-cli task cancel <id>
  todo-cli task next-occurrences --task-id <id>
  todo-cli task delete <id> --yes
  todo-cli task +today --format table
  todo-cli task +inbox --format table
  todo-cli +add --title "Quick task"

Categories:
  todo-cli category list --format table
  todo-cli category create --name Work --color '#2563eb'
  todo-cli category update <id> --name Personal
  todo-cli category delete <id> --yes

Calendar:
  todo-cli calendar events --start 2026-05-11T00:00:00+08:00 --end 2026-05-12T00:00:00+08:00
  todo-cli calendar +agenda --days 7 --format table

Delivery channels:
  todo-cli notify settings
  todo-cli notify channels
  todo-cli notify create-setting --channel ntfy --config '{"topic":"todo"}' --default=true

Raw API:
  todo-cli api GET /tasks
  todo-cli api PATCH /tasks/1/status --data '{"status":"completed"}'
  todo-cli api PUT /tasks/42 --data-file ./payload.json
`;
}

function skillHelp() {
  return `todo-cli skill - inspect and install the bundled AI skill

Examples:
  todo-cli --version
  todo-cli skill path
  todo-cli skill doctor
  todo-cli skill doctor --target minis
  todo-cli skill install --target minis
  todo-cli skill install --target minis --force
  todo-cli skill install --target-dir /custom/skills

Installation is explicit and creates a todo-cli directory symlink. Use --force to move an existing target
to a timestamped backup before installing the symlink.
Start a new agent session after installation so the host can refresh its skill index.
`;
}

function taskHelp(action) {
  if (action === 'list') {
    return `todo-cli task list - list tasks

Examples:
  todo-cli task list --status pending --format table
  todo-cli task list --category-id 3
  todo-cli task list --start 2026-05-11T00:00:00+08:00 --end 2026-05-12T00:00:00+08:00
  todo-cli task list --summary=false
  todo-cli task today --include-occurrences

Filters:
  --status pending|completed|cancelled|skipped
  --category-id ID
  --start RFC3339
  --end RFC3339
  --summary=false     Return full task records instead of compact rows
  --include-occurrences Include recurring instances for today/tomorrow shortcuts
`;
  }

  if (['detail', 'show', 'get'].includes(action)) {
    return `todo-cli task detail - read the effective task detail shown to users

Examples:
  todo-cli task detail 42
  todo-cli task detail 42 --date 2026-05-11
  todo-cli task detail 42 --scope occurrence
  todo-cli task detail 42 --scope series
  todo-cli task get 42

How to choose:
  task detail is the default for "today/current/calendar/task detail" questions.
  For recurring tasks, task detail returns the next visible occurrence when one exists.
  task get reads the series task body only.
  Use task today --include-occurrences before detail when the user has not provided an id.

Options:
  --scope auto|series|occurrence       Default auto
  --date YYYY-MM-DD                    Prefer this occurrence date
  --from RFC3339                       Anchor used by next-occurrences
`;
  }

  if (['create', '+add', 'update', 'schedule'].includes(action)) {
    return `todo-cli task ${action || 'create'} - create or update a task

Examples:
  todo-cli task create --title "当日复盘" --start-time-local "2026-05-11T20:30:00" --timezone Asia/Shanghai
  todo-cli task create --title "当日复盘" --start-time-local "2026-05-11T20:30:00" --timezone Asia/Shanghai --recurrence-rule '{"freq":"weekly","interval":1,"byday":["MO","TU","WE","TH","FR"]}'
  todo-cli task create --title "全天任务" --due-date 2026-05-11 --all-day=true
  todo-cli task update 42 --title "New title" --if-match 3
  todo-cli task update 42 --description-file ./daily-review.md --if-match 3
  todo-cli task update 42 --description-file ./daily-review.md --occurrence-date 2026-05-11 --if-match 3
  todo-cli task schedule 42 --start-time-local "2026-05-11T14:00:00" --timezone Asia/Shanghai

Task fields:
  --title TEXT                         Required for create
  --description TEXT, --desc TEXT
  --description-file PATH, --desc-file PATH
  --priority low|medium|high           Maps to -1|0|1
  --status pending|completed|cancelled|skipped
  --start-time RFC3339                 Absolute timestamp
  --end-time RFC3339
  --start-time-local YYYY-MM-DDTHH:mm  Local wall time, pair with --timezone
  --end-time-local YYYY-MM-DDTHH:mm
  --timezone TZ                        Example: Asia/Shanghai
  --due-date YYYY-MM-DD
  --all-day=true|false
  --category-ids 1,2
  --recurrence-rule JSON               {"freq":"weekly","interval":1,"byday":["MO"]}
  --recurrence-end-date YYYY-MM-DD
  --occurrence-date YYYY-MM-DD          Update one recurring occurrence
  --if-match REVISION                  Update guard
  --client-op-id ID                    Idempotency/debug id

Recurring occurrence checks:
  If a recurring task detail is opened from calendar/today/next occurrence views, verify that instance too:
    todo-cli task next-occurrences --task-id 42
  To update just the displayed occurrence:
    todo-cli task update 42 --description-file ./daily-review.md --occurrence-date 2026-05-11 --if-match 3
`;
  }

  if (['complete', 'pending', 'reopen', 'cancel', 'skip'].includes(action)) {
    return `todo-cli task status - update task status

Examples:
  todo-cli task complete 42
  todo-cli task pending 42
  todo-cli task skip 42
  todo-cli task cancel 42

Safety:
  Status updates send mutation metadata automatically.
  Use --if-match REVISION only with task update/schedule payload changes.
`;
  }

  if (action === 'delete') {
    return `todo-cli task delete - delete a task

Examples:
  todo-cli task delete 42 --dry-run
  todo-cli task delete 42 --yes

Safety:
  Deleting requires --yes unless --dry-run is present.
`;
  }

  return `todo-cli task - task commands

Examples:
  todo-cli task list --status pending --format table
  todo-cli task get <id>
  todo-cli task create --title "Ship CLI"
  todo-cli task update <id> --title "New title" --if-match <revision>
  todo-cli task update <id> --description-file ./notes.md --if-match <revision>
  todo-cli task complete <id>
  todo-cli task schedule <id> --start-time-local "2026-05-11T14:00:00" --timezone Asia/Shanghai
  todo-cli task next-occurrences --task-id <id>
  todo-cli task delete <id> --yes
`;
}

function authHelp() {
  return `todo-cli auth - authentication and user profile

Examples:
  todo-cli auth register --username alice --email alice@example.com --password secret123
  todo-cli auth login --username alice --password secret123
  todo-cli auth login --username alice --password secret123 --no-save
  todo-cli auth refresh
  todo-cli auth refresh --no-save
  todo-cli auth status
  todo-cli auth me
  todo-cli auth logout

Notes:
  Login stores token and user in ~/.todo-cli/config.json unless --no-save is passed.
  auth refresh exchanges the stored or TODO_TOKEN bearer token for a new token and saves it unless --no-save is passed.
  auth me includes the account timezone used to interpret local task times.
`;
}

function categoryHelp() {
  return `todo-cli category - manage task categories

Examples:
  todo-cli category list --format table
  todo-cli category get 1
  todo-cli category create --name Work --color '#2563eb'
  todo-cli category update 1 --name Personal --color '#16a34a'
  todo-cli category delete 1 --dry-run
  todo-cli category delete 1 --yes

Notes:
  Use category IDs with task commands via --category-ids 1,2 or --category-id 1.
  Deleting requires --yes unless --dry-run is present.
`;
}

function calendarHelp() {
  return `todo-cli calendar - inspect calendar events

Examples:
  todo-cli calendar +agenda --days 7 --format table
  todo-cli calendar events --start 2026-05-11T00:00:00+08:00 --end 2026-05-12T00:00:00+08:00
  todo-cli calendar events --start 2026-05-11T00:00:00+08:00 --end 2026-05-12T00:00:00+08:00 --summary=false

Notes:
  calendar events requires --start and --end.
  Use RFC3339 timestamps with timezone offsets for predictable boundaries.
`;
}

function notifyHelp() {
  return `todo-cli notify - notification delivery settings

Examples:
  todo-cli notify settings
  todo-cli notify channels
  todo-cli notify create-setting --channel ntfy --config '{"topic":"todo"}' --default=true
  todo-cli notify create-setting --channel webhook --config '{"url":"https://example.com/hook"}'
  todo-cli notify default <setting-id>
  todo-cli notify test --channel ntfy --config '{"topic":"todo"}'

Notes:
  Delivery settings select and configure notification channels.
  Credentials are redacted from command output.
`;
}

function configHelp() {
  return `todo-cli config - inspect or edit CLI configuration

Examples:
  todo-cli config show
  todo-cli config set --base-url https://your-todo-server.example.com
  todo-cli config set --token TOKEN
  todo-cli config reset

Precedence:
  --base-url URL > TODO_BASE_URL > config file > ${DEFAULT_BASE_URL}
  --token TOKEN > TODO_TOKEN > config file
`;
}

function apiHelp() {
  return `todo-cli api - raw HTTP API escape hatch

Examples:
  todo-cli api GET /tasks
  todo-cli api PATCH /tasks/42/status --data '{"status":"completed"}'
  todo-cli api PUT /tasks/42 --data-file ./payload.json
  todo-cli api GET /calendar --query '{"start":"2026-05-11T00:00:00+08:00","end":"2026-05-12T00:00:00+08:00"}'
  todo-cli api GET /calendar --query-file ./query.json
  todo-cli api GET /auth/me

Options:
  --data JSON
  --data-file PATH
  --query JSON
  --query-file PATH
  --auth=false       Skip bearer token for public endpoints

Prefer wrapped commands first. Use api only when no resource command exists.
`;
}

function recurrenceHelp() {
  return `todo-cli recurrence - recurrence-rule JSON examples

Weekly weekdays:
  --recurrence-rule '{"freq":"weekly","interval":1,"byday":["MO","TU","WE","TH","FR"]}'

Daily:
  --recurrence-rule '{"freq":"daily","interval":1}'

Monthly:
  --recurrence-rule '{"freq":"monthly","interval":1}'

Yearly:
  --recurrence-rule '{"freq":"yearly","interval":1}'

Use --recurrence-end-date YYYY-MM-DD to stop a series.
Use --start-time-local with --timezone for human wall-clock recurrence creation.
`;
}

async function dispatch() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  if (flags.version) {
    console.log(CLI_VERSION);
    return;
  }
  if (flags.help || flags.h || positionals.length === 0) {
    console.log(help(positionals));
    return;
  }

  const ctx = await makeContext(flags);
  let [resource, ...args] = positionals;

  if (resource === '+add') {
    resource = 'task';
    args = ['+add', ...args];
  } else if (resource === '+today' || resource === '+inbox' || resource === '+tomorrow') {
    args = [resource, ...args];
    resource = 'task';
  } else if (resource === '+agenda') {
    args = [resource, ...args];
    resource = 'calendar';
  }

  const aliases = {
    tasks: 'task',
    categories: 'category',
    cat: 'category',
    cal: 'calendar',
    notifications: 'notify',
    notification: 'notify',
    skills: 'skill',
  };
  resource = aliases[resource] || resource;

  let result;
  if (resource === 'init') result = await handleInit(ctx);
  else if (resource === 'config') result = await handleConfig(ctx, args);
  else if (resource === 'auth') result = await handleAuth(ctx, args);
  else if (resource === 'task') result = await handleTask(ctx, args);
  else if (resource === 'category') result = await handleCategory(ctx, args);
  else if (resource === 'notify') result = await handleNotify(ctx, args);
  else if (resource === 'calendar') result = await handleCalendar(ctx, args);
  else if (resource === 'api') result = await handleRawAPI(ctx, args);
  else if (resource === 'health') result = await handleHealth(ctx);
  else if (resource === 'doctor') result = await handleDoctor(ctx);
  else if (resource === 'skill') result = await handleSkill(ctx, args);
  else throw new CliError(`unknown resource: ${resource}`);

  printResult(result, flags);
}

dispatch().catch((err) => {
  const message = err instanceof CliError ? err.message : err?.stack || err?.message || String(err);
  console.error(sanitizeErrorText(message));
  process.exitCode = err instanceof CliError ? err.code : 1;
});
