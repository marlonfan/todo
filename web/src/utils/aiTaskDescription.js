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

function isLikelyStreamResponse(response) {
  if (isEventStreamResponse(response)) return true;
  return Boolean(response.body?.getReader);
}

function tryParseJSON(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isCompleteStreamPayload(value) {
  const payload = String(value || '').trim();
  if (!payload) return false;
  if (payload === '[DONE]') return true;
  if (!payload.startsWith('{') && !payload.startsWith('[')) return true;
  return tryParseJSON(payload) !== null;
}

function extractString(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(extractString).join('');
  }
  if (value && typeof value === 'object') {
    return extractString(value.text ?? value.content ?? value.value ?? '');
  }
  return '';
}

function extractOpenAITextDelta(chunk) {
  const choice = Array.isArray(chunk?.choices) ? chunk.choices[0] : null;
  const delta = choice?.delta || {};
  const message = choice?.message || {};
  const candidates = [
    delta.content,
    delta.text,
    delta.output_text,
    choice?.text,
    message.content,
    chunk?.delta,
    chunk?.content,
    chunk?.text,
    chunk?.response,
  ];
  for (const candidate of candidates) {
    const text = extractString(candidate);
    if (text) return text;
  }
  return '';
}

function extractAnthropicTextDelta(payload) {
  const candidates = [
    payload?.delta?.text,
    payload?.content_block?.text,
    payload?.message?.content,
    payload?.content,
    payload?.text,
  ];
  for (const candidate of candidates) {
    const text = extractString(candidate);
    if (text) return text;
  }
  return '';
}

function stripThinkingBlocks(value) {
  let text = String(value || '');
  text = text.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');
  const openThinkIndex = text.search(/<think\b[^>]*>/i);
  if (openThinkIndex !== -1) {
    text = text.slice(0, openThinkIndex);
  }
  return text;
}

function emitVisibleText(rawContent, visibleState, onDelta) {
  const nextVisible = stripThinkingBlocks(rawContent);
  if (nextVisible === visibleState.content) return;
  const delta = nextVisible.startsWith(visibleState.content)
    ? nextVisible.slice(visibleState.content.length)
    : nextVisible;
  visibleState.content = nextVisible;
  onDelta?.(nextVisible, delta);
}

async function readSSEStream(response, onEvent, signal) {
  const reader = response.body?.getReader?.();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let dataLines = [];

  const flush = async () => {
    if (!event && dataLines.length === 0) return;
    const currentEvent = event;
    const data = dataLines.join('\n');
    event = '';
    dataLines = [];
    await onEvent({ event: currentEvent, data }, data);
  };

  const handleLine = async (line) => {
    const nextLine = String(line || '').replace(/\r$/, '');
    if (!nextLine) {
      await flush();
      return;
    }
    if (nextLine.startsWith(':')) return;

    if (nextLine.startsWith('event:')) {
      if (dataLines.length > 0) {
        await flush();
      }
      event = nextLine.slice(6).trim();
      return;
    }

    if (nextLine.startsWith('data:')) {
      dataLines.push(nextLine.slice(5).trimStart());
      if (isCompleteStreamPayload(dataLines.join('\n'))) {
        await flush();
      }
      return;
    }

    const payload = nextLine.trim();
    if (payload === '[DONE]' || payload.startsWith('{') || payload.startsWith('[')) {
      await onEvent({ event: '', data: payload }, payload);
    }
  };

  while (true) {
    throwIfAborted(signal);
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      await handleLine(line);
      newlineIndex = buffer.indexOf('\n');
    }
  }

  buffer += decoder.decode();
  const tail = buffer.trim();
  if (tail) {
    await handleLine(tail);
  }
  await flush();
  throwIfAborted(signal);
}

async function readTextStream(response, onText, signal) {
  const reader = response.body?.getReader?.();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let content = '';
  while (true) {
    throwIfAborted(signal);
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    if (!text) continue;
    content += text;
    await onText(content, text);
  }
  const tail = decoder.decode();
  if (tail) {
    content += tail;
    await onText(content, tail);
  }
  throwIfAborted(signal);
  return content;
}

function yieldForStreamUpdate() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
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
  if (isLikelyStreamResponse(response)) {
    let content = '';
    const visibleState = { content: '' };
    if (!isEventStreamResponse(response)) {
      const rawContent = await readTextStream(response, async (next) => {
        emitVisibleText(next, visibleState, onDelta);
        await yieldForStreamUpdate();
      }, signal);
      return stripThinkingBlocks(rawContent);
    }
    await readSSEStream(response, async ({ data }, rawBlock) => {
      const payload = String(data || '').trim();
      if (!payload || payload === '[DONE]') return;
      const chunk = tryParseJSON(payload);
      const delta = chunk ? extractOpenAITextDelta(chunk) : payload || rawBlock;
      if (!delta) return;
      content += delta;
      emitVisibleText(content, visibleState, onDelta);
      await yieldForStreamUpdate();
    }, signal);
    return stripThinkingBlocks(content);
  }
  const data = await response.json();
  return stripThinkingBlocks(data?.choices?.[0]?.message?.content || '');
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
  if (isLikelyStreamResponse(response)) {
    let content = '';
    const visibleState = { content: '' };
    if (!isEventStreamResponse(response)) {
      const rawContent = await readTextStream(response, async (next) => {
        emitVisibleText(next, visibleState, onDelta);
        await yieldForStreamUpdate();
      }, signal);
      return stripThinkingBlocks(rawContent);
    }
    await readSSEStream(response, async ({ event, data }) => {
      const payload = tryParseJSON(data);
      if (event === 'error' || payload?.type === 'error') {
        throw new Error(payload?.error?.message || 'Anthropic stream error');
      }
      if (!payload) return;
      const delta = extractAnthropicTextDelta(payload);
      if (!delta) return;
      content += delta;
      emitVisibleText(content, visibleState, onDelta);
      await yieldForStreamUpdate();
    }, signal);
    return stripThinkingBlocks(content);
  }
  const data = await response.json();
  const blocks = Array.isArray(data?.content) ? data.content : [];
  return stripThinkingBlocks(blocks
    .map((block) => block?.text || '')
    .filter(Boolean)
    .join('\n'));
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

export async function generateAIResponse({
  systemPrompt = '',
  userInput = '',
  signal,
  onDelta,
} = {}) {
  const config = normalizeAIConfig(readAIConfig());
  if (!isAIConfigReady(config)) {
    const err = new Error('AI model is not configured');
    err.code = AI_CONFIG_REQUIRED_CODE;
    throw err;
  }

  const prompt = {
    system: String(systemPrompt || '').trim(),
    user: String(userInput || '').trim(),
  };

  if (!prompt.system) {
    throw new Error('System prompt is required');
  }
  if (!prompt.user) {
    throw new Error('User input is required');
  }

  return config.protocol === AI_PROTOCOL_ANTHROPIC
    ? callAnthropicCompatible(config, prompt, { signal, onDelta })
    : callOpenAICompatible(config, prompt, { signal, onDelta });
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

  const content = await generateAIResponse({
    systemPrompt: prompt.system,
    userInput: prompt.user,
    signal,
    onDelta,
  });
  return cleanGeneratedTaskDescription(content);
}

export function getSupportedAIProtocols() {
  return [AI_PROTOCOL_OPENAI, AI_PROTOCOL_ANTHROPIC];
}
