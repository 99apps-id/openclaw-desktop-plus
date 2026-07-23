/**
 * Helpers for OpenClaw `gateway.mode: "remote"` + `gateway.remote.*`.
 */

import type { GatewayConfig, GatewayRemoteConfig } from './types.js'
import { DEFAULT_GATEWAY_PORT } from './constants.js'

export function isGatewayRemoteMode(gw?: GatewayConfig | null): boolean {
  return gw?.mode === 'remote'
}

/** Convert ws(s)://… to http(s):// origin (+ optional path, no hash). */
export function gatewayUrlToHttpOrigin(rawUrl: string): string | null {
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  try {
    const normalized = trimmed
      .replace(/^ws:\/\//i, 'http://')
      .replace(/^wss:\/\//i, 'https://')
    const u = new URL(normalized)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const path = u.pathname === '/' ? '' : u.pathname.replace(/\/$/, '')
    return `${u.origin}${path}`
  } catch {
    return null
  }
}

export function parsePortFromGatewayUrl(rawUrl: string, fallback = DEFAULT_GATEWAY_PORT): number {
  try {
    const normalized = rawUrl
      .trim()
      .replace(/^ws:\/\//i, 'http://')
      .replace(/^wss:\/\//i, 'https://')
    const u = new URL(normalized)
    if (u.port) {
      const n = Number(u.port)
      if (Number.isFinite(n) && n > 0) return n
    }
    return u.protocol === 'https:' ? 443 : u.protocol === 'http:' ? 80 : fallback
  } catch {
    return fallback
  }
}

export function buildControlUiUrlFromOrigin(
  originOrBase: string,
  token?: string,
  path = '',
): string {
  const base = originOrBase.replace(/\/$/, '')
  const trimmed = path.trim()
  const basePath = !trimmed || trimmed === '/' ? '' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  let url = `${base}${basePath || '/'}`
  if (token && token.trim()) {
    url = `${url}#token=${encodeURIComponent(token.trim())}`
  }
  return url
}

/** Build iframe Control UI URL for remote mode from gateway.remote. */
export function buildRemoteControlUiUrl(
  remote: GatewayRemoteConfig | undefined,
  path = '',
): { httpOrigin: string; port: number; controlUrl: string } | null {
  const wsOrHttp = remote?.url?.trim()
  if (!wsOrHttp) return null
  const httpOrigin = gatewayUrlToHttpOrigin(wsOrHttp)
  if (!httpOrigin) return null
  const port = parsePortFromGatewayUrl(wsOrHttp)
  const token = remote?.token?.trim() || undefined
  return {
    httpOrigin,
    port,
    controlUrl: buildControlUiUrlFromOrigin(httpOrigin, token, path),
  }
}
