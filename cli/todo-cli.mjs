#!/usr/bin/env node

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';

const DEFAULT_BASE_URL = 'http://127.0.0.1:8080';
const DEFAULT_CONFIG_PATH = join(homedir(), '.todo-cli', 'config.json');

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

function buildTaskPayload(flags, { partial = false } = {}) {
  const payload = {};

  const title = optionalString(flags, ['title']);
  if (title !== undefined) payload.title = title;
  if (!partial && !payload.title) throw new CliError('missing required option --title');

  const description = optionalString(flags, ['description', 'desc']);
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

async function apiRequest(ctx, method, path, { query, data, headers = {}, auth = true } = {}) {
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
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch (err) {
    throw new CliError(`cannot connect to ${ctx.serverBase}: ${err.message}. ${connectionHint(ctx)}`, 2);
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
  if (format === 'ndjson') {
    const rows = Array.isArray(result) ? result : [result];
    for (const row of rows) console.log(JSON.stringify(row));
    return;
  }
  if (format === 'table') {
    printTable(result);
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

async function makeContext(flags) {
  const config = await readConfig(flags);
  const baseURL = resolveBaseURL(flags, config);
  return {
    flags,
    config,
    baseUrlSource: baseURL.source,
    serverBase: normalizeServerBaseURL(baseURL.value),
    apiBase: normalizeBaseURL(baseURL.value),
    token: String(flags.token || process.env.TODO_TOKEN || config.token || ''),
  };
}

async function checkHealth(ctx) {
  let response;
  try {
    response = await fetch(`${ctx.serverBase}/health`);
  } catch (err) {
    throw new CliError(`cannot connect to ${ctx.serverBase}: ${err.message}. ${connectionHint(ctx)}`, 2);
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
  if (action === 'create' || action === '+add') {
    const payload = buildTaskPayload(ctx.flags);
    return apiRequest(ctx, 'POST', '/tasks', {
      data: payload,
      headers: buildMutationHeaders(ctx.flags, 'cli.task.create'),
    });
  }
  if (action === 'update') {
    if (!id) throw new CliError('missing task id');
    const payload = buildTaskPayload(ctx.flags, { partial: true });
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
  if (action === 'schedule') {
    if (!id) throw new CliError('missing task id');
    const payload = buildTaskPayload(ctx.flags, { partial: true });
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
  if (action === 'notifications') {
    if (!id) throw new CliError('missing task id');
    return apiRequest(ctx, 'GET', `/tasks/${id}/notifications`);
  }
  if (action === '+today') {
    const tasks = await apiRequest(ctx, 'GET', '/tasks', { query: localRange(1, 0) }) || [];
    return tasks.map(summarizeTask);
  }
  if (action === '+tomorrow') {
    const tasks = await apiRequest(ctx, 'GET', '/tasks', { query: localRange(1, 1) }) || [];
    return tasks.map(summarizeTask);
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
  const data = parseJSONFlag(optionalString(ctx.flags, ['data', 'body']), 'data');
  const query = parseJSONFlag(optionalString(ctx.flags, ['query']), 'query') || {};
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
      report.recommendations.push('Refresh credentials with `todo-cli auth login --username USER --password PASS`.');
    }
  }

  report.ok = report.server.ok;
  report.ready = report.server.ok && report.auth.ok;
  return report;
}

function help() {
  return `todo-cli - HTTP CLI for the Todo app

Usage:
  todo-cli [global options] <resource> <action> [args] [options]

Global options:
  --base-url URL       Server URL. Defaults to ${DEFAULT_BASE_URL} for local development.
  --token TOKEN        Auth token, or set TODO_TOKEN
  --config PATH        Config path, default ~/.todo-cli/config.json
  --format json|table|ndjson
  --dry-run            Print request without sending it

First run:
  todo-cli init --base-url https://your-todo-server.example.com
  todo-cli init --base-url https://your-todo-server.example.com --username u --password secret123
  todo-cli doctor
  todo-cli config set --base-url https://your-todo-server.example.com

Auth:
  todo-cli auth register --username u --email u@example.com --password secret123
  todo-cli auth login --username u --password secret123
  todo-cli auth status
  todo-cli auth logout

Tasks:
  todo-cli task list --status pending --format table
  todo-cli task get <id>
  todo-cli task create --title "Ship CLI" --description "notes" --priority high
  todo-cli task update <id> --title "New title" --if-match <revision>
  todo-cli task complete <id>
  todo-cli task pending <id>
  todo-cli task cancel <id>
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

Raw API:
  todo-cli api GET /tasks
  todo-cli api PATCH /tasks/1/status --data '{"status":"completed"}'
`;
}

async function dispatch() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  if (flags.help || flags.h || positionals.length === 0) {
    console.log(help());
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
  };
  resource = aliases[resource] || resource;

  let result;
  if (resource === 'init') result = await handleInit(ctx);
  else if (resource === 'config') result = await handleConfig(ctx, args);
  else if (resource === 'auth') result = await handleAuth(ctx, args);
  else if (resource === 'task') result = await handleTask(ctx, args);
  else if (resource === 'category') result = await handleCategory(ctx, args);
  else if (resource === 'calendar') result = await handleCalendar(ctx, args);
  else if (resource === 'api') result = await handleRawAPI(ctx, args);
  else if (resource === 'health') result = await handleHealth(ctx);
  else if (resource === 'doctor') result = await handleDoctor(ctx);
  else throw new CliError(`unknown resource: ${resource}`);

  printResult(result, flags);
}

dispatch().catch((err) => {
  const message = err instanceof CliError ? err.message : err?.stack || err?.message || String(err);
  console.error(message);
  process.exitCode = err instanceof CliError ? err.code : 1;
});
