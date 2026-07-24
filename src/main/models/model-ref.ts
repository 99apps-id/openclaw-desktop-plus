/**
 * Normalize model refs to `provider/model` form expected by OpenClaw.
 * Bare ids (e.g. `nesa-free`) fall back to `openai/<id>` upstream and break the chat picker.
 */

import type { OpenClawConfig } from '../../shared/types.js'

/** Strip a leading `provider/` if present; catalog entries often arrive qualified. */
export function bareModelId(modelId: string): string {
  const id = modelId.trim()
  if (!id) return ''
  const slash = id.indexOf('/')
  if (slash < 0) return id
  return id.slice(slash + 1) || id
}

/** Build `provider/model` when both parts are present. */
export function qualifyModelRef(provider: string | undefined, modelId: string): string {
  const id = modelId.trim()
  const p = provider?.trim()
  if (!id) return ''
  if (id.includes('/')) return id
  if (p) return `${p}/${id}`
  return id
}

/**
 * Build the primary model string written to `agents.defaults.model.primary`.
 * - Already qualified (`provider/model`) → returned as-is (avoids `nesa/nesa/auto`)
 * - MiniMax onboard style prefers a bare id
 * - Otherwise `provider/id`
 */
export function toPrimaryModelRef(providerId: string, modelId: string): string {
  const id = modelId.trim()
  const p = providerId.trim()
  if (!id) return ''
  if (p === 'minimax') return bareModelId(id)
  if (id.includes('/')) return id
  if (p) return `${p}/${id}`
  return id
}

/**
 * Resolve a primary model string to a provider-qualified ref using configured providers.
 * - Already qualified (`provider/model`) → returned as-is
 * - Bare id unique across providers → `thatProvider/id`
 * - Alias `nesa-free` / known nesa free names → `nesa/auto` when nesa is configured
 * - Otherwise leave unchanged (caller may still write it; gateway will warn)
 */
export function resolvePrimaryModelRef(
  config: OpenClawConfig,
  raw: string,
): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  const lower = trimmed.toLowerCase()
  const providers = config.models?.providers ?? {}

  // Common mislabel for local NesaRouter (`nesa/auto`).
  // Bare "nesa-free" becomes openai/nesa-free upstream → "Unknown model".
  if (
    providers.nesa &&
    (lower === 'nesa-free' ||
      lower === 'nesafree' ||
      lower === 'nesarouter' ||
      lower === 'openai/nesa-free' ||
      lower === 'nesa/nesa-free')
  ) {
    return 'nesa/auto'
  }

  if (trimmed.includes('/')) return trimmed

  const matches: string[] = []
  for (const [providerId, p] of Object.entries(providers)) {
    if (!p || typeof p !== 'object') continue
    const models = (p as { models?: Array<{ id?: string }> }).models ?? []
    for (const m of models) {
      const id = typeof m?.id === 'string' ? m.id.trim() : ''
      if (id && id.toLowerCase() === lower) {
        matches.push(`${providerId}/${id}`)
      }
    }
  }

  if (matches.length === 1) return matches[0]!
  return trimmed
}
