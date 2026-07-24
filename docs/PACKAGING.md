# Packaging (Windows installer)

How to build `OpenClaw-Desktop-Plus-Setup-<version>.exe`.

## One-shot (local)

```bash
pnpm run package:prepare-deps   # download-node + download-openclaw
pnpm lint && pnpm type-check
pnpm run package:win
```

Output lands under `dist/`.

`package:win` expects **`build/node/`** and **`build/openclaw/`** to exist (created by `package:prepare-deps`).

## Version pins

| Field | Location | Meaning |
| --- | --- | --- |
| `version` | `package.json` | Shell semver (+ OpenClaw pin suffix) |
| `openclawBundleVersion` | `package.json` | Exact npm OpenClaw version to download |
| `bundledOpenClawVersion` | `resources/bundle-manifest.json` | Written by `prepare-bundle` |

Release Git tags must be `v` + `package.json` `version`, e.g. `v0.8.0+openclaw.2026.7.1-2`.

## Control UI

The npm OpenClaw package may omit `dist/control-ui/`. Desktop builds it from the matching GitHub tag (`ensure-openclaw-control-ui`).

If Vite fails on Windows:

1. Build Control UI on Linux/WSL (`scripts/ci-build-openclaw-control-ui.ts` or CI artifact), or
2. Populate `build/openclaw/dist/control-ui/`, then run `download-openclaw` with `OPENCLAW_SKIP_CONTROL_UI_BUILD=1`.

## Signing

- Unsigned local builds: default (`CSC_IDENTITY_AUTO_DISCOVERY=false` when no cert).
- Signed: set `CSC_LINK` + `CSC_KEY_PASSWORD` (see `pnpm run package:win:signed`).
- CI may use SignPath when `USE_SIGNPATH=true`.

## Publish target

`electron-builder` publish config points at:

`https://github.com/99apps-id/openclaw-desktop-plus`

## CI release

Manual or tag-driven workflow: `.github/workflows/release.yml`.

For `workflow_dispatch`, always pass the **full existing tag** (including `+`). Empty tag checks out the wrong ref and can produce mixed OpenClaw / Control UI bundles (black screen).

## Verification

```bash
pnpm run check-openclaw-versions
pnpm run verify-bundle
pnpm run verify-packaged-win   # after package:win
```

See also [INSTALLER_TROUBLESHOOTING.md](INSTALLER_TROUBLESHOOTING.md).
