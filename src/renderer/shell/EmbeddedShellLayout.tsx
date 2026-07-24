import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Info, Key, Puzzle, RefreshCw, LayoutDashboard, Cpu, Radio, ChevronLeft, Paperclip, ListTodo, Timer, Server } from 'lucide-react'
import { LoadingView } from './LoadingView'
import { ErrorView, type ErrorType } from './ErrorView'
import { SettingsView } from './SettingsView'
import { AboutView } from './AboutView'
import { DashboardView } from './DashboardView'
import { ProviderView } from './ProviderView'
import { SkillsView } from './SkillsView'
import { UpdateView } from './UpdateView'
import { FeishuAccessView } from './FeishuAccessView'
import { ChannelsView } from './ChannelsView'
import { ModelsView, QuickModelChip } from './ModelsView'
import type { GatewayStatus, GatewayStatusValue } from '../../shared/types'
import { useUpdateNoticeStore } from '@/stores/update-store'

const TIMEOUT_MS = 300_000

const STATUS_LABELS: Record<GatewayStatusValue, string> = {
  starting: 'Gateway is starting…',
  running: 'Gateway is ready',
  stopped: 'Waiting for Gateway to start…',
  error: 'Gateway failed to start',
}

interface ErrorInfo {
  errorType: ErrorType
  title: string
  detail?: string
}

export type EmbeddedPanel =
  | ''
  | 'settings'
  | 'about'
  | 'dashboard'
  | 'llm-api'
  | 'skills'
  | 'updates'
  | 'feishu-settings'
  | 'models'
  | 'channels'

export interface EmbeddedShellLayoutProps {
  activePanel: EmbeddedPanel
  onPanelChange: (panel: EmbeddedPanel) => void
}

function buildControlUIUrl(port: number, token?: string, path = ''): string {
  const trimmed = path.trim()
  const basePath = !trimmed || trimmed === '/' ? '/' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  let url = `http://127.0.0.1:${port}${basePath}`
  if (token && typeof token === 'string' && token.trim()) {
    url = `${url}#token=${encodeURIComponent(token.trim())}`
  }
  return url
}

function appendTokenHash(baseUrl: string, token?: string): string {
  const cleaned = baseUrl.replace(/#.*$/, '')
  if (token && token.trim()) {
    return `${cleaned}#token=${encodeURIComponent(token.trim())}`
  }
  return cleaned
}

const DESKTOP_NAV_ITEMS: { id: EmbeddedPanel; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, description: 'Gateway status & versions' },
  { id: 'models', label: 'Models', icon: <Cpu className="w-4 h-4" />, description: 'Default model & provider' },
  { id: 'channels', label: 'Channels', icon: <Radio className="w-4 h-4" />, description: 'WhatsApp, Telegram, Feishu…' },
  { id: 'llm-api', label: 'LLM API', icon: <Key className="w-4 h-4" />, description: 'Providers & auth profiles' },
  { id: 'skills', label: 'Skills', icon: <Puzzle className="w-4 h-4" />, description: 'Skills & extensions' },
  { id: 'updates', label: 'Updates', icon: <RefreshCw className="w-4 h-4" />, description: 'Check for updates' },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, description: 'Appearance & startup' },
  { id: 'about', label: 'About', icon: <Info className="w-4 h-4" />, description: 'Version info' },
]

export function EmbeddedShellLayout({ activePanel, onPanelChange }: EmbeddedShellLayoutProps) {
  const { t } = useTranslation()
  const [gatewayView, setGatewayView] = useState<'loading' | 'error'>('loading')
  const [statusText, setStatusText] = useState('Gateway is starting…')
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [timedOut, setTimedOut] = useState(false)
  const [gatewayPort, setGatewayPort] = useState<number | null>(null)
  const [controlUrl, setControlUrl] = useState<string | null>(null)
  /** Bumps when the gateway process restarts so the iframe remounts and opens a fresh WebSocket (same #token URL would otherwise not reload). */
  const [controlUiReloadKey, setControlUiReloadKey] = useState(0)
  const [controlUiLoadError, setControlUiLoadError] = useState(false)
  const [attachBusy, setAttachBusy] = useState(false)
  const [attachBanner, setAttachBanner] = useState<string | null>(null)
  const controlUiPathRef = useRef('')
  const gatewayAuthTokenRef = useRef<string | undefined>(undefined)
  const gatewayModeRef = useRef<'local' | 'remote'>('local')
  /** Remote Control UI origin + optional basePath (from gateway status), without SPA deep-link. */
  const remoteControlUiBaseRef = useRef<string | null>(null)
  const prevGatewayStatusRef = useRef<GatewayStatusValue | null>(null)
  const lastRunningPidRef = useRef<number | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateAvailable = useUpdateNoticeStore((state) => state.available)
  const updateDismissed = useUpdateNoticeStore((state) => state.dismissed)
  const updateInfo = useUpdateNoticeStore((state) => state.info)
  const setUpdateAvailable = useUpdateNoticeStore((state) => state.setUpdateAvailable)
  const dismissUpdateNotice = useUpdateNoticeStore((state) => state.dismissUpdateNotice)

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const showError = useCallback((info: ErrorInfo) => {
    clearTimeoutTimer()
    setTimedOut(false)
    setGatewayView('error')
    setErrorInfo(info)
  }, [clearTimeoutTimer])

  const startTimeoutTimer = useCallback(() => {
    clearTimeoutTimer()
    timeoutRef.current = setTimeout(() => {
      setTimedOut(true)
      setStatusText('Gateway did not become ready within 5 minutes. Please check logs or retry.')
    }, TIMEOUT_MS)
  }, [clearTimeoutTimer])

  const handleStatusUpdate = useCallback(
    (status: GatewayStatus) => {
      const prev = prevGatewayStatusRef.current
      prevGatewayStatusRef.current = status.status

      setStatusText(STATUS_LABELS[status.status])
      if (status.status === 'running') {
        clearTimeoutTimer()
        setGatewayView('loading')

        const resumedFromNonRunning = prev !== 'running'
        const pidChanged =
          status.pid != null &&
          lastRunningPidRef.current != null &&
          status.pid !== lastRunningPidRef.current
        const shouldReloadControlUi = resumedFromNonRunning || pidChanged
        if (status.pid != null) {
          lastRunningPidRef.current = status.pid
        }

        setGatewayPort(status.port)
        gatewayModeRef.current = status.mode === 'remote' ? 'remote' : 'local'
        if (status.mode === 'remote' && status.controlUrl) {
          remoteControlUiBaseRef.current = status.controlUrl
            .replace(/#.*$/, '')
            .replace(/\/$/, '')
        } else {
          remoteControlUiBaseRef.current = null
        }
        void (async () => {
          const port = status.port
          try {
            // Never block the console on a hung config IPC — fall back to URL without #token after 10s.
            const config = await Promise.race([
              window.electronAPI.configRead(),
              new Promise<undefined>((resolve) => {
                setTimeout(() => resolve(undefined), 10_000)
              }),
            ])
            const remoteToken =
              status.mode === 'remote'
                ? config?.gateway?.remote?.token
                : undefined
            const localToken = config?.gateway?.auth?.token
            const token =
              (typeof remoteToken === 'string' && remoteToken.trim()
                ? remoteToken
                : typeof localToken === 'string'
                  ? localToken
                  : undefined) || undefined
            gatewayAuthTokenRef.current = token
            const deepPath = controlUiPathRef.current
            const url =
              status.mode === 'remote' && status.controlUrl
                ? (() => {
                    // Keep origin + optional controlUi basePath; do not strip to bare origin.
                    const base =
                      remoteControlUiBaseRef.current ??
                      status.controlUrl!.replace(/#.*$/, '').replace(/\/$/, '')
                    const withPath =
                      base +
                      (deepPath
                        ? deepPath.startsWith('/')
                          ? deepPath
                          : `/${deepPath}`
                        : '')
                    return appendTokenHash(withPath, gatewayAuthTokenRef.current)
                  })()
                : buildControlUIUrl(port, gatewayAuthTokenRef.current, deepPath)
            setControlUiLoadError(false)
            if (shouldReloadControlUi) {
              setControlUiReloadKey((k) => k + 1)
            }
            setControlUrl(url)
          } catch {
            gatewayAuthTokenRef.current = undefined
            setControlUiLoadError(false)
            if (shouldReloadControlUi) {
              setControlUiReloadKey((k) => k + 1)
            }
            setControlUrl(
              status.mode === 'remote' && status.controlUrl
                ? status.controlUrl
                : buildControlUIUrl(port, undefined, controlUiPathRef.current),
            )
          }
        })()
      } else {
        if (prev === 'running') {
          setGatewayPort(null)
          setControlUrl(null)
        }
        if (status.status === 'error') {
          showError({
            errorType: 'gateway-crash',
            title: 'Gateway service exited unexpectedly',
            detail: 'Please check Gateway configuration and logs, then retry.',
          })
        }
      }
    },
    [showError, clearTimeoutTimer],
  )

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const status = await window.electronAPI.gatewayStatus()
        if (!mounted) return
        handleStatusUpdate(status)
        if (status.status === 'stopped') {
          startTimeoutTimer()
          try {
            await window.electronAPI.gatewayStart()
          } catch {
            if (!mounted) return
            showError({
              errorType: 'start-failure',
              title: 'Gateway failed to start',
              detail: 'Unable to start Gateway process. Please check installation integrity.',
            })
          }
        } else if (status.status === 'starting') {
          startTimeoutTimer()
        }
      } catch {
        if (!mounted) return
        showError({
          errorType: 'connection-error',
          title: 'Unable to connect to main process',
          detail: 'Internal communication failed. Please restart the application.',
        })
      }
    }
    void init()
    const unsub = window.electronAPI.onGatewayStatusChange((status) => {
      if (mounted) handleStatusUpdate(status)
    })
    return () => {
      mounted = false
      unsub()
      clearTimeoutTimer()
    }
  }, [handleStatusUpdate, startTimeoutTimer, clearTimeoutTimer, showError])

  useEffect(() => {
    const unsub = window.electronAPI.onUpdateAvailable((info) => {
      const payload = info as { version?: string; releaseNotes?: string; releaseDate?: string }
      const version = payload?.version?.toString().trim()
      if (!version) return
      setUpdateAvailable({
        version,
        releaseNotes: payload.releaseNotes,
        publishedAt: payload.releaseDate,
      })
    })
    return () => {
      unsub()
    }
  }, [setUpdateAvailable])

  useEffect(() => {
    if (activePanel === 'updates') {
      dismissUpdateNotice()
    }
  }, [activePanel, dismissUpdateNotice])

  const handleRetry = async () => {
    setGatewayView('loading')
    setErrorInfo(null)
    setTimedOut(false)
    setStatusText('Restarting Gateway…')
    startTimeoutTimer()
    try {
      await window.electronAPI.gatewayRestart()
    } catch {
      showError({
        errorType: 'start-failure',
        title: 'Gateway restart failed',
        detail: 'Please check Gateway configuration and logs, then retry.',
      })
    }
  }

  const handleOpenLogDir = () => {
    void window.electronAPI.systemOpenLogDir()
  }

  const reloadControlUi = useCallback((path?: string) => {
    if (path !== undefined) {
      controlUiPathRef.current = path
    }
    // Remember deep-link even while Gateway is restarting (port temporarily null).
    // When status returns to running, handleStatusUpdate rebuilds controlUrl with this path.
    if (gatewayPort == null && !controlUrl) {
      setControlUiLoadError(false)
      onPanelChange('')
      return
    }
    setControlUiLoadError(false)
    const p = controlUiPathRef.current
    const isRemote =
      gatewayModeRef.current === 'remote' ||
      Boolean(controlUrl && !/127\.0\.0\.1|localhost/i.test(controlUrl))
    if (isRemote && (remoteControlUiBaseRef.current || controlUrl)) {
      const base =
        remoteControlUiBaseRef.current ??
        controlUrl!.replace(/#.*$/, '').replace(/\/$/, '')
      const withPath = base + (p ? (p.startsWith('/') ? p : `/${p}`) : '')
      setControlUrl(appendTokenHash(withPath, gatewayAuthTokenRef.current))
    } else if (gatewayPort != null) {
      setControlUrl(buildControlUIUrl(gatewayPort, gatewayAuthTokenRef.current, p))
    }
    setControlUiReloadKey((k) => k + 1)
    onPanelChange('')
  }, [gatewayPort, controlUrl, onPanelChange])

  const handlePickAttachments = useCallback(async () => {
    if (attachBusy) return
    setAttachBusy(true)
    setAttachBanner(null)
    try {
      const result = await window.electronAPI.chatPickAttachments()
      if (!result.ok) {
        setAttachBanner(result.message ?? t('shell.embed.attachFailed'))
      } else if (result.count > 0) {
        const skip =
          result.skipped.length > 0
            ? t('shell.embed.attachSkipped', { list: result.skipped.join(', ') })
            : ''
        setAttachBanner(t('shell.embed.attachOk', { count: result.count }) + (skip ? ` ${skip}` : ''))
      }
      // canceled / zero files: no banner
    } catch (e) {
      setAttachBanner(e instanceof Error ? e.message : t('shell.embed.attachFailed'))
    } finally {
      setAttachBusy(false)
      window.setTimeout(() => setAttachBanner(null), 5000)
    }
  }, [attachBusy, t])

  const handleNavigateToPanel = (panel: EmbeddedPanel) => {
    onPanelChange(panel)
  }

  const showControlUIIframe = gatewayPort !== null && controlUrl !== null
  const hasActivePanel = activePanel !== ''

  if (gatewayView === 'error' && errorInfo) {
    return (
      <ErrorView
        errorType={errorInfo.errorType}
        title={errorInfo.title}
        detail={errorInfo.detail}
        onRetry={handleRetry}
        onOpenLogDir={handleOpenLogDir}
      />
    )
  }

  const renderPanelContent = () => {
    switch (activePanel) {
      case 'settings':
        return (
          <SettingsView
            onBack={() => onPanelChange('')}
            onOpenFeishuSettings={() => onPanelChange('feishu-settings')}
            onOpenModels={() => onPanelChange('models')}
            onOpenChannels={() => onPanelChange('channels')}
            onOpenMobileConnect={() => reloadControlUi('/nodes')}
          />
        )
      case 'about':
        return <AboutView onBack={() => onPanelChange('')} />
      case 'dashboard':
        return (
          <DashboardView
            onNavigateToSettings={() => handleNavigateToPanel('settings')}
            onNavigateToLlmApi={() => handleNavigateToPanel('llm-api')}
            onNavigateToSkills={() => handleNavigateToPanel('skills')}
            onNavigateToUpdates={() => handleNavigateToPanel('updates')}
            onNavigateToFeishuSettings={() => handleNavigateToPanel('feishu-settings')}
            onNavigateToModels={() => handleNavigateToPanel('models')}
            onNavigateToChannels={() => handleNavigateToPanel('channels')}
            onOpenControlUi={(path) => reloadControlUi(path ?? '')}
            updateAvailable={updateAvailable && !updateDismissed}
            updateVersion={updateInfo?.version}
            onDismissUpdateNotice={() => dismissUpdateNotice()}
          />
        )
      case 'llm-api':
        return <ProviderView onBack={() => onPanelChange('')} />
      case 'skills':
        return (
          <SkillsView
            onBack={() => onPanelChange('')}
            onOpenControlUi={(path) => reloadControlUi(path ?? '')}
          />
        )
      case 'updates':
        return (
          <UpdateView
            onBack={() => onPanelChange('')}
            updateAvailable={updateAvailable}
            updateVersion={updateInfo?.version}
            updateNotes={updateInfo?.releaseNotes}
            onDismissUpdateNotice={() => dismissUpdateNotice()}
          />
        )
      case 'feishu-settings':
        return <FeishuAccessView onBack={() => onPanelChange('channels')} />
      case 'models':
        return <ModelsView onBack={() => onPanelChange('')} />
      case 'channels':
        return (
          <ChannelsView
            onBack={() => onPanelChange('')}
            onOpenFeishuSettings={() => onPanelChange('feishu-settings')}
            onOpenControlUi={(path) => reloadControlUi(path ?? '')}
          />
        )
      default:
        return null
    }
  }

  return (
    <main className="h-screen relative overflow-hidden select-none" role="main">
      {/* Full-screen Control UI iframe (always mounted when available).
          Do not use flex-1 on iframe: in column flex layouts the iframe often collapses to 0 height
          (only the dark shell body shows through — looks like a black window). */}
      {showControlUIIframe ? (
        <iframe
          key={`openclaw-control-ui-${controlUiReloadKey}`}
          src={controlUrl}
          title="OpenClaw Control UI"
          className={`absolute inset-0 z-0 h-full w-full border-0 bg-background ${
            hasActivePanel ? 'opacity-0 pointer-events-none' : ''
          }`}
          referrerPolicy="no-referrer"
          allow="clipboard-read; clipboard-write; camera; microphone"
          allowFullScreen
          onLoad={() => setControlUiLoadError(false)}
          onError={() => setControlUiLoadError(true)}
        />
      ) : (
        !hasActivePanel && (
          <div className="absolute inset-0 z-0 flex min-h-0 items-center justify-center overflow-auto p-4">
            <LoadingView
              variant="embedded"
              statusText={statusText}
              timedOut={timedOut}
              onRetry={handleRetry}
              hintText="Startup takes approximately 5 minutes, please wait."
            />
          </div>
        )
      )}

      {showControlUIIframe && !hasActivePanel && controlUiLoadError && (
        <div
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md border border-destructive/40 bg-background/95 px-3 py-2 text-xs text-destructive shadow-sm backdrop-blur"
          role="alert"
        >
          Control UI failed to load.{' '}
          <button type="button" className="underline font-medium" onClick={() => reloadControlUi()}>
            Reload
          </button>
        </div>
      )}

      {showControlUIIframe && !hasActivePanel && attachBanner && (
        <div
          className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md border border-border bg-background/95 px-3 py-2 text-xs text-foreground shadow-sm backdrop-blur max-w-[min(90vw,28rem)]"
          role="status"
        >
          {attachBanner}
        </div>
      )}

      {showControlUIIframe && !hasActivePanel && (
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 pointer-events-auto flex-wrap justify-end max-w-[min(100vw-1.5rem,42rem)]">
          <QuickModelChip onOpenModels={() => onPanelChange('models')} />
          <button
            type="button"
            onClick={() => void handlePickAttachments()}
            disabled={attachBusy}
            className="rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors disabled:opacity-50 inline-flex items-center gap-1"
            aria-label={t('shell.embed.attach')}
            title={t('shell.embed.attachTitle')}
          >
            <Paperclip className="w-3.5 h-3.5" />
            {t('shell.embed.attach')}
          </button>
          <button
            type="button"
            onClick={() => reloadControlUi('/tasks')}
            className="rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors inline-flex items-center gap-1"
            aria-label={t('shell.embed.openTasksTitle')}
            title={t('shell.embed.openTasksTitle')}
          >
            <ListTodo className="w-3.5 h-3.5" />
            {t('shell.embed.openTasks')}
          </button>
          <button
            type="button"
            onClick={() => reloadControlUi('/automation')}
            className="rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors inline-flex items-center gap-1"
            aria-label={t('shell.embed.openAutomationsTitle')}
            title={t('shell.embed.openAutomationsTitle')}
          >
            <Timer className="w-3.5 h-3.5" />
            {t('shell.embed.openAutomations')}
          </button>
          <button
            type="button"
            onClick={() => reloadControlUi('/settings/mcp')}
            className="rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors inline-flex items-center gap-1"
            aria-label={t('shell.embed.openMcpTitle')}
            title={t('shell.embed.openMcpTitle')}
          >
            <Server className="w-3.5 h-3.5" />
            {t('shell.embed.openMcp')}
          </button>
          <button
            type="button"
            onClick={() => onPanelChange('channels')}
            className="rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors"
          >
            Channels
          </button>
          <button
            type="button"
            onClick={() => reloadControlUi()}
            className="rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors"
            aria-label={t('shell.embed.reloadControlUi')}
            title={t('shell.embed.reloadControlUi')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPanelChange('dashboard')}
            className="rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors"
            aria-label="Desktop menu"
          >
            Menu
          </button>
        </div>
      )}

      {/* Desktop panel overlay */}
      {hasActivePanel && (
        <div className="absolute inset-0 z-30 flex min-h-0 flex-col bg-background/98 supports-[backdrop-filter]:bg-background/92 backdrop-blur-sm">
          <div className="shrink-0 border-b border-border/60 bg-background/80 px-4 py-2.5 backdrop-blur-md flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPanelChange('')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg px-2 py-1.5 hover:bg-muted/80"
              aria-label="Back to Control UI"
            >
              <ChevronLeft className="w-4 h-4" />
              Control UI
            </button>
            <span className="text-sm text-border">/</span>
            <span className="text-sm font-medium">
              {activePanel === 'feishu-settings'
                ? t('shell.feishu.title')
                : DESKTOP_NAV_ITEMS.find((item) => item.id === activePanel)?.label ?? activePanel}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{renderPanelContent()}</div>
        </div>
      )}

    </main>
  )
}
