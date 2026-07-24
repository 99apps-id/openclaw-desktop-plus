import { describe, expect, it } from 'vitest'
import {
  buildRemoteControlUiUrl,
  gatewayUrlToHttpOrigin,
  isGatewayRemoteMode,
  parsePortFromGatewayUrl,
} from './gateway-remote.js'
import { DEFAULT_GATEWAY_PORT } from './constants.js'

describe('isGatewayRemoteMode', () => {
  it('detects remote mode only', () => {
    expect(isGatewayRemoteMode({ mode: 'remote' })).toBe(true)
    expect(isGatewayRemoteMode({ mode: 'local' })).toBe(false)
    expect(isGatewayRemoteMode(undefined)).toBe(false)
    expect(isGatewayRemoteMode(null)).toBe(false)
  })
})

describe('gatewayUrlToHttpOrigin', () => {
  it('converts ws(s) to http(s) and preserves path', () => {
    expect(gatewayUrlToHttpOrigin('ws://127.0.0.1:18789')).toBe('http://127.0.0.1:18789')
    expect(gatewayUrlToHttpOrigin('wss://vps.example.com/openclaw')).toBe(
      'https://vps.example.com/openclaw',
    )
  })

  it('returns null for empty or invalid urls', () => {
    expect(gatewayUrlToHttpOrigin('')).toBeNull()
    expect(gatewayUrlToHttpOrigin('   ')).toBeNull()
    expect(gatewayUrlToHttpOrigin('not-a-url')).toBeNull()
  })
})

describe('parsePortFromGatewayUrl', () => {
  it('reads explicit ports', () => {
    expect(parsePortFromGatewayUrl('ws://127.0.0.1:18789')).toBe(18789)
  })

  it('uses scheme defaults then fallback', () => {
    expect(parsePortFromGatewayUrl('https://vps.example.com/openclaw')).toBe(443)
    expect(parsePortFromGatewayUrl('http://vps.example.com/openclaw')).toBe(80)
    expect(parsePortFromGatewayUrl('not-a-url')).toBe(DEFAULT_GATEWAY_PORT)
  })
})

describe('buildRemoteControlUiUrl', () => {
  it('returns null when remote url missing', () => {
    expect(buildRemoteControlUiUrl(undefined)).toBeNull()
    expect(buildRemoteControlUiUrl({})).toBeNull()
    expect(buildRemoteControlUiUrl({ url: '  ' })).toBeNull()
  })

  it('builds control URL with token hash and path', () => {
    const built = buildRemoteControlUiUrl(
      { url: 'wss://vps.example.com:8443/openclaw', token: 'secret' },
      '/tasks',
    )
    expect(built).not.toBeNull()
    expect(built!.httpOrigin).toBe('https://vps.example.com:8443/openclaw')
    expect(built!.port).toBe(8443)
    expect(built!.controlUrl).toBe(
      'https://vps.example.com:8443/openclaw/tasks#token=secret',
    )
  })
})
