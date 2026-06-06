import {
  AI_PROTOCOL_ANTHROPIC,
  AI_PROTOCOL_OPENAI,
  isAIConfigReady,
  normalizeAIConfig,
  readAIConfig,
} from './aiConfig.js';

export const AI_CONFIG_REQUIRED_CODE = 'AI_CONFIG_REQUIRED';

const MAX_CONTEXT_TASKS = 160;
const MAX_TEXT_CHARS = 520;
const MAX_CONTEXT_JSON_CHARS = 26000;

function truncateText(value, max = MAX_TEXT_CHARS) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function normalizePriority(value) {
  const priority = Number.parseInt(value, 10);
  if (priority === 1) return 'high';
  if (priority === 0) return 'medium';
  if (priority === -1) return 'low';
  return String(value ?? '');
}

function readTaskID(task) {
  const candidates = [
    task?.task_id,
    task?.taskID,
    task?.source_task_id,
    task?.sourceTaskID,
    task?.base_task_id,
    task?.id,
  ];
  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric !== 0) return numeric;
  }
  return 0;
}

function buildCategoryLookup(categories = []) {
  const map = new Map();
  (Array.isArray(categories) ? categories : []).forEach((category) => {
    const id = Number(category?.id || 0);
    if (!id) return;
    map.set(id, String(category?.name || '').trim());
  });
  return map;
}

function readTaskCategories(task, categoryLookup) {
  if (Array.isArray(task?.categories)) {
    return task.categories
      .map((category) => String(category?.name || category?.title || '').trim())
      .filter(Boolean);
  }
  const rawIDs = task?.category_ids || task?.categoryIDs || [];
  const ids = Array.isArray(rawIDs) ? rawIDs : [rawIDs];
  return ids
    .map((id) => categoryLookup.get(Number(id || 0)) || '')
    .filter(Boolean);
}

export function summarizeTaskForAI(task, categories = []) {
  const categoryLookup = buildCategoryLookup(categories);
  return {
    id: readTaskID(task),
    title: truncateText(task?.title || ''),
    status: String(task?.status || 'pending'),
    priority: normalizePriority(task?.priority),
    categories: readTaskCategories(task, categoryLookup),
    allDay: Boolean(task?.all_day || task?.allDay),
    startTime: task?.start_time || task?.startTime || task?.due_date || task?.dueDate || '',
    endTime: task?.end_time || task?.endTime || '',
    recurrence: task?.recurrence_rule || task?.recurrenceRule || null,
    description: truncateText(task?.description || ''),
  };
}

function sortContextTasks(tasks, currentTaskID) {
  const statusWeight = { pending: 0, completed: 2, cancelled: 3, skipped: 3 };
  return [...(Array.isArray(tasks) ? tasks : [])]
    .filter((task) => task && !task.deleted_at && !task.deletedAt)
    .sort((a, b) => {
      const aID = readTaskID(a);
      const bID = readTaskID(b);
      if (currentTaskID && aID === currentTaskID) return -1;
      if (currentTaskID && bID === currentTaskID) return 1;
      const aStatus = statusWeight[String(a?.status || 'pending')] ?? 1;
      const bStatus = statusWeight[String(b?.status || 'pending')] ?? 1;
      if (aStatus !== bStatus) return aStatus - bStatus;
      const aTime = String(a?.start_time || a?.startTime || a?.due_date || a?.dueDate || a?.created_at || '');
      const bTime = String(b?.start_time || b?.startTime || b?.due_date || b?.dueDate || b?.created_at || '');
      return aTime.localeCompare(bTime);
    });
}

function mergeCurrentTaskIntoContextTasks(tasks, currentTask) {
  const currentTaskID = readTaskID(currentTask);
  if (!currentTaskID) return [currentTask, ...(Array.isArray(tasks) ? tasks : [])].filter(Boolean);

  let inserted = false;
  const merged = [];
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    if (readTaskID(task) === currentTaskID) {
      if (!inserted) {
        merged.push(currentTask);
        inserted = true;
      }
      return;
    }
    merged.push(task);
  });

  if (!inserted) {
    merged.unshift(currentTask);
  }
  return merged;
}

export function buildTaskDescriptionPrompt({
  task,
  currentDescription = '',
  allTasks = [],
  categories = [],
  systemPrompt = '',
  userProfile = '',
  language = 'zh-CN',
  allowTaskContext = true,
} = {}) {
  const descriptionValue = currentDescription !== undefined && currentDescription !== null
    ? currentDescription
    : task?.description || '';
  const currentTaskSource = {
    ...(task || {}),
    description: descriptionValue,
  };
  const currentTask = {
    ...summarizeTaskForAI(currentTaskSource, categories),
    description: truncateText(descriptionValue),
  };
  const currentTaskID = currentTask.id;
  const contextTasks = allowTaskContext
    ? sortContextTasks(mergeCurrentTaskIntoContextTasks(allTasks, currentTaskSource), currentTaskID)
      .slice(0, MAX_CONTEXT_TASKS)
      .map((item) => summarizeTaskForAI(item, categories))
    : [];
  const contextJSON = truncateText(JSON.stringify(contextTasks, null, 2), MAX_CONTEXT_JSON_CHARS);
  const system = [
    String(systemPrompt || '').trim(),
    String(userProfile || '').trim()
      ? `\n使用者人设与背景：\n${String(userProfile).trim()}`
      : '',
  ].filter(Boolean).join('\n\n');
  const user = [
    '请基于以下信息，为“当前任务”生成一版更清晰、更可执行的 Markdown 描述。',
    '',
    '要求：',
    '- 不要编造当前任务和背景中没有的业务事实。',
    '- “当前任务”是本次生成的唯一权威；如果背景任务中出现同一任务的旧标题或旧描述，以当前任务为准。',
    '- 优先输出下一步行动、检查清单、完成标准、依赖或风险。',
    '- 如果缺少关键信息，请在“待确认”中列出。',
    '- 保留用户已经写明的时间、对象、约束和交付物。',
    '- 只输出可直接放进任务描述里的正文，不要解释你的推理过程。',
    `- 输出语言：${String(language || 'zh-CN').startsWith('en') ? 'English' : '简体中文'}`,
    '',
    '当前任务：',
    JSON.stringify(currentTask, null, 2),
    '',
    allowTaskContext ? '全部任务背景（来自本地缓存，可能因长度限制被截断）：' : '全部任务背景：未启用',
    allowTaskContext ? contextJSON : '[]',
  ].join('\n');

  return { system, user, contextTasks };
}

function joinAPIURL(baseURL, path) {
  return `${String(baseURL || '').replace(/\/+$/, '')}/${String(path || '').replace(/^\/+/, '')}`;
}

async function readErrorMessage(response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.error || data?.message || response.statusText;
  } catch {
    return response.statusText;
  }
}

function createAbortError() {
  const error = new Error('AI generation aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function isEventStreamResponse(response) {
  return String(response.headers?.get?.('content-type') || '').toLowerCase().includes('text/event-stream');
}

function findSSESeparator(buffer) {
  const lfIndex = buffer.indexOf('\n\n');
  const crlfIndex = buffer.indexOf('\r\n\r\n');
  if (lfIndex === -1) return crlfIndex;
  if (crlfIndex === -1) return lfIndex;
  return Math.min(lfIndex, crlfIndex);
}

function readSSEBlock(block) {
  const lines = String(block || '').split(/\r?\n/);
  let event = '';
  const dataLines = [];
  lines.forEach((line) => {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
      return;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  });
  return {
    event,
    data: dataLines.join('\n'),
  };
}

async function readSSEStream(response, onEvent, signal) {
  const reader = response.body?.getReader?.();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    throwIfAborted(signal);
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = findSSESeparator(buffer);
    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex);
      const separatorLength = buffer.startsWith('\r\n\r\n', separatorIndex) ? 4 : 2;
      buffer = buffer.slice(separatorIndex + separatorLength);
      const event = readSSEBlock(block);
      if (event.data) {
        await onEvent(event);
      }
      separatorIndex = findSSESeparator(buffer);
    }
  }

  buffer += decoder.decode();
  const tail = buffer.trim();
  if (tail) {
    const event = readSSEBlock(tail);
    if (event.data) {
      await onEvent(event);
    }
  }
  throwIfAborted(signal);
}

async function callOpenAICompatible(config, prompt, options = {}) {
  const { signal, onDelta } = options;
  const response = await fetch(joinAPIURL(config.baseURL, 'chat/completions'), {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.modelID,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  if (isEventStreamResponse(response)) {
    let content = '';
    await readSSEStream(response, ({ data }) => {
      if (data === '[DONE]') return;
      const chunk = JSON.parse(data);
      const delta = chunk?.choices?.[0]?.delta?.content || '';
      if (!delta) return;
      content += delta;
      onDelta?.(content, delta);
    }, signal);
    return content.trim();
  }
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
}

async function callAnthropicCompatible(config, prompt, options = {}) {
  const { signal, onDelta } = options;
  const response = await fetch(joinAPIURL(config.baseURL, 'messages'), {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.modelID,
      max_tokens: 1400,
      temperature: 0.2,
      stream: true,
      system: prompt.system,
      messages: [
        { role: 'user', content: prompt.user },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  if (isEventStreamResponse(response)) {
    let content = '';
    await readSSEStream(response, ({ event, data }) => {
      const payload = JSON.parse(data);
      if (event === 'error' || payload?.type === 'error') {
        throw new Error(payload?.error?.message || 'Anthropic stream error');
      }
      const delta = payload?.delta?.text || '';
      if (!delta) return;
      content += delta;
      onDelta?.(content, delta);
    }, signal);
    return content.trim();
  }
  const data = await response.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return blocks
    .map((block) => block?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function cleanGeneratedTaskDescription(value) {
  let text = String(value || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  const lines = text.split('\n');
  const firstLine = lines[0]?.trim() || '';
  const openingFence = /^([`~]{3,})\s*([A-Za-z0-9_-]+)?[^\n]*$/i.exec(firstLine);
  if (!openingFence) return text;

  const fenceChar = openingFence[1][0];
  const minFenceLength = openingFence[1].length;
  const closingFencePattern = new RegExp(`^\\s*\\${fenceChar}{${minFenceLength},}\\s*$`);
  let closingIndex = -1;
  for (let i = lines.length - 1; i > 0; i -= 1) {
    if (closingFencePattern.test(lines[i])) {
      closingIndex = i;
      break;
    }
    if (String(lines[i] || '').trim()) {
      break;
    }
  }

  if (closingIndex > 0) {
    text = lines.slice(1, closingIndex).join('\n').trim();
    return text;
  }

  const language = String(openingFence[2] || '').toLowerCase();
  if (!language || language === 'markdown' || language === 'md') {
    text = lines.slice(1).join('\n').trim();
  }
  return text;
}

export async function generateTaskDescriptionDraft({
  task,
  currentDescription = '',
  allTasks = [],
  categories = [],
  language = 'zh-CN',
  signal,
  onDelta,
} = {}) {
  const config = normalizeAIConfig(readAIConfig());
  if (!isAIConfigReady(config)) {
    const err = new Error('AI model is not configured');
    err.code = AI_CONFIG_REQUIRED_CODE;
    throw err;
  }

  const prompt = buildTaskDescriptionPrompt({
    task,
    currentDescription,
    allTasks,
    categories,
    systemPrompt: config.systemPrompt,
    userProfile: config.userProfile,
    language,
    allowTaskContext: config.allowTaskContext,
  });

  const content = config.protocol === AI_PROTOCOL_ANTHROPIC
    ? await callAnthropicCompatible(config, prompt, { signal, onDelta })
    : await callOpenAICompatible(config, prompt, { signal, onDelta });
  return cleanGeneratedTaskDescription(content);
}

export function getSupportedAIProtocols() {
  return [AI_PROTOCOL_OPENAI, AI_PROTOCOL_ANTHROPIC];
}
