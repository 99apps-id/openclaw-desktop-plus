/**
 * npm `openclaw` packages no longer ship `dist/control-ui/` (see upstream package.json "files").
 * Gateway still serves static assets from that path. This step fetches matching GitHub tag sources
 * (`ui/` + `scripts/ui.js` + repo-root `src/` + `apps/` for OpenClawKit JSON resources), runs `vite build` into
 * `../dist/control-ui`, then deletes those sources
 * and devDependencies so the desktop bundle stays small.
 *
 * Note: Vite 8 + Rolldown native bindings often fail on GitHub `windows-latest`; CI builds UI on Linux
 * and merges `dist/control-ui` before `prepare-bundle` (see release workflow + ci-build-openclaw-control-ui).
 *
 * After `vite build`, we run a desktop-only esbuild pass on `dist/control-ui` (see transpile-control-ui-for-electron)
 * so the UI runs inside Electron without changing upstream OpenClaw sources.
 */

import { createWriteStream, existsSync } from 'node:fs'
import {
  mkdir,
  rm,
  cp,
  writeFile,
  readFile,
  readdir,
  access,
  unlink,
  stat,
} from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { execFile, execFileSync, execSync } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
import { transpileControlUiForElectronEmbedded } from './lib/transpile-control-ui-for-electron.ts'
import { applyOpenClawUiLitDecoratorCompatPatches } from './lib/patch-openclaw-ui-lit-decorators.ts'

/** Written after GitHub UI build so cached installs can detect pre-npm / legacy bundles. */
export const CONTROL_UI_ELECTRON_LIT_MARKER = '.electron-lit-compat-v1'

const GITHUB_REPO = 'openclaw/openclaw'

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

/**
 * Map npm `openclaw` version → GitHub tag candidates.
 * Exact tag first; npm republish suffixes (`2026.7.1-2`) fall back to the base release tag
 * (`v2026.7.1`) because GitHub often has no `vYYYY.M.D-N` ref.
 */
export function gitTagCandidatesForNpmVersion(version: string): string[] {
  const raw = version.trim()
  if (!raw) throw new Error('OpenClaw version is empty')
  const v = raw.startsWith('v') ? raw.slice(1) : raw
  const exact = `v${v}`
  const candidates = [exact]
  // npm republish only: calendar version + numeric suffix (not -beta.N / -alpha.N)
  const republish = /^(\d{4}\.\d{1,2}\.\d{1,2})-(\d+)$/.exec(v)
  if (republish) {
    candidates.push(`v${republish[1]}`)
  }
  return [...new Set(candidates)]
}

function gitTagForNpmVersion(version: string): string {
  return gitTagCandidatesForNpmVersion(version)[0]!
}

function tarballUrlForTag(tag: string): string {
  return `https://codeload.github.com/${GITHUB_REPO}/tar.gz/${tag}`
}

/** Full URL override (e.g. mirror). Must be the same tarball as the resolved tag. */
function resolveTarballUrlOverride(): string | null {
  const override = process.env.OPENCLAW_SOURCE_TARBALL_URL?.trim()
  if (override) {
    console.log('  [control-ui] using OPENCLAW_SOURCE_TARBALL_URL for source tarball')
    return override
  }
  return null
}

function tarballFetchRetries(): number {
  const n = Number(process.env.OPENCLAW_TARBALL_FETCH_RETRIES ?? '5')
  return Number.isFinite(n) && n >= 1 ? Math.min(20, Math.floor(n)) : 5
}

function tarballFetchTimeoutMs(): number {
  const n = Number(process.env.OPENCLAW_TARBALL_FETCH_TIMEOUT_MS ?? String(30 * 60 * 1000))
  return Number.isFinite(n) && n >= 60_000 ? Math.min(2 * 60 * 60 * 1000, Math.floor(n)) : 30 * 60 * 1000
}

function curlOnPath(): boolean {
  try {
    execFileSync('curl', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Windows `System32\\tar.exe` (bsdtar) often fails extracting GitHub tarballs (e.g. docs paths).
 * Prefer Git for Windows GNU tar, or `OPENCLAW_TAR_EXE` override.
 */
function resolveTarExecutable(): string {
  const override = process.env.OPENCLAW_TAR_EXE?.trim()
  if (override) return override
  if (process.platform !== 'win32') return 'tar'
  const candidates = [
    'C:\\Program Files\\Git\\usr\\bin\\tar.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\tar.exe',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return 'tar'
}

/**
 * Git for Windows `tar` runs in MSYS; drive-letter paths like `E:\...` break gzip (`Cannot connect to E: resolve failed`).
 * Use `/e/...` style paths for that binary.
 */
function pathsForTarExe(tarExe: string, tgzPath: string, extractDir: string): { tgz: string; cwd: string } {
  const tgz = resolve(tgzPath)
  const cwd = resolve(extractDir)
  if (process.platform !== 'win32') return { tgz, cwd }
  if (!/\\git\\/i.test(tarExe)) return { tgz, cwd }
  const toMsys = (abs: string) => {
    const m = /^([a-zA-Z]):[/\\](.*)$/i.exec(abs)
    if (!m) return abs.replace(/\\/g, '/')
    return `/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`
  }
  return { tgz: toMsys(tgz), cwd: toMsys(cwd) }
}

function extractTarGzToDir(tgzPath: string, extractDir: string): void {
  const tarExe = resolveTarExecutable()
  if (tarExe !== 'tar') {
    console.log(`  [control-ui] using ${tarExe} for tarball extract`)
  } else if (process.platform === 'win32') {
    console.warn(
      '  [warn] Git tar not found — using System32 tar (may fail on some archives). Install Git for Windows or set OPENCLAW_TAR_EXE.',
    )
  }
  const { tgz, cwd } = pathsForTarExe(tarExe, tgzPath, extractDir)
  execFileSync(tarExe, ['-xzf', tgz, '-C', cwd], { stdio: 'inherit' })
}

/**
 * Node fetch (Undici) often fails immediately with "terminated" on Windows toward codeload.github.com.
 * Prefer curl when available unless OPENCLAW_TARBALL_USE_FETCH=1.
 */
function tarballDownloadBackend(): 'curl' | 'fetch' {
  if (process.env.OPENCLAW_TARBALL_USE_FETCH === '1') {
    return 'fetch'
  }
  if (process.env.OPENCLAW_TARBALL_USE_CURL === '1') {
    return 'curl'
  }
  if (process.platform === 'win32' && curlOnPath()) {
    return 'curl'
  }
  return 'fetch'
}

async function downloadTarballWithCurl(url: string, dest: string, timeoutMs: number): Promise<void> {
  const out = resolve(dest)
  const maxTimeSec = Math.max(60, Math.ceil(timeoutMs / 1000))
  await unlink(out).catch(() => {})
  try {
    await execFileAsync(
      'curl',
      [
        '-fL',
        '--retry',
        '3',
        '--retry-delay',
        '2',
        '--connect-timeout',
        '120',
        '--max-time',
        String(maxTimeSec),
        '-A',
        'openclaw-desktop-bundle/ensure-control-ui',
        '-o',
        out,
        url,
      ],
      { maxBuffer: 4 * 1024 * 1024 },
    )
  } catch (err) {
    await unlink(out).catch(() => {})
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`curl: ${msg}`)
  }
  const st = await stat(out)
  if (st.size < 10_000) {
    await unlink(out).catch(() => {})
    throw new Error(`curl: downloaded file too small (${st.size} bytes)`)
  }
}

type OpenclawRootPackageJson = {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

/**
 * Vite bundles `../src/**` under `openclawRoot/src`. Rolldown resolves bare imports from the source
 * file upward, so `node_modules` must exist on `openclawRoot` (not only under `ui/`). Shared `src/`
 * imports the same packages as the OpenClaw CLI root `package.json` (`zod`, `@mariozechner/pi-ai`, …);
 * install that full dependency set from the extracted tag to avoid whack-a-mole missing modules.
 */
async function ensureOpenclawRootDepsForBundledSrc(
  openclawRoot: string,
  openclawRepoRoot: string,
): Promise<void> {
  const upstreamPath = join(openclawRepoRoot, 'package.json')
  if (!(await fileExists(upstreamPath))) {
    throw new Error(`[control-ui] missing OpenClaw package.json: ${upstreamPath}`)
  }
  const bundledPkgPath = join(openclawRoot, 'package.json')
  // Preserve the npm-published manifest (no workspace:*). Restoring the GitHub monorepo
  // package.json breaks later `npm install` steps (Feishu SDK, Slack patches, version checks).
  const bundledPkgBackup = (await fileExists(bundledPkgPath))
    ? await readFile(bundledPkgPath, 'utf8')
    : null
  const upstream = JSON.parse(await readFile(upstreamPath, 'utf8')) as OpenclawRootPackageJson
  const dependencies = { ...(upstream.dependencies ?? {}) }
  const droppedWorkspace: string[] = []
  for (const [name, range] of Object.entries(dependencies)) {
    if (typeof range === 'string' && range.startsWith('workspace:')) {
      droppedWorkspace.push(name)
      delete dependencies[name]
    }
  }
  if (droppedWorkspace.length > 0) {
    console.log(
      `  [control-ui] omitting workspace:* root deps from npm install stub: ${droppedWorkspace.join(', ')}`,
    )
  }
  if (Object.keys(dependencies).length === 0) {
    throw new Error(`[control-ui] OpenClaw package.json has no installable dependencies: ${upstreamPath}`)
  }
  const stub: Record<string, unknown> = {
    name: 'openclaw-desktop-control-ui-openclawroot',
    private: true,
    version: '0.0.0',
    dependencies,
  }
  const optional = upstream.optionalDependencies
  if (optional && Object.keys(optional).length > 0) {
    const cleanedOptional = { ...optional }
    for (const [name, range] of Object.entries(cleanedOptional)) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        delete cleanedOptional[name]
      }
    }
    if (Object.keys(cleanedOptional).length > 0) {
      stub.optionalDependencies = cleanedOptional
    }
  }
  await writeFile(bundledPkgPath, `${JSON.stringify(stub, null, 2)}\n`, 'utf8')
  execSync('npm install --no-audit --no-fund --legacy-peer-deps', {
    cwd: openclawRoot,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: '' },
  })
  if (bundledPkgBackup) {
    await writeFile(bundledPkgPath, `${bundledPkgBackup.trimEnd()}\n`, 'utf8')
    console.log('  [control-ui] restored npm package.json after root deps install')
  } else {
    // No prior npm manifest — fall back to GitHub package.json with workspace:* stripped.
    const upstreamPkg = JSON.parse(await readFile(upstreamPath, 'utf8')) as Record<string, unknown>
    if (upstreamPkg.dependencies && typeof upstreamPkg.dependencies === 'object') {
      const deps = { ...(upstreamPkg.dependencies as Record<string, string>) }
      for (const [name, range] of Object.entries(deps)) {
        if (typeof range === 'string' && range.startsWith('workspace:')) delete deps[name]
      }
      upstreamPkg.dependencies = deps
    }
    if (upstreamPkg.optionalDependencies && typeof upstreamPkg.optionalDependencies === 'object') {
      const opt = { ...(upstreamPkg.optionalDependencies as Record<string, string>) }
      for (const [name, range] of Object.entries(opt)) {
        if (typeof range === 'string' && range.startsWith('workspace:')) delete opt[name]
      }
      upstreamPkg.optionalDependencies = opt
    }
    await writeFile(bundledPkgPath, `${JSON.stringify(upstreamPkg, null, 2)}\n`, 'utf8')
  }
}

type WorkspacePkgJson = {
  name?: string
  dependencies?: Record<string, string>
  scripts?: Record<string, string>
}

/** Map package name → directory under `packages/` (from extracted monorepo). */
async function mapOpenClawPackageDirs(packagesRoot: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (!(await fileExists(packagesRoot))) return map
  const ents = await readdir(packagesRoot, { withFileTypes: true })
  for (const ent of ents) {
    if (!ent.isDirectory()) continue
    const dir = join(packagesRoot, ent.name)
    const pkgPath = join(dir, 'package.json')
    if (!(await fileExists(pkgPath))) continue
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8')) as WorkspacePkgJson
      if (pkg.name) map.set(pkg.name, dir)
    } catch {
      // ignore invalid package.json
    }
  }
  return map
}

async function rewriteWorkspaceProtocolInPackageJson(
  pkgJsonPath: string,
  nameToRelFile: Map<string, string>,
): Promise<number> {
  const raw = await readFile(pkgJsonPath, 'utf8')
  const pkg = JSON.parse(raw) as WorkspacePkgJson
  let changed = 0
  if (!pkg.dependencies) return 0
  for (const [depName, range] of Object.entries(pkg.dependencies)) {
    if (!range.startsWith('workspace:')) continue
    const rel = nameToRelFile.get(depName)
    if (!rel) {
      throw new Error(
        `[control-ui] unresolved workspace dep ${depName} in ${pkgJsonPath} (no local package dir)`,
      )
    }
    pkg.dependencies[depName] = `file:${rel}`
    changed++
  }
  if (changed > 0) {
    await writeFile(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  }
  return changed
}

/**
 * OpenClaw 2026.7+ Control UI depends on private monorepo packages via `workspace:*`
 * (e.g. `@openclaw/media-core`). npm cannot resolve that outside the pnpm workspace, so we
 * copy the needed packages, rewrite deps to `file:`, build them, then let `ui/` install.
 */
async function materializeOpenClawUiWorkspacePackages(
  openclawRoot: string,
  srcRoot: string,
  uiDest: string,
): Promise<void> {
  const uiPkgPath = join(uiDest, 'package.json')
  const uiPkg = JSON.parse(await readFile(uiPkgPath, 'utf8')) as WorkspacePkgJson
  const workspaceDepNames = Object.entries(uiPkg.dependencies ?? {})
    .filter(([, range]) => range.startsWith('workspace:'))
    .map(([name]) => name)
  const filePackageDepNames = Object.entries(uiPkg.dependencies ?? {})
    .filter(([, range]) => typeof range === 'string' && range.startsWith('file:../packages/'))
    .map(([name]) => name)

  if (workspaceDepNames.length === 0 && filePackageDepNames.length === 0) {
    console.log('  [control-ui] no workspace/file packages deps in ui/ — skip package materialize')
    return
  }

  // If a previous failed build left `file:../packages/*` but no dist, still materialize from srcRoot.
  const neededSeed = workspaceDepNames.length > 0 ? workspaceDepNames : filePackageDepNames
  // Restore workspace protocol so rewrite path below is consistent when seed came from file: deps.
  if (workspaceDepNames.length === 0 && filePackageDepNames.length > 0) {
    for (const name of filePackageDepNames) {
      if (uiPkg.dependencies) uiPkg.dependencies[name] = 'workspace:*'
    }
    await writeFile(uiPkgPath, `${JSON.stringify(uiPkg, null, 2)}\n`, 'utf8')
  }

  const srcPackages = join(srcRoot, 'packages')
  const nameToSrcDir = await mapOpenClawPackageDirs(srcPackages)
  const needed = new Set<string>(neededSeed)

  // Expand transitive workspace deps (BFS).
  const queue = [...needed]
  while (queue.length > 0) {
    const name = queue.shift()!
    const srcDir = nameToSrcDir.get(name)
    if (!srcDir) {
      throw new Error(
        `[control-ui] ui depends on ${name} (workspace:*) but packages/ has no matching package.json`,
      )
    }
    const nested = JSON.parse(await readFile(join(srcDir, 'package.json'), 'utf8')) as WorkspacePkgJson
    for (const [depName, range] of Object.entries(nested.dependencies ?? {})) {
      if (!range.startsWith('workspace:')) continue
      if (needed.has(depName)) continue
      needed.add(depName)
      queue.push(depName)
    }
  }

  const destPackages = join(openclawRoot, 'packages')
  await mkdir(destPackages, { recursive: true })

  const nameToDestDir = new Map<string, string>()
  for (const name of needed) {
    const srcDir = nameToSrcDir.get(name)!
    const folder = srcDir.split(/[/\\]/).pop()!
    const destDir = join(destPackages, folder)
    await rm(destDir, { recursive: true, force: true })
    await cp(srcDir, destDir, { recursive: true })
    // Drop any vendored node_modules from the tarball to force a clean install.
    await rm(join(destDir, 'node_modules'), { recursive: true, force: true })
    nameToDestDir.set(name, destDir)
    console.log(`  [control-ui] materialized workspace package ${name} → packages/${folder}`)
  }

  // Rewrite workspace:* → file: relative paths (ui + each package).
  const uiNameToRel = new Map<string, string>()
  for (const [name, destDir] of nameToDestDir) {
    const folder = destDir.split(/[/\\]/).pop()!
    uiNameToRel.set(name, `../packages/${folder}`)
  }
  await rewriteWorkspaceProtocolInPackageJson(uiPkgPath, uiNameToRel)

  for (const destDir of nameToDestDir.values()) {
    const pkgNameToRel = new Map<string, string>()
    for (const [name, otherDir] of nameToDestDir) {
      if (otherDir === destDir) continue
      const folder = otherDir.split(/[/\\]/).pop()!
      pkgNameToRel.set(name, `../${folder}`)
    }
    await rewriteWorkspaceProtocolInPackageJson(join(destDir, 'package.json'), pkgNameToRel)
  }

  // Build leaf → dependents (simple multi-pass: build any package whose workspace deps already built).
  const built = new Set<string>()
  const pending = new Set(needed)
  let guard = 0
  while (pending.size > 0 && guard < 20) {
    guard++
    let progress = false
    for (const name of [...pending]) {
      const destDir = nameToDestDir.get(name)!
      const pkg = JSON.parse(await readFile(join(destDir, 'package.json'), 'utf8')) as WorkspacePkgJson
      const wsDeps = Object.entries(pkg.dependencies ?? {})
        .filter(([, r]) => r.startsWith('file:../'))
        .map(([n]) => n)
        .filter((n) => needed.has(n))
      if (wsDeps.some((d) => !built.has(d))) continue

      console.log(`  [control-ui] building workspace package ${name}...`)
      execSync('npm install --no-audit --no-fund', {
        cwd: destDir,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: '' },
      })
      if (pkg.scripts?.build) {
        // Monorepo packages call `tsdown` from the workspace root; install locally for desktop builds.
        if (/\btsdown\b/.test(pkg.scripts.build)) {
          execSync('npm install --no-save --no-audit --no-fund tsdown@0.22.1', {
            cwd: destDir,
            stdio: 'inherit',
            env: { ...process.env, NODE_ENV: '' },
          })
        }
        execSync('npm run build', {
          cwd: destDir,
          stdio: 'inherit',
          env: { ...process.env, NODE_ENV: '' },
        })
      }
      built.add(name)
      pending.delete(name)
      progress = true
    }
    if (!progress) {
      throw new Error(
        `[control-ui] could not build workspace packages (cycle or missing build?): ${[...pending].join(', ')}`,
      )
    }
  }

  console.log(`  [control-ui] workspace packages ready (${built.size})`)
}

/** Hoist `@openclaw/*` installed under ui/node_modules to the OpenClaw root for Vite resolution. */
async function hoistOpenClawScopedModules(openclawRoot: string, uiDest: string): Promise<void> {
  const from = join(uiDest, 'node_modules', '@openclaw')
  if (!(await fileExists(from))) return
  const toParent = join(openclawRoot, 'node_modules')
  const to = join(toParent, '@openclaw')
  await mkdir(toParent, { recursive: true })
  await rm(to, { recursive: true, force: true })
  await cp(from, to, { recursive: true })
  console.log('  [control-ui] hoisted ui/node_modules/@openclaw → openclaw root node_modules')
}

/**
 * Packages imported by Control UI but not declared in ui/package.json (resolved via pnpm in the
 * OpenClaw monorepo). Keep versions loose enough for npm to resolve with lit@3.
 */
const CONTROL_UI_EXTRA_NPM_DEPS = ['@lit/context@^1.1.0'] as const

async function ensureControlUiExtraNpmDeps(uiDest: string): Promise<void> {
  console.log(`  [control-ui] installing extra UI deps: ${CONTROL_UI_EXTRA_NPM_DEPS.join(', ')}`)
  execSync(`npm install --no-audit --no-fund --no-save ${CONTROL_UI_EXTRA_NPM_DEPS.join(' ')}`, {
    cwd: uiDest,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: '' },
  })
}

/** Fail fast if Control UI `@openclaw/*` packages under ui/node_modules are empty/missing. */
async function assertControlUiOpenClawPackages(uiDest: string): Promise<void> {
  const required = [
    join(uiDest, 'node_modules', '@openclaw', 'uirouter', 'dist', 'index.js'),
    join(uiDest, 'node_modules', '@openclaw', 'libterminal', 'dist', 'browser.js'),
  ]
  const missing = []
  for (const p of required) {
    if (!(await fileExists(p))) missing.push(p)
  }
  if (missing.length > 0) {
    throw new Error(
      `[control-ui] missing @openclaw packages required by Control UI Vite build:\n${missing.map((p) => `  - ${p}`).join('\n')}`,
    )
  }
}

async function findExtractedRepoRoot(extractParent: string): Promise<string> {
  const names = await readdir(extractParent, { withFileTypes: true })
  for (const ent of names) {
    if (!ent.isDirectory()) continue
    const root = join(extractParent, ent.name)
    const uiPkg = join(root, 'ui', 'package.json')
    const uiScript = join(root, 'scripts', 'ui.js')
    if ((await fileExists(uiPkg)) && (await fileExists(uiScript))) {
      return root
    }
  }
  throw new Error(
    `Extracted OpenClaw archive under ${extractParent} has no ui/package.json + scripts/ui.js`,
  )
}

async function downloadTarballToFileOnce(url: string, dest: string, timeoutMs: number): Promise<void> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': 'openclaw-desktop-bundle/ensure-control-ui' },
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }
    if (!res.body) {
      throw new Error('response has no body')
    }
    const nodeReadable = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream)
    await pipeline(nodeReadable, createWriteStream(dest))
  } catch (err) {
    await unlink(dest).catch(() => {})
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`download timed out after ${Math.round(timeoutMs / 1000)}s (${url})`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Stream tarball to disk. On Windows defaults to curl (avoids Undici "terminated"); else Node fetch.
 */
async function downloadToFile(url: string, dest: string): Promise<void> {
  const attempts = tarballFetchRetries()
  const timeoutMs = tarballFetchTimeoutMs()
  let backend = tarballDownloadBackend()
  if (backend === 'curl' && !curlOnPath()) {
    console.warn('  [warn] curl not found on PATH — falling back to Node fetch')
    backend = 'fetch'
  }
  if (backend === 'curl') {
    console.log('  [control-ui] using curl for tarball download (set OPENCLAW_TARBALL_USE_FETCH=1 to force Node fetch)')
  }
  let lastErr: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      if (backend === 'curl') {
        await downloadTarballWithCurl(url, dest, timeoutMs)
      } else {
        await downloadTarballToFileOnce(url, dest, timeoutMs)
      }
      const st = await stat(dest)
      if (st.size < 10_000) {
        throw new Error(`downloaded file too small (${st.size} bytes)`)
      }
      return
    } catch (e) {
      lastErr = e
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`  [warn] tarball download attempt ${i}/${attempts} failed: ${msg}`)
      // Missing GitHub tags (npm republish suffixes) — do not burn retries.
      if (/\b404\b|returned error:\s*404|HTTP 404/i.test(msg)) {
        break
      }
      if (
        backend === 'fetch' &&
        i === 1 &&
        (msg === 'terminated' || msg.includes('terminated')) &&
        curlOnPath()
      ) {
        console.warn('  [warn] switching to curl after fetch "terminated"')
        backend = 'curl'
      }
      if (i < attempts) {
        const backoff = Math.min(20_000, 2000 * 2 ** (i - 1))
        await new Promise((r) => setTimeout(r, backoff))
      }
    }
  }
  const hint =
    'Check network/VPN/proxy, or set OPENCLAW_SOURCE_TARBALL_URL to a mirror of the same tag tarball. ' +
    'On Windows, curl is used by default (OPENCLAW_TARBALL_USE_FETCH=1 to force Node fetch). ' +
    'Optional: OPENCLAW_TARBALL_FETCH_RETRIES, OPENCLAW_TARBALL_FETCH_TIMEOUT_MS.'
  const last = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(`Failed to download OpenClaw sources after ${attempts} attempts (${last}). ${hint}`)
}

/**
 * Fetch OpenClaw `ui/` from GitHub tag matching `npmPackageVersion` and run `vite build`
 * into `openclawRoot/dist/control-ui`. Does not delete sources (caller may clean up).
 */
export async function downloadAndBuildOpenClawControlUiAt(
  openclawRoot: string,
  npmPackageVersion: string,
): Promise<void> {
  const parentTmp = join(
    openclawRoot,
    '..',
    `_openclaw_control_ui_tmp_${Date.now()}_${randomBytes(4).toString('hex')}`,
  )
  await mkdir(parentTmp, { recursive: true })

  const tgzPath = join(parentTmp, 'openclaw-src.tgz')
  const extractDir = join(parentTmp, 'extracted')

  try {
    const urlOverride = resolveTarballUrlOverride()
    if (urlOverride) {
      console.log(
        `  [control-ui] fetching sources for npm ${npmPackageVersion} (override URL)...`,
      )
      await downloadToFile(urlOverride, tgzPath)
    } else {
      const tags = gitTagCandidatesForNpmVersion(npmPackageVersion)
      let downloaded = false
      let lastErr: unknown
      for (const tag of tags) {
        const url = tarballUrlForTag(tag)
        console.log(
          `  [control-ui] fetching ${tag} sources (${url.split('/').slice(0, 3).join('/')}/...)...`,
        )
        try {
          await downloadToFile(url, tgzPath)
          if (tag !== gitTagForNpmVersion(npmPackageVersion)) {
            console.log(
              `  [control-ui] npm ${npmPackageVersion} → GitHub tag ${tag} (exact tag missing; used republish fallback)`,
            )
          } else {
            console.log(`  [control-ui] using GitHub tag ${tag}`)
          }
          downloaded = true
          break
        } catch (e) {
          lastErr = e
          const msg = e instanceof Error ? e.message : String(e)
          console.warn(`  [warn] tag ${tag} failed: ${msg.split('\n')[0]}`)
        }
      }
      if (!downloaded) {
        const last = lastErr instanceof Error ? lastErr.message : String(lastErr)
        throw new Error(
          `No GitHub source tarball for openclaw@${npmPackageVersion} (tried ${tags.join(', ')}). ${last}`,
        )
      }
    }

    await mkdir(extractDir, { recursive: true })
    extractTarGzToDir(tgzPath, extractDir)

    const srcRoot = await findExtractedRepoRoot(extractDir)
    const uiSrc = join(srcRoot, 'ui')
    const uiDest = join(openclawRoot, 'ui')
    const sharedSrc = join(srcRoot, 'src')
    const sharedDest = join(openclawRoot, 'src')
    const scriptSrc = join(srcRoot, 'scripts', 'ui.js')
    const scriptDestDir = join(openclawRoot, 'scripts')
    const scriptDest = join(scriptDestDir, 'ui.js')

    await rm(uiDest, { recursive: true, force: true })
    await cp(uiSrc, uiDest, { recursive: true })
    await rm(sharedDest, { recursive: true, force: true })
    await cp(sharedSrc, sharedDest, { recursive: true })

    const appsSrc = join(srcRoot, 'apps')
    const appsDest = join(openclawRoot, 'apps')
    if (await fileExists(appsSrc)) {
      await rm(appsDest, { recursive: true, force: true })
      await cp(appsSrc, appsDest, { recursive: true })
    }

    await mkdir(scriptDestDir, { recursive: true })
    await cp(scriptSrc, scriptDest)

    // Vite Control UI resolves monorepo tsconfig path aliases from the OpenClaw repo root.
    for (const name of [
      'tsconfig.json',
      'tsconfig.core.json',
      'tsconfig.core.projects.json',
      'tsconfig.projects.json',
      'tsconfig.extensions.json',
      'tsconfig.extensions.projects.json',
      'tsconfig.plugin-sdk.dts.json',
    ]) {
      const from = join(srcRoot, name)
      if (await fileExists(from)) {
        await cp(from, join(openclawRoot, name))
      }
    }

    // UI sources import `../../../packages/<name>/src/...` — copy the full packages tree.
    const srcPackagesAll = join(srcRoot, 'packages')
    if (await fileExists(srcPackagesAll)) {
      const destPackagesAll = join(openclawRoot, 'packages')
      await rm(destPackagesAll, { recursive: true, force: true })
      await cp(srcPackagesAll, destPackagesAll, { recursive: true })
      console.log('  [control-ui] copied monorepo packages/ for Control UI source imports')
    }

    await applyOpenClawUiLitDecoratorCompatPatches(uiDest)

    // OpenClaw 2026.7+ ui/ depends on private workspace packages (@openclaw/media-core, …).
    await materializeOpenClawUiWorkspacePackages(openclawRoot, srcRoot, uiDest)

    console.log('  [control-ui] npm install in ui/ (Vite + deps)...')
    execSync('npm install --no-audit --no-fund', {
      cwd: uiDest,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: '' },
    })

    // Upstream ui/package.json omits some imports that the monorepo resolves via pnpm hoisting
    // (e.g. `@lit/context`). Install them explicitly for standalone npm builds.
    await ensureControlUiExtraNpmDeps(uiDest)

    console.log('  [control-ui] npm install OpenClaw root deps at openclaw root (for ../src/** resolution)...')
    await ensureOpenclawRootDepsForBundledSrc(openclawRoot, srcRoot)

    // Vite aliases `@openclaw/uirouter` + `@openclaw/libterminal` to openclawRoot/node_modules.
    // Must run AFTER root `npm install`, which otherwise deletes a prior hoist ("removed N packages").
    await hoistOpenClawScopedModules(openclawRoot, uiDest)
    await assertControlUiOpenClawPackages(uiDest)

    console.log('  [control-ui] vite build → dist/control-ui')
    execSync('npm run build', {
      cwd: uiDest,
      stdio: 'inherit',
    })

    const controlUiDist = join(openclawRoot, 'dist', 'control-ui')
    await transpileControlUiForElectronEmbedded(controlUiDist)

    await writeFile(join(controlUiDist, CONTROL_UI_ELECTRON_LIT_MARKER), '1\n', 'utf8')

    const indexHtml = join(openclawRoot, 'dist', 'control-ui', 'index.html')
    if (!(await fileExists(indexHtml))) {
      throw new Error(`Control UI build finished but missing: ${indexHtml}`)
    }
  } finally {
    try {
      await rm(parentTmp, { recursive: true, force: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(
        `  [warn] control-ui temp cleanup failed (${parentTmp}): ${msg.split('\n')[0]} (safe to delete manually)`,
      )
    }
  }
}

async function removeBundledUiSources(openclawDir: string): Promise<void> {
  const uiDest = join(openclawDir, 'ui')
  const sharedDest = join(openclawDir, 'src')
  const appsDest = join(openclawDir, 'apps')
  const packagesDest = join(openclawDir, 'packages')
  const scriptDest = join(openclawDir, 'scripts', 'ui.js')
  const scriptDestDir = join(openclawDir, 'scripts')
  await rm(uiDest, { recursive: true, force: true })
  await rm(sharedDest, { recursive: true, force: true })
  await rm(appsDest, { recursive: true, force: true })
  await rm(packagesDest, { recursive: true, force: true })
  for (const name of [
    'tsconfig.json',
    'tsconfig.core.json',
    'tsconfig.core.projects.json',
    'tsconfig.projects.json',
    'tsconfig.extensions.json',
    'tsconfig.extensions.projects.json',
    'tsconfig.plugin-sdk.dts.json',
  ]) {
    await rm(join(openclawDir, name), { force: true })
  }
  await rm(scriptDest, { force: true })
  try {
    const rest = await readdir(scriptDestDir)
    if (rest.length === 0) {
      await rm(scriptDestDir, { recursive: true, force: true })
    }
  } catch {
    // ignore
  }
}

/**
 * If `dist/control-ui/index.html` is missing under `openclawDir`, fetch matching GitHub tag sources and build.
 * Strips `ui/` + `src/` + `apps/` + `scripts/ui.js` after a successful build to keep the bundle lean.
 */
export async function ensureOpenClawControlUiBuilt(
  openclawDir: string,
  npmPackageVersion: string,
): Promise<void> {
  const controlUiDist = join(openclawDir, 'dist', 'control-ui')
  const indexHtml = join(controlUiDist, 'index.html')
  const markerPath = join(controlUiDist, CONTROL_UI_ELECTRON_LIT_MARKER)
  if (await fileExists(indexHtml)) {
    if (await fileExists(markerPath)) {
      console.log('  [control-ui] dist/control-ui already present (Electron Lit compat) — skip')
      return
    }
    console.log(
      '  [control-ui] dist/control-ui present but missing Electron Lit compat marker — rebuilding from GitHub...',
    )
    await rm(controlUiDist, { recursive: true, force: true })
  }

  console.log(`  [control-ui] building Control UI from GitHub sources for ${npmPackageVersion}...`)
  await downloadAndBuildOpenClawControlUiAt(openclawDir, npmPackageVersion)

  console.log('  [control-ui] removing ui/ sources and dev install from bundle...')
  await removeBundledUiSources(openclawDir)

  console.log('  [control-ui] OK')
}
