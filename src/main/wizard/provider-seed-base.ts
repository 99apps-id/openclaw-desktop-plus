/**
 * Known first-party provider API base URLs (aligned with wizard PROVIDER_SEEDS).
 * Used to detect whether openclaw.json baseUrl is a custom override vs the seed default.
 */

import type { ModelProvider } from '../../shared/types.js'

const SEED_BASE_URLS: Partial<Record<ModelProvider, string>> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  opencode: 'https://opencode.ai/zen/v1',
  'vercel-ai-gateway': 'https://ai-gateway.vercel.sh/v1',
  moonshot: 'https://api.moonshot.ai/v1',
  'moonshot-cn': 'https://api.moonshot.cn/v1',
  'kimi-coding': 'https://api.kimi.com/coding/',
  minimax: 'https://api.minimaxi.com/anthropic',
  xai: 'https://api.x.ai/v1',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  litellm: 'http://localhost:4000',
  synthetic: 'https://api.synthetic.new/anthropic',
  venice: 'https://api.venice.ai/api/v1',
  together: 'https://api.together.xyz/v1',
  huggingface: 'https://router.huggingface.co/v1',
  zai: 'https://api.z.ai/api/paas/v4',
  xiaomi: 'https://api.xiaomimimo.com/v1',
  qianfan: 'https://qianfan.baidubce.com/v2',
  kilocode: 'https://api.kilo.ai/api/gateway/',
  volcengine: 'https://ark.cn-beijing.volces.com/api/v3',
  'volcengine-plan': 'https://ark.cn-beijing.volces.com/api/coding/v3',
  byteplus: 'https://ark.ap-southeast.bytepluses.com/api/v3',
  'byteplus-plan': 'https://ark.ap-southeast.bytepluses.com/api/coding/v3',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  chutes: 'https://api.chutes.ai/v1',
  'copilot-proxy': 'http://localhost:3000/v1',
  vllm: 'http://127.0.0.1:8000/v1',
  kuae: 'https://coding-plan-endpoint.kuaecloud.net/v1',
  lmstudio: 'http://127.0.0.1:1234/v1',
  ollama: 'http://127.0.0.1:11434',
}

export function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** Seed base URL for a known provider, or undefined when custom / CF gateway / unknown. */
export function getProviderSeedBaseUrl(
  provider: ModelProvider,
  opts?: { moonshotRegion?: 'global' | 'cn' },
): string | undefined {
  if (provider === 'custom' || provider === 'cloudflare-ai-gateway') return undefined
  if (provider === 'moonshot-cn' || (provider === 'moonshot' && opts?.moonshotRegion === 'cn')) {
    return SEED_BASE_URLS['moonshot-cn']
  }
  if (provider === 'moonshot') return SEED_BASE_URLS.moonshot
  return SEED_BASE_URLS[provider]
}

/**
 * Return current baseUrl only when it differs from the known seed (i.e. a real override).
 * Empty string means “use provider default”.
 */
export function endpointOverrideFromProviderBaseUrl(
  provider: ModelProvider,
  currentBaseUrl: string | undefined,
  opts?: { moonshotRegion?: 'global' | 'cn' },
): string {
  if (!currentBaseUrl?.trim()) return ''
  const seed = getProviderSeedBaseUrl(provider, opts)
  if (!seed) {
    // No seed to compare (custom/CF) — do not treat provider base as endpointUrl override field
    return ''
  }
  const a = normalizeApiBaseUrl(currentBaseUrl)
  const b = normalizeApiBaseUrl(seed)
  if (a.toLowerCase() === b.toLowerCase()) return ''
  return currentBaseUrl.trim()
}
