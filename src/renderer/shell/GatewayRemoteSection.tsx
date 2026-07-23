import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { GatewayConfig } from '../../shared/types'

type ConnMode = 'local' | 'remote'
type Transport = 'direct' | 'ssh'

/**
 * Settings: switch between local bundled gateway and remote (VPS / SSH tunnel).
 */
export function GatewayRemoteSection() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<ConnMode>('local')
  const [url, setUrl] = useState('ws://127.0.0.1:18789')
  const [token, setToken] = useState('')
  const [transport, setTransport] = useState<Transport>('direct')
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const cfg = await window.electronAPI.configRead()
        const gw = cfg?.gateway as GatewayConfig | undefined
        if (gw?.mode === 'remote') {
          setMode('remote')
          setUrl(gw.remote?.url?.trim() || 'ws://127.0.0.1:18789')
          setToken(gw.remote?.token?.trim() || '')
          setTransport(gw.remote?.transport === 'ssh' ? 'ssh' : 'direct')
        } else {
          setMode('local')
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const apply = useCallback(async () => {
    setSaving(true)
    setBanner(null)
    try {
      await window.electronAPI.gatewayApplyConnection(
        mode === 'remote'
          ? { mode: 'remote', url: url.trim(), token: token.trim() || undefined, transport }
          : { mode: 'local' },
      )
      setBanner({
        kind: 'ok',
        text:
          mode === 'remote'
            ? t('shell.settings.gatewayRemoteApplied')
            : t('shell.settings.gatewayLocalApplied'),
      })
    } catch (err) {
      setBanner({
        kind: 'err',
        text: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }, [mode, url, token, transport, t])

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('shell.settings.loading')}</p>
  }

  return (
    <section className="flex flex-col gap-4" aria-label={t('shell.settings.gatewaySectionAria')}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold">{t('shell.settings.gatewaySection')}</h2>
        <p className="text-xs text-muted-foreground">{t('shell.settings.gatewaySectionDesc')}</p>
      </div>

      <fieldset className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="gw-mode">
          {t('shell.settings.gatewayMode')}
        </label>
        <Select value={mode} onValueChange={(v) => setMode(v as ConnMode)}>
          <SelectTrigger id="gw-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="local">{t('shell.settings.gatewayModeLocal')}</SelectItem>
            <SelectItem value="remote">{t('shell.settings.gatewayModeRemote')}</SelectItem>
          </SelectContent>
        </Select>
      </fieldset>

      {mode === 'remote' && (
        <>
          <fieldset className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="gw-remote-url">
              {t('shell.settings.gatewayRemoteUrl')}
            </label>
            <Input
              id="gw-remote-url"
              className="font-mono"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="ws://127.0.0.1:18789"
            />
            <p className="text-xs text-muted-foreground">{t('shell.settings.gatewayRemoteUrlHint')}</p>
          </fieldset>

          <fieldset className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="gw-remote-token">
              {t('shell.settings.gatewayRemoteToken')}
            </label>
            <Input
              id="gw-remote-token"
              type="password"
              className="font-mono"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              placeholder="optional"
            />
          </fieldset>

          <fieldset className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="gw-transport">
              {t('shell.settings.gatewayTransport')}
            </label>
            <Select value={transport} onValueChange={(v) => setTransport(v as Transport)}>
              <SelectTrigger id="gw-transport">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">{t('shell.settings.gatewayTransportDirect')}</SelectItem>
                <SelectItem value="ssh">{t('shell.settings.gatewayTransportSsh')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('shell.settings.gatewayTransportHint')}</p>
          </fieldset>
        </>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void apply()} disabled={saving}>
          {saving ? t('shell.settings.gatewayApplying') : t('shell.settings.gatewayApply')}
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
