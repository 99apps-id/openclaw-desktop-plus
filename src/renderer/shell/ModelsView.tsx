import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ShellLayout } from './ShellLayout'
import { ModelSettingsSection } from './ModelSettingsSection'
import { FailoverSettingsSection } from './FailoverSettingsSection'
import { VisionModelSettingsSection } from './VisionModelSettingsSection'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'

export interface ModelsViewProps {
  onBack?: () => void
}

type GatewayModel = { id: string; name?: string; provider?: string }

/**
 * Top-level Models panel — same editor as Settings, but reachable in one click
 * from the desktop nav (avoids burying model/provider changes under Appearance).
 */
export function ModelsView({ onBack }: ModelsViewProps = {}) {
  const { t } = useTranslation()
  const handleBack = onBack ?? (() => {
    window.location.hash = ''
  })

  const [gatewayModels, setGatewayModels] = useState<GatewayModel[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [quickPrimary, setQuickPrimary] = useState('')
  const [quickSaving, setQuickSaving] = useState(false)
  const [quickBanner, setQuickBanner] = useState<string | null>(null)

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const [list, settings] = await Promise.all([
        window.electronAPI.modelsList(),
        window.electronAPI.modelSettingsLoad().catch(() => null),
      ])
      setGatewayModels(list.models ?? [])
      const primary = settings?.defaultPrimaryDisplay?.trim() || settings?.modelConfig?.modelId || ''
      setQuickPrimary(primary)
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : t('shell.models.catalogFailed'))
    } finally {
      setCatalogLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const catalogOptions = useMemo(() => {
    const seen = new Set<string>()
    const rows: GatewayModel[] = []
    for (const m of gatewayModels) {
      const id = m.id?.trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      rows.push(m)
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id))
  }, [gatewayModels])

  const applyQuickDefault = async (modelId: string) => {
    if (!modelId.trim()) return
    setQuickSaving(true)
    setQuickBanner(null)
    try {
      await window.electronAPI.modelsSetDefault({ modelId: modelId.trim() })
      setQuickPrimary(modelId.trim())
      setQuickBanner(t('shell.models.quickApplied'))
      // Best-effort restart so gateway/agents pick up the new default.
      try {
        await window.electronAPI.gatewayRestart()
      } catch {
        /* ignore */
      }
    } catch (e) {
      setQuickBanner(e instanceof Error ? e.message : t('shell.models.quickFailed'))
    } finally {
      setQuickSaving(false)
    }
  }

  return (
    <ShellLayout title={t('shell.models.title')} onBack={handleBack}>
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('shell.models.subtitle')}</p>
        <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
          {t('shell.models.controlUiHint')}
        </div>

        <section
          className="rounded-lg border border-border p-4 space-y-3"
          aria-label={t('shell.models.liveCatalogAria')}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{t('shell.models.liveCatalogTitle')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('shell.models.liveCatalogDesc')}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void loadCatalog()}
              disabled={catalogLoading}
              aria-label={t('shell.models.refreshCatalog')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${catalogLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {catalogError ? (
            <p className="text-xs text-destructive" role="alert">
              {catalogError}
            </p>
          ) : null}

          {catalogLoading && catalogOptions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t('shell.models.catalogLoading')}
            </div>
          ) : catalogOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('shell.models.catalogEmpty')}</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                value={
                  catalogOptions.some((m) => m.id === quickPrimary) ? quickPrimary : undefined
                }
                onValueChange={(v) => void applyQuickDefault(v)}
                disabled={quickSaving}
              >
                <SelectTrigger className="w-full font-mono text-xs">
                  <SelectValue placeholder={t('shell.models.pickFromCatalog')} />
                </SelectTrigger>
                <SelectContent className="max-h-[min(50vh,280px)]">
                  {catalogOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="font-mono text-xs">
                      {m.provider ? `${m.provider} · ${m.name || m.id}` : m.name || m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {quickSaving ? <Loader2 className="w-4 h-4 animate-spin shrink-0 self-center" /> : null}
            </div>
          )}
          {quickBanner ? (
            <p className="text-xs text-muted-foreground" role="status">
              {quickBanner}
            </p>
          ) : null}
        </section>

        <ModelSettingsSection />
        <VisionModelSettingsSection />
        <FailoverSettingsSection />
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-1.5"
          onClick={() => {
            window.location.hash = ''
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t('shell.models.openChat')}
        </Button>
      </div>
    </ShellLayout>
  )
}

/** Compact chip for Control UI chrome — shows current default model, opens Models panel. */
export function QuickModelChip({ onOpenModels }: { onOpenModels: () => void }) {
  const { t } = useTranslation()
  const [label, setLabel] = useState<string>(t('shell.models.chipLoading'))

  const refresh = useCallback(async () => {
    try {
      const res = await window.electronAPI.modelSettingsLoad()
      const display = res.defaultPrimaryDisplay?.trim()
      if (display) {
        setLabel(display)
        return
      }
      const provider = res.modelConfig.provider
      const modelId = res.modelConfig.modelId
      setLabel(modelId ? `${provider} · ${modelId}` : provider)
    } catch {
      setLabel(t('shell.models.chipUnavailable'))
    }
  }, [t])

  useEffect(() => {
    void refresh()
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(timer)
    }
  }, [refresh])

  return (
    <button
      type="button"
      onClick={onOpenModels}
      title={t('shell.models.chipTitle')}
      className="max-w-[14rem] truncate rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur hover:border-primary/50 hover:bg-muted transition-colors"
    >
      {label}
    </button>
  )
}
