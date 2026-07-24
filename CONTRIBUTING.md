# Contributing to OpenClaw Desktop Plus

Thanks for contributing. This repository is a community Windows desktop distribution for [OpenClaw](https://github.com/openclaw/openclaw).

**Repo:** [github.com/99apps-id/openclaw-desktop-plus](https://github.com/99apps-id/openclaw-desktop-plus)

## Quick start

```bash
git clone https://github.com/99apps-id/openclaw-desktop-plus.git
cd openclaw-desktop-plus
pnpm install
pnpm dev
```

**Prerequisites:** Node.js >= 22.22.3 · pnpm · Windows 10/11 for packaging/tests

More detail: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) · [docs/PACKAGING.md](docs/PACKAGING.md) · [docs/USER_GUIDE.md](docs/USER_GUIDE.md) (operator-facing)

## Project layout

```
src/
├── main/        # Electron main (gateway, IPC, config, updates)
├── renderer/    # React UI (wizard, shell, i18n)
├── preload/     # Context bridge
└── shared/      # Types, constants, IPC channels
docs/            # Development and packaging guides
```

## Code style

- TypeScript strict mode
- React function components
- Tailwind CSS utilities
- Prefer clear code over redundant comments
- **English only** in source comments, UI strings committed in this repo’s docs, and changelog entries

## Checks before a PR

```bash
pnpm lint
pnpm type-check
pnpm build
```

## Pull requests

1. Fork and create a feature branch
2. Keep changes focused
3. Ensure lint and type-check pass
4. Describe the change and link related issues

## Releases

- Assets are published via GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)).
- Installer name: `OpenClaw-Desktop-Plus-Setup-<version>.exe`
- Bundled OpenClaw pin: `package.json` → `openclawBundleVersion`; manifest refreshed by `prepare-bundle`
- Release tags: `v` + `package.json` `version` (e.g. `v0.8.1+openclaw.2026.7.1-2`)

## License

By contributing, you agree your contributions are licensed under GPL-3.0.
