/**
 * Inject Desktop Plus chat CSS into Control UI frames (ASCII + QR readability).
 */

import { webFrameMain, type BrowserWindow } from 'electron'
import { CONTROL_UI_CHAT_ENHANCE_SCRIPT } from './chat-enhance.js'
import { logWarn } from '../utils/logger.js'

function looksLikeControlUiUrl(url: string): boolean {
  if (!url || url === 'about:blank') return false
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (url.startsWith('openclaw-shell:') || url.startsWith('file:')) return false
    return true
  } catch {
    return false
  }
}

async function injectIntoFrame(frameProcessId: number, frameRoutingId: number): Promise<void> {
  try {
    const frame = webFrameMain.fromId(frameProcessId, frameRoutingId)
    if (!frame || frame.isDestroyed()) return
    const url = frame.url
    if (!looksLikeControlUiUrl(url)) return
    await frame.executeJavaScript(CONTROL_UI_CHAT_ENHANCE_SCRIPT, true)
  } catch (err) {
    logWarn(
      `[control-ui] chat enhance inject failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/** Attach once per BrowserWindow to enhance nested Control UI iframes. */
export function attachControlUiChatEnhance(window: BrowserWindow): void {
  window.webContents.on(
    'did-frame-finish-load',
    (
      _event: Electron.Event,
      isMainFrame: boolean,
      frameProcessId: number,
      frameRoutingId: number,
    ) => {
      if (isMainFrame) return
      void injectIntoFrame(frameProcessId, frameRoutingId)
    },
  )
}
