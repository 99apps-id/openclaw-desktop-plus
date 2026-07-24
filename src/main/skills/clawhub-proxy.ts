/**
 * ClawHub skill search/install via bundled `openclaw skills` CLI.
 * Local gateway only — remote gateways manage skills on the remote host.
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { getBundledNodePath, getBundledOpenClawDir, getBundledOpenClawPath, getUserDataDir } from '../utils/paths.js'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'
import { isGatewayRemoteMode } from '../../shared/gateway-remote.js'
import type { OpenClawConfig } from '../../shared/types.js'

const SEARCH_TIMEOUT_MS = 60_000
const INSTALL_TIMEOUT_MS = 180_000

export interface ClawHubSkillHit {
  slug: string
  name?: string
  description?: string
  score?: number
  owner?: string
}

export interface ClawHubSearchResult {
  ok: boolean
  results: ClawHubSkillHit[]
  message?: string
}

export interface ClawHubInstallResult {
  ok: boolean
  slug?: string
  message?: string
}

function withNodeInPath(env: NodeJS.ProcessEnv, nodePath: string): NodeJS.ProcessEnv {
  const nodeDir = path.dirname(nodePath)
  const currentPath = env.PATH ?? ''
  return {
    ...env,
    PATH: currentPath ? `${nodeDir}${path.delimiter}${currentPath}` : nodeDir,
  }
}

function buildCliEnv(): NodeJS.ProcessEnv {
  const nodePath = getBundledNodePath()
  return {
    ...withNodeInPath(process.env, nodePath),
    OPENCLAW_STATE_DIR: getUserDataDir(),
    OPENCLAW_CONFIG_PATH: path.join(getUserDataDir(), OPENCLAW_CONFIG_FILE),
    OPENCLAW_AGENT_DIR: path.join(getUserDataDir(), 'agents', 'main', 'agent'),
    CLAWHUB_DISABLE_TELEMETRY: '1',
    NODE_ENV: 'production',
  }
}

function runSkillsCli(
  args: string[],
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()

  if (!fs.existsSync(nodePath)) {
    throw new Error(`Bundled Node.js not found: ${nodePath}`)
  }
  if (!fs.existsSync(openclawPath)) {
    throw new Error(`Bundled OpenClaw not found: ${openclawPath}`)
  }

  const fullArgs = [openclawPath, 'skills', ...args]
  const env = buildCliEnv()

  return new Promise((resolve, reject) => {
    const child = spawn(nodePath, fullArgs, {
      cwd: getBundledOpenClawDir(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`skills CLI timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const exitCode = code ?? (signal ? 1 : 0)
      resolve({ exitCode, stdout, stderr })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

function assertLocalGateway(config: OpenClawConfig | null | undefined): void {
  if (isGatewayRemoteMode(config?.gateway)) {
    throw new Error(
      'ClawHub install/search from Desktop only works with a local gateway. Open Skills in Control UI on the remote gateway instead.',
    )
  }
}

function extractJsonPayload(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // CLI may print banners before JSON — take the last {...} or [...] block.
    const arrStart = trimmed.lastIndexOf('[')
    const objStart = trimmed.lastIndexOf('{')
    const start = Math.max(arrStart, objStart)
    if (start < 0) return null
    try {
      return JSON.parse(trimmed.slice(start))
    } catch {
      return null
    }
  }
}

function mapHit(raw: Record<string, unknown>): ClawHubSkillHit | null {
  const slug =
    typeof raw.slug === 'string'
      ? raw.slug
      : typeof raw.ref === 'string'
        ? raw.ref
        : typeof raw.id === 'string'
          ? raw.id
          : typeof raw.name === 'string' && String(raw.name).includes('/')
            ? String(raw.name)
            : ''
  if (!slug.trim()) return null
  const owner =
    typeof raw.owner === 'string'
      ? raw.owner
      : typeof raw.ownerHandle === 'string'
        ? raw.ownerHandle
        : undefined
  const name = typeof raw.displayName === 'string' ? raw.displayName : typeof raw.name === 'string' ? raw.name : undefined
  const description =
    typeof raw.description === 'string'
      ? raw.description
      : typeof raw.summary === 'string'
        ? raw.summary
        : undefined
  const score = typeof raw.score === 'number' ? raw.score : undefined
  // Prefer @owner/slug when we have parts
  let ref = slug.trim()
  if (!ref.startsWith('@') && owner && !ref.includes('/')) {
    ref = `@${owner.replace(/^@/, '')}/${ref}`
  } else if (!ref.startsWith('@') && ref.includes('/') && !ref.startsWith('git:')) {
    ref = `@${ref.replace(/^@/, '')}`
  }
  return { slug: ref, name, description, score, owner }
}

function parseSearchHits(payload: unknown): ClawHubSkillHit[] {
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? Array.isArray((payload as { results?: unknown }).results)
        ? ((payload as { results: unknown[] }).results)
        : Array.isArray((payload as { skills?: unknown }).skills)
          ? ((payload as { skills: unknown[] }).skills)
          : Array.isArray((payload as { items?: unknown }).items)
            ? ((payload as { items: unknown[] }).items)
            : []
      : []

  const out: ClawHubSkillHit[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const hit = mapHit(row as Record<string, unknown>)
    if (!hit || seen.has(hit.slug)) continue
    seen.add(hit.slug)
    out.push(hit)
  }
  return out
}

/** `openclaw skills search <query> --json --limit n` */
export async function searchClawHubSkills(
  config: OpenClawConfig | null | undefined,
  query: string,
  limit = 12,
): Promise<ClawHubSearchResult> {
  assertLocalGateway(config)
  const q = query.trim()
  if (!q) {
    return { ok: false, results: [], message: 'Search query is required' }
  }
  const lim = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 40) : 12
  try {
    const { exitCode, stdout, stderr } = await runSkillsCli(
      ['search', q, '--json', '--limit', String(lim)],
      SEARCH_TIMEOUT_MS,
    )
    const payload = extractJsonPayload(stdout)
    const results = parseSearchHits(payload)
    if (exitCode !== 0 && results.length === 0) {
      return {
        ok: false,
        results: [],
        message: (stderr || stdout || `skills search failed (exit ${exitCode})`).trim().slice(0, 500),
      }
    }
    return { ok: true, results }
  } catch (e) {
    return {
      ok: false,
      results: [],
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

/** `openclaw skills install <ref> --global --acknowledge-clawhub-risk` */
export async function installClawHubSkill(
  config: OpenClawConfig | null | undefined,
  skillRef: string,
): Promise<ClawHubInstallResult> {
  assertLocalGateway(config)
  const ref = skillRef.trim()
  if (!ref) {
    return { ok: false, message: 'Skill ref is required' }
  }
  try {
    const { exitCode, stdout, stderr } = await runSkillsCli(
      ['install', ref, '--global', '--acknowledge-clawhub-risk', '--force'],
      INSTALL_TIMEOUT_MS,
    )
    const combined = `${stdout}\n${stderr}`.trim()
    if (exitCode !== 0) {
      return {
        ok: false,
        slug: ref,
        message: combined.slice(0, 800) || `skills install failed (exit ${exitCode})`,
      }
    }
    return {
      ok: true,
      slug: ref,
      message: combined.split('\n').filter(Boolean).slice(-3).join(' ').slice(0, 400) || `Installed ${ref}`,
    }
  } catch (e) {
    return {
      ok: false,
      slug: ref,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}
