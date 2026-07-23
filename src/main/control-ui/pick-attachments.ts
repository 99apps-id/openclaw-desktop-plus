/**
 * Native file picker → inject attachments into the embedded Control UI chat composer.
 * Cross-origin iframe cannot be reached from the shell renderer; use webFrameMain frames.
 */

import { dialog, type BrowserWindow } from 'electron'
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { logWarn } from '../utils/logger.js'

const MAX_FILE_BYTES = 16 * 1024 * 1024
/** Cap total payload before base64 inflate (~21 MiB wire per 16 MiB file). */
const MAX_BATCH_BYTES = 32 * 1024 * 1024
const MAX_BATCH_FILES = 8

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.js': 'text/javascript',
  '.jsx': 'text/javascript',
  '.py': 'text/x-python',
  '.rs': 'text/x-rust',
  '.go': 'text/x-go',
  '.html': 'text/html',
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
}

export interface ChatPickAttachmentFile {
  name: string
  mime: string
  base64: string
}

export interface ChatPickAttachmentsResult {
  ok: boolean
  count: number
  skipped: string[]
  message?: string
}

function mimeFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

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

function collectControlUiFrames(window: BrowserWindow): Electron.WebFrameMain[] {
  const out: Electron.WebFrameMain[] = []
  const walk = (frame: Electron.WebFrameMain | null | undefined) => {
    if (!frame || frame.isDestroyed()) return
    if (looksLikeControlUiUrl(frame.url)) out.push(frame)
    for (const child of frame.frames ?? []) walk(child)
  }
  try {
    walk(window.webContents.mainFrame)
  } catch {
    /* ignore */
  }
  return out
}

function buildInjectScript(files: ChatPickAttachmentFile[]): string {
  return `
(function (files) {
  try {
    var input = document.querySelector('.agent-chat__file-input');
    if (!input) return { ok: false, reason: 'no-file-input' };
    var dt = new DataTransfer();
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var bin = atob(f.base64);
      var bytes = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      var blob = new Blob([bytes], { type: f.mime || 'application/octet-stream' });
      dt.items.add(new File([blob], f.name || ('file-' + i), { type: f.mime || 'application/octet-stream' }));
    }
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, count: files.length };
  } catch (e) {
    return { ok: false, reason: e && e.message ? String(e.message) : 'inject-failed' };
  }
})(${JSON.stringify(files)});
`
}

async function injectIntoControlUi(
  window: BrowserWindow,
  files: ChatPickAttachmentFile[],
): Promise<{ ok: boolean; message?: string }> {
  const frames = collectControlUiFrames(window)
  if (frames.length === 0) {
    // Fallback: try any subframe via webFrameMain.fromId from known process — scan all
    try {
      for (const frame of window.webContents.mainFrame.framesInSubtree ?? []) {
        if (looksLikeControlUiUrl(frame.url)) frames.push(frame)
      }
    } catch {
      /* ignore */
    }
  }
  if (frames.length === 0) {
    return { ok: false, message: 'Control UI chat is not loaded yet' }
  }

  const script = buildInjectScript(files)
  let lastReason = 'inject-failed'
  for (const frame of frames) {
    try {
      if (frame.isDestroyed()) continue
      const result = (await frame.executeJavaScript(script, true)) as
        | { ok?: boolean; reason?: string; count?: number }
        | undefined
      if (result?.ok) return { ok: true }
      if (result?.reason) lastReason = result.reason
    } catch (err) {
      lastReason = err instanceof Error ? err.message : String(err)
      logWarn(`[control-ui] attach inject failed: ${lastReason}`)
    }
  }
  if (lastReason === 'no-file-input') {
    return { ok: false, message: 'Open the Chat page first, then try Attach again' }
  }
  return { ok: false, message: lastReason }
}

/** Show native multi-file dialog and inject into Control UI composer. */
export async function pickAndInjectChatAttachments(
  window: BrowserWindow | null,
): Promise<ChatPickAttachmentsResult> {
  if (!window || window.isDestroyed()) {
    return { ok: false, count: 0, skipped: [], message: 'No main window' }
  }

  const picked = await dialog.showOpenDialog(window, {
    title: 'Attach files to chat',
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Images & documents',
        extensions: [
          'png',
          'jpg',
          'jpeg',
          'gif',
          'webp',
          'bmp',
          'svg',
          'pdf',
          'txt',
          'md',
          'markdown',
          'json',
          'csv',
          'ts',
          'tsx',
          'js',
          'jsx',
          'py',
          'rs',
          'go',
          'html',
          'css',
          'yaml',
          'yml',
          'doc',
          'docx',
          'xls',
          'xlsx',
          'ppt',
          'pptx',
          'zip',
        ],
      },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })

  if (picked.canceled || picked.filePaths.length === 0) {
    return { ok: true, count: 0, skipped: [] }
  }

  const files: ChatPickAttachmentFile[] = []
  const skipped: string[] = []
  let batchBytes = 0

  for (const filePath of picked.filePaths) {
    if (files.length >= MAX_BATCH_FILES) {
      skipped.push(`${basename(filePath)} (max ${MAX_BATCH_FILES} files per attach)`)
      continue
    }
    try {
      const buf = await readFile(filePath)
      if (buf.byteLength > MAX_FILE_BYTES) {
        skipped.push(`${basename(filePath)} (over 16 MiB)`)
        continue
      }
      if (batchBytes + buf.byteLength > MAX_BATCH_BYTES) {
        skipped.push(`${basename(filePath)} (batch over 32 MiB)`)
        continue
      }
      // Skip video by extension (Control UI rejects video/)
      if (/\.(?:avi|m4v|mov|mp4|mpeg|mpg|webm)$/i.test(filePath)) {
        skipped.push(`${basename(filePath)} (video not supported)`)
        continue
      }
      files.push({
        name: basename(filePath),
        mime: mimeFromPath(filePath),
        base64: buf.toString('base64'),
      })
      batchBytes += buf.byteLength
    } catch (err) {
      skipped.push(`${basename(filePath)} (${err instanceof Error ? err.message : String(err)})`)
    }
  }

  if (files.length === 0) {
    return {
      ok: false,
      count: 0,
      skipped,
      message: skipped.length ? 'No files could be attached' : 'No files selected',
    }
  }

  let injected: { ok: boolean; message?: string }
  try {
    injected = await injectIntoControlUi(window, files)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logWarn(`[control-ui] attach inject threw: ${msg}`)
    return {
      ok: false,
      count: 0,
      skipped,
      message: msg.includes('Invalid string length') || msg.includes('out of memory')
        ? 'Files too large to inject — try fewer or smaller files'
        : msg,
    }
  }
  return {
    ok: injected.ok,
    count: injected.ok ? files.length : 0,
    skipped,
    message: injected.ok ? undefined : injected.message,
  }
}
