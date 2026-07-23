/**
 * Supported UI locales for the desktop shell (renderer i18n + persisted ShellConfig.locale).
 */
import { APP_NAME } from './constants.js'

export const SHELL_SUPPORTED_LOCALES = ['en', 'fr', 'ja', 'ko', 'es'] as const

export type ShellLocale = (typeof SHELL_SUPPORTED_LOCALES)[number]

/** Follow OS / Electron locale string → supported shell locale */
export function normalizeToShellLocale(electronLocale: string): ShellLocale {
  const lower = electronLocale.toLowerCase()
  // Chinese (and any unsupported locale) falls back to English.
  if (lower.startsWith('fr')) return 'fr'
  if (lower.startsWith('ja')) return 'ja'
  if (lower.startsWith('ko')) return 'ko'
  if (lower.startsWith('es')) return 'es'
  if ((SHELL_SUPPORTED_LOCALES as readonly string[]).includes(lower)) {
    return lower as ShellLocale
  }
  return 'en'
}

/** Native window title before renderer paints (bootstrap / errors) */
export function getLocalizedShellWindowTitle(_locale: ShellLocale): string {
  return APP_NAME
}
