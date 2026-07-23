/**
 * Shared types — used by main and renderer processes.
 * Compatible with upstream OpenClaw configuration shape.
 */

import type { ShellLocale } from './shell-locale.js'

// ─── ShellConfig ─────────────────────────────────────────────────────────────

/** Window position and size */
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

/** Desktop shell theme */
export type ShellTheme = 'system' | 'light' | 'dark'

/** Update channel */
export type UpdateChannel = 'stable' | 'beta'

export type { ShellLocale }

/** Desktop shell settings stored in %APPDATA%\OpenClaw Desktop Plus\config.json */
export interface ShellConfig {
  closeToTray: boolean
  autoStart: boolean
  theme: ShellTheme
  /** Preferred UI language; omit to follow OS locale */
  locale?: ShellLocale
  lastGatewayPort: number
  updateChannel: UpdateChannel
  /** After first-run wizard: whether main-window expand ran once */
  onboardingMainWindowExpanded?: boolean
  /** Whether to check for updates automatically; default true */
  autoCheckUpdates?: boolean
  /** Last update check time (ISO 8601) */
  lastUpdateCheck?: string
  windowBounds: WindowBounds
}

// ─── OpenClawConfig ───────────────────────────────────────────────────────────

/** Gateway authentication config (upstream: `none` mode removed — use token or password) */
export interface GatewayAuthConfig {
  mode?: 'token' | 'password'
  token?: string
  /** Used when `mode` is `password` (or implied); same field as upstream `gateway.auth.password`. */
  password?: string
}

/** Gateway Control UI policy (upstream `gateway.controlUi.*`) */
export interface GatewayControlUiConfig {
  /**
   * When true, loopback Control UI may connect with token/password only if device identity
   * is unavailable (e.g. Electron sandboxed iframe without `crypto.subtle`).
   * Required for embedded dashboard in OpenClaw Desktop Plus.
   */
  allowInsecureAuth?: boolean
  /**
   * When true, skip Control UI device-identity requirements on loopback (upstream
   * `gateway.controlUi.dangerouslyDisableDeviceAuth`). Needed with OpenClaw ≥2026.3.x when the
   * embedded iframe still hits 500 / device-identity failures despite `allowInsecureAuth`.
   */
  dangerouslyDisableDeviceAuth?: boolean
  /**
   * Browser/WebSocket origins allowed for Control UI (upstream `gateway.controlUi.allowedOrigins`).
   * Desktop may seed `["*"]` on loopback bind when empty so Electron embeds pass origin checks.
   */
  allowedOrigins?: string[]
  /** Custom filesystem root for built Control UI (upstream `gateway.controlUi.root`) */
  root?: string
}

/** Gateway config */
export interface GatewayRemoteConfig {
  /** WebSocket URL, e.g. ws://127.0.0.1:18789 (SSH tunnel) or ws://host:18789 (direct) */
  url?: string
  /** Client token for the remote gateway */
  token?: string
  /** Client password when remote uses password auth */
  password?: string
  /** How the desktop reaches the remote gateway */
  transport?: 'direct' | 'ssh'
}

/** Gateway config */
export interface GatewayConfig {
  /** Matches upstream doctor: local (desktop shell) or remote */
  mode?: 'local' | 'remote'
  port?: number
  /** Upstream `gateway run --bind`: loopback | lan | tailnet | auto | custom */
  bind?: 'loopback' | 'lan' | 'auto' | 'tailnet' | 'custom'
  auth?: GatewayAuthConfig
  controlUi?: GatewayControlUiConfig
  /** Remote client target when `mode` is `remote` */
  remote?: GatewayRemoteConfig
  /** When true, pass --force on port conflict (aligned with gateway run) */
  forcePortOnConflict?: boolean
}

/** Auth profile selection entry (aligned with upstream OpenClaw) */
export interface AuthProfileSelection {
  provider: string
  mode: 'api_key' | 'oauth' | 'token'
  email?: string
}

/** Auth config (aligned with upstream OpenClaw) */
export interface AuthCooldownsConfig {
  /**
   * How many auth-profile rotations to try on rate-limit before escalating to the next
   * model in `agents.defaults.model.fallbacks` (upstream default: 1).
   */
  rateLimitedProfileRotations?: number
  [key: string]: unknown
}

/** Auth config (aligned with upstream OpenClaw) */
export interface AuthConfig {
  profiles?: Record<string, AuthProfileSelection>
  order?: Record<string, string[]>
  cooldowns?: AuthCooldownsConfig
}

/** Default model settings */
export interface AgentModelDefaults {
  primary?: string
  /** Fallback model chain (provider/model) */
  fallbacks?: string[]
}

/** Default model alias entry */
export interface AgentModelAlias {
  alias?: string
}

/** Agent defaults */
export interface AgentDefaultsConfig {
  /** CLI compatibility: model may be a string (provider/model) */
  model?: AgentModelDefaults | string
  /** Optional model alias map (e.g. moonshot/kimi-k2.5) */
  models?: Record<string, AgentModelAlias>
  workspace?: string
  /**
   * Vision model when the primary cannot accept images (string or `{ primary, fallbacks }`).
   * Used for Control UI image attachments and the `image` tool.
   */
  imageModel?: string | AgentModelDefaults
  /**
   * PDF routing model (string or `{ primary, fallbacks }`). Falls back to imageModel, then session model.
   */
  pdfModel?: string | AgentModelDefaults
}

/** Single agent entry (OpenClaw `agents.list[]`; multi-agent routing) */
export interface AgentListEntry {
  id: string
  name?: string
  workspace?: string
  agentDir?: string
  /** Upstream accepts `provider/model` string or structured model */
  model?: string | AgentModelDefaults
  [key: string]: unknown
}

/** Agents section */
export interface AgentsConfig {
  defaults?: AgentDefaultsConfig
  /** Optional multi-agent list (same shape as upstream `openclaw.json`) */
  list?: AgentListEntry[]
}

/** Feishu (Lark) channel config */
export interface FeishuChannelConfig {
  appId?: string
  appSecret?: string
  verificationToken?: string
  encryptKey?: string
  /** DM access policy; desktop wizard defaults to `pairing` */
  dmPolicy?: 'pairing' | 'open' | 'allowlist' | 'disabled'
}

/** Single pending Feishu DM pairing row (read from credentials/*.json) */
export interface FeishuPairingRequest {
  code: string
  openId?: string
  displayName?: string
  createdAt?: string
  expiresAt?: string
}

export interface FeishuApprovedSender {
  openId: string
}

export interface PairingListPendingResult {
  channel: 'feishu'
  requests: FeishuPairingRequest[]
}

export interface PairingListApprovedResult {
  channel: 'feishu'
  senders: FeishuApprovedSender[]
}

/** Stable keys for Feishu pairing approve — renderer maps to i18n (shell.feishu.*). */
export type PairingApproveMessageId = 'pairing_code_required' | 'local_approve_success'

export interface PairingApproveResult {
  ok: boolean
  message?: string
  /** When set, prefer localized shell.feishu strings over raw `message`. */
  messageId?: PairingApproveMessageId
  messageParams?: {
    openId?: string
    code?: string
  }
}

/** Wizard Telegram channel (aligned with upstream TelegramConfig) */
export interface TelegramChannelConfig {
  enabled?: boolean
  botToken?: string
}

/** Wizard Discord channel (aligned with upstream DiscordConfig) */
export interface DiscordChannelConfig {
  enabled?: boolean
  token?: string
}

/** Wizard Slack channel (aligned with upstream SlackConfig) */
export interface SlackChannelConfig {
  mode?: 'socket' | 'http'
  botToken?: string
  signingSecret?: string
  appToken?: string
}

/** Per-account WhatsApp entry (upstream `channels.whatsapp.accounts.*`) */
export interface WhatsAppAccountConfig {
  name?: string
  enabled?: boolean
  /** Override Baileys auth directory for this account */
  authDir?: string
}

/** Wizard WhatsApp channel (aligned with upstream; QR pairing via Control UI) */
export interface WhatsAppChannelConfig {
  enabled?: boolean
  /** Default account id when multiple accounts are configured */
  defaultAccount?: string
  /** Multi-number / multi-session accounts (Baileys) */
  accounts?: Record<string, WhatsAppAccountConfig>
}

/** Channels keyed by channel name */
export interface ChannelsConfig {
  feishu?: FeishuChannelConfig
  telegram?: TelegramChannelConfig
  discord?: DiscordChannelConfig
  slack?: SlackChannelConfig
  whatsapp?: WhatsAppChannelConfig
  [key: string]: unknown
}

/** Main OpenClaw config at %USERPROFILE%\.openclaw\openclaw.json */
export interface OpenClawConfig {
  gateway?: GatewayConfig
  agents?: AgentsConfig
  channels?: ChannelsConfig
  auth?: AuthConfig
  models?: ModelsConfig
  [key: string]: unknown
}

/** Custom / extended model provider entry */
export interface ModelProviderConfig {
  baseUrl?: string
  compatibility?: 'openai' | 'anthropic'
  /** Upstream field: model API kind */
  api?: string
  apiKey?: string
  /** Custom HTTP headers */
  headers?: Record<string, string>
  /**
   * Third-party `anthropic-messages` hosts that expect Bearer credentials (Synthetic, OpenCode Zen, Kimi Coding, Cloudflare gateway, etc.) use `true`. MiniMax (`api.minimax.io`) uses Anthropic-style `x-api-key` — omit or `false`. Use `false` for local proxies (e.g. copilot-proxy).
   */
  authHeader?: boolean
  models?: Array<Record<string, unknown> & { id: string; name?: string }>
}

/** Models section (CLI-aligned) */
export interface ModelsConfig {
  mode?: 'merge' | 'replace'
  providers?: Record<string, ModelProviderConfig>
}

// ─── WizardState ─────────────────────────────────────────────────────────────

/** Model provider id */
export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'openai-codex'
  | 'google'
  | 'openrouter'
  | 'opencode'
  | 'mistral'
  | 'minimax'
  | 'moonshot'
  | 'moonshot-cn' // UI alias: moonshot with China endpoint (api.moonshot.cn)
  | 'zai'
  | 'venice'
  | 'groq'
  | 'xai'
  | 'cerebras'
  | 'huggingface'
  | 'github-copilot'
  | 'kilocode'
  | 'volcengine'
  | 'volcengine-plan'
  | 'byteplus'
  | 'byteplus-plan'
  | 'qianfan'
  | 'bedrock'
  | 'cloudflare-ai-gateway'
  | 'litellm'
  | 'together'
  | 'nvidia'
  | 'qwen-portal'
  | 'google-vertex'
  | 'google-gemini-cli'
  | 'ollama'
  | 'vllm'
  | 'lmstudio'
  | 'vercel-ai-gateway'
  | 'synthetic'
  | 'xiaomi'
  | 'kimi-coding'
  | 'chutes'
  | 'copilot-proxy'
  | 'kuae' // Kuae Cloud Coding Plan
  | 'custom'

/** Wizard model step data */
export interface ModelConfig {
  provider: ModelProvider
  apiKey: string
  modelId: string
  /** Moonshot endpoint region */
  moonshotRegion?: 'global' | 'cn'
  /** Custom provider: real provider id */
  customProviderId?: string
  /** Custom provider: API base URL */
  customBaseUrl?: string
  /**
   * Optional API base URL override for any provider (LiteLLM proxy, self-hosted OpenAI-compatible,
   * custom OpenRouter gateway, etc.). When set, written to `models.providers.<id>.baseUrl`.
   */
  endpointUrl?: string
  /** Custom provider: protocol compatibility */
  customCompatibility?: 'openai' | 'anthropic'
  /** Cloudflare AI Gateway: Account ID */
  cloudflareAccountId?: string
  /** Cloudflare AI Gateway: Gateway ID */
  cloudflareGatewayId?: string
}

/** Wizard channel step data */
export interface ChannelConfig {
  feishu: FeishuChannelConfig | null
  telegram: TelegramChannelConfig | null
  discord: DiscordChannelConfig | null
  slack: SlackChannelConfig | null
  whatsapp: WhatsAppChannelConfig | null
  selectedChannel: 'feishu' | 'telegram' | 'whatsapp' | 'discord' | 'slack'
  skipChannels: boolean
}

/** Wizard gateway step data */
export interface GatewayWizardConfig {
  port: number
  bind: 'loopback' | 'lan' | 'auto'
  authToken: string
}

/** Wizard progress (in-memory, Zustand) */
export interface WizardState {
  currentStep: number
  modelConfig: ModelConfig
  channelConfig: ChannelConfig
  gatewayConfig: GatewayWizardConfig
}

// ─── WizardCompleteResult ─────────────────────────────────────────────────────

/** Result of wizard completeSetup */
export interface WizardCompleteResult {
  ok: boolean
  port?: number
  error?: string
  phase?: 'config' | 'auth' | 'gateway'
}

/** Settings → model editor: load snapshot */
export interface ModelSettingsLoadResult {
  hasConfig: boolean
  modelConfig: ModelConfig
  /** Extra agents from `agents.list` (for per-agent model target) */
  agents: Array<{ id: string; name?: string; currentModel?: string }>
  /** Resolved default primary for display */
  defaultPrimaryDisplay?: string
}

/** Settings → model editor: apply payload */
export interface ModelSettingsApplyPayload {
  modelConfig: ModelConfig
  target: { kind: 'defaults' } | { kind: 'agent'; agentId: string }
  /** When true, restart Gateway after write so changes take effect immediately */
  restartGateway: boolean
}

/** Settings → model editor: apply result */
export interface ModelSettingsApplyResult {
  ok: boolean
  error?: string
  restarted?: boolean
  validationIssues?: Array<{ path: string; message: string }>
}

// ─── BundleManifest / AppVersionInfo ────────────────────────────────────────

/** Bundle manifest from prepare-bundle (About / Update Center) */
export interface BundleManifest {
  shellVersion: string
  bundledOpenClawVersion: string
}

/** Collected app version info */
export interface AppVersionInfo {
  shell: string
  electron: string
  node: string
  openclaw: string
}

// ─── GatewayStatus ───────────────────────────────────────────────────────────

/** Gateway lifecycle status */
export type GatewayStatusValue = 'starting' | 'running' | 'stopped' | 'error'

/** Gateway child process snapshot */
export interface GatewayStatus {
  running: boolean
  port: number
  pid: number | null
  uptime: number
  status: GatewayStatusValue
  /** local = bundled process; remote = connect to gateway.remote.url */
  mode?: 'local' | 'remote'
  /** Prefers remote HTTP Control UI origin when mode is remote (no #token hash) */
  controlUrl?: string
}

// ─── Registry (Skills / Extensions / Commands) ──────────────────────────────

/** Skill discovery source */
export type SkillSource = 'bundled' | 'user-workspace' | 'user-extensions' | 'load-path'

/** Extension discovery source */
export type ExtensionSource = 'bundled' | 'user-extensions' | 'load-path'

/** Skill registry row */
export interface SkillRegistryItem {
  id: string
  name: string
  description?: string
  source: SkillSource
  enabled: boolean
  path: string
  version?: string
  requires?: { bins?: string[]; env?: string[]; config?: string[] }
  conflict?: string
}

/** Extension registry row */
export interface ExtensionRegistryItem {
  id: string
  name: string
  description?: string
  source: ExtensionSource
  enabled: boolean
  path: string
  version?: string
  providers?: string[]
  tools?: string[]
  commands?: string[]
  error?: string
}

/** Plugin row from `openclaw plugins list --json` */
export interface PluginInfo {
  id: string
  name?: string
  status: 'loaded' | 'disabled' | 'error'
  description?: string
  source?: string
  origin?: string
  version?: string
  error?: string
}

/** Validation outcome */
export interface ValidationResult {
  ok: boolean
  errors?: string[]
  warnings?: string[]
}

/** Registry export summary */
export interface RegistryExportSummary {
  skills: string[]
  extensions: string[]
  exportedAt: string
}

// ─── Update / Verify / Repair ────────────────────────────────────────────────

/** GitHub release check result */
export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion?: string
  releaseUrl?: string
  releaseNotes?: string
  publishedAt?: string
  downloadUrl?: string
  error?: string
}

/** Bundled resources verification */
export interface BundleVerifyResult {
  ok: boolean
  nodeExists: boolean
  openclawExists: boolean
  missing: string[]
  versions: {
    shell: string
    electron: string
    node: string
    openclaw: string
  }
}

/** Pre-start check payload for the renderer */
export interface PrestartCheckFrontend {
  ok: boolean
  bundleOk: boolean
  configExists: boolean
  configParseable: boolean
  errors: string[]
  fixSuggestions: string[]
}

/** Post-update validation (rollback hints for Update Center) */
export interface PostUpdateValidationResult {
  ran: boolean
  ok: boolean
  report?: DiagnosticReport
  rollbackGuidance: string
}

// ─── Diagnostics (Doctor proxy) ────────────────────────────────────────────────

/** Diagnostic severity */
export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'pass'

/** Single diagnostic line */
export interface DiagnosticItem {
  id: string
  level: DiagnosticLevel
  message: string
  fix?: string
  source?: 'cli' | 'prestart' | 'desktop'
}

/** Full diagnostic report */
export interface DiagnosticReport {
  ok: boolean
  items: DiagnosticItem[]
  runAt: string
}
