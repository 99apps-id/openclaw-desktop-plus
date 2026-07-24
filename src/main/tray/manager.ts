import { Menu, Tray, app, nativeImage, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { GatewayStatusValue } from '../../shared/types.js'
import type { ShellLocale } from '../../shared/shell-locale.js'
import { getInstallDir, getUserDataDir } from '../utils/paths.js'
import { getTrayMenuStrings, type TrayMenuStrings } from './tray-i18n.js'

export interface TrayManagerOptions {
  appName: string
  /** Current shell UI locale (from ShellConfig + OS fallback) */
  resolveTrayLocale: () => ShellLocale
  onOpenMainWindow: () => void
  onRestartGateway: () => void | Promise<void>
  onOpenSettings?: () => void
  /** Feishu pairing / allowlist (shell route) */
  onOpenFeishuSettings?: () => void
  onOpenAbout?: () => void
  onOpenUpdates?: () => void
  onQuit: () => void
}

function gatewayStatusLabel(strings: TrayMenuStrings, status: GatewayStatusValue): string {
  switch (status) {
    case 'running':
      return strings.gatewayRunning
    case 'starting':
      return strings.gatewayStarting
    case 'error':
      return strings.gatewayError
    case 'stopped':
    default:
      return strings.gatewayStopped
  }
}

function resolveTrayIconPath(): string | null {
  const installDir = getInstallDir()
  const resourcesPath = process.resourcesPath
  const exeDir = path.dirname(app.getPath('exe'))
  // Prefer .ico on Windows so tray/taskbar match the branded OpenClaw asset (PNG can fail silently).
  const candidates =
    process.platform === 'win32'
      ? [
          path.join(resourcesPath, 'icon.ico'),
          path.join(installDir, 'resources', 'icon.ico'),
          path.join(exeDir, 'resources', 'icon.ico'),
          path.join(resourcesPath, 'tray-icon.png'),
          path.join(resourcesPath, 'apple-touch-icon.png'),
          path.join(installDir, 'resources', 'tray-icon.png'),
          path.join(installDir, 'resources', 'apple-touch-icon.png'),
        ]
      : [
          path.join(resourcesPath, 'apple-touch-icon.png'),
          path.join(resourcesPath, 'tray-icon.png'),
          path.join(resourcesPath, 'icon.ico'),
          path.join(installDir, 'resources', 'apple-touch-icon.png'),
          path.join(installDir, 'resources', 'tray-icon.png'),
          path.join(installDir, 'resources', 'icon.ico'),
          path.join(exeDir, 'resources', 'tray-icon.png'),
          path.join(exeDir, 'resources', 'icon.ico'),
        ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return null
}

export class TrayManager {
  private tray: Tray | null = null
  private gatewayStatus: GatewayStatusValue = 'stopped'
  private updateAvailable = false
  private readonly options: TrayManagerOptions

  constructor(options: TrayManagerOptions) {
    this.options = options
  }

  create(): Tray {
    if (this.tray && !this.tray.isDestroyed()) {
      return this.tray
    }

    const iconPath = resolveTrayIconPath()
    const resolvedIcon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()
    const icon = resolvedIcon.isEmpty() ? nativeImage.createEmpty() : resolvedIcon
    this.tray = new Tray(icon)
    this.tray.setToolTip(this.options.appName)
    this.tray.on('double-click', () => {
      this.options.onOpenMainWindow()
    })
    this.rebuildMenu()
    return this.tray
  }

  setGatewayStatus(status: GatewayStatusValue): void {
    this.gatewayStatus = status
    this.rebuildMenu()
  }

  setUpdateAvailable(available: boolean): void {
    if (this.updateAvailable !== available) {
      this.updateAvailable = available
      this.rebuildMenu()
    }
  }

  /** Call when ShellConfig.locale changes so menu labels update. */
  refreshMenu(): void {
    this.rebuildMenu()
  }

  destroy(): void {
    if (!this.tray || this.tray.isDestroyed()) {
      this.tray = null
      return
    }
    this.tray.destroy()
    this.tray = null
  }

  private rebuildMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) {
      return
    }

    const locale = this.options.resolveTrayLocale()
    const s = getTrayMenuStrings(locale)

    const template = [
      {
        label: s.openApp,
        click: () => this.options.onOpenMainWindow(),
      },
      ...(this.updateAvailable
        ? [
            {
              label: s.updateAvailable,
              click: () => {
                if (this.options.onOpenUpdates) {
                  this.options.onOpenUpdates()
                } else if (this.options.onOpenSettings) {
                  this.options.onOpenSettings()
                }
                this.options.onOpenMainWindow()
              },
            },
          ]
        : []),
      {
        label: gatewayStatusLabel(s, this.gatewayStatus),
        enabled: false,
      },
      {
        label: s.restartGateway,
        click: () => {
          void this.options.onRestartGateway()
        },
      },
      { type: 'separator' as const },
      {
        label: s.openConfigDir,
        click: () => {
          void shell.openPath(getUserDataDir())
        },
      },
      {
        label: s.settings,
        submenu: [
          {
            label: s.settingsGeneral,
            click: () => {
              this.options.onOpenSettings?.()
              this.options.onOpenMainWindow()
            },
          },
          ...(this.options.onOpenFeishuSettings
            ? [
                {
                  label: s.settingsFeishu,
                  click: () => {
                    this.options.onOpenFeishuSettings?.()
                    this.options.onOpenMainWindow()
                  },
                } as const,
              ]
            : []),
        ],
      },
      {
        label: s.about,
        click: () => {
          this.options.onOpenAbout?.()
          this.options.onOpenMainWindow()
        },
      },
      { type: 'separator' as const },
      {
        label: s.quit,
        click: () => this.options.onQuit(),
      },
    ]

    const menu = Menu.buildFromTemplate(template)
    this.tray.setContextMenu(menu)
  }
}
