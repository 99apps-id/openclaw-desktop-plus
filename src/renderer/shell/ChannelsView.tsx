import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShellLayout } from './ShellLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  MessageSquare,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  QrCode,
} from 'lucide-react'
import type { OpenClawConfig, WhatsAppAccountConfig, WhatsAppChannelConfig } from '../../shared/types'

export interface ChannelsViewProps {
  onBack?: () => void
  onOpenFeishuSettings?: () => void
  /** Leave desktop panel and focus Control UI (optionally deep-link path). */
  onOpenControlUi?: (path?: string) => void
}

type ChannelKey = 'whatsapp' | 'telegram' | 'discord' | 'slack' | 'feishu'

interface ChannelRow {
  id: ChannelKey
  label: string
  configured: boolean
  detail: string
  stripped?: boolean
}

function summarizeWhatsApp(wa: WhatsAppChannelConfig | undefined): string {
  if (!wa) return ''
  const accounts = wa.accounts ? Object.keys(wa.accounts) : []
  if (accounts.length === 0) return wa.enabled ? 'enabled' : ''
  return `${accounts.length} account(s)${wa.defaultAccount ? ` · default=${wa.defaultAccount}` : ''}`
}

function maskSecret(value: string | undefined): string {
  if (!value) return ''
  if (value.length <= 8) return '••••'
  return `${value.slice(0, 4)}…${value.slice(-4)}`
}

export function ChannelsView({
  onBack,
  onOpenFeishuSettings,
  onOpenControlUi,
}: ChannelsViewProps = {}) {
  const { t } = useTranslation()
  const handleBack = onBack ?? (() => {
    window.location.hash = ''
  })
  const openControlUi = (path?: string) => {
    if (onOpenControlUi) onOpenControlUi(path)
    else window.location.hash = ''
  }

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [config, setConfig] = useState<OpenClawConfig | null>(null)

  const [waEnabled, setWaEnabled] = useState(false)
  const [waDefault, setWaDefault] = useState('default')
  const [waAccounts, setWaAccounts] = useState<Array<{ id: string; name: string; enabled: boolean }>>(
    [],
  )
  const [newAccountId, setNewAccountId] = useState('')

  const [tgEnabled, setTgEnabled] = useState(false)
  const [tgToken, setTgToken] = useState('')
  const [discordEnabled, setDiscordEnabled] = useState(false)
  const [discordToken, setDiscordToken] = useState('')
  const [slackBotToken, setSlackBotToken] = useState('')
  const [feishuAppId, setFeishuAppId] = useState('')
  const [feishuAppSecret, setFeishuAppSecret] = useState('')

  const [waQrBusy, setWaQrBusy] = useState(false)
  const [waQrDataUrl, setWaQrDataUrl] = useState<string | null>(null)
  const [waQrMessage, setWaQrMessage] = useState<string | null>(null)
  const [waQrConnected, setWaQrConnected] = useState(false)
  const waQrDataUrlRef = useRef<string | null>(null)
  const waPollGenRef = useRef(0)

  useEffect(() => {
    waQrDataUrlRef.current = waQrDataUrl
  }, [waQrDataUrl])

  useEffect(() => {
    return () => {
      waPollGenRef.current += 1
    }
  }, [])

  const stopWhatsAppQrPoll = useCallback(() => {
    waPollGenRef.current += 1
    setWaQrBusy(false)
  }, [])

  const runWhatsAppQrPoll = useCallback(async () => {
    const gen = ++waPollGenRef.current
    setWaQrBusy(true)
    while (gen === waPollGenRef.current) {
      try {
        const res = await window.electronAPI.whatsappLoginWait({
          currentQrDataUrl: waQrDataUrlRef.current,
          accountId: waDefault.trim() || undefined,
        })
        if (gen !== waPollGenRef.current) return
        if (res.qrDataUrl) {
          waQrDataUrlRef.current = res.qrDataUrl
          setWaQrDataUrl(res.qrDataUrl)
        }
        if (res.message) setWaQrMessage(res.message)
        if (res.connected) {
          setWaQrConnected(true)
          waQrDataUrlRef.current = null
          setWaQrDataUrl(null)
          setWaQrBusy(false)
          return
        }
        // Wait returned (new QR / timeout without connect) — keep looping while panel is active.
      } catch (e) {
        if (gen !== waPollGenRef.current) return
        setWaQrMessage(e instanceof Error ? e.message : t('shell.channels.waQrFailed'))
        setWaQrBusy(false)
        return
      }
    }
  }, [t, waDefault])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const cfg = await window.electronAPI.configRead()
      setConfig(cfg)
      const wa = cfg.channels?.whatsapp as WhatsAppChannelConfig | undefined
      setWaEnabled(wa?.enabled === true || !!(wa?.accounts && Object.keys(wa.accounts).length))
      setWaDefault(wa?.defaultAccount?.trim() || 'default')
      const rows: Array<{ id: string; name: string; enabled: boolean }> = []
      if (wa?.accounts) {
        for (const [id, acct] of Object.entries(wa.accounts)) {
          if (!acct) continue
          rows.push({
            id,
            name: typeof acct.name === 'string' ? acct.name : id,
            enabled: acct.enabled !== false,
          })
        }
      }
      if (rows.length === 0 && wa?.enabled) {
        rows.push({ id: 'default', name: 'Primary', enabled: true })
      }
      setWaAccounts(rows)

      const tg = cfg.channels?.telegram as { enabled?: boolean; botToken?: string } | undefined
      setTgEnabled(tg?.enabled === true || !!tg?.botToken)
      setTgToken(typeof tg?.botToken === 'string' ? tg.botToken : '')

      const disc = cfg.channels?.discord as { enabled?: boolean; token?: string } | undefined
      setDiscordEnabled(disc?.enabled === true || !!disc?.token)
      setDiscordToken(typeof disc?.token === 'string' ? disc.token : '')

      const slack = cfg.channels?.slack as { botToken?: string } | undefined
      setSlackBotToken(typeof slack?.botToken === 'string' ? slack.botToken : '')

      const feishu = cfg.channels?.feishu as { appId?: string; appSecret?: string } | undefined
      setFeishuAppId(typeof feishu?.appId === 'string' ? feishu.appId : '')
      setFeishuAppSecret(typeof feishu?.appSecret === 'string' ? feishu.appSecret : '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shell.channels.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const rows: ChannelRow[] = useMemo(() => {
    const ch = config?.channels
    return [
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        configured: !!(ch?.whatsapp as WhatsAppChannelConfig | undefined)?.enabled ||
          !!(ch?.whatsapp as WhatsAppChannelConfig | undefined)?.accounts,
        detail: summarizeWhatsApp(ch?.whatsapp as WhatsAppChannelConfig | undefined) || t('shell.channels.notConfigured'),
      },
      {
        id: 'telegram',
        label: 'Telegram',
        configured: !!(ch?.telegram as { botToken?: string } | undefined)?.botToken,
        detail: (ch?.telegram as { botToken?: string } | undefined)?.botToken
          ? t('shell.channels.tokenSet')
          : t('shell.channels.notConfigured'),
      },
      {
        id: 'discord',
        label: 'Discord',
        configured: !!(ch?.discord as { token?: string } | undefined)?.token,
        detail: (ch?.discord as { token?: string } | undefined)?.token
          ? t('shell.channels.tokenSet')
          : t('shell.channels.notConfigured'),
      },
      {
        id: 'slack',
        label: 'Slack',
        configured: !!(ch?.slack as { botToken?: string } | undefined)?.botToken,
        detail: t('shell.channels.slackStrippedHint'),
        stripped: true,
      },
      {
        id: 'feishu',
        label: 'Feishu / Lark',
        configured: !!(ch?.feishu as { appId?: string } | undefined)?.appId,
        detail: (ch?.feishu as { appId?: string } | undefined)?.appId
          ? t('shell.channels.credentialsSet')
          : t('shell.channels.notConfigured'),
      },
    ]
  }, [config, t])

  const addAccount = () => {
    const id = newAccountId.trim().replace(/\s+/g, '-').toLowerCase()
    if (!id) return
    if (waAccounts.some((a) => a.id === id)) {
      setBanner({ kind: 'err', text: t('shell.channels.accountExists') })
      return
    }
    setWaAccounts((prev) => [...prev, { id, name: id, enabled: true }])
    setNewAccountId('')
    if (!waDefault) setWaDefault(id)
  }

  const saveAll = async () => {
    if (!config) return
    setSaving(true)
    setBanner(null)
    try {
      const accounts: Record<string, WhatsAppAccountConfig> = {}
      for (const row of waAccounts) {
        accounts[row.id] = {
          name: row.name.trim() || row.id,
          enabled: row.enabled,
        }
      }
      const nextWa: WhatsAppChannelConfig | undefined =
        waEnabled || Object.keys(accounts).length > 0
          ? {
              enabled: waEnabled,
              ...(waDefault.trim() ? { defaultAccount: waDefault.trim() } : {}),
              ...(Object.keys(accounts).length > 0 ? { accounts } : {}),
            }
          : undefined

      const channels: NonNullable<OpenClawConfig['channels']> = {
        ...(config.channels ?? {}),
      }

      if (nextWa) channels.whatsapp = nextWa
      else delete channels.whatsapp

      if (tgEnabled && tgToken.trim()) {
        channels.telegram = {
          ...(typeof channels.telegram === 'object' && channels.telegram ? channels.telegram : {}),
          enabled: true,
          botToken: tgToken.trim(),
        }
      } else if (!tgEnabled) {
        delete channels.telegram
      }

      if (discordEnabled && discordToken.trim()) {
        channels.discord = {
          ...(typeof channels.discord === 'object' && channels.discord ? channels.discord : {}),
          enabled: true,
          token: discordToken.trim(),
        }
      } else if (!discordEnabled) {
        delete channels.discord
      }

      // Slack extension is stripped from the desktop bundle — keep any stored token for export
      // but do not pretend the channel is supported.
      if (slackBotToken.trim()) {
        channels.slack = {
          ...(typeof channels.slack === 'object' && channels.slack ? channels.slack : {}),
          botToken: slackBotToken.trim(),
        }
      }

      if (feishuAppId.trim() && feishuAppSecret.trim()) {
        channels.feishu = {
          ...(typeof channels.feishu === 'object' && channels.feishu ? channels.feishu : {}),
          appId: feishuAppId.trim(),
          appSecret: feishuAppSecret.trim(),
        }
      }

      const next: OpenClawConfig = { ...config, channels }
      await window.electronAPI.configWrite(next)
      setConfig(next)
      setBanner({ kind: 'ok', text: t('shell.channels.savedRestartHint') })
      try {
        await window.electronAPI.gatewayRestart()
      } catch {
        // save succeeded; restart is best-effort
      }
      // Open Control UI Channels after restart so WhatsApp QR pairing is visible
      // (native Channels panel does not embed the Baileys QR surface).
      if (waEnabled) {
        openControlUi('/channels')
      }
    } catch (e) {
      setBanner({
        kind: 'err',
        text: e instanceof Error ? e.message : t('shell.channels.saveFailed'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleWhatsAppQrStart = async (force: boolean) => {
    stopWhatsAppQrPoll()
    setWaQrBusy(true)
    setWaQrMessage(null)
    setWaQrConnected(false)
    if (force) {
      waQrDataUrlRef.current = null
      setWaQrDataUrl(null)
    }
    try {
      const res = await window.electronAPI.whatsappLoginStart({
        force,
        accountId: waDefault.trim() || undefined,
      })
      if (res.qrDataUrl) {
        waQrDataUrlRef.current = res.qrDataUrl
        setWaQrDataUrl(res.qrDataUrl)
      }
      setWaQrMessage(res.message ?? null)
      if (res.connected) {
        setWaQrConnected(true)
        waQrDataUrlRef.current = null
        setWaQrDataUrl(null)
        setWaQrBusy(false)
        return
      }
      if (res.qrDataUrl) {
        // Keep UI busy while auto-waiting; gateway refreshes QR every ~15–20s.
        void runWhatsAppQrPoll()
      } else {
        setWaQrBusy(false)
      }
    } catch (e) {
      setWaQrMessage(e instanceof Error ? e.message : t('shell.channels.waQrFailed'))
      waQrDataUrlRef.current = null
      setWaQrDataUrl(null)
      setWaQrBusy(false)
    }
  }

  const handleWhatsAppQrWait = async () => {
    void runWhatsAppQrPoll()
  }

  const handleWhatsAppLogout = async () => {
    stopWhatsAppQrPoll()
    setWaQrBusy(true)
    try {
      const res = await window.electronAPI.whatsappLogout({
        accountId: waDefault.trim() || undefined,
      })
      waQrDataUrlRef.current = null
      setWaQrDataUrl(null)
      setWaQrConnected(false)
      setWaQrMessage(res.message ?? 'Logged out.')
    } catch (e) {
      setWaQrMessage(e instanceof Error ? e.message : t('shell.channels.waQrFailed'))
    } finally {
      setWaQrBusy(false)
    }
  }

  if (loading) {
    return (
      <ShellLayout title={t('shell.channels.title')} onBack={handleBack}>
        <div className="flex items-center justify-center min-h-[40vh]" role="status">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </ShellLayout>
    )
  }

  if (error) {
    return (
      <ShellLayout title={t('shell.channels.title')} onBack={handleBack}>
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
        <Button type="button" className="mt-4" onClick={() => void load()}>
          {t('shell.channels.retry')}
        </Button>
      </ShellLayout>
    )
  }

  return (
    <ShellLayout title={t('shell.channels.title')} onBack={handleBack}>
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <p className="text-sm text-muted-foreground">{t('shell.channels.subtitle')}</p>

        <section className="space-y-3" aria-label={t('shell.channels.overviewAria')}>
          <h3 className="text-sm font-semibold">{t('shell.channels.overview')}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{row.detail}</p>
                </div>
                <span
                  className={[
                    'shrink-0 text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded',
                    row.stripped
                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                      : row.configured
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {row.stripped
                    ? t('shell.channels.stripped')
                    : row.configured
                      ? t('shell.channels.active')
                      : t('shell.channels.inactive')}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 rounded-lg border border-border p-4" aria-label="WhatsApp">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                {t('shell.channels.whatsappTitle')}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {t('shell.channels.whatsappDesc')}
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm shrink-0">
              <Checkbox checked={waEnabled} onCheckedChange={(c) => setWaEnabled(c === true)} />
              {t('shell.channels.enable')}
            </label>
          </div>

          <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 space-y-3">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" />
              {t('shell.channels.waLinkTitle')}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t('shell.channels.waQrHint')}</p>
            <ol className="text-xs text-muted-foreground list-decimal pl-4 space-y-1 leading-relaxed">
              <li>{t('shell.channels.waLinkStep1')}</li>
              <li>{t('shell.channels.waLinkStep2')}</li>
              <li>{t('shell.channels.waLinkStep3')}</li>
            </ol>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!waEnabled || waQrBusy}
                onClick={() => void handleWhatsAppQrStart(false)}
              >
                {waQrBusy && !waQrDataUrl ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <QrCode className="w-3.5 h-3.5 mr-1" />
                )}
                {waQrBusy && !waQrDataUrl ? t('shell.channels.waQrWorking') : t('shell.channels.waShowQr')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!waEnabled || waQrBusy}
                onClick={() => void handleWhatsAppQrStart(true)}
              >
                {t('shell.channels.waRelink')}
              </Button>
              {waQrDataUrl ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={waQrBusy}
                  onClick={() => void handleWhatsAppQrWait()}
                >
                  {waQrBusy ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : null}
                  {waQrBusy ? t('shell.channels.waQrWaiting') : t('shell.channels.waWaitScan')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive"
                disabled={!waEnabled || waQrBusy}
                onClick={() => void handleWhatsAppLogout()}
              >
                {t('shell.channels.waLogout')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => openControlUi('/channels')}>
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                {t('shell.channels.openControlUiQr')}
              </Button>
            </div>

            {waQrConnected ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5" role="status">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('shell.channels.waQrConnected')}
              </p>
            ) : null}

            {waQrMessage ? (
              <p className="text-xs text-muted-foreground break-words" role="status">
                {waQrMessage}
              </p>
            ) : null}

            {waQrDataUrl ? (
              <div className="inline-flex rounded-md border border-dashed border-border bg-background p-3">
                <img
                  src={waQrDataUrl}
                  alt="WhatsApp QR"
                  width={180}
                  height={180}
                  className="rounded-sm"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            ) : null}
          </div>

          <fieldset className="space-y-1.5">
            <label htmlFor="wa-default" className="text-sm font-medium">
              {t('shell.channels.defaultAccount')}
            </label>
            <Input
              id="wa-default"
              value={waDefault}
              onChange={(e) => setWaDefault(e.target.value)}
              placeholder="default"
              className="font-mono"
              disabled={!waEnabled}
            />
          </fieldset>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t('shell.channels.accounts')}</p>
            {waAccounts.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('shell.channels.noAccounts')}</p>
            ) : (
              <ul className="space-y-2">
                {waAccounts.map((acct) => (
                  <li
                    key={acct.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-2"
                  >
                    <code className="text-xs font-mono shrink-0">{acct.id}</code>
                    <Input
                      value={acct.name}
                      onChange={(e) =>
                        setWaAccounts((prev) =>
                          prev.map((a) => (a.id === acct.id ? { ...a, name: e.target.value } : a)),
                        )
                      }
                      className="h-8 flex-1 min-w-[8rem]"
                      disabled={!waEnabled}
                    />
                    <label className="inline-flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={acct.enabled}
                        onCheckedChange={(c) =>
                          setWaAccounts((prev) =>
                            prev.map((a) =>
                              a.id === acct.id ? { ...a, enabled: c === true } : a,
                            ),
                          )
                        }
                        disabled={!waEnabled}
                      />
                      {t('shell.channels.enable')}
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={!waEnabled}
                      onClick={() => setWaAccounts((prev) => prev.filter((a) => a.id !== acct.id))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
                placeholder={t('shell.channels.newAccountPlaceholder')}
                className="font-mono h-9"
                disabled={!waEnabled}
              />
              <Button type="button" variant="secondary" onClick={addAccount} disabled={!waEnabled}>
                <Plus className="w-4 h-4 mr-1" />
                {t('shell.channels.addAccount')}
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Telegram</h3>
            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox checked={tgEnabled} onCheckedChange={(c) => setTgEnabled(c === true)} />
              {t('shell.channels.enable')}
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{t('shell.channels.telegramDesc')}</p>
          <Input
            type="password"
            value={tgToken}
            onChange={(e) => setTgToken(e.target.value)}
            placeholder={t('shell.channels.botTokenPlaceholder')}
            disabled={!tgEnabled}
            className="font-mono"
          />
          {tgToken && !tgEnabled ? (
            <p className="text-[10px] text-muted-foreground">{maskSecret(tgToken)}</p>
          ) : null}
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Discord</h3>
            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={discordEnabled}
                onCheckedChange={(c) => setDiscordEnabled(c === true)}
              />
              {t('shell.channels.enable')}
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{t('shell.channels.discordDesc')}</p>
          <Input
            type="password"
            value={discordToken}
            onChange={(e) => setDiscordToken(e.target.value)}
            placeholder={t('shell.channels.botTokenPlaceholder')}
            disabled={!discordEnabled}
            className="font-mono"
          />
        </section>

        <section className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="text-sm font-semibold">Slack</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('shell.channels.slackStrippedDesc')}
          </p>
        </section>

        <section className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">{t('shell.channels.feishuTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('shell.channels.feishuDesc')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={feishuAppId}
              onChange={(e) => setFeishuAppId(e.target.value)}
              placeholder="App ID"
              className="font-mono"
            />
            <Input
              type="password"
              value={feishuAppSecret}
              onChange={(e) => setFeishuAppSecret(e.target.value)}
              placeholder="App Secret"
              className="font-mono"
            />
          </div>
          {onOpenFeishuSettings && (
            <Button type="button" variant="secondary" onClick={onOpenFeishuSettings}>
              {t('shell.settings.openFeishuSettings')}
            </Button>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void saveAll()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {t('shell.channels.saveAll')}
          </Button>
          <Button type="button" variant="outline" onClick={() => openControlUi('/channels')}>
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            {t('shell.channels.openControlUi')}
          </Button>
        </div>

        {banner && (
          <p
            className={[
              'text-sm inline-flex items-center gap-1.5',
              banner.kind === 'ok' ? 'text-emerald-600' : 'text-destructive',
            ].join(' ')}
            role="status"
          >
            {banner.kind === 'ok' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {banner.text}
          </p>
        )}
      </div>
    </ShellLayout>
  )
}
