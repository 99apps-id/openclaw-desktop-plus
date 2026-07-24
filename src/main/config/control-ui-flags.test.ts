import { describe, expect, it } from 'vitest'
import {
  mergeEmbeddedControlUiFlagsIfNeeded,
  needsLoopbackAllowedOriginsWildcardSeed,
  usesLoopbackOnlyGatewayBind,
} from './control-ui-flags.js'
import type { OpenClawConfig } from '../../shared/types.js'

describe('usesLoopbackOnlyGatewayBind', () => {
  it('treats missing gateway / unset bind as loopback', () => {
    expect(usesLoopbackOnlyGatewayBind(undefined)).toBe(true)
    expect(usesLoopbackOnlyGatewayBind({})).toBe(true)
    expect(usesLoopbackOnlyGatewayBind({ bind: 'loopback' })).toBe(true)
  })

  it('is false for lan/auto binds', () => {
    expect(usesLoopbackOnlyGatewayBind({ bind: 'lan' })).toBe(false)
    expect(usesLoopbackOnlyGatewayBind({ bind: 'auto' })).toBe(false)
  })
})

describe('needsLoopbackAllowedOriginsWildcardSeed', () => {
  it('seeds only on loopback when origins unset or empty', () => {
    expect(needsLoopbackAllowedOriginsWildcardSeed({}, true)).toBe(true)
    expect(needsLoopbackAllowedOriginsWildcardSeed({ allowedOrigins: [] }, true)).toBe(true)
    expect(needsLoopbackAllowedOriginsWildcardSeed({ allowedOrigins: ['https://a'] }, true)).toBe(
      false,
    )
    expect(needsLoopbackAllowedOriginsWildcardSeed({}, false)).toBe(false)
  })
})

describe('mergeEmbeddedControlUiFlagsIfNeeded', () => {
  it('does not change remote gateway configs', () => {
    const config: OpenClawConfig = {
      gateway: { mode: 'remote', remote: { url: 'wss://vps.example.com' } },
    }
    const result = mergeEmbeddedControlUiFlagsIfNeeded(config)
    expect(result.changed).toBe(false)
    expect(result.config).toBe(config)
  })

  it('sets both auth flags when missing on local gateway', () => {
    const config: OpenClawConfig = { gateway: { mode: 'local' } }
    const result = mergeEmbeddedControlUiFlagsIfNeeded(config)
    expect(result.changed).toBe(true)
    expect(result.config.gateway?.controlUi?.allowInsecureAuth).toBe(true)
    expect(result.config.gateway?.controlUi?.dangerouslyDisableDeviceAuth).toBe(true)
    expect(result.config.gateway?.controlUi?.allowedOrigins).toEqual(['*'])
  })

  it('seeds allowedOrigins * on loopback when empty', () => {
    const config: OpenClawConfig = {
      gateway: {
        mode: 'local',
        bind: 'loopback',
        controlUi: {
          allowInsecureAuth: true,
          dangerouslyDisableDeviceAuth: true,
          allowedOrigins: [],
        },
      },
    }
    const result = mergeEmbeddedControlUiFlagsIfNeeded(config)
    expect(result.changed).toBe(true)
    expect(result.config.gateway?.controlUi?.allowedOrigins).toEqual(['*'])
  })

  it('does not seed * for non-loopback bind', () => {
    const config: OpenClawConfig = {
      gateway: {
        mode: 'local',
        bind: 'lan',
        controlUi: {},
      },
    }
    const result = mergeEmbeddedControlUiFlagsIfNeeded(config)
    expect(result.changed).toBe(true)
    expect(result.config.gateway?.controlUi?.allowInsecureAuth).toBe(true)
    expect(result.config.gateway?.controlUi?.dangerouslyDisableDeviceAuth).toBe(true)
    expect(result.config.gateway?.controlUi?.allowedOrigins).toBeUndefined()
  })

  it('preserves an existing non-empty allowlist', () => {
    const config: OpenClawConfig = {
      gateway: {
        mode: 'local',
        bind: 'loopback',
        controlUi: {
          allowInsecureAuth: true,
          dangerouslyDisableDeviceAuth: true,
          allowedOrigins: ['http://127.0.0.1:18789'],
        },
      },
    }
    const result = mergeEmbeddedControlUiFlagsIfNeeded(config)
    expect(result.changed).toBe(false)
    expect(result.config.gateway?.controlUi?.allowedOrigins).toEqual(['http://127.0.0.1:18789'])
  })
})
