/**
 * WhatsApp Web login via Gateway RPC (`web.login.start` / `wait` / `channels.logout`).
 * Control UI sometimes receives QR but fails to paint it in the Electron iframe; the shell
 * can show the same `qrDataUrl` natively.
 */

import { createGatewayRpcClientFromConfig } from '../gateway/rpc-client.js'

export interface WhatsAppLoginResult {
  qrDataUrl?: string | null
  message?: string | null
  connected?: boolean | null
  code?: string | null
}

type LoginRpcPayload = {
  qrDataUrl?: unknown
  message?: unknown
  connected?: unknown
  code?: unknown
}

function mapLoginPayload(payload: LoginRpcPayload | null | undefined): WhatsAppLoginResult {
  return {
    qrDataUrl: typeof payload?.qrDataUrl === 'string' ? payload.qrDataUrl : null,
    message: typeof payload?.message === 'string' ? payload.message : null,
    connected: typeof payload?.connected === 'boolean' ? payload.connected : null,
    code: typeof payload?.code === 'string' ? payload.code : null,
  }
}

export async function whatsappLoginStart(opts?: {
  force?: boolean
  accountId?: string
  timeoutMs?: number
}): Promise<WhatsAppLoginResult> {
  const client = await createGatewayRpcClientFromConfig()
  try {
    const timeoutMs = opts?.timeoutMs ?? 45_000
    const payload = await client.request<LoginRpcPayload>(
      'web.login.start',
      {
        force: opts?.force === true,
        timeoutMs,
        ...(opts?.accountId?.trim() ? { accountId: opts.accountId.trim() } : {}),
      },
      { timeoutMs: timeoutMs + 5_000 },
    )
    return mapLoginPayload(payload)
  } finally {
    client.close()
  }
}

export async function whatsappLoginWait(opts?: {
  currentQrDataUrl?: string | null
  accountId?: string
  timeoutMs?: number
}): Promise<WhatsAppLoginResult> {
  const client = await createGatewayRpcClientFromConfig()
  try {
    const timeoutMs = opts?.timeoutMs ?? 120_000
    const payload = await client.request<LoginRpcPayload>(
      'web.login.wait',
      {
        timeoutMs,
        ...(opts?.currentQrDataUrl ? { currentQrDataUrl: opts.currentQrDataUrl } : {}),
        ...(opts?.accountId?.trim() ? { accountId: opts.accountId.trim() } : {}),
      },
      { timeoutMs: timeoutMs + 5_000 },
    )
    return mapLoginPayload(payload)
  } finally {
    client.close()
  }
}

export async function whatsappLogout(opts?: { accountId?: string }): Promise<WhatsAppLoginResult> {
  const client = await createGatewayRpcClientFromConfig()
  try {
    await client.request(
      'channels.logout',
      {
        channel: 'whatsapp',
        ...(opts?.accountId?.trim() ? { accountId: opts.accountId.trim() } : {}),
      },
      { timeoutMs: 30_000 },
    )
    return {
      qrDataUrl: null,
      connected: false,
      message: 'Logged out.',
    }
  } finally {
    client.close()
  }
}
