import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, MessageSquareText } from 'lucide-react'
import { useWizardStore } from '@/stores/wizard-store'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ChannelTab = 'feishu' | 'telegram' | 'whatsapp' | 'discord' | 'slack'

interface ChannelTabOption {
  id: ChannelTab
  label: string
  description: string
}

// Order matches OpenClaw CLI onboard channel options
const CHANNEL_TABS: readonly ChannelTabOption[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    description: 'wizard.channel.whatsapp.description',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    description: 'wizard.channel.telegram.description',
  },
  {
    id: 'discord',
    label: 'Discord',
    description: 'wizard.channel.discord.description',
  },
  {
    id: 'slack',
    label: 'Slack',
    description: 'wizard.channel.slack.description',
  },
  {
    id: 'feishu',
    label: 'Feishu',
    description: 'wizard.channel.feishu.description',
  },
] as const

export function ChannelStep() {
  const { t } = useTranslation()
  const { channelConfig, setChannelConfig } = useWizardStore()

  const activeTab = channelConfig.selectedChannel

  const hasFeishuRequired =
    !!channelConfig.feishu?.appId?.trim() && !!channelConfig.feishu?.appSecret?.trim()
  const hasTelegramRequired = !!channelConfig.telegram?.botToken?.trim()
  const hasDiscordRequired = !!channelConfig.discord?.token?.trim()
  const hasSlackRequired =
    !!channelConfig.slack?.botToken?.trim() &&
    (channelConfig.slack?.mode !== 'http' || !!channelConfig.slack?.signingSecret?.trim())
  const showFeishuValidation = !channelConfig.skipChannels && activeTab === 'feishu'
  const showTelegramValidation = !channelConfig.skipChannels && activeTab === 'telegram'
  const showDiscordValidation = !channelConfig.skipChannels && activeTab === 'discord'
  const showSlackValidation = !channelConfig.skipChannels && activeTab === 'slack'
  const validationMessage = useMemo(() => {
    if (showFeishuValidation)
      return hasFeishuRequired
        ? t('wizard.channel.feishu.requiredDone')
        : t('wizard.channel.feishu.requiredMissing')
    if (showTelegramValidation)
      return hasTelegramRequired
        ? t('wizard.channel.telegram.configDone')
        : t('wizard.channel.telegram.configMissing')
    if (showDiscordValidation)
      return hasDiscordRequired
        ? t('wizard.channel.discord.configDone')
        : t('wizard.channel.discord.configMissing')
    if (showSlackValidation)
      return hasSlackRequired
        ? t('wizard.channel.slack.configDone')
        : t('wizard.channel.slack.configMissing')
    return null
  }, [
    hasFeishuRequired,
    hasTelegramRequired,
    hasDiscordRequired,
    hasSlackRequired,
    showFeishuValidation,
    showTelegramValidation,
    showDiscordValidation,
    showSlackValidation,
    t,
  ])

  const handleSkipChannelsChange = (checked: boolean) => {
    setChannelConfig({ skipChannels: checked })
  }

  const handleTabChange = (tab: ChannelTab) => {
    setChannelConfig({ selectedChannel: tab, skipChannels: false })
  }

  const updateFeishuField = (
    key: 'appId' | 'appSecret' | 'verificationToken' | 'encryptKey',
    value: string,
  ) => {
    const nextFeishu = {
      ...(channelConfig.feishu ?? {}),
      [key]: value,
    }
    setChannelConfig({ feishu: nextFeishu })
  }

  const updateTelegramField = (key: 'botToken', value: string) => {
    setChannelConfig({
      telegram: { ...(channelConfig.telegram ?? {}), [key]: value },
    })
  }

  const updateDiscordField = (key: 'token', value: string) => {
    setChannelConfig({
      discord: { ...(channelConfig.discord ?? {}), [key]: value },
    })
  }

  const updateSlackField = (
    key: 'mode' | 'botToken' | 'signingSecret' | 'appToken',
    value: string,
  ) => {
    const next = { ...(channelConfig.slack ?? { mode: 'socket' as const }) }
    if (key === 'mode') next.mode = value as 'socket' | 'http'
    else next[key] = value
    setChannelConfig({ slack: next })
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-3xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{t('wizard.channel.title')}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{t('wizard.channel.subtitle')}</p>
        </div>
        <label
          htmlFor="skip-channels-checkbox"
          className="inline-flex items-center gap-2 cursor-pointer rounded-md border border-border px-3 py-1.5 bg-muted/20 hover:bg-muted/50 transition-colors"
        >
          <Checkbox
            id="skip-channels-checkbox"
            checked={channelConfig.skipChannels}
            onCheckedChange={(checked) =>
              handleSkipChannelsChange(checked === true)
            }
          />
          <span className="text-sm font-medium">{t('wizard.channel.skipChannels')}</span>
        </label>
      </header>

      <section className="rounded-lg border border-border p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Channel type">
          {CHANNEL_TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={[
                  'h-9 rounded-md border px-3 text-sm transition-colors',
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-input bg-background text-foreground hover:border-primary/40',
                ].join(' ')}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          {t(CHANNEL_TABS.find((tab) => tab.id === activeTab)?.description ?? '')}
        </p>

        {activeTab === 'feishu' ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">{t('wizard.channel.feishu.title')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('wizard.channel.feishu.description')}
                </p>
              </div>
              <a
                href="https://open.feishu.cn/app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {t('wizard.channel.feishu.openPlatform')}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <fieldset className="space-y-1.5">
                <label htmlFor="feishu-app-id" className="text-sm font-medium">
                  {t('wizard.channel.feishu.appId')} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="feishu-app-id"
                  type="text"
                  value={channelConfig.feishu?.appId ?? ''}
                  onChange={(e) => updateFeishuField('appId', e.target.value)}
                  placeholder="cli_a1b2c3d4e5f6"
                  className="font-mono"
                  disabled={channelConfig.skipChannels}
                />
              </fieldset>

              <fieldset className="space-y-1.5">
                <label htmlFor="feishu-app-secret" className="text-sm font-medium">
                  {t('wizard.channel.feishu.appSecret')} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="feishu-app-secret"
                  type="password"
                  value={channelConfig.feishu?.appSecret ?? ''}
                  onChange={(e) => updateFeishuField('appSecret', e.target.value)}
                  placeholder={t('wizard.channel.feishu.appSecret')}
                  className="font-mono"
                  disabled={channelConfig.skipChannels}
                />
              </fieldset>

              <fieldset className="space-y-1.5">
                <label htmlFor="feishu-verification-token" className="text-sm font-medium">
                  {t('wizard.channel.feishu.verificationToken')}
                </label>
                <Input
                  id="feishu-verification-token"
                  type="text"
                  value={channelConfig.feishu?.verificationToken ?? ''}
                  onChange={(e) => updateFeishuField('verificationToken', e.target.value)}
                  placeholder={t('wizard.channel.feishu.verificationToken')}
                  className="font-mono"
                  disabled={channelConfig.skipChannels}
                />
              </fieldset>

              <fieldset className="space-y-1.5">
                <label htmlFor="feishu-encrypt-key" className="text-sm font-medium">
                  {t('wizard.channel.feishu.encryptKey')}{' '}
                  <span className="text-muted-foreground">({t('wizard.channel.feishu.optional')})</span>
                </label>
                <Input
                  id="feishu-encrypt-key"
                  type="text"
                  value={channelConfig.feishu?.encryptKey ?? ''}
                  onChange={(e) => updateFeishuField('encryptKey', e.target.value)}
                  placeholder={t('wizard.channel.feishu.encryptKey')}
                  className="font-mono"
                  disabled={channelConfig.skipChannels}
                />
              </fieldset>
            </div>

            {validationMessage && (
              <p
                className={[
                  'text-xs inline-flex items-center gap-1.5',
                  hasFeishuRequired ? 'text-emerald-600' : 'text-amber-600',
                ].join(' ')}
              >
                <MessageSquareText className="w-3.5 h-3.5" />
                {validationMessage}
              </p>
            )}
          </div>
        ) : activeTab === 'telegram' ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <p className="text-sm font-medium text-foreground">{t('wizard.channel.telegram.title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('wizard.channel.telegram.description')}
            </p>
            <fieldset className="space-y-1.5">
              <label htmlFor="telegram-bot-token" className="text-sm font-medium">
                {t('wizard.channel.telegram.botToken')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="telegram-bot-token"
                type="password"
                value={channelConfig.telegram?.botToken ?? ''}
                onChange={(e) => updateTelegramField('botToken', e.target.value)}
                placeholder="telegram-bot-token"
                className="font-mono"
                disabled={channelConfig.skipChannels}
              />
            </fieldset>
            {validationMessage && (
              <p className={['text-xs inline-flex items-center gap-1.5', hasTelegramRequired ? 'text-emerald-600' : 'text-amber-600'].join(' ')}>
                <MessageSquareText className="w-3.5 h-3.5" />
                {validationMessage}
              </p>
            )}
          </div>
        ) : activeTab === 'discord' ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <p className="text-sm font-medium text-foreground">{t('wizard.channel.discord.title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('wizard.channel.discord.description')}
            </p>
            <fieldset className="space-y-1.5">
              <label htmlFor="discord-token" className="text-sm font-medium">
                {t('wizard.channel.discord.botToken')} <span className="text-destructive">*</span>
              </label>
              <Input
                id="discord-token"
                type="password"
                value={channelConfig.discord?.token ?? ''}
                onChange={(e) => updateDiscordField('token', e.target.value)}
                placeholder="discord-bot-token"
                className="font-mono"
                disabled={channelConfig.skipChannels}
              />
            </fieldset>
            {validationMessage && (
              <p className={['text-xs inline-flex items-center gap-1.5', hasDiscordRequired ? 'text-emerald-600' : 'text-amber-600'].join(' ')}>
                <MessageSquareText className="w-3.5 h-3.5" />
                {validationMessage}
              </p>
            )}
          </div>
        ) : activeTab === 'slack' ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <p className="text-sm font-medium text-foreground">{t('wizard.channel.slack.title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('wizard.channel.slack.description')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <fieldset className="space-y-1.5">
                <label htmlFor="slack-mode" className="text-sm font-medium">{t('wizard.channel.slack.connectionMode')}</label>
                <Select
                  value={channelConfig.slack?.mode ?? 'socket'}
                  onValueChange={(v) => updateSlackField('mode', v)}
                  disabled={channelConfig.skipChannels}
                >
                  <SelectTrigger id="slack-mode" className="font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="socket">{t('wizard.channel.slack.socketMode')}</SelectItem>
                    <SelectItem value="http">{t('wizard.channel.slack.httpMode')}</SelectItem>
                  </SelectContent>
                </Select>
              </fieldset>
              <fieldset className="space-y-1.5">
                <label htmlFor="slack-bot-token" className="text-sm font-medium">
                  {t('wizard.channel.slack.botToken')} <span className="text-destructive">*</span>
                </label>
                <Input
                  id="slack-bot-token"
                  type="password"
                  value={channelConfig.slack?.botToken ?? ''}
                  onChange={(e) => updateSlackField('botToken', e.target.value)}
                  placeholder="slack-bot-token"
                  className="font-mono"
                  disabled={channelConfig.skipChannels}
                />
              </fieldset>
              {channelConfig.slack?.mode === 'http' && (
                <fieldset className="space-y-1.5 md:col-span-2">
                  <label htmlFor="slack-signing-secret" className="text-sm font-medium">
                    {t('wizard.channel.slack.signingSecret')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="slack-signing-secret"
                    type="password"
                    value={channelConfig.slack?.signingSecret ?? ''}
                    onChange={(e) => updateSlackField('signingSecret', e.target.value)}
                    placeholder="Required for HTTP mode"
                    className="font-mono"
                    disabled={channelConfig.skipChannels}
                  />
                </fieldset>
              )}
              {channelConfig.slack?.mode === 'socket' && (
                <fieldset className="space-y-1.5 md:col-span-2">
                  <label htmlFor="slack-app-token" className="text-sm font-medium">{t('wizard.channel.slack.appLevelToken')}</label>
                  <Input
                    id="slack-app-token"
                    type="password"
                    value={channelConfig.slack?.appToken ?? ''}
                    onChange={(e) => updateSlackField('appToken', e.target.value)}
                    placeholder="xapp-... (Socket mode)"
                    className="font-mono"
                    disabled={channelConfig.skipChannels}
                  />
                </fieldset>
              )}
            </div>
            {validationMessage && (
              <p className={['text-xs inline-flex items-center gap-1.5', hasSlackRequired ? 'text-emerald-600' : 'text-amber-600'].join(' ')}>
                <MessageSquareText className="w-3.5 h-3.5" />
                {validationMessage}
              </p>
            )}
          </div>
        ) : activeTab === 'whatsapp' ? (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 sm:p-4 space-y-3 sm:space-y-4">
            <p className="text-sm font-medium text-foreground">{t('wizard.channel.whatsapp.title')}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('wizard.channel.whatsapp.description')}
            </p>
            <label className="inline-flex items-center gap-2 text-sm">
              <Checkbox
                checked={channelConfig.whatsapp?.enabled === true}
                onCheckedChange={(checked) => {
                  const enabled = checked === true
                  const prev = channelConfig.whatsapp ?? {}
                  const accounts = prev.accounts ?? { default: { name: 'Primary', enabled: true } }
                  setChannelConfig({
                    whatsapp: {
                      ...prev,
                      enabled,
                      defaultAccount: prev.defaultAccount ?? 'default',
                      accounts: enabled ? accounts : prev.accounts,
                    },
                    skipChannels: false,
                  })
                }}
                disabled={channelConfig.skipChannels}
              />
              {t('wizard.channel.whatsapp.enable')}
            </label>
            <fieldset className="space-y-1.5">
              <label htmlFor="wa-default-account" className="text-sm font-medium">
                {t('wizard.channel.whatsapp.defaultAccount')}
              </label>
              <Input
                id="wa-default-account"
                value={channelConfig.whatsapp?.defaultAccount ?? 'default'}
                onChange={(e) =>
                  setChannelConfig({
                    whatsapp: {
                      ...(channelConfig.whatsapp ?? { enabled: true }),
                      enabled: true,
                      defaultAccount: e.target.value,
                      accounts: channelConfig.whatsapp?.accounts ?? {
                        default: { name: 'Primary', enabled: true },
                      },
                    },
                  })
                }
                className="font-mono"
                disabled={channelConfig.skipChannels || !channelConfig.whatsapp?.enabled}
              />
            </fieldset>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('wizard.channel.whatsapp.accounts')}</p>
              <p className="text-xs text-muted-foreground">{t('wizard.channel.whatsapp.accountsHint')}</p>
              {Object.entries(channelConfig.whatsapp?.accounts ?? {}).map(([id, acct]) => (
                <div
                  key={id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-2 py-2"
                >
                  <code className="text-xs font-mono">{id}</code>
                  <Input
                    value={acct?.name ?? id}
                    onChange={(e) => {
                      const accounts = { ...(channelConfig.whatsapp?.accounts ?? {}) }
                      accounts[id] = { ...(accounts[id] ?? {}), name: e.target.value, enabled: accounts[id]?.enabled !== false }
                      setChannelConfig({
                        whatsapp: {
                          ...(channelConfig.whatsapp ?? { enabled: true }),
                          enabled: true,
                          accounts,
                        },
                      })
                    }}
                    className="h-8 flex-1 min-w-[8rem]"
                    disabled={channelConfig.skipChannels || !channelConfig.whatsapp?.enabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={channelConfig.skipChannels || Object.keys(channelConfig.whatsapp?.accounts ?? {}).length <= 1}
                    onClick={() => {
                      const accounts = { ...(channelConfig.whatsapp?.accounts ?? {}) }
                      delete accounts[id]
                      setChannelConfig({
                        whatsapp: {
                          ...(channelConfig.whatsapp ?? { enabled: true }),
                          accounts,
                        },
                      })
                    }}
                  >
                    {t('wizard.channel.whatsapp.removeAccount')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={channelConfig.skipChannels || !channelConfig.whatsapp?.enabled}
                onClick={() => {
                  const accounts = { ...(channelConfig.whatsapp?.accounts ?? {}) }
                  let n = Object.keys(accounts).length + 1
                  let id = `account-${n}`
                  while (accounts[id]) {
                    n += 1
                    id = `account-${n}`
                  }
                  accounts[id] = { name: id, enabled: true }
                  setChannelConfig({
                    whatsapp: {
                      ...(channelConfig.whatsapp ?? { enabled: true }),
                      enabled: true,
                      defaultAccount: channelConfig.whatsapp?.defaultAccount ?? 'default',
                      accounts,
                    },
                  })
                }}
              >
                {t('wizard.channel.whatsapp.addAccount')}
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
