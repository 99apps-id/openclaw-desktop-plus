import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * OpenRouter-style resilience: model fallback chain + extra API keys (auth profile rotation)
 * + rate-limit rotation cap. Upstream OpenClaw performs rotation/failover at runtime.
 */
export function FailoverSettingsSection() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fallbacksText, setFallbacksText] = useState('')
  const [rotations, setRotations] = useState('1')
  const [provider, setProvider] = useState<string>('openrouter')
  const [extraKey, setExtraKey] = useState('')
  const [profilesHint, setProfilesHint] = useState('')
  const [restartGateway, setRestartGateway] = useState(true)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [summary, settings, cfg] = await Promise.all([
        window.electronAPI.providersList(),
        window.electronAPI.modelSettingsLoad().catch(() => null),
        window.electronAPI.configRead(),
      ])
      const fb = summary.modelDefaults?.fallbacks ?? []
      setFallbacksText(fb.join('\n'))
      const rot = cfg?.auth?.cooldowns?.rateLimitedProfileRotations
      setRotations(typeof rot === 'number' ? String(rot) : '1')

      const rawProvider = settings?.modelConfig?.provider ?? 'openrouter'
      const providerId =
        rawProvider === 'custom'
          ? settings?.modelConfig?.customProviderId?.trim() || 'custom'
          : rawProvider === 'moonshot-cn'
            ? 'moonshot'
            : rawProvider
      setProvider(providerId)

      const forProvider = (summary.profiles ?? []).filter((x) => x.provider === providerId)
      const order = summary.authOrder?.[providerId] ?? []
      setProfilesHint(
        forProvider.length
          ? t('shell.failover.profilesHint', {
              count: forProvider.length,
              order: order.length ? order.join(' → ') : forProvider.map((x) => x.profileId).join(', '),
            })
          : t('shell.failover.profilesEmpty'),
      )
    } catch (e) {
      setBanner({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void reload()
  }, [reload])

  const applyFallbacks = async () => {
    setSaving(true)
    setBanner(null)
    try {
      const fallbacks = fallbacksText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      // Dedicated IPC merges fallbacks without wiping unrelated agent defaults.
      await window.electronAPI.modelsSetFallbacks({ fallbacks })

      // Re-read after fallbacks write, then patch only auth.cooldowns.
      const rotN = Math.max(0, Number.parseInt(rotations, 10) || 0)
      const cfg = await window.electronAPI.configRead()
      const prevAuth = cfg.auth && typeof cfg.auth === 'object' ? cfg.auth : {}
      const prevCooldowns =
        prevAuth.cooldowns && typeof prevAuth.cooldowns === 'object' ? prevAuth.cooldowns : {}
      await window.electronAPI.configWrite({
        ...cfg,
        auth: {
          ...prevAuth,
          cooldowns: {
            ...prevCooldowns,
            rateLimitedProfileRotations: rotN,
          },
        },
      })

      let restarted = false
      if (restartGateway) {
        try {
          await window.electronAPI.gatewayRestart()
          restarted = true
        } catch {
          /* best-effort */
        }
      }

      setBanner({
        kind: 'ok',
        text: restarted ? t('shell.failover.savedRestarted') : t('shell.failover.saved'),
      })
      await reload()
    } catch (e) {
      setBanner({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  const addExtraKey = async () => {
    const key = extraKey.trim()
    if (!key) return
    setSaving(true)
    setBanner(null)
    try {
      const profileId = `${provider}:rot-${Date.now().toString(36)}`
      await window.electronAPI.providersSaveProfile({
        profileId,
        provider,
        apiKey: key,
      })
      setExtraKey('')
      setBanner({ kind: 'ok', text: t('shell.failover.keyAdded', { id: profileId }) })
      await reload()
    } catch (e) {
      setBanner({ kind: 'err', text: e instanceof Error ? e.message : String(e) })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('shell.settings.loading')}</p>
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-4" aria-label={t('shell.failover.aria')}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{t('shell.failover.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('shell.failover.desc')}</p>
      </div>

      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="failover-fallbacks">
          {t('shell.failover.fallbacks')}
        </label>
        <textarea
          id="failover-fallbacks"
          className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
          value={fallbacksText}
          onChange={(e) => setFallbacksText(e.target.value)}
          placeholder={'openrouter/anthropic/claude-sonnet-4-5\nopenai/gpt-5.4\nanthropic/claude-sonnet-4-6'}
        />
        <p className="text-xs text-muted-foreground">{t('shell.failover.fallbacksHint')}</p>
      </fieldset>

      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="failover-rotations">
          {t('shell.failover.rotations')}
        </label>
        <Input
          id="failover-rotations"
          className="font-mono max-w-[8rem]"
          value={rotations}
          onChange={(e) => setRotations(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t('shell.failover.rotationsHint')}</p>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">{profilesHint}</p>
        <fieldset className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="failover-extra-key">
            {t('shell.failover.addKey', { provider })}
          </label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="failover-extra-key"
              type="password"
              className="font-mono flex-1 min-w-[12rem]"
              value={extraKey}
              onChange={(e) => setExtraKey(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
            />
            <Button type="button" variant="secondary" disabled={saving || !extraKey.trim()} onClick={() => void addExtraKey()}>
              {t('shell.failover.addKeyBtn')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('shell.failover.addKeyHint')}</p>
        </fieldset>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={restartGateway}
          onChange={(e) => setRestartGateway(e.target.checked)}
          className="rounded border-input"
        />
        {t('shell.failover.restartGateway')}
      </label>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void applyFallbacks()} disabled={saving}>
          {saving ? t('shell.failover.saving') : t('shell.failover.save')}
        </Button>
        {banner && (
          <p className={`text-xs ${banner.kind === 'ok' ? 'text-muted-foreground' : 'text-destructive'}`}>
            {banner.text}
          </p>
        )}
      </div>
    </section>
  )
}
