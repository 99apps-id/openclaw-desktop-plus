# User guide — OpenClaw Desktop Plus

Operator-facing guide for the Windows desktop shell. For upstream gateway concepts (agents, tools, Control UI pages), see [docs.openclaw.ai](https://docs.openclaw.ai).

## Mental model

| Piece | What you use it for |
| --- | --- |
| **Control UI** (main window content) | Chat with the main agent, sessions, Tasks rail, Automations, Plugins/MCP, Skills workshop |
| **Desktop panels** (Menu / Dashboard overlays) | Gateway status, Models, LLM API keys, Channels (WhatsApp QR), ClawHub install (local), shell settings |
| **Tray** | Show window, restart gateway, quit |

Desktop Plus does **not** replace Control UI. It embeds it and adds native panels + deep-links.

## First launch

1. Install from [Releases](https://github.com/99apps-id/openclaw-desktop-plus/releases/latest).
2. Wizard: choose a model provider and API key (or OAuth where supported) → optional channels → gateway port/bind.
3. When the gateway status is **running**, the Control UI loads in the main area.
4. Use **Menu** (top-right) for Desktop panels, or the floating chips for Tasks / Cron / MCP / Channels / Attach.

Config written by the wizard lives in `%USERPROFILE%\.openclaw\openclaw.json`.

## Dashboard

- Gateway **Start / Restart**, port, local vs remote mode indicator
- Version block: Shell, Electron, Node, bundled OpenClaw
- **Doctor** / **Doctor --fix** (OpenClaw doctor + desktop checks)
- Quick actions into Settings, Skills, LLM API, Models, Channels
- Control UI shortcuts: **Tasks**, **Automations**, **MCP** (disabled until gateway is running)

## Models

Use **Models** when you care about the **default chat model** and catalog.

- Live list from the gateway (`models.list`), always shown as `provider/model` when possible
- **Set as default** writes `agents.defaults.model.primary` through a qualifier so bare ids (e.g. `nesa-free`) do not become phantom `openai/…` refs
- Optional vision / PDF model routing (`imageModel` / `pdfModel`)
- After changing the default, a gateway restart is often required for all agents to pick it up

**Models vs LLM API**

| Panel | Responsibility |
| --- | --- |
| **Models** | Default / fallbacks / aliases / catalog picker |
| **LLM API** | Provider credentials, auth profiles, custom OpenAI-compatible endpoints |

Adding a **custom endpoint** with a model id (and optionally “set as default”) registers the provider under `models.providers.<id>` so it appears in Models after refresh/restart. An auth-profile-only entry does not invent catalog models by itself.

### Custom OpenAI-compatible endpoint

In **LLM API** or Settings → model editor:

- Provider ID (e.g. `my-proxy`)
- API base URL
- Model ID (free text for custom hosts)
- Compatibility: OpenAI or Anthropic-style
- Optional: set as default; restart gateway after save

If you uncheck “set as default”, Desktop restores the previous primary **before** restarting the gateway so the running process does not keep a temporary primary.

## LLM API

- List configured providers and auth profiles
- Add profile (provider + API key); for **custom**, also enter provider id, base URL, model id
- Free-text **Set** default model field is also qualified server-side (`resolvePrimaryModelRef`)

## Channels

### WhatsApp

1. Enable WhatsApp in the Channels panel and save.
2. Click **Show QR** (or **Relink** with force).
3. Scan with WhatsApp → Linked devices.
4. Desktop auto-waits (`web.login.wait`) and refreshes the QR when the gateway rotates it (~15–20s). You can still press **Wait for scan** manually.
5. Prefer this panel over Control UI Settings QR; the iframe often receives QR events but fails to paint them.

Multi-account: set default account id and per-account rows as documented in the panel. Logout clears the Baileys session for the selected account.

### Other channels

- Telegram / Discord: bot tokens in the panel
- Feishu: dedicated Feishu Settings (pairing / allowlist)
- Slack: may appear in catalogs but is stripped from the desktop bundle (heavy deps)

## Skills and ClawHub

### Local skills list

Skills panel lists bundled + user skills/extensions, with enable/disable and validation.

### ClawHub (local gateway only)

1. Ensure gateway mode is **local** (not remote).
2. Skills → ClawHub → search → **Install**.
3. Install runs `openclaw skills install <ref> --global` into the managed skills directory under `%USERPROFILE%\.openclaw`.
4. Reload the list after install.

### Remote gateway

If Desktop is attached to a remote gateway, ClawHub install from the shell is **blocked**. Skills would land on the Windows machine, not on the VPS. Use **Open Skills in Control UI** (or ClawHub on the remote host) instead.

### Plugin install by spec

The “Install plugin” field still accepts npm/path/URL specs for `openclaw plugins install`.

### Control UI shortcuts on Skills

Buttons open `/tasks`, `/automation`, `/settings/mcp`, `/skills` in the embedded Control UI (works for local and remote).

## Gateway: local, bind, remote

### Local

Default. Desktop starts the bundled gateway process.

**Bind** (Settings → Gateway):

| Bind | Use when |
| --- | --- |
| `loopback` | Only this PC (safest default) |
| `lan` / `auto` | Phone pairing / Mobile Connect needs a non-loopback advertised URL |

**Mobile Connect:** Settings can force LAN bind then open Control UI `/nodes`.

### Remote

1. Settings → Gateway → **Remote**
2. Enter WebSocket URL (`ws://` / `wss://`), optional token, transport (`direct` or `ssh`)
3. Apply — Desktop stops managing a local child and loads Control UI from the remote HTTP origin (token kept in the URL hash)

Deep-links (Tasks, Channels, Skills, …) rewrite the remote origin path and re-attach the token so remote sessions stay authenticated.

## Chat and sub-agents

- The chat agent is the OpenClaw **main** agent. It may spawn **sub-agents** via tools (`sessions_spawn`); progress appears in Control UI **Tasks** / background-task rail / session sidebar children — not as Cursor-style task cards.
- **Attach** (floating button): native file picker injects images/documents into the Control UI composer (size/count limits apply).

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Black / empty Control UI | [INSTALLER_TROUBLESHOOTING.md](INSTALLER_TROUBLESHOOTING.md); verify Control UI bundle; run doctor |
| WhatsApp QR missing in Settings | Use Desktop → Channels → Show QR |
| `Unknown model: openai/…` | Set a qualified primary (`provider/model`); avoid bare free-tier aliases |
| ClawHub install fails on remote | Expected — install on the remote gateway / Control UI |
| Second instance “kills” QR/login | Desktop focuses the existing window without full reload |
| Changes not visible in Program Files app | Rebuild/reinstall; or use `pnpm start` from source for testing |

Logs: `%USERPROFILE%\.openclaw\logs\` (including `shell.log` when present).

## Related docs

- [README.md](../README.md) — product overview
- [DEVELOPMENT.md](DEVELOPMENT.md) — hacking on the shell
- [PACKAGING.md](PACKAGING.md) — building the installer
- Upstream: [Control UI](https://docs.openclaw.ai/web/control-ui) · [Sub-agents](https://docs.openclaw.ai/tools/subagents) · [ClawHub](https://docs.openclaw.ai/clawhub)
