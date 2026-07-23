/**
 * OpenClaw Feishu channel: historically `registerFull` re-ran on every inbound dispatch when
 * `api.registrationMode === "full"`, re-registering tools and spamming logs.
 * Guard once per process via globalThis (gateway child is one Node process).
 *
 * Upstream layouts:
 * - Older: dedicated `dist/feishu-*.js` chunks.
 * - Mid: Feishu inside hashed `dist/auth-profiles-*.js` bundles.
 * - 2026.3.31+: bundled channel at `dist/extensions/feishu/index.js`.
 * - 2026.7+: Feishu split into lazy chunks (`subagent-hooks-api-*.js`, `drive-*.js`, …) without the
 *   old `registerFull` + `registerFeishuSubagentHooks` adjacency — no guard needed when absent.
 *
 * Idempotent: safe to run after every download-openclaw / prepare-bundle.
 */
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

const GUARD_FLAG = '__openclawDesktopFeishuFullRegistered'

/** Matches `registerFull(api) { … registerFeishuSubagentHooks(api); … }` entry (first statement after `{`). */
const REGISTER_FULL_FEISHU_RE =
  /(registerFull\(api\)\s*\{)(\s*)(registerFeishuSubagentHooks\(api\);)/

async function tryPatchFeishuRegisterFullFile(
  filePath: string,
  label: string,
): Promise<boolean> {
  let raw = await readFile(filePath, 'utf8')
  if (raw.includes(GUARD_FLAG)) return false
  if (!raw.includes('registerFeishuSubagentHooks')) return false
  if (!REGISTER_FULL_FEISHU_RE.test(raw)) return false
  raw = raw.replace(REGISTER_FULL_FEISHU_RE, (_m, p1: string, p2: string, p3: string) => {
    return `${p1}${p2}if(globalThis.${GUARD_FLAG})return;globalThis.${GUARD_FLAG}=!0;${p3}`
  })
  await writeFile(filePath, raw, 'utf8')
  console.log(`  [patch-feishu] ${label}: registerFull guarded (once per process)`)
  return true
}

function isFeishuCandidateName(name: string): boolean {
  return (
    /^feishu-.*\.js$/.test(name) ||
    /^auth-profiles-.*\.js$/.test(name) ||
    /^subagent-hooks-api-.*\.js$/.test(name) ||
    /^drive-.*\.js$/.test(name)
  )
}

export async function patchOpenClawFeishuRegisterOnce(openclawRoot: string): Promise<void> {
  const dist = join(openclawRoot, 'dist')
  let names: string[]
  try {
    names = await readdir(dist)
  } catch {
    return
  }

  const candidatePaths = names.filter(isFeishuCandidateName).map((n) => join(dist, n))

  const feishuExtIndex = join(dist, 'extensions', 'feishu', 'index.js')
  if (await fileExists(feishuExtIndex)) {
    candidatePaths.push(feishuExtIndex)
  }

  let patched = false
  let sawFeishuHooks = false
  let sawRegisterFullPair = false
  let hasGuard = false

  for (const filePath of candidatePaths) {
    const label =
      filePath === feishuExtIndex ? 'extensions/feishu/index.js' : basename(filePath)
    const raw = await readFile(filePath, 'utf8')
    if (raw.includes(GUARD_FLAG)) hasGuard = true
    if (raw.includes('registerFeishuSubagentHooks')) sawFeishuHooks = true
    if (REGISTER_FULL_FEISHU_RE.test(raw)) sawRegisterFullPair = true
    const ok = await tryPatchFeishuRegisterFullFile(filePath, label)
    if (ok) patched = true
  }

  if (patched || hasGuard) return

  if (sawRegisterFullPair) {
    console.warn(
      '  [patch-feishu] registerFull+registerFeishuSubagentHooks pattern still present but patch did not apply',
    )
    return
  }

  if (sawFeishuHooks) {
    console.log(
      '  [patch-feishu] skip — Feishu hooks present without registerFull adjacency (2026.7+ layout)',
    )
    return
  }

  if (candidatePaths.length > 0) {
    // auth-profiles / drive candidates matched by name only — nothing Feishu-specific to patch.
    console.log('  [patch-feishu] skip — no Feishu registerFull pattern in bundle')
  }
}
