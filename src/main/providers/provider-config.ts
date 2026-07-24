/**
 * models.providers, agents.defaults, auth.order — shared with LLM API UI.
 */

import type {
  OpenClawConfig,
  ModelProviderConfig,
  AgentDefaultsConfig,
  AuthConfig,
} from '../../shared/types.js'

export interface ProviderSummary {
  providerId: string
  baseUrl?: string
  api?: string
  hasApiKey: boolean
  models?: Array<{ id: string; name?: string }>
}

export interface ModelDefaultsSummary {
  primary?: string
  fallbacks?: string[]
}

export interface ProvidersListResult {
  profiles: Array<{ profileId: string; provider: string; hasKey: boolean }>
  providers: ProviderSummary[]
  modelDefaults: ModelDefaultsSummary
  authOrder: Record<string, string[]>
}

function getProviderSummary(providerId: string, config: ModelProviderConfig): ProviderSummary {
  return {
    providerId,
    baseUrl: config.baseUrl,
    api: config.api,
    hasApiKey: Boolean(config.apiKey?.length),
    models: config.models,
  }
}

/**
 * Summary for UI (no raw secrets)
 */
export function getProvidersSummary(
  config: OpenClawConfig,
  profileItems: Array<{ profileId: string; provider: string; hasKey: boolean }>,
): ProvidersListResult {
  const providers: ProviderSummary[] = []
  const providersConfig = config?.models?.providers ?? {}
  for (const [id, p] of Object.entries(providersConfig)) {
    if (p && typeof p === 'object') {
      providers.push(getProviderSummary(id, p as ModelProviderConfig))
    }
  }

  let modelDefaults: ModelDefaultsSummary = {}
  const modelCfg = config?.agents?.defaults?.model
  if (typeof modelCfg === 'string') {
    modelDefaults = { primary: modelCfg }
  } else if (modelCfg && typeof modelCfg === 'object') {
    modelDefaults = {
      primary: modelCfg.primary,
      fallbacks: Array.isArray((modelCfg as { fallbacks?: string[] }).fallbacks)
        ? (modelCfg as { fallbacks: string[] }).fallbacks
        : undefined,
    }
  }

  const authOrder = (config?.auth?.order ?? {}) as Record<string, string[]>

  return {
    profiles: profileItems,
    providers,
    modelDefaults,
    authOrder,
  }
}

/**
 * Save one models.providers entry
 */
export function saveProviderConfig(
  currentConfig: OpenClawConfig,
  providerId: string,
  config: Partial<ModelProviderConfig>,
): OpenClawConfig {
  const next = { ...currentConfig }
  next.models = next.models ?? { providers: {} }
  next.models.providers = next.models.providers ?? {}
  const existing = (next.models.providers[providerId] ?? {}) as ModelProviderConfig
  const merged = { ...existing, ...config } as ModelProviderConfig
  // Upsert models by id so a display-name patch does not wipe sibling models.
  if (Array.isArray(config.models) && Array.isArray(existing.models)) {
    const byId = new Map<string, { id: string; name?: string } & Record<string, unknown>>()
    for (const m of existing.models) {
      if (!m || typeof m !== 'object') continue
      const id = typeof (m as { id?: unknown }).id === 'string' ? (m as { id: string }).id.trim() : ''
      if (!id) continue
      byId.set(id, { ...(m as object), id } as { id: string; name?: string } & Record<string, unknown>)
    }
    for (const m of config.models) {
      if (!m || typeof m !== 'object') continue
      const id = typeof (m as { id?: unknown }).id === 'string' ? (m as { id: string }).id.trim() : ''
      if (!id) continue
      const prev = byId.get(id)
      byId.set(id, { ...(prev ?? {}), ...(m as object), id } as {
        id: string
        name?: string
      } & Record<string, unknown>)
    }
    merged.models = [...byId.values()] as ModelProviderConfig['models']
  }
  next.models.providers[providerId] = merged
  return next
}

/**
 * Set default model + fallbacks
 */
export function setModelDefaults(
  currentConfig: OpenClawConfig,
  opts: { primary?: string; fallbacks?: string[] },
): OpenClawConfig {
  const next = { ...currentConfig }
  next.agents = next.agents ?? {}
  next.agents.defaults = next.agents.defaults ?? ({} as AgentDefaultsConfig)
  const modelCfg = next.agents.defaults.model
  if (typeof modelCfg === 'string') {
    next.agents.defaults.model = {
      primary: opts.primary ?? modelCfg,
      fallbacks: opts.fallbacks,
    } as AgentModelDefaultsExt
  } else {
    next.agents.defaults.model = {
      ...(typeof modelCfg === 'object' && modelCfg ? modelCfg : {}),
      ...(opts.primary !== undefined && { primary: opts.primary }),
      ...(opts.fallbacks !== undefined && { fallbacks: opts.fallbacks }),
    } as AgentModelDefaultsExt
  }
  return next
}

/** Widen type for fallbacks */
interface AgentModelDefaultsExt {
  primary?: string
  fallbacks?: string[]
}

/**
 * Set model aliases (agents.defaults.models)
 */
export function setModelAliases(
  currentConfig: OpenClawConfig,
  aliases: Record<string, { alias?: string }>,
): OpenClawConfig {
  const next = { ...currentConfig }
  next.agents = next.agents ?? {}
  next.agents.defaults = next.agents.defaults ?? ({} as AgentDefaultsConfig)
  next.agents.defaults.models = aliases
  return next
}

/**
 * Canonical auth.order entry for a provider. OpenClaw expects full profile ids
 * (e.g. `anthropic:work`); older configs may use shorthand (`work` → `anthropic:work`).
 *
 * MiniMax: onboard-style configs list **`global`** under `auth.order.minimax` (resolves to `minimax:global`).
 * Legacy `minimax:default` maps to `minimax:global` — otherwise auth resolves a missing/wrong key → HTTP 401.
 */
export function normalizeAuthOrderEntry(providerId: string, entry: string): string {
  const t = entry.trim()
  if (!t) return t
  if (t.includes(':')) {
    const [pid, ...restParts] = t.split(':')
    const suffix = restParts.join(':')
    if (pid === 'minimax' && suffix.toLowerCase() === 'default') {
      return 'minimax:global'
    }
    return t
  }
  const suffix = providerId === 'minimax' && t.toLowerCase() === 'default' ? 'global' : t
  return `${providerId}:${suffix}`
}

/**
 * Reorder profiles in auth.order[provider]
 */
export function updateAuthOrder(
  currentConfig: OpenClawConfig,
  providerId: string,
  profileIds: string[],
): OpenClawConfig {
  const next = { ...currentConfig }
  next.auth = next.auth ?? ({} as AuthConfig)
  next.auth.order = { ...(next.auth.order ?? {}) }
  next.auth.order[providerId] = profileIds
  return next
}

/**
 * Ensure profileId is first in auth.order[providerId]
 */
export function addProfileToAuthOrder(
  currentConfig: OpenClawConfig,
  providerId: string,
  profileId: string,
): OpenClawConfig {
  const order = (currentConfig?.auth?.order ?? {}) as Record<string, string[]>
  const existing = order[providerId] ?? []
  const newEntry = normalizeAuthOrderEntry(providerId, profileId)
  const normalized = [...new Set(existing.map((e) => normalizeAuthOrderEntry(providerId, e)))]
  if (normalized.includes(newEntry)) return currentConfig
  return updateAuthOrder(currentConfig, providerId, [newEntry, ...normalized])
}

/**
 * Remove profileId from auth.order[providerId]
 */
export function removeProfileFromAuthOrder(
  currentConfig: OpenClawConfig,
  providerId: string,
  profileId: string,
): OpenClawConfig {
  const order = (currentConfig?.auth?.order ?? {}) as Record<string, string[]>
  const existing = order[providerId] ?? []
  const target = normalizeAuthOrderEntry(providerId, profileId)
  const filtered = existing.filter(
    (id) => normalizeAuthOrderEntry(providerId, id) !== target,
  )
  if (filtered.length === existing.length) return currentConfig
  return updateAuthOrder(currentConfig, providerId, filtered)
}
