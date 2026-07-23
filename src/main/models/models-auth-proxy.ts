/**
 * `openclaw models auth login` via bundled CLI (OAuth / API-key browser or interactive flows).
 */

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'
import { OPENCLAW_CONFIG_FILE } from '../../shared/constants.js'
import { getBundledNodePath, getBundledOpenClawDir, getBundledOpenClawPath, getUserDataDir } from '../utils/paths.js'
import { logInfo, logWarn } from '../utils/logger.js'

const AUTH_LOGIN_TIMEOUT_MS = 5 * 60_000

const OAUTH_CAPABLE_PROVIDERS = new Set([
  'openrouter',
  'openai-codex',
  'github-copilot',
  'google-gemini-cli',
  'qwen-portal',
  'chutes',
])

export function isOAuthCapableProvider(provider: string): boolean {
  return OAUTH_CAPABLE_PROVIDERS.has(provider.trim().toLowerCase())
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
    NODE_ENV: 'production',
  }
}

export interface ModelsAuthLoginResult {
  ok: boolean
  exitCode: number
  stdout: string
  stderr: string
  message: string
}

/**
 * Run `openclaw models auth login --provider <id> --method oauth|api-key`.
 * Opens browser URLs found in CLI output via Electron shell.
 */
export async function modelsAuthLogin(
  provider: string,
  method: 'oauth' | 'api-key' = 'oauth',
): Promise<ModelsAuthLoginResult> {
  const id = provider.trim().toLowerCase()
  if (!id) {
    return { ok: false, exitCode: 1, stdout: '', stderr: '', message: 'Provider id is required' }
  }
  if (method === 'oauth' && !isOAuthCapableProvider(id)) {
    return {
      ok: false,
      exitCode: 1,
      stdout: '',
      stderr: '',
      message: `Provider "${id}" does not support OAuth login in Desktop Plus`,
    }
  }

  const nodePath = getBundledNodePath()
  const openclawPath = getBundledOpenClawPath()
  if (!fs.existsSync(nodePath)) {
    throw new Error(`Bundled Node.js not found: ${nodePath}`)
  }
  if (!fs.existsSync(openclawPath)) {
    throw new Error(`Bundled OpenClaw not found: ${openclawPath}`)
  }

  const fullArgs = [openclawPath, 'models', 'auth', 'login', '--provider', id, '--method', method]
  logInfo(`[models-auth] ${nodePath} ${fullArgs.join(' ')}`)

  return new Promise((resolve, reject) => {
    const child = spawn(nodePath, fullArgs, {
      cwd: getBundledOpenClawDir(),
      env: buildCliEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: false,
    })

    let stdout = ''
    let stderr = ''
    const openedUrls = new Set<string>()

    const maybeOpenUrl = (chunk: string) => {
      const urlRe = /https?:\/\/[^\s"'<>]+/gi
      let m: RegExpExecArray | null
      while ((m = urlRe.exec(chunk)) !== null) {
        const url = m[0].replace(/[).,;]+$/, '')
        if (openedUrls.has(url)) continue
        if (/localhost|127\.0\.0\.1/i.test(url) && !/oauth|auth|openrouter|accounts\.google|github/i.test(url)) {
          continue
        }
        openedUrls.add(url)
        void shell.openExternal(url).catch((err) => {
          logWarn(`[models-auth] openExternal failed: ${err instanceof Error ? err.message : String(err)}`)
        })
      }
    }

    child.stdout?.on('data', (buf) => {
      const text = buf.toString()
      stdout += text
      maybeOpenUrl(text)
    })
    child.stderr?.on('data', (buf) => {
      const text = buf.toString()
      stderr += text
      maybeOpenUrl(text)
    })

    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`models auth login timed out after ${AUTH_LOGIN_TIMEOUT_MS}ms`))
    }, AUTH_LOGIN_TIMEOUT_MS)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const exitCode = code ?? (signal ? 1 : 0)
      const ok = exitCode === 0
      resolve({
        ok,
        exitCode,
        stdout,
        stderr,
        message: ok
          ? `Signed in to ${id} (${method}).`
          : (stderr || stdout || `models auth login failed (exit ${exitCode})`).trim().slice(0, 500),
      })
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}
