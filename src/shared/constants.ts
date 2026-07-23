/**
 * Shared constants — main and renderer.
 * Path layout matches upstream OpenClaw conventions.
 */

/** Default gateway listen port */
export const DEFAULT_GATEWAY_PORT = 18789

/** OpenClaw state directory under %USERPROFILE% */
export const OPENCLAW_USER_DIR = '.openclaw'

/** Shell product name (under %APPDATA%; installer shortcut / window title) */
export const APP_NAME = 'OpenClaw Desktop Plus'

/** electron-builder / Windows AUMID — new product identity (not upgrade-compatible with com.openclaw.desktop) */
export const APP_ID = 'com.openclaw.desktop-plus'

/** Pre-rename AppData folder — migrate shell config once when present */
export const APP_NAME_LEGACY = 'OpenClaw Desktop'

/** Main OpenClaw config filename */
export const OPENCLAW_CONFIG_FILE = 'openclaw.json'

/** Shell config file relative to app.getPath('userData') */
export const SHELL_CONFIG_FILE = 'config.json'
