/**
 * CSS/JS injected into the embedded OpenClaw Control UI for:
 * - readable ASCII art / crisp QR images
 * - coding-composer attach discoverability (highlight +, drop affordance, one-time hint)
 */
export const CONTROL_UI_CHAT_ENHANCE_CSS = `
/* OpenClaw Desktop Plus — chat readability (ASCII / monospace / QR) */
pre, code, .font-mono, [class*="mono"], [class*="code-block"], [class*="CodeBlock"],
[data-language="ascii"], [data-language="text"], [class*="language-ascii"], [class*="language-text"] {
  font-family: ui-monospace, "Cascadia Code", "Cascadia Mono", "Segoe UI Mono",
    "SF Mono", Menlo, Consolas, "Liberation Mono", monospace !important;
  font-variant-ligatures: none;
  font-feature-settings: "liga" 0, "calt" 0;
}
pre, [class*="code-block"], [class*="CodeBlock"], [data-language] {
  white-space: pre !important;
  overflow-x: auto !important;
  tab-size: 4;
  line-height: 1.35 !important;
  letter-spacing: 0 !important;
}
/* QR / barcode-like images: keep pixels sharp */
img[alt*="qr" i], img[alt*="QR"], img[src*="qr" i], img[src*="QR"],
img[class*="qr" i], canvas[class*="qr" i], svg[class*="qr" i],
img[src^="data:image"][alt*="code" i] {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  max-width: min(100%, 320px);
  height: auto;
}
/* ASCII-art / QR-in-text blocks */
pre:not([class]), pre.ocdp-ascii, .ocdp-ascii {
  white-space: pre !important;
  overflow-x: auto !important;
  font-size: 12px !important;
  line-height: 1.15 !important;
}
/* Coding composer — make attach control easier to spot */
.agent-chat__input-btn--attach,
summary.agent-chat__input-btn--attach {
  outline: 1px solid color-mix(in srgb, var(--accent, #3b82f6) 45%, transparent);
  border-radius: 8px;
}
.agent-chat__attach-menu[open] > summary.agent-chat__input-btn--attach {
  outline-color: var(--accent, #3b82f6);
}
.chat-attachments-preview {
  gap: 0.5rem;
}
.agent-chat__composer-shell.ocdp-drop-target {
  outline: 2px dashed color-mix(in srgb, var(--accent, #3b82f6) 70%, transparent);
  outline-offset: -4px;
  background: color-mix(in srgb, var(--accent, #3b82f6) 6%, transparent);
}
#ocdp-attach-hint {
  position: fixed;
  z-index: 9999;
  left: 50%;
  bottom: 5.5rem;
  transform: translateX(-50%);
  max-width: min(92vw, 28rem);
  padding: 0.55rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text, inherit);
  background: color-mix(in srgb, var(--bg, #111) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--border, #444) 80%, transparent);
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
#ocdp-attach-hint button {
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
  font-size: 14px;
  line-height: 1;
  padding: 0 0.15rem;
}
#ocdp-attach-hint button:hover { opacity: 1; }
`

export const CONTROL_UI_CHAT_ENHANCE_SCRIPT = `
(function () {
  try {
    if (document.getElementById('ocdp-chat-enhance')) return;
    var s = document.createElement('style');
    s.id = 'ocdp-chat-enhance';
    s.textContent = ${JSON.stringify(CONTROL_UI_CHAT_ENHANCE_CSS)};
    (document.head || document.documentElement).appendChild(s);

    function looksLikeAsciiArt(text) {
      if (!text || text.length < 40) return false;
      var lines = text.split(/\\n/);
      if (lines.length < 4) return false;
      var blocky = 0;
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i];
        if (/[█▄▀░▒▓#*@]{4,}/.test(L) || /[+][-]{3,}[+]/.test(L) || /^[ \\t]*[|]/.test(L)) blocky++;
      }
      return blocky >= 3;
    }

    function enhanceNode(root) {
      var nodes = root.querySelectorAll ? root.querySelectorAll('pre') : [];
      for (var i = 0; i < nodes.length; i++) {
        var pre = nodes[i];
        if (pre.classList.contains('ocdp-ascii')) continue;
        if (looksLikeAsciiArt(pre.textContent || '')) pre.classList.add('ocdp-ascii');
      }
      var imgs = root.querySelectorAll ? root.querySelectorAll('img') : [];
      for (var j = 0; j < imgs.length; j++) {
        var img = imgs[j];
        var alt = (img.getAttribute('alt') || '') + ' ' + (img.getAttribute('src') || '');
        if (/qr|barcode/i.test(alt)) {
          img.style.imageRendering = 'pixelated';
          img.style.maxWidth = 'min(100%, 320px)';
        }
      }
    }

    enhanceNode(document);
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        for (var k = 0; k < m.addedNodes.length; k++) {
          var n = m.addedNodes[k];
          if (n.nodeType === 1) enhanceNode(n);
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Drop affordance on composer
    function wireDropTarget() {
      var shell = document.querySelector('.agent-chat__composer-shell');
      if (!shell || shell.dataset.ocdpDropBound) return;
      shell.dataset.ocdpDropBound = '1';
      var depth = 0;
      shell.addEventListener('dragenter', function (e) {
        if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
        depth++;
        shell.classList.add('ocdp-drop-target');
      });
      shell.addEventListener('dragleave', function () {
        depth = Math.max(0, depth - 1);
        if (depth === 0) shell.classList.remove('ocdp-drop-target');
      });
      shell.addEventListener('drop', function () {
        depth = 0;
        shell.classList.remove('ocdp-drop-target');
      });
      shell.addEventListener('dragover', function (e) {
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      });
    }
    wireDropTarget();
    var dropMo = new MutationObserver(function () { wireDropTarget(); });
    dropMo.observe(document.documentElement, { childList: true, subtree: true });

    // One-time attach hint (localStorage)
    try {
      if (localStorage.getItem('ocdp-attach-hint-dismissed') !== '1') {
        var hint = document.createElement('div');
        hint.id = 'ocdp-attach-hint';
        hint.setAttribute('role', 'status');
        hint.innerHTML = '<span>Attach images &amp; docs: use <strong>+</strong> in the composer, drag &amp; drop, paste a screenshot, or the Desktop <strong>Attach</strong> button.</span><button type="button" aria-label="Dismiss">×</button>';
        hint.querySelector('button').addEventListener('click', function () {
          localStorage.setItem('ocdp-attach-hint-dismissed', '1');
          hint.remove();
        });
        document.documentElement.appendChild(hint);
        setTimeout(function () {
          // Hide only — do not mark dismissed so it can show again next session until user clicks ×
          if (hint.parentNode) hint.remove();
        }, 14000);
      }
    } catch (e2) {}
  } catch (e) {}
})();
`
