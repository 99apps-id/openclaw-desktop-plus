import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadingView } from '@/shell/LoadingView'
import { EmbeddedShellLayout, type EmbeddedPanel } from '@/shell/EmbeddedShellLayout'
import { WizardLayout } from './wizard/WizardLayout'
import { syncNativeWindowTitle } from '@/i18n'

function getHashRoute(): string {
  return window.location.hash.replace(/^#/, '')
}

const VALID_HASH_PANELS = new Set<string>([
  'settings',
  'about',
  'dashboard',
  'llm-api',
  'skills',
  'updates',
  'feishu-settings',
  'models',
  'channels',
])

/** Map legacy hashes and drop unknown fragments (e.g. pasted gateway #token=…) so we don't open a bogus “panel”. */
function normalizeShellRoute(route: string): string {
  if (route === 'feishu-access') return 'feishu-settings'
  if (!route) return ''
  if (!VALID_HASH_PANELS.has(route)) return ''
  return route
}

function App() {
  const { t, i18n } = useTranslation()
  const [route, setRoute] = useState<string | null>(null)
  const [configExists, setConfigExists] = useState<boolean | null>(null)

  useEffect(() => {
    if (typeof window.electronAPI === 'undefined') return
    window.electronAPI
      .configExists()
      .then((exists) => {
        setConfigExists(exists)
        if (!exists) {
          setRoute('wizard')
          return
        }
        setRoute(normalizeShellRoute(getHashRoute() || ''))
      })
      .catch((err) => {
        console.warn('[OpenClaw] configExists failed:', err)
        setConfigExists(false)
        setRoute('wizard')
      })
  }, [])

  useEffect(() => {
    if (configExists !== true) return
    const handler = () => setRoute(normalizeShellRoute(getHashRoute() || ''))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [configExists])

  const handlePanelChange = useCallback((panel: EmbeddedPanel) => {
    const hash = panel === '' ? '' : `#${panel}`
    if (window.location.hash !== hash) {
      window.location.hash = hash
    }
    setRoute(panel)
  }, [])

  /** Native title + document.title: wizard uses app name only (no "Setup Wizard" in the title bar). */
  useEffect(() => {
    if (route === null || configExists === null) {
      syncNativeWindowTitle(t('app.name'))
      return
    }
    if (route === 'wizard') {
      syncNativeWindowTitle(t('app.name'))
      return
    }
    if (configExists) {
      const panelTitles: Record<string, string> = {
        '': t('shell.dashboard.title'),
        dashboard: t('shell.dashboard.title'),
        settings: t('shell.settings.title'),
        about: t('shell.about.title'),
        'llm-api': t('shell.dashboard.llmApi'),
        skills: t('shell.skillsPanel.title'),
        updates: t('shell.updates.title'),
        'feishu-settings': t('shell.feishu.title'),
        models: t('shell.models.title'),
        channels: t('shell.channels.title'),
      }
      const segment = panelTitles[route] ?? t('shell.dashboard.title')
      syncNativeWindowTitle(`${segment} - ${t('app.name')}`)
    }
  }, [route, configExists, t, i18n.language])

  if (typeof window.electronAPI === 'undefined') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t('shell.error.preloadTitle')}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{t('shell.error.preloadBody')}</p>
        <p className="text-xs text-muted-foreground max-w-sm">{t('shell.error.preloadHint')}</p>
      </main>
    )
  }

  if (route === null || configExists === null) {
    return <LoadingView statusText={t('shell.loading.checkingConfig')} />
  }
  if (route === 'wizard') return <WizardLayout />
  if (configExists) {
    const panel: EmbeddedPanel =
      route === 'settings' ||
      route === 'about' ||
      route === 'dashboard' ||
      route === 'llm-api' ||
      route === 'skills' ||
      route === 'updates' ||
      route === 'feishu-settings' ||
      route === 'models' ||
      route === 'channels'
        ? route
        : ''
    return <EmbeddedShellLayout activePanel={panel} onPanelChange={handlePanelChange} />
  }
  return <LoadingView statusText={t('shell.loading.checkingConfig')} />
}

export default App
