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

test('cleanGeneratedTaskDescription leaves only visible response text', () => {
  assert.equal(cleanGeneratedTaskDescription('<think>hidden thoughts</think>').trim(), '');
  assert.equal(cleanGeneratedTaskDescription('<think>hidden thoughts</think>\nVisible').trim(), 'Visible');
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
    const statuses = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onStatus: (status) => statuses.push(status),
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(statuses, ['thinking']);
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

test('generateAIResponse exposes reasoning separately from visible output', async () => {
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
      'data: {"choices":[{"delta":{"reasoning_content":"先分析"}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":"再作答"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"最终答案"},"finish_reason":"stop"}]}\n\n',
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
    const reasoningSnapshots = [];
    const answerSnapshots = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onReasoning: (content) => reasoningSnapshots.push(content),
      onDelta: (content) => answerSnapshots.push(content),
    });

    assert.deepEqual(reasoningSnapshots, ['先分析', '先分析再作答']);
    assert.deepEqual(answerSnapshots, ['最终答案']);
    assert.equal(result, '最终答案');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse reports output truncated by the model token limit', async () => {
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
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"delta":{"content":"回答到一半"},"finish_reason":"length"}]}\n\n'
        ));
        controller.close();
      },
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };

  try {
    const finishes = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onFinish: (finish) => finishes.push(finish),
    });

    assert.equal(result, '回答到一半');
    assert.deepEqual(finishes, [{ reason: 'length', incomplete: true }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse reports token truncation from a non-stream OpenAI response', async () => {
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
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{
      message: { content: '回答到一半', reasoning_content: '分析过程' },
      finish_reason: 'length',
    }],
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  try {
    const reasoningSnapshots = [];
    const finishes = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onReasoning: (content) => reasoningSnapshots.push(content),
      onFinish: (finish) => finishes.push(finish),
    });

    assert.equal(result, '回答到一半');
    assert.deepEqual(reasoningSnapshots, ['分析过程']);
    assert.deepEqual(finishes, [{ reason: 'length', incomplete: true }]);
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
    const reasoningSnapshots = [];
    const statuses = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onStatus: (status) => statuses.push(status),
      onReasoning: (content) => reasoningSnapshots.push(content),
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(statuses, ['thinking']);
    assert.deepEqual(reasoningSnapshots, ['hidden', 'hidden thoughts']);
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

test('generateAIResponse reports Anthropic thinking before visible text', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify({
        protocol: AI_PROTOCOL_ANTHROPIC,
        baseURL: 'https://ai.example.test/v1',
        apiKey: 'test-key',
        modelID: 'test-model',
      }) : null),
    },
  };
  globalThis.fetch = async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"hidden"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Visible"}}\n\n',
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
    const statuses = [];
    const snapshots = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onStatus: (status) => statuses.push(status),
      onDelta: (content) => snapshots.push(content),
    });

    assert.deepEqual(statuses, ['thinking']);
    assert.deepEqual(snapshots, ['Visible']);
    assert.equal(result, 'Visible');
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse reports Anthropic max token truncation and requests a 32K answer budget', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify({
        protocol: AI_PROTOCOL_ANTHROPIC,
        baseURL: 'https://ai.example.test/v1',
        apiKey: 'test-key',
        modelID: 'test-model',
      }) : null),
    },
  };
  globalThis.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.max_tokens, 32768);
    const encoder = new TextEncoder();
    const chunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"分析"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"回答到一半"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"max_tokens"}}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
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
    const reasoningSnapshots = [];
    const finishes = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onReasoning: (content) => reasoningSnapshots.push(content),
      onFinish: (finish) => finishes.push(finish),
    });

    assert.equal(result, '回答到一半');
    assert.deepEqual(reasoningSnapshots, ['分析']);
    assert.deepEqual(finishes, [{ reason: 'max_tokens', incomplete: true }]);
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalWindow === 'undefined') {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  }
});

test('generateAIResponse separates reasoning in a non-stream Anthropic response', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === AI_CONFIG_STORAGE_KEY ? JSON.stringify({
        protocol: AI_PROTOCOL_ANTHROPIC,
        baseURL: 'https://ai.example.test/v1',
        apiKey: 'test-key',
        modelID: 'test-model',
      }) : null),
    },
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [
      { type: 'thinking', thinking: '分析过程' },
      { type: 'text', text: '最终答案' },
    ],
    stop_reason: 'end_turn',
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  try {
    const reasoningSnapshots = [];
    const finishes = [];
    const result = await generateAIResponse({
      systemPrompt: 'system',
      userInput: 'user',
      onReasoning: (content) => reasoningSnapshots.push(content),
      onFinish: (finish) => finishes.push(finish),
    });

    assert.equal(result, '最终答案');
    assert.deepEqual(reasoningSnapshots, ['分析过程']);
    assert.deepEqual(finishes, [{ reason: 'end_turn', incomplete: false }]);
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
