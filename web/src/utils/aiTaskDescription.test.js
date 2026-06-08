import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CONFIG_STORAGE_KEY,
  AI_PROTOCOL_A,
  AI_PROTOCOL_ANTHROPIC,
  AI_PROTOCOL_OPENAI,
  normalizeAIConfig,
} from './aiConfig.js';
import {
  buildTaskDescriptionPrompt,
  cleanGeneratedTaskDescription,
  generateAIResponse,
  summarizeTaskForAI,
} from './aiTaskDescription.js';

test('normalizeAIConfig keeps task context enabled by default', () => {
  const config = normalizeAIConfig({ protocol: AI_PROTOCOL_ANTHROPIC, modelID: 'claude-3-5-sonnet' });

  assert.equal(config.protocol, AI_PROTOCOL_ANTHROPIC);
  assert.equal(config.baseURL, 'https://api.anthropic.com/v1');
  assert.equal(config.allowTaskContext, true);
});

test('normalizeAIConfig migrates legacy A protocol to Anthropic', () => {
  const config = normalizeAIConfig({ protocol: AI_PROTOCOL_A });

  assert.equal(config.protocol, AI_PROTOCOL_ANTHROPIC);
  assert.equal(config.baseURL, 'https://api.anthropic.com/v1');
});

test('summarizeTaskForAI produces compact task context', () => {
  const summary = summarizeTaskForAI({
    id: 12,
    title: 'Prepare report',
    priority: 1,
    status: 'pending',
    categories: [{ id: 2, name: 'Work' }],
    description: 'A'.repeat(700),
  });

  assert.equal(summary.id, 12);
  assert.equal(summary.priority, 'high');
  assert.deepEqual(summary.categories, ['Work']);
  assert.ok(summary.description.length < 700);
});

test('buildTaskDescriptionPrompt includes current task and background tasks', () => {
  const prompt = buildTaskDescriptionPrompt({
    task: { id: 1, title: '写发布说明', description: '先整理一下' },
    currentDescription: '先整理一下',
    allTasks: [
      { id: 2, title: '修复登录问题', status: 'completed' },
      { id: 1, title: '写发布说明', status: 'pending' },
    ],
    systemPrompt: 'system',
    userProfile: '我是独立开发者',
  });

  assert.match(prompt.system, /独立开发者/);
  assert.match(prompt.user, /当前任务/);
  assert.match(prompt.user, /写发布说明/);
  assert.equal(prompt.contextTasks[0].id, 1);
});

test('buildTaskDescriptionPrompt prefers current draft over stale cached task', () => {
  const prompt = buildTaskDescriptionPrompt({
    task: { id: 1, title: '明确新建品动销提升的方案设计', description: '' },
    currentDescription: '',
    allTasks: [
      { id: 1, title: '梳理待办事项', description: '我的待办事项' },
      { id: 2, title: '其他任务', status: 'pending' },
    ],
  });

  assert.equal(prompt.contextTasks[0].id, 1);
  assert.equal(prompt.contextTasks[0].title, '明确新建品动销提升的方案设计');
  assert.doesNotMatch(prompt.user, /梳理待办事项/);
});

test('cleanGeneratedTaskDescription unwraps markdown fences', () => {
  assert.equal(cleanGeneratedTaskDescription('```markdown\n- step\n```'), '- step');
  assert.equal(cleanGeneratedTaskDescription('``` markdown\n- step\n```'), '- step');
  assert.equal(cleanGeneratedTaskDescription('````md\n- step\n````'), '- step');
  assert.equal(cleanGeneratedTaskDescription('~~~markdown\n- step\n~~~'), '- step');
  assert.equal(cleanGeneratedTaskDescription('```markdown\n- streaming step'), '- streaming step');
  assert.equal(cleanGeneratedTaskDescription('```\n- unlabeled step\n```'), '- unlabeled step');
});

test('generateAIResponse preserves streamed text and emits incremental deltas', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const storedConfig = {
    protocol: AI_PROTOCOL_OPENAI,
    baseURL: 'https://ai.example.test/v1',
    apiKey: 'test-key',
    modelID: 'test-model',
  };
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify(storedConfig) : null),
    },
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://ai.example.test/v1/chat/completions');
    const payload = JSON.parse(options.body);
    assert.equal(payload.messages[0].content, 'system');
    assert.equal(payload.messages[1].content, 'user');

    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"- Token"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\n- Keep dash"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    return new Response(new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };

  try {
    const snapshots = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(snapshots, ['- Token', '- Token\n- Keep dash']);
    assert.equal(result, '- Token\n- Keep dash');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse streams OpenAI-compatible alternate delta fields without reasoning output', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify({
        protocol: AI_PROTOCOL_OPENAI,
        baseURL: 'https://ai.example.test/v1',
        apiKey: 'test-key',
        modelID: 'test-model',
      }) : null),
    },
  };
  globalThis.fetch = async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: message\ndata: {"choices":[{"delta":{"reasoning_content":"思考中"}}]}\n\n',
      'event: message\ndata: {"choices":[{"delta":{"content":"- Token"}}]}\n\n',
      'event: message\ndata: {"choices":[{"text":"\\n完成"}]}\n\n',
      'data: [DONE]\n\n',
    ];
    return new Response(new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8' },
    });
  };

  try {
    const snapshots = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(snapshots, ['- Token', '- Token\n完成']);
    assert.equal(result, '- Token\n完成');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse streams SSE lines without blank-line event separators', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify({
        protocol: AI_PROTOCOL_OPENAI,
        baseURL: 'https://ai.example.test/v1',
        apiKey: 'test-key',
        modelID: 'test-model',
      }) : null),
    },
  };
  globalThis.fetch = async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"第一段"}}]}\n',
      'data: {"choices":[{"delta":{"content":"\\n第二段"}}]}\n',
      'data: [DONE]\n',
    ];
    return new Response(new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };

  try {
    const snapshots = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(snapshots, ['第一段', '第一段\n第二段']);
    assert.equal(result, '第一段\n第二段');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse hides streamed think blocks from visible output', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify({
        protocol: AI_PROTOCOL_OPENAI,
        baseURL: 'https://ai.example.test/v1',
        apiKey: 'test-key',
        modelID: 'test-model',
      }) : null),
    },
  };
  globalThis.fetch = async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"<think>hidden"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" thoughts</think>"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"Visible"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"\\n- Item"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    return new Response(new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };

  try {
    const snapshots = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(snapshots, ['Visible', 'Visible\n- Item']);
    assert.equal(result, 'Visible\n- Item');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse streams readable bodies with non-SSE content type', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify({
        protocol: AI_PROTOCOL_OPENAI,
        baseURL: 'https://ai.example.test/v1',
        apiKey: 'test-key',
        modelID: 'test-model',
      }) : null),
    },
  };
  globalThis.fetch = async () => {
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('first'));
        controller.enqueue(encoder.encode(' second'));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
    });
  };

  try {
    const snapshots = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(snapshots, ['first', 'first second']);
    assert.equal(result, 'first second');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});
