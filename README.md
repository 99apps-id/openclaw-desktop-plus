<p align="center">
  <img src="resources/apple-touch-icon.png" alt="OpenClaw Desktop Plus" width="128" height="128" />
</p>

<h1 align="center">OpenClaw Desktop Plus</h1>

<p align="center">
  <strong>Windows installer and desktop shell for <a href="https://github.com/openclaw/openclaw">OpenClaw</a>.</strong><br />
  One-click setup, bundled runtime, guided wizard — run OpenClaw agents on Windows without a terminal.
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
  <img src="resources/demo.gif" alt="OpenClaw Desktop Plus demo on Windows" width="720" />
</p>

---

## Documentation

| Doc | Purpose |
| --- | --- |
| **[README](README.md)** (this file) | Product overview, install, FAQ |
| **[CHANGELOG](CHANGELOG.md)** | Release history |
| **[CONTRIBUTING](CONTRIBUTING.md)** | How to contribute |
| **[SECURITY](SECURITY.md)** | Vulnerability reporting |
| **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** | Local dev setup and project layout |
| **[docs/PACKAGING.md](docs/PACKAGING.md)** | Building the Windows installer |
| **[docs/INSTALLER_TROUBLESHOOTING.md](docs/INSTALLER_TROUBLESHOOTING.md)** | Black screen / mixed-bundle hardening |

Repository: [github.com/99apps-id/openclaw-desktop-plus](https://github.com/99apps-id/openclaw-desktop-plus)

---

## What is this?

**OpenClaw Desktop Plus** packages the OpenClaw runtime into a standard Windows install experience. Download one `.exe`, finish the setup wizard, and run OpenClaw from a native desktop shell — no manual wiring required.

Community-maintained distribution for the OpenClaw ecosystem (not affiliated with the core OpenClaw project).

## Quick start

1. Download the latest installer from [Releases](https://github.com/99apps-id/openclaw-desktop-plus/releases/latest)
2. Run setup (asset name follows `package.json`, e.g. `OpenClaw-Desktop-Plus-Setup-0.8.0+openclaw.2026.7.1-2.exe`)
3. Complete the wizard (provider → channel → gateway)
4. Launch from Start Menu or the desktop shortcut

**Requirements:** Windows 10/11 x64 · ~350 MB free space · Internet for API calls

## Current release (v0.8.0)

| | |
| --- | --- |
| **Shell** | `0.8.0+openclaw.2026.7.1-2` |
| **Git tag** | `v0.8.0+openclaw.2026.7.1-2` |
| **Bundled OpenClaw** | **2026.7.1-2** (`openclawBundleVersion` in `package.json`) |
| **Bundled Node.js** | **22.23.1** (upstream `engines`: Node ≥ 22.22.3 on 22.x) |

Highlights: Models / Channels panels, WhatsApp multi-account, Control UI reload, doctor / skills tooling. Full notes: [CHANGELOG 0.8.0](CHANGELOG.md) · upstream [v2026.7.1](https://github.com/openclaw/openclaw/releases/tag/v2026.7.1).

## Features

| | |
| --- | --- |
| One-click installer | Native Windows `.exe` — no system-wide Node.js |
| Bundled runtime | Portable Node.js + OpenClaw |
| Setup wizard | Provider, channel, and gateway configuration |
| In-app updates | GitHub Releases via electron-updater |
| Native shell | Tray, shortcuts, auto-start |
| Remote gateway | Attach to VPS / Tailscale / SSH-tunneled gateway (Settings) |
| Providers & channels | 50+ providers (OpenRouter API key or OAuth, …); Telegram, Discord, WhatsApp, Feishu, and more |
| UI languages | English, Français, 日本語, 한국어, Español |

## Compatibility notes

- **Pin:** Bundled OpenClaw version is `openclawBundleVersion` in root `package.json`. Run `pnpm run download-openclaw` before packaging.
- **State:** `%USERPROFILE%\.openclaw` / `openclaw.json` (same as upstream).
- **Desktop shell config:** `%APPDATA%\OpenClaw Desktop Plus\config.json`
- **Control UI:** Built from GitHub tag sources when npm packages omit `dist/control-ui/` (republish tags like `2026.7.1-2` fall back to `v2026.7.1`).
- **Embedded auth:** For local gateways the shell maintains `gateway.controlUi.allowInsecureAuth` and `dangerouslyDisableDeviceAuth` so Control UI works in the Electron iframe.

## Screenshots

| Installer | Setup wizard | Dashboard |
| --- | --- | --- |
| <img src="resources/screenshot-installer-user-scope.png" alt="Installer" width="260" /> | <img src="resources/screenshot-setup-wizard.png" alt="Setup wizard" width="260" /> | <img src="resources/screenshot-gateway-dashboard.png" alt="Dashboard" width="260" /> |

## FAQ

<details>
<summary><strong>How do I install on Windows?</strong></summary>

Download `OpenClaw-Desktop-Plus-Setup-*.exe` from the [latest release](https://github.com/99apps-id/openclaw-desktop-plus/releases/latest) and run it.
</details>

<details>
<summary><strong>Do I need Node.js installed globally?</strong></summary>

No. The installer ships a portable Node.js runtime.
</details>

<details>
<summary><strong>Where is user data stored?</strong></summary>

- OpenClaw: `%USERPROFILE%\.openclaw\`
- Desktop shell: `%APPDATA%\OpenClaw Desktop Plus\config.json`

Uninstall does not remove these by default.
</details>

<details>
<summary><strong>How do updates work?</strong></summary>

The app checks GitHub Releases and can install updates in-app. You can also download older assets for rollback.
</details>

## Development

```bash
git clone https://github.com/99apps-id/openclaw-desktop-plus.git
cd openclaw-desktop-plus
pnpm install
pnpm dev
```

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** and **[docs/PACKAGING.md](docs/PACKAGING.md)**.

**Prerequisites:** Node.js `>= 22.22.3` · `pnpm` · Windows 10/11

## License

[GPL-3.0](LICENSE)
