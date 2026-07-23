/**
 * Tray context menu strings (main process). Kept in sync with shell locales.
 */
import { app } from 'electron'
import type { ShellConfig } from '../../shared/types.js'
import {
  SHELL_SUPPORTED_LOCALES,
  normalizeToShellLocale,
  type ShellLocale,
} from '../../shared/shell-locale.js'

export interface TrayMenuStrings {
  openApp: string
  updateAvailable: string
  gatewayRunning: string
  gatewayStarting: string
  gatewayError: string
  gatewayStopped: string
  restartGateway: string
  openConfigDir: string
  settings: string
  settingsGeneral: string
  settingsFeishu: string
  about: string
  quit: string
}

const EN: TrayMenuStrings = {
  openApp: 'Open OpenClaw',
  updateAvailable: 'Update available',
  gatewayRunning: 'Gateway: Running',
  gatewayStarting: 'Gateway: Starting',
  gatewayError: 'Gateway: Error',
  gatewayStopped: 'Gateway: Stopped',
  restartGateway: 'Restart Gateway',
  openConfigDir: 'Open config directory',
  settings: 'Settings',
  settingsGeneral: 'General',
  settingsFeishu: 'Feishu Settings',
  about: 'About',
  quit: 'Quit',
}

const FR: TrayMenuStrings = {
  openApp: 'Ouvrir OpenClaw',
  updateAvailable: 'Mise à jour disponible',
  gatewayRunning: 'Passerelle : en cours d’exécution',
  gatewayStarting: 'Passerelle : démarrage',
  gatewayError: 'Passerelle : erreur',
  gatewayStopped: 'Passerelle : arrêtée',
  restartGateway: 'Redémarrer la passerelle',
  openConfigDir: 'Ouvrir le dossier de configuration',
  settings: 'Paramètres',
  settingsGeneral: 'Général',
  settingsFeishu: 'Paramètres Feishu',
  about: 'À propos',
  quit: 'Quitter',
}

const JA: TrayMenuStrings = {
  openApp: 'OpenClaw を開く',
  updateAvailable: 'アップデートがあります',
  gatewayRunning: 'ゲートウェイ: 実行中',
  gatewayStarting: 'ゲートウェイ: 起動中',
  gatewayError: 'ゲートウェイ: エラー',
  gatewayStopped: 'ゲートウェイ: 停止',
  restartGateway: 'ゲートウェイを再起動',
  openConfigDir: '設定フォルダを開く',
  settings: '設定',
  settingsGeneral: '一般',
  settingsFeishu: 'Feishu 設定',
  about: 'について',
  quit: '終了',
}

const KO: TrayMenuStrings = {
  openApp: 'OpenClaw 열기',
  updateAvailable: '업데이트 사용 가능',
  gatewayRunning: '게이트웨이: 실행 중',
  gatewayStarting: '게이트웨이: 시작 중',
  gatewayError: '게이트웨이: 오류',
  gatewayStopped: '게이트웨이: 중지됨',
  restartGateway: '게이트웨이 다시 시작',
  openConfigDir: '설정 폴더 열기',
  settings: '설정',
  settingsGeneral: '일반',
  settingsFeishu: 'Feishu 설정',
  about: '정보',
  quit: '종료',
}

const ES: TrayMenuStrings = {
  openApp: 'Abrir OpenClaw',
  updateAvailable: 'Actualización disponible',
  gatewayRunning: 'Puerta de enlace: En ejecución',
  gatewayStarting: 'Puerta de enlace: Iniciando',
  gatewayError: 'Puerta de enlace: Error',
  gatewayStopped: 'Puerta de enlace: Detenida',
  restartGateway: 'Reiniciar puerta de enlace',
  openConfigDir: 'Abrir carpeta de configuración',
  settings: 'Configuración',
  settingsGeneral: 'General',
  settingsFeishu: 'Configuración Feishu',
  about: 'Acerca de',
  quit: 'Salir',
}

const BY_LOCALE: Record<ShellLocale, TrayMenuStrings> = {
  en: EN,
  fr: FR,
  ja: JA,
  ko: KO,
  es: ES,
}

export function getTrayMenuStrings(locale: ShellLocale): TrayMenuStrings {
  return BY_LOCALE[locale] ?? EN
}

/** Resolve active shell UI locale: persisted ShellConfig.locale, else OS locale. */
export function resolveTrayLocale(readShellConfig: () => ShellConfig): ShellLocale {
  const cfg = readShellConfig()
  const raw = cfg.locale
  if (typeof raw === 'string' && (SHELL_SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
    return raw as ShellLocale
  }
  return normalizeToShellLocale(app.getLocale())
}

export interface FeishuPairingNotificationCopy {
  title: string
  bodyTemplate: string
}

/** System notification when new Feishu pairing pending (same locale as tray). */
export function getFeishuPairingNotificationStrings(locale: ShellLocale): FeishuPairingNotificationCopy {
  switch (locale) {
    case 'ja':
      return {
        title: 'OpenClaw',
        bodyTemplate: '新しい Feishu DM の承認待ち。ペアリングコード: {{code}}',
      }
    case 'ko':
      return {
        title: 'OpenClaw',
        bodyTemplate: '새 Feishu DM 승인 대기, 페어링 코드: {{code}}',
      }
    case 'fr':
      return {
        title: 'OpenClaw',
        bodyTemplate: 'Nouvelle demande d’appariement Feishu DM, code : {{code}}',
      }
    case 'es':
      return {
        title: 'OpenClaw',
        bodyTemplate: 'Nueva solicitud de emparejamiento Feishu DM, código: {{code}}',
      }
    default:
      return {
        title: 'OpenClaw Desktop Plus',
        bodyTemplate: 'New Feishu DM pairing request, code: {{code}}',
      }
  }
}

export function formatFeishuPairingBody(template: string, code: string): string {
  return template.replace(/\{\{\s*code\s*\}\}/g, code)
}
