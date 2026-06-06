import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROTOCOL_A, AI_PROTOCOL_ANTHROPIC, normalizeAIConfig } from './aiConfig.js';
import {
  buildTaskDescriptionPrompt,
  cleanGeneratedTaskDescription,
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
