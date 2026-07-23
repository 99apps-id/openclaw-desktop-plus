/**
 * Shell i18n: shell-config locale preference, OS locale fallback, sync native window title.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ko from './locales/ko.json'
import es from './locales/es.json'

import {
  normalizeToShellLocale,
  SHELL_SUPPORTED_LOCALES,
  type ShellLocale,
} from '../../shared/shell-locale'

export type { ShellLocale }
export { SHELL_SUPPORTED_LOCALES }

const DEFAULT_LOCALE: ShellLocale = 'en'

/** Fixed labels for the language dropdown (native script; avoids nesting i18n keys). */
export const SHELL_LOCALE_LABELS: Record<ShellLocale, string> = {
  en: 'English',
  fr: 'Français',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
}

const IPC_LOCALE_TIMEOUT_MS = 8000

function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms)
    void promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      () => {
        clearTimeout(timer)
        resolve(undefined)
      },
    )
  })
}

async function detectSystemLocale(): Promise<ShellLocale> {
  if (typeof window.electronAPI?.systemGetLocale === 'function') {
    try {
      const locale = await raceWithTimeout(window.electronAPI.systemGetLocale(), IPC_LOCALE_TIMEOUT_MS)
      if (locale) {
        return normalizeToShellLocale(locale)
      }
    } catch {
      // fall through
    }
  }
  return normalizeToShellLocale(navigator.language)
}

async function resolveInitialLocale(): Promise<ShellLocale> {
  if (typeof window.electronAPI?.shellGetConfig === 'function') {
    try {
      const cfg = await raceWithTimeout(window.electronAPI.shellGetConfig(), IPC_LOCALE_TIMEOUT_MS)
      if (cfg?.locale) {
        return normalizeToShellLocale(cfg.locale)
      }
    } catch {
      // fall through
    }
  }
  return detectSystemLocale()
}

/** Push title to main process (document.title also updates the window in Electron). */
export function syncNativeWindowTitle(title: string): void {
  const trimmed = title.trim()
  if (!trimmed) return
  try {
    document.title = trimmed
  } catch {
    /* ignore */
  }
  if (typeof window.electronAPI?.shellSetWindowTitle === 'function') {
    void window.electronAPI.shellSetWindowTitle(trimmed)
  }
}

/** Change UI language and persist to shell config. */
export async function setAppLocale(next: ShellLocale): Promise<void> {
  await i18n.changeLanguage(next)
  if (typeof window.electronAPI?.shellSetConfig === 'function') {
    try {
      await window.electronAPI.shellSetConfig({ locale: next })
    } catch {
      // still keep i18n language
    }
  }
}

export async function initI18n(): Promise<void> {
  const lng = await resolveInitialLocale()

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ja: { translation: ja },
      ko: { translation: ko },
      es: { translation: es },
    },
    lng,
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  })
}

export default i18n
