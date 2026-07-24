# Development

Local development for **OpenClaw Desktop Plus** (Electron + React).

## Prerequisites

- Node.js **>= 22.22.3**
- **pnpm**
- Windows 10/11 (required for full desktop testing and packaging)

## Setup

```bash
git clone https://github.com/99apps-id/openclaw-desktop-plus.git
cd openclaw-desktop-plus
pnpm install
pnpm dev
```

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Run Electron + Vite in development |
| `pnpm lint` | ESLint |
| `pnpm type-check` | TypeScript (`tsc --noEmit`) |
| `pnpm build` | Production Electron build (`electron-vite`) |
| `pnpm smoke` | CSP + gateway smoke checks |

## Layout

```
src/main/       Electron main process
src/renderer/   React shell UI + i18n (en, fr, ja, ko, es)
src/preload/    IPC bridge
src/shared/     Shared types and constants
scripts/        Bundle download, patches, packaging helpers
resources/      Icons, installer assets, generated bundle pieces
```

## UI languages

Shell UI locales: **English**, French, Japanese, Korean, Spanish.  
Chinese (`zh-CN` / `zh-TW`) locales were removed; OS Chinese locales fall back to English.

## Configuration paths (runtime)

| Data | Path |
| --- | --- |
| OpenClaw state | `%USERPROFILE%\.openclaw\` |
| Shell config | `%APPDATA%\OpenClaw Desktop Plus\config.json` |

## Related docs

- [USER_GUIDE.md](USER_GUIDE.md) — operator guide (panels, ClawHub, remote gateway, WhatsApp)
- [PACKAGING.md](PACKAGING.md) — Windows installer
- [INSTALLER_TROUBLESHOOTING.md](INSTALLER_TROUBLESHOOTING.md) — black screen / mixed bundles
- [../README.md](../README.md) — product overview
- [../CONTRIBUTING.md](../CONTRIBUTING.md)
