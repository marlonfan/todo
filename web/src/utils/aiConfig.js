export const AI_PROTOCOL_OPENAI = 'openai';
export const AI_PROTOCOL_ANTHROPIC = 'anthropic';
export const AI_PROTOCOL_A = 'a_protocol';
export const AI_CONFIG_STORAGE_KEY = 'todo:aiConfig:v1';

export const DEFAULT_AI_SYSTEM_PROMPT = [
  '你是一个谨慎、务实的任务管理助手。',
  '你的目标是把任务信息整理得更清晰、更可执行，而不是编造业务事实。',
  '当背景信息不足时，用“待确认”列出缺失信息。',
].join('\n');

export const DEFAULT_AI_CONFIG = {
  protocol: AI_PROTOCOL_OPENAI,
  baseURL: 'https://api.openai.com/v1',
  apiKey: '',
  modelID: '',
  systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
  userProfile: '',
  allowTaskContext: true,
};

const SUPPORTED_PROTOCOLS = new Set([AI_PROTOCOL_OPENAI, AI_PROTOCOL_ANTHROPIC, AI_PROTOCOL_A]);

export function getDefaultBaseURLForProtocol(protocol) {
  return protocol === AI_PROTOCOL_ANTHROPIC || protocol === AI_PROTOCOL_A
    ? 'https://api.anthropic.com/v1'
    : 'https://api.openai.com/v1';
}

export function normalizeAIProtocol(value) {
  const normalized = String(value || '').trim();
  if (normalized === AI_PROTOCOL_A) return AI_PROTOCOL_ANTHROPIC;
  return SUPPORTED_PROTOCOLS.has(normalized) ? normalized : AI_PROTOCOL_OPENAI;
}

export function normalizeAIBaseURL(value, protocol = AI_PROTOCOL_OPENAI) {
  const raw = String(value || '').trim();
  const fallback = getDefaultBaseURLForProtocol(protocol);
  return (raw || fallback).replace(/\/+$/, '');
}

export function normalizeAIConfig(value = {}) {
  const protocol = normalizeAIProtocol(value?.protocol);
  return {
    protocol,
    baseURL: normalizeAIBaseURL(value?.baseURL, protocol),
    apiKey: String(value?.apiKey || '').trim(),
    modelID: String(value?.modelID || '').trim(),
    systemPrompt: String(value?.systemPrompt || DEFAULT_AI_SYSTEM_PROMPT).trim() || DEFAULT_AI_SYSTEM_PROMPT,
    userProfile: String(value?.userProfile || ''),
    allowTaskContext: value?.allowTaskContext !== false,
  };
}

export function readAIConfig() {
  if (typeof window === 'undefined') return normalizeAIConfig(DEFAULT_AI_CONFIG);
  try {
    const raw = window.localStorage?.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return normalizeAIConfig(DEFAULT_AI_CONFIG);
    return normalizeAIConfig(JSON.parse(raw));
  } catch {
    return normalizeAIConfig(DEFAULT_AI_CONFIG);
  }
}

export function saveAIConfig(value) {
  const normalized = normalizeAIConfig(value);
  if (typeof window !== 'undefined') {
    window.localStorage?.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent('todo:ai-config-changed', { detail: normalized }));
  }
  return normalized;
}

export function isAIConfigReady(value) {
  const config = normalizeAIConfig(value);
  return Boolean(config.baseURL && config.apiKey && config.modelID);
}
