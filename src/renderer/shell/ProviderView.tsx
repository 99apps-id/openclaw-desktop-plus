import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShellLayout } from './ShellLayout'
import { PROVIDER_OPTIONS, MODELS_BY_PROVIDER } from '@/constants/provider-presets'
import type { ModelProvider, ModelConfig } from '../../shared/types'
import type { ProvidersListResult } from '../../shared/electron-api'

export interface ProviderViewProps {
  onBack?: () => void
}

function formatTestMessage(msg: string | undefined, t: (key: string) => string): string {
  if (!msg) return t('shell.llmApi.unknownError')
  if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('403') || msg.toLowerCase().includes('unauthorized'))
    return t('shell.llmApi.authFailed')
  if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('limit'))
    return t('shell.llmApi.rateLimit')
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('econnrefused'))
    return t('shell.llmApi.networkErrorMsg')
  return msg.length > 120 ? `${msg.slice(0, 117)}...` : msg
}

export function ProviderView({ onBack }: ProviderViewProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<ProvidersListResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState<string>('')
  const [newProfile, setNewProfile] = useState({
    profileId: '',
    provider: '' as ModelProvider | '',
    apiKey: '',
    customProviderId: '',
    customBaseUrl: '',
    modelId: '',
    compatibility: 'openai' as 'openai' | 'anthropic',
  })
  const [profileBanner, setProfileBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [importJson, setImportJson] = useState('')
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const [defaultPrimary, setDefaultPrimary] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await window.electronAPI.providersList()
      setData(res)
      setDefaultPrimary(res.modelDefaults?.primary ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shell.llmApi.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleTest = async () => {
    const { provider, apiKey, modelId } = testForm
    if (!provider || !apiKey || !modelId) return
    if (provider === 'custom' && (!customBaseUrl || !customProviderId)) return
    setTestState('testing')
    setTestMessage('')
    try {
      const cfg: ModelConfig = {
        provider,
        apiKey,
        modelId,
        customBaseUrl: provider === 'custom' ? customBaseUrl : undefined,
        customProviderId: provider === 'custom' ? customProviderId : undefined,
        customCompatibility: provider === 'custom' ? 'openai' : undefined,
      }
      const res = await window.electronAPI.providersTest(cfg)
      if (res.ok) {
        setTestState('ok')
        setTestMessage(t('shell.llmApi.connectionSuccess'))
      } else {
        setTestState('fail')
        setTestMessage(formatTestMessage(res.message, t))
      }
    } catch (e) {
      setTestState('fail')
      setTestMessage(e instanceof Error ? e.message : t('shell.llmApi.testFailed'))
    }
  }

  const [testForm, setTestForm] = useState({
    provider: '' as ModelProvider | '',
    modelId: '',
    apiKey: '',
  })
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customProviderId, setCustomProviderId] = useState('')
  const [customEndpoint, setCustomEndpoint] = useState({
    providerId: '',
    baseUrl: '',
    modelId: '',
    modelName: '',
    apiKey: '',
    compatibility: 'openai' as 'openai' | 'anthropic',
    setAsDefault: true,
    restartGateway: true,
  })
  const [savingCustom, setSavingCustom] = useState(false)
  const [customEndpointBanner, setCustomEndpointBanner] = useState<{
    kind: 'ok' | 'err'
    text: string
  } | null>(null)

  const testModelOpts = testForm.provider ? MODELS_BY_PROVIDER[testForm.provider] ?? [] : []

  const handleSaveCustomEndpoint = async () => {
    const providerId = customEndpoint.providerId.trim()
    const baseUrl = customEndpoint.baseUrl.trim()
    const modelId = customEndpoint.modelId.trim()
    const apiKey = customEndpoint.apiKey.trim()
    if (!providerId || !baseUrl || !modelId || !apiKey) return
    setSavingCustom(true)
    setCustomEndpointBanner(null)
    setError(null)
    try {
      const cfg: ModelConfig = {
        provider: 'custom',
        apiKey,
        modelId,
        customProviderId: providerId,
        customBaseUrl: baseUrl,
        customCompatibility: customEndpoint.compatibility,
      }
      await window.electronAPI.modelSettingsApply({
        modelConfig: cfg,
        target: { kind: 'defaults' },
        // Defer restart until after optional primary restore, otherwise gateway
        // keeps the temporary new primary while config already restored the old one.
        restartGateway: false,
      })
      const displayName = customEndpoint.modelName.trim() || modelId
      if (displayName !== modelId) {
        await window.electronAPI.providersSaveProviderConfig({
          providerId,
          config: {
            models: [{ id: modelId, name: displayName }],
          },
        })
      }
      const expectedPrimary = modelId.includes('/') ? modelId : `${providerId}/${modelId}`
      if (!customEndpoint.setAsDefault) {
        // modelSettingsApply always writes primary; restore previous if user unchecked.
        const prev = data?.modelDefaults?.primary?.trim()
        if (prev && prev !== expectedPrimary) {
          await window.electronAPI.providersSetModelDefaults({ primary: prev })
        }
      }
      if (customEndpoint.restartGateway) {
        try {
          await window.electronAPI.gatewayRestart()
        } catch {
          /* config is saved; gateway can be restarted manually */
        }
      }
      setCustomEndpoint({
        providerId: '',
        baseUrl: '',
        modelId: '',
        modelName: '',
        apiKey: '',
        compatibility: 'openai',
        setAsDefault: true,
        restartGateway: true,
      })
      setCustomEndpointBanner({ kind: 'ok', text: t('shell.llmApi.customEndpointSaved') })
      void load()
    } catch (e) {
      setCustomEndpointBanner({
        kind: 'err',
        text: e instanceof Error ? e.message : t('shell.llmApi.customEndpointSaveFailed'),
      })
    } finally {
      setSavingCustom(false)
    }
  }

  const handleSaveProfile = async () => {
    const { profileId, provider, apiKey } = newProfile
    if (!provider || !apiKey.trim()) return
    setSaving(true)
    setProfileBanner(null)
    setError(null)
    try {
      if (provider === 'custom') {
        const customProviderId =
          newProfile.customProviderId.trim() || newProfile.profileId.trim()
        const baseUrl = newProfile.customBaseUrl.trim()
        const modelId = newProfile.modelId.trim()
        if (!customProviderId || !baseUrl || !modelId) {
          setProfileBanner({
            kind: 'err',
            text: t('shell.llmApi.customProfileFieldsRequired'),
          })
          return
        }
        const cfg: ModelConfig = {
          provider: 'custom',
          apiKey: apiKey.trim(),
          modelId,
          customProviderId,
          customBaseUrl: baseUrl,
          customCompatibility: newProfile.compatibility,
        }
        await window.electronAPI.modelSettingsApply({
          modelConfig: cfg,
          target: { kind: 'defaults' },
          restartGateway: true,
        })
        // Also register an auth profile entry keyed for the custom provider id
        try {
          await window.electronAPI.providersSaveProfile({
            profileId: newProfile.profileId.trim() || 'default',
            provider: customProviderId,
            apiKey: apiKey.trim(),
          })
        } catch {
          /* provider config is the important write; auth profile is best-effort */
        }
        setNewProfile({
          profileId: '',
          provider: '',
          apiKey: '',
          customProviderId: '',
          customBaseUrl: '',
          modelId: '',
          compatibility: 'openai',
        })
        setProfileBanner({ kind: 'ok', text: t('shell.llmApi.customEndpointSaved') })
        void load()
        return
      }

      if (!profileId.trim()) return
      await window.electronAPI.providersSaveProfile({
        profileId: profileId.trim(),
        provider,
        apiKey: apiKey.trim(),
      })
      setNewProfile({
        profileId: '',
        provider: '',
        apiKey: '',
        customProviderId: '',
        customBaseUrl: '',
        modelId: '',
        compatibility: 'openai',
      })
      setProfileBanner({ kind: 'ok', text: t('shell.llmApi.profileSaved') })
      void load()
    } catch (e) {
      setProfileBanner({
        kind: 'err',
        text: e instanceof Error ? e.message : t('shell.llmApi.saveFailed'),
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProfile = async (profileId: string, provider: string) => {
    try {
      await window.electronAPI.providersDeleteProfile({ profileId, provider })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shell.llmApi.deleteFailed'))
    }
  }

  const handleExport = async () => {
    try {
      const json = await window.electronAPI.providersExport({ maskKeys: true })
      await navigator.clipboard.writeText(json)
      setImportResult({ imported: 0, errors: [] })
      setTimeout(() => setImportResult(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shell.llmApi.exportFailed'))
    }
  }

  const handleImport = async () => {
    if (!importJson.trim()) return
    try {
      const res = await window.electronAPI.providersImport(importJson.trim())
      setImportResult(res)
      setImportJson('')
      void load()
    } catch (e) {
      setImportResult({ imported: 0, errors: [e instanceof Error ? e.message : t('shell.llmApi.importFailed')] })
    }
  }

  const handleSetDefault = async () => {
    if (!defaultPrimary.trim()) return
    setSaving(true)
    try {
      await window.electronAPI.providersSetModelDefaults({ primary: defaultPrimary.trim() })
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shell.llmApi.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const defaultBack = () => {
    window.location.hash = ''
  }
  const onBackFn = onBack ?? defaultBack

  if (loading && !data) {
    return (
      <ShellLayout title={t('shell.nav.llmApi')} onBack={onBackFn}>
        <p className="text-sm text-muted-foreground" role="status">
          {t('shell.llmApi.loading')}
        </p>
      </ShellLayout>
    )
  }

  return (
    <ShellLayout title={t('shell.nav.llmApi')} onBack={onBackFn}>
      <div className="flex flex-col gap-6 max-w-2xl">
        {error && (
          <div
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Default model */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label={t('shell.llmApi.defaultModelAria')}>
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-muted-foreground" aria-hidden />
            <h2 className="text-sm font-medium">{t('shell.llmApi.defaultModelSection')}</h2>
          </div>
          <div className="flex gap-2">
            <Input
              value={defaultPrimary}
              onChange={(e) => setDefaultPrimary(e.target.value)}
              placeholder={t('shell.llmApi.defaultModelPlaceholder')}
              className="font-mono text-sm"
            />
            <Button size="sm" onClick={handleSetDefault} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : t('shell.llmApi.set')}
            </Button>
          </div>
        </section>

        {/* Providers list + add custom OpenAI-compatible endpoint */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label={t('shell.llmApi.providersAria')}>
          <h2 className="text-sm font-medium mb-3">{t('shell.llmApi.providersSection')}</h2>
          {data?.providers && data.providers.length > 0 ? (
            <ul className="space-y-2">
              {data.providers.map((p) => (
                <li
                  key={p.providerId}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="font-medium">{p.providerId}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.baseUrl ?? t('shell.llmApi.defaultEndpoint')} · {p.hasApiKey ? t('shell.llmApi.keySet') : t('shell.llmApi.noKey')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('shell.llmApi.noProviders')}</p>
          )}

          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <div>
              <h3 className="text-sm font-medium">{t('shell.llmApi.addCustomEndpoint')}</h3>
              <p className="text-xs text-muted-foreground mt-1">{t('shell.llmApi.addCustomEndpointHint')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder={t('shell.llmApi.providerIdLabel')}
                value={customEndpoint.providerId}
                onChange={(e) => setCustomEndpoint((f) => ({ ...f, providerId: e.target.value }))}
                className="font-mono text-sm"
                aria-label={t('shell.llmApi.providerIdLabel')}
              />
              <Input
                placeholder={t('shell.llmApi.baseUrlPlaceholder')}
                value={customEndpoint.baseUrl}
                onChange={(e) => setCustomEndpoint((f) => ({ ...f, baseUrl: e.target.value }))}
                className="font-mono text-sm"
                aria-label={t('shell.llmApi.baseUrlLabel')}
              />
              <Input
                placeholder={t('shell.llmApi.modelIdLabel')}
                value={customEndpoint.modelId}
                onChange={(e) => setCustomEndpoint((f) => ({ ...f, modelId: e.target.value }))}
                className="font-mono text-sm"
                aria-label={t('shell.llmApi.modelIdLabel')}
              />
              <Input
                placeholder={t('shell.llmApi.modelNamePlaceholder')}
                value={customEndpoint.modelName}
                onChange={(e) => setCustomEndpoint((f) => ({ ...f, modelName: e.target.value }))}
                className="text-sm"
                aria-label={t('shell.llmApi.modelNameLabel')}
              />
              <Input
                type="password"
                placeholder={t('shell.llmApi.apiKeyPlaceholder')}
                value={customEndpoint.apiKey}
                onChange={(e) => setCustomEndpoint((f) => ({ ...f, apiKey: e.target.value }))}
                className="font-mono text-sm sm:col-span-2"
                autoComplete="off"
              />
              <Select
                value={customEndpoint.compatibility}
                onValueChange={(v) =>
                  setCustomEndpoint((f) => ({
                    ...f,
                    compatibility: (v === 'anthropic' ? 'anthropic' : 'openai') as 'openai' | 'anthropic',
                  }))
                }
              >
                <SelectTrigger className="w-full" aria-label={t('shell.llmApi.compatibilityLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">{t('shell.llmApi.openaiCompatible')}</SelectItem>
                  <SelectItem value="anthropic">{t('shell.llmApi.anthropicCompatible')}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex flex-col gap-2 justify-center text-xs">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customEndpoint.setAsDefault}
                    onChange={(e) => setCustomEndpoint((f) => ({ ...f, setAsDefault: e.target.checked }))}
                  />
                  {t('shell.llmApi.setAsDefault')}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={customEndpoint.restartGateway}
                    onChange={(e) => setCustomEndpoint((f) => ({ ...f, restartGateway: e.target.checked }))}
                  />
                  {t('shell.llmApi.restartAfterSave')}
                </label>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => void handleSaveCustomEndpoint()}
                disabled={
                  savingCustom ||
                  !customEndpoint.providerId.trim() ||
                  !customEndpoint.baseUrl.trim() ||
                  !customEndpoint.modelId.trim() ||
                  !customEndpoint.apiKey.trim()
                }
              >
                {savingCustom ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="w-4 h-4" aria-hidden />
                )}
                {t('shell.llmApi.add')}
              </Button>
              {customEndpointBanner ? (
                <p
                  className={`text-xs ${customEndpointBanner.kind === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
                  role="status"
                >
                  {customEndpointBanner.text}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {/* Auth profiles */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label={t('shell.llmApi.authProfilesAria')}>
          <h2 className="text-sm font-medium mb-3">{t('shell.llmApi.authProfilesSection')}</h2>
          {data?.profiles && data.profiles.length > 0 ? (
            <ul className="space-y-2">
              {data.profiles.map((prof) => (
                <li
                  key={prof.profileId}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span>
                    <span className="font-medium">{prof.profileId}</span>
                    <span className="text-muted-foreground text-sm ml-2">({prof.provider})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {prof.hasKey ? t('shell.llmApi.keySet') : t('shell.llmApi.noKey')}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteProfile(prof.profileId, prof.provider)}
                      aria-label={t('shell.llmApi.deleteProfileAria', { id: prof.profileId })}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t('shell.llmApi.noProfiles')}</p>
          )}

          <div className="mt-4 pt-4 border-t border-border space-y-3">
            <p className="text-xs text-muted-foreground">{t('shell.llmApi.addProfile')}</p>
            <div className="flex flex-wrap gap-2">
              <Select
                value={newProfile.provider || undefined}
                onValueChange={(v) =>
                  setNewProfile((p) => ({
                    ...p,
                    provider: (v || '') as ModelProvider | '',
                    // Pre-fill custom provider id from profile id when switching to custom
                    customProviderId:
                      v === 'custom' && !p.customProviderId.trim() && p.profileId.trim()
                        ? p.profileId.trim()
                        : p.customProviderId,
                  }))
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('shell.llmApi.providerPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-[min(50vh,280px)]">
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newProfile.provider !== 'custom' ? (
                <Input
                  placeholder={t('shell.llmApi.profileIdPlaceholder')}
                  value={newProfile.profileId}
                  onChange={(e) => setNewProfile((p) => ({ ...p, profileId: e.target.value }))}
                  className="w-32"
                />
              ) : null}
              <Input
                type="password"
                placeholder={t('shell.llmApi.apiKeyPlaceholder')}
                value={newProfile.apiKey}
                onChange={(e) => setNewProfile((p) => ({ ...p, apiKey: e.target.value }))}
                className="w-48"
                autoComplete="off"
              />
              {newProfile.provider !== 'custom' ? (
                <Button
                  size="sm"
                  onClick={() => void handleSaveProfile()}
                  disabled={
                    saving ||
                    !newProfile.provider ||
                    !newProfile.profileId.trim() ||
                    !newProfile.apiKey.trim()
                  }
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="w-4 h-4" aria-hidden />
                  )}
                  {t('shell.llmApi.add')}
                </Button>
              ) : null}
            </div>

            {newProfile.provider === 'custom' ? (
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t('shell.llmApi.customProfileFieldsHint')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder={t('shell.llmApi.providerIdLabel')}
                    value={newProfile.customProviderId}
                    onChange={(e) =>
                      setNewProfile((p) => ({ ...p, customProviderId: e.target.value }))
                    }
                    className="font-mono text-sm"
                    aria-label={t('shell.llmApi.providerIdLabel')}
                  />
                  <Input
                    placeholder={t('shell.llmApi.baseUrlPlaceholder')}
                    value={newProfile.customBaseUrl}
                    onChange={(e) =>
                      setNewProfile((p) => ({ ...p, customBaseUrl: e.target.value }))
                    }
                    className="font-mono text-sm"
                    aria-label={t('shell.llmApi.baseUrlLabel')}
                  />
                  <Input
                    placeholder={t('shell.llmApi.modelIdLabel')}
                    value={newProfile.modelId}
                    onChange={(e) => setNewProfile((p) => ({ ...p, modelId: e.target.value }))}
                    className="font-mono text-sm"
                    aria-label={t('shell.llmApi.modelIdLabel')}
                  />
                  <Select
                    value={newProfile.compatibility}
                    onValueChange={(v) =>
                      setNewProfile((p) => ({
                        ...p,
                        compatibility: v === 'anthropic' ? 'anthropic' : 'openai',
                      }))
                    }
                  >
                    <SelectTrigger aria-label={t('shell.llmApi.compatibilityLabel')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">{t('shell.llmApi.openaiCompatible')}</SelectItem>
                      <SelectItem value="anthropic">{t('shell.llmApi.anthropicCompatible')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={() => void handleSaveProfile()}
                  disabled={
                    saving ||
                    !newProfile.apiKey.trim() ||
                    !(newProfile.customProviderId.trim() || newProfile.profileId.trim()) ||
                    !newProfile.customBaseUrl.trim() ||
                    !newProfile.modelId.trim()
                  }
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="w-4 h-4" aria-hidden />
                  )}
                  {t('shell.llmApi.addCustomEndpoint')}
                </Button>
              </div>
            ) : null}

            {profileBanner ? (
              <p
                className={`text-xs ${profileBanner.kind === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
                role="status"
              >
                {profileBanner.text}
              </p>
            ) : null}
          </div>
        </section>

        {/* Test connection */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label={t('shell.llmApi.testConnectionAria')}>
          <h2 className="text-sm font-medium mb-3">{t('shell.llmApi.testConnectionSection')}</h2>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Select
                value={testForm.provider || undefined}
                onValueChange={(v) =>
                  setTestForm((f) => ({
                    ...f,
                    provider: (v || '') as ModelProvider | '',
                    modelId: '',
                  }))
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('shell.llmApi.providerPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {testForm.provider === 'custom' ? (
                <>
                  <Input
                    placeholder={t('shell.llmApi.providerIdPlaceholder')}
                    value={customProviderId}
                    onChange={(e) => setCustomProviderId(e.target.value)}
                    className="w-32"
                  />
                  <Input
                    placeholder={t('shell.llmApi.baseUrlPlaceholder')}
                    value={customBaseUrl}
                    onChange={(e) => setCustomBaseUrl(e.target.value)}
                    className="w-48"
                  />
                </>
              ) : null}
              {testModelOpts.length > 0 ? (
                <Select
                  value={testForm.modelId && testModelOpts.some((m) => m.id === testForm.modelId) ? testForm.modelId : undefined}
                  onValueChange={(v) => setTestForm((f) => ({ ...f, modelId: v || '' }))}
                  disabled={!testForm.provider}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder={t('shell.llmApi.modelPresetPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {testModelOpts.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                placeholder={testModelOpts.length > 0 ? t('shell.llmApi.orCustomModelId') : t('shell.llmApi.modelIdPlaceholder')}
                value={testForm.modelId}
                onChange={(e) => setTestForm((f) => ({ ...f, modelId: e.target.value }))}
                className="w-48"
              />
              <Input
                type="password"
                placeholder={t('shell.llmApi.apiKeyPlaceholder')}
                value={testForm.apiKey}
                onChange={(e) => setTestForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="w-48"
              />
              <Button
                size="sm"
                onClick={handleTest}
                disabled={
                  testState === 'testing' ||
                  !testForm.provider ||
                  !testForm.apiKey ||
                  !testForm.modelId ||
                  (testForm.provider === 'custom' && (!customBaseUrl || !customProviderId))
                }
              >
                {testState === 'testing' ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  t('shell.llmApi.test')
                )}
              </Button>
            </div>
            {testState === 'ok' && (
              <p className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400" role="status">
                <CheckCircle2 className="w-4 h-4" aria-hidden />
                {testMessage}
              </p>
            )}
            {testState === 'fail' && (
              <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
                <XCircle className="w-4 h-4" aria-hidden />
                {testMessage}
              </p>
            )}
          </div>
        </section>

        {/* Import / Export */}
        <section className="rounded-lg border border-border bg-card p-4" aria-label={t('shell.llmApi.importExportAria')}>
          <h2 className="text-sm font-medium mb-3">{t('shell.llmApi.importExportSection')}</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Copy className="w-4 h-4 mr-1" aria-hidden />
              {t('shell.llmApi.exportCopy')}
            </Button>
          </div>
          <div className="mt-3">
            <textarea
              className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={t('shell.llmApi.pasteJsonPlaceholder')}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <Button size="sm" className="mt-2" onClick={handleImport} disabled={!importJson.trim()}>
              <Upload className="w-4 h-4 mr-1" aria-hidden />
              {t('shell.llmApi.import')}
            </Button>
            {importResult && (
              <p className="text-sm mt-2">
                {t('shell.llmApi.importedCount', { count: importResult.imported })}{' '}
                {importResult.errors.length > 0 && (
                  <span className="text-destructive">{importResult.errors.join(', ')}</span>
                )}
              </p>
            )}
          </div>
        </section>
      </div>
    </ShellLayout>
  )
}
