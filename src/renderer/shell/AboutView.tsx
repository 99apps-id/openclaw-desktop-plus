import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ShellLayout } from './ShellLayout'
import type { AppVersionInfo } from '../../shared/types'
import { formatMainVersion } from '@/utils/version-format'

const PROJECT_URL = 'https://github.com/99apps-id/openclaw-desktop-plus'

export interface AboutViewProps {
  /** Back navigation when embedded in parent layout */
  onBack?: () => void
}

function defaultNavigateBack() {
  window.location.hash = ''
}

function ExternalLinkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export function AboutView({ onBack }: AboutViewProps) {
  const { t } = useTranslation()
  const handleBack = onBack ?? defaultNavigateBack
  const [versions, setVersions] = useState<AppVersionInfo | null>(null)

  const versionLabels = useMemo(
    () =>
      (['shell', 'electron', 'node', 'openclaw'] as const).map((key) => ({
        key,
        label:
          key === 'shell'
            ? t('shell.about.shellVersion')
            : key === 'electron'
              ? t('shell.about.electronLabel')
              : key === 'node'
                ? t('shell.about.nodeLabel')
                : t('shell.about.openclawLabel'),
      })),
    [t]
  )

  useEffect(() => {
    window.electronAPI.shellGetVersions().then(setVersions).catch(() => {
      // noop — version display will show loading state
    })
  }, [])

  const handleOpenProject = () => {
    void window.electronAPI.systemOpenExternal(PROJECT_URL)
  }

  return (
    <ShellLayout title={t('shell.about.title')} onBack={handleBack}>
      <div className="flex flex-col items-center justify-center gap-8 min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-2xl font-bold text-primary-foreground tracking-tight">OC</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight">{t('shell.about.appNameTitle')}</h2>
        </div>

        {versions ? (
          <>
            <p className="text-base font-medium font-mono" aria-label={t('shell.about.mainVersionAria')}>
              {formatMainVersion(versions)}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {versionLabels.map(({ key, label }) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground text-right">{label}</dt>
                  <dd className="font-mono">{versions[key]}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            {t('shell.about.fetchingVersions')}
          </p>
        )}

        <Button variant="outline" size="sm" onClick={handleOpenProject}>
          <ExternalLinkIcon />
          {t('shell.about.viewOnGithub')}
        </Button>
      </div>
    </ShellLayout>
  )
}
