<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop Plus" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop Plus</h1>

<p align="center">
  <strong>Community Windows desktop shell and installer for <a href="https://github.com/openclaw/openclaw">OpenClaw</a>.</strong><br />
  Bundled Node.js + OpenClaw gateway, embedded Control UI, and native panels for models, channels, skills, and settings — without requiring a global Node install.
</p>

<p align="center">
  <a href="https://github.com/99apps-id/openclaw-desktop-plus/releases/latest">
    <img src="https://img.shields.io/github/v/release/99apps-id/openclaw-desktop-plus?style=flat-square&color=2563eb&label=latest+release" alt="Latest release" />
  </a>
  <a href="https://github.com/99apps-id/openclaw-desktop-plus/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/99apps-id/openclaw-desktop-plus/ci.yml?style=flat-square&label=ci" alt="CI" />
  </a>
  <a href="https://github.com/99apps-id/openclaw-desktop-plus/releases">
    <img src="https://img.shields.io/github/downloads/99apps-id/openclaw-desktop-plus/total?style=flat-square&color=16a34a&label=downloads" alt="Downloads" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/99apps-id/openclaw-desktop-plus?style=flat-square" alt="License" />
  </a>
</p>

<p align="center">
  <a href="#what-it-is">What it is</a> ·
  <a href="#what-it-is-not">What it is not</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="docs/USER_GUIDE.md">User guide</a> ·
  <a href="#faq">FAQ</a>
</p>

---

## What it is

**OpenClaw Desktop Plus** is an Electron app that:

1. Installs a portable **Node.js** runtime and a pinned **OpenClaw** gateway bundle
2. Runs (or attaches to) the gateway and embeds the OpenClaw **Control UI** in a window
3. Adds **native Desktop panels** for day-to-day operations that are awkward in a pure CLI workflow

It is a **community distribution** maintained by [99apps.id](https://github.com/99apps-id). It is **not** affiliated with the upstream OpenClaw project.

| Layer | Role |
| --- | --- |
| **Desktop shell** (this repo) | Installer, tray, wizard, IPC, Models / Channels / Skills / Settings panels |
| **OpenClaw gateway** (bundled) | Agents, tools, channels, skills runtime, Control UI |
| **User state** | `%USERPROFILE%\.openclaw\` (same layout as upstream CLI installs) |

Full operator walkthrough: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## What it is not

| Expectation | Reality |
| --- | --- |
| A coding IDE like Cursor | No — Control UI is an agent dashboard/chat, not an editor with inline completions |
| Official OpenClaw product | Community fork/packaging only |
| macOS / Linux desktop app | **Windows x64 only** today. On Mac/Linux/VPS, run the [OpenClaw gateway](https://github.com/openclaw/openclaw) directly, or attach Desktop Plus (on Windows) in **remote** mode |
| A replacement for ClawHub / Control UI | Shell deep-links into Control UI for Tasks, Automations, MCP, Skills; ClawHub install from the shell works for **local** gateway only |

## Quick start

1. Download `OpenClaw-Desktop-Plus-Setup-*.exe` from [Releases](https://github.com/99apps-id/openclaw-desktop-plus/releases/latest)
2. Run the installer (per-user or machine-wide)
3. Complete the setup wizard: **model provider → channels (optional) → gateway**
4. Launch from the Start Menu or desktop shortcut

**Requirements:** Windows 10/11 **x64** · ~350 MB free disk · network access for LLM APIs (and ClawHub if you install skills)

**Dev loop (contributors):** close the app → `pnpm start` from a checkout. Installed Program Files builds only pick up source fixes after you rebuild/reinstall.

## Current release

| | |
| --- | --- |
| **Shell** | `0.8.2+openclaw.2026.7.1-2` |
| **Git tag** | `v0.8.2+openclaw.2026.7.1-2` |
| **Bundled OpenClaw** | `2026.7.1-2` (`openclawBundleVersion` in `package.json`) |
| **Bundled Node.js** | `22.23.1` |

See [CHANGELOG](CHANGELOG.md) and upstream [OpenClaw v2026.7.1](https://github.com/openclaw/openclaw/releases/tag/v2026.7.1).

## Features

### Installer and runtime

- One-click NSIS installer; no system-wide Node.js required
- Pinned OpenClaw + portable Node shipped under `resources/`
- In-app updates from GitHub Releases (`electron-updater`)
- Tray icon, optional auto-start, shell theme / locale

### Gateway

- **Local mode (default):** Desktop spawns the bundled gateway on loopback (or LAN / auto bind for Mobile Connect)
- **Remote mode:** Attach to a gateway on a VPS, Tailscale, or SSH tunnel (Settings → Gateway). Control UI loads from the remote HTTP origin; local ClawHub install is disabled so skills are not written only on the Windows PC

### Native Desktop panels

| Panel | Purpose |
| --- | --- |
| **Dashboard** | Gateway status, versions, doctor, shortcuts into Control UI (Tasks / Automations / MCP) |
| **Models** | Live catalog, set default model (provider-qualified refs), vision/PDF routing |
| **LLM API** | Providers, auth profiles, custom OpenAI-compatible endpoints |
| **Channels** | WhatsApp (native QR + multi-account), Telegram, Discord, Slack notice, Feishu |
| **Skills** | Enable/disable skills & extensions; **ClawHub** search/install (local gateway); deep-links to Control UI |
| **Settings** | Appearance, startup, gateway local/remote + bind, model editor |

### Control UI (embedded)

The main chat surface is upstream Control UI inside an Electron iframe. Desktop adds:

- Reload Control UI without killing the gateway
- Floating shortcuts: **Tasks**, **Automations (Cron)**, **MCP / Plugins**, Channels, Attach files
- Deep-links that preserve auth token for **local and remote** gateways

### Channels and models (highlights)

- WhatsApp: show QR in the **Channels** panel (Control UI QR painting is often flaky in the iframe); QR refresh every ~15–20s is normal Baileys behavior
- Model refs normalized to `provider/model` (avoids bare ids becoming `openai/<id>` and breaking the picker)
- Custom OpenAI-compatible endpoints: provider id, base URL, model id, compatibility

## Architecture (local vs remote)

```text
┌─────────────────────────────────────────────┐
│           OpenClaw Desktop Plus             │
│  Electron shell · native panels · tray      │
│                    │                        │
│         embedded Control UI iframe          │
└──────────┬──────────────────┬───────────────┘
           │                  │
    local gateway      remote gateway
    (bundled child)    (VPS / Tailscale / SSH)
           │                  │
           └────────┬─────────┘
                    │
           %USERPROFILE%\.openclaw\
           (config, skills, sessions)
```

Typical **VPS** layout: run OpenClaw gateway on the server (≥4 GB RAM recommended); use Desktop Plus on Windows in **remote** mode as the UI. Do not run the Electron installer on a headless Linux VPS.

## Paths and config

| Data | Location |
| --- | --- |
| OpenClaw state | `%USERPROFILE%\.openclaw\` (`openclaw.json`, `skills\`, `workspace\`, logs) |
| Desktop shell config | `%APPDATA%\OpenClaw Desktop Plus\config.json` |
| Bundled pin | `openclawBundleVersion` in `package.json` |

Uninstall does **not** delete `.openclaw` by default.

## Documentation

| Doc | Purpose |
| --- | --- |
| **[README](README.md)** (this file) | Product overview and orientation |
| **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** | Operator guide: panels, ClawHub, remote gateway, WhatsApp, models |
| **[CHANGELOG](CHANGELOG.md)** | Release history |
| **[CONTRIBUTING](CONTRIBUTING.md)** | How to contribute |
| **[SECURITY](SECURITY.md)** | Vulnerability reporting |
| **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | Local development |
| **[docs/PACKAGING.md](docs/PACKAGING.md)** | Building the Windows installer |
| **[docs/INSTALLER_TROUBLESHOOTING.md](docs/INSTALLER_TROUBLESHOOTING.md)** | Black screen / mixed-bundle issues |

Upstream OpenClaw docs: [docs.openclaw.ai](https://docs.openclaw.ai)

## FAQ

<details>
<summary><strong>How do I install on Windows?</strong></summary>

Download `OpenClaw-Desktop-Plus-Setup-*.exe` from the [latest release](https://github.com/99apps-id/openclaw-desktop-plus/releases/latest) and run it.
</details>

<details>
<summary><strong>Do I need Node.js installed globally?</strong></summary>

No. The installer ships a portable Node.js runtime used only for the bundled gateway.
</details>

<details>
<summary><strong>Can I run this on a VPS, Mac, or Linux desktop?</strong></summary>

The **Desktop Plus app** is Windows-only. Run the OpenClaw **gateway** on those platforms, then optionally attach from Windows Desktop Plus via **Settings → Gateway → Remote**. Gateway RAM: plan for **≥4 GB** in production; browser automation often needs **≥8 GB**.
</details>

<details>
<summary><strong>Where do I install ClawHub skills?</strong></summary>

- **Local gateway:** Desktop → Skills → ClawHub search/install (writes under `%USERPROFILE%\.openclaw\skills`).
- **Remote gateway:** use Control UI Skills / ClawHub on the remote host (Desktop will not install into the VPS from the Windows box).
</details>

<details>
<summary><strong>WhatsApp QR does not show in Control UI Settings</strong></summary>

Use **Desktop → Channels → Show QR**. That path talks to the same gateway `web.login.*` APIs and renders the image natively. QR codes rotating every ~15–20 seconds is expected.
</details>

<details>
<summary><strong>Chat says Unknown model / models disappear after picking one</strong></summary>

Prefer provider-qualified ids (`nesa/auto`, `genfity/gpt-…`). The shell qualifies bare ids when setting the default. Avoid aliases like bare `nesa-free` (upstream may map them to `openai/nesa-free`).
</details>

<details>
<summary><strong>How do updates work?</strong></summary>

The app checks GitHub Releases and can download/install updates in-app. You can also install a specific older Setup `.exe` for rollback.
</details>

## Development

```bash
git clone https://github.com/99apps-id/openclaw-desktop-plus.git
cd openclaw-desktop-plus
pnpm install
pnpm run package:prepare-deps   # download Node + OpenClaw into build/
pnpm dev
```

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** and **[docs/PACKAGING.md](docs/PACKAGING.md)**.

**Prerequisites:** Node.js `>= 22.22.3` · `pnpm` · Windows 10/11 x64

## License

[GPL-3.0](LICENSE)
