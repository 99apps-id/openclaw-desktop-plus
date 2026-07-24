/**
 * Pure helpers for embedded Control UI auth / origin flags.
 * Kept filesystem-free so unit tests can cover Electron iframe compatibility rules.
 */

import type { OpenClawConfig } from '../../shared/types.js'

/** Narrow type for reading `controlUi` / `bind` without a heavy import cycle. */
type GatewayConfigLike = { controlUi?: unknown; mode?: string; bind?: string }

/** True when bind is unset or loopback (desktop default). */
export function usesLoopbackOnlyGatewayBind(gw: unknown): boolean {
  if (!gw || typeof gw !== 'object' || Array.isArray(gw)) return true
  const bind = (gw as GatewayConfigLike).bind
  return bind === undefined || bind === 'loopback'
}

/** Seed `allowedOrigins: ['*']` only when the key is absent or [] — do not override a non-empty user allowlist. */
export function needsLoopbackAllowedOriginsWildcardSeed(
  ctrl: Record<string, unknown>,
  loopbackBind: boolean,
): boolean {
  if (!loopbackBind) return false
  const raw = ctrl.allowedOrigins
  if (raw === undefined) return true
  return Array.isArray(raw) && raw.length === 0
}

/**
 * OpenClaw 2026.3+ hardens Control UI auth (device identity + loopback policy). The desktop embeds
 * Control UI in an Electron iframe; upstream may return 500 or reject WS unless both
 * `allowInsecureAuth` and `dangerouslyDisableDeviceAuth` are set for local gateways.
 * Always normalize to the embedded-safe pair for non-remote mode (overrides user `false`).
 *
 * **WebSocket origin:** seed `allowedOrigins: ["*"]` when bind is loopback (or unset) and
 * `allowedOrigins` is unset or `[]` — scoped to local bind only. Remote mode is left untouched.
 */
export function mergeEmbeddedControlUiFlagsIfNeeded(config: OpenClawConfig): {
  config: OpenClawConfig
  changed: boolean
} {
  const gw = config.gateway
  if (gw && typeof gw === 'object' && !Array.isArray(gw) && gw.mode === 'remote') {
    return { config, changed: false }
  }
  const ctrl =
    gw && typeof gw === 'object' && !Array.isArray(gw) ? (gw as GatewayConfigLike).controlUi : undefined
  const base =
    ctrl && typeof ctrl === 'object' && !Array.isArray(ctrl)
      ? (ctrl as Record<string, unknown>)
      : {}
  const loopbackBind = usesLoopbackOnlyGatewayBind(gw)
  const needWildcardOrigins = needsLoopbackAllowedOriginsWildcardSeed(base, loopbackBind)
  const flagsOk = base.allowInsecureAuth === true && base.dangerouslyDisableDeviceAuth === true
  if (flagsOk && !needWildcardOrigins) {
    return { config, changed: false }
  }
  const next = JSON.parse(JSON.stringify(config)) as OpenClawConfig
  const existing =
    next.gateway && typeof next.gateway === 'object' && !Array.isArray(next.gateway)
      ? (next.gateway as Record<string, unknown>)
      : {}
  const existingCtrl = existing.controlUi
  const ctrlBase =
    existingCtrl && typeof existingCtrl === 'object' && !Array.isArray(existingCtrl)
      ? (existingCtrl as Record<string, unknown>)
      : {}
  const mergedCtrl: Record<string, unknown> = {
    ...ctrlBase,
    allowInsecureAuth: true,
    dangerouslyDisableDeviceAuth: true,
  }
  if (needWildcardOrigins) {
    mergedCtrl.allowedOrigins = ['*']
  }
  next.gateway = {
    ...existing,
    controlUi: mergedCtrl,
  } as OpenClawConfig['gateway']
  return { config: next, changed: true }
}
