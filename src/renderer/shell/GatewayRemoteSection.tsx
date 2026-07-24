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
import { Smartphone } from 'lucide-react'
import type { GatewayConfig } from '../../shared/types'

type ConnMode = 'local' | 'remote'
type Transport = 'direct' | 'ssh'
type BindMode = 'loopback' | 'lan' | 'auto'

export interface GatewayRemoteSectionProps {
  /** Open Control UI Nodes (Mobile Connect / device pair QR). */
  onOpenMobileConnect?: () => void
}

/**
 * Settings: local vs remote gateway, bind address for phone pairing, Mobile Connect shortcut.
 */
export function GatewayRemoteSection({ onOpenMobileConnect }: GatewayRemoteSectionProps = {}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<ConnMode>('local')
  const [bind, setBind] = useState<BindMode>('loopback')
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
        const b = gw?.bind
        if (b === 'lan' || b === 'auto' || b === 'loopback') setBind(b)
        else setBind('loopback')
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
          : { mode: 'local', bind },
      )
      setBanner({
        kind: 'ok',
        text:
          mode === 'remote'
            ? t('shell.settings.gatewayRemoteApplied')
            : bind === 'lan' || bind === 'auto'
              ? t('shell.settings.gatewayLocalLanApplied')
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
  }, [mode, url, token, transport, bind, t])

  const openMobileConnect = useCallback(async () => {
    setBanner(null)
    // Mobile Connect QR requires a non-loopback advertised URL.
    if (mode === 'local' && bind === 'loopback') {
      setSaving(true)
      try {
        setBind('lan')
        await window.electronAPI.gatewayApplyConnection({ mode: 'local', bind: 'lan' })
        setBanner({ kind: 'ok', text: t('shell.settings.gatewayLocalLanApplied') })
      } catch (err) {
        setBanner({
          kind: 'err',
          text: err instanceof Error ? err.message : String(err),
        })
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    }
    onOpenMobileConnect?.()
  }, [mode, bind, onOpenMobileConnect, t])

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('shell.settings.loading')}</p>
  }

  return (
    <section className="flex flex-col gap-5" aria-label={t('shell.settings.gatewaySectionAria')}>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('shell.settings.gatewaySection')}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('shell.settings.gatewaySectionDesc')}
        </p>
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

      {mode === 'local' && (
        <fieldset className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="gw-bind">
            {t('shell.settings.gatewayBind')}
          </label>
          <Select value={bind} onValueChange={(v) => setBind(v as BindMode)}>
            <SelectTrigger id="gw-bind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="loopback">{t('shell.settings.gatewayBindLoopback')}</SelectItem>
              <SelectItem value="lan">{t('shell.settings.gatewayBindLan')}</SelectItem>
              <SelectItem value="auto">{t('shell.settings.gatewayBindAuto')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('shell.settings.gatewayBindHint')}
          </p>
        </fieldset>
      )}

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
              placeholder="ws://192.168.1.10:18789"
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('shell.settings.gatewayRemoteUrlHint')}
            </p>
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('shell.settings.gatewayTransportHint')}
            </p>
          </fieldset>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void apply()} disabled={saving}>
          {saving ? t('shell.settings.gatewayApplying') : t('shell.settings.gatewayApply')}
        </Button>
        {onOpenMobileConnect && (
          <Button
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void openMobileConnect()}
          >
            <Smartphone className="w-3.5 h-3.5 mr-1.5" />
            {t('shell.settings.openMobileConnect')}
          </Button>
        )}
      </div>

      {banner && (
        <p
          className={`text-xs leading-relaxed ${
            banner.kind === 'ok' ? 'text-muted-foreground' : 'text-destructive'
          }`}
        >
          {banner.text}
        </p>
      )}
    </section>
  )
}
