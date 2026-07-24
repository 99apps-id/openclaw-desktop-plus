/**
 * Models list via RPC `models.list`, falling back to config parsing when gateway is down.
 */

import { createGatewayRpcClientFromConfig } from '../gateway/rpc-client.js'
import { GatewayRpcError } from '../gateway/rpc-client.js'
import type { OpenClawConfig } from '../../shared/types.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ModelListItem {
  id: string
  name?: string
  provider?: string
}

export interface ModelsListResult {
  models: ModelListItem[]
}

// ─── RPC shape (models.list) ─────────────────────────────────────────────────

interface ModelsListRpcPayload {
  models?: Array<{ id?: string; name?: string; provider?: string; [key: string]: unknown }>
}

// ─── Extract from config ─────────────────────────────────────────────────────

function extractModelsFromConfig(config: OpenClawConfig): ModelListItem[] {
  const providers = config?.models?.providers ?? {}
  const items: ModelListItem[] = []
  const seen = new Set<string>()

  for (const [providerId, p] of Object.entries(providers)) {
    if (!p || typeof p !== 'object') continue
    const models = (p as { models?: Array<{ id: string; name?: string }> }).models ?? []
    for (const m of models) {
      const bareId = m.id ?? ''
      if (!bareId) continue
      // Always qualify — bare ids collide across providers and break setDefault.
      const id = `${providerId}/${bareId}`
      if (seen.has(id)) continue
      seen.add(id)
      items.push({
        id,
        name: m.name,
        provider: providerId,
      })
    }
  }

  return items.sort((a, b) => a.id.localeCompare(b.id))
}

// ─── Map RPC → UI rows ───────────────────────────────────────────────────────

function mapRpcModels(payload: ModelsListRpcPayload): ModelListItem[] {
  const raw = payload?.models ?? []
  const seen = new Set<string>()
  return raw
    .map((m) => {
      const bare = String(m.id ?? m.name ?? '').trim()
      if (!bare) return null
      const provider = typeof m.provider === 'string' ? m.provider.trim() : ''
      // Prefer provider/model so Models panel never writes bare ids as primary.
      const id =
        bare.includes('/') || !provider ? bare : `${provider}/${bare}`
      if (seen.has(id)) return null
      seen.add(id)
      return {
        id,
        name: typeof m.name === 'string' ? m.name : undefined,
        provider: provider || undefined,
      } as ModelListItem
    })
    .filter((x): x is ModelListItem => x !== null)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List models: RPC first, config fallback
 */
export async function listModelsWithProxy(
  readOpenClawConfig: () => OpenClawConfig
): Promise<ModelsListResult> {
  let client: Awaited<ReturnType<typeof createGatewayRpcClientFromConfig>> | null = null

  try {
    client = await createGatewayRpcClientFromConfig()
    const payload = await client.request<ModelsListRpcPayload>('models.list', {})
    client.close()
    client = null

    const models = mapRpcModels(payload ?? {})
    return { models }
  } catch (err) {
    if (client) {
      try {
        client.close()
      } catch {
        /* ignore */
      }
    }
    if (err instanceof GatewayRpcError) {
      if (
        err.code === 'GATEWAY_UNREACHABLE' ||
        err.code === 'GATEWAY_NOT_CONNECTED' ||
        err.code === 'GATEWAY_TIMEOUT'
      ) {
        const config = readOpenClawConfig()
        const models = extractModelsFromConfig(config)
        return { models }
      }
    }
    const config = readOpenClawConfig()
    const models = extractModelsFromConfig(config)
    return { models }
  }
}
