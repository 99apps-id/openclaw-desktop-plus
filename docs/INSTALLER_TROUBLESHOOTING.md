# Installer troubleshooting (Control UI black screen)

Short English summary of release hardening for **OpenClaw Desktop Plus**.

## Symptom

After install, the embedded Control UI shows a blank/dark page, or the gateway returns HTTP 500 in the iframe.

## Common causes

1. **Mixed bundle** — Shell version / OpenClaw pin / Control UI assets from different tags or branches.
2. **Incomplete Control UI** — Missing or broken `dist/control-ui` (HTML loads, JS 404).
3. **Wrong `cwd` for gateway** — Upstream resolves Control UI relative to `process.cwd()`; must be the bundled `resources/openclaw` directory.
4. **Auth / Origin** — Local iframe needs `allowInsecureAuth` / `dangerouslyDisableDeviceAuth`, and sometimes a synthetic `Origin` on loopback requests.
5. **Stale `gateway.controlUi.root`** — Points outside the bundled UI.

## Hardening already in this repo

| Check | Where |
| --- | --- |
| Pin vs manifest vs on-disk OpenClaw | `check-openclaw-versions` |
| Control UI `index.html` + module assets | `verify-bundle` / `validateOpenclawResources` |
| Packaged `win-unpacked` layout | `verify-packaged-win` |
| Release workflow checks out the tag (not a random branch) | `release.yml` `CHECKOUT_REF` |
| Gateway `cwd` = bundled OpenClaw | process manager |
| Strip bad `controlUi.root` | config migration |
| Electron Lit / decorator compat | `ensure-openclaw-control-ui` patches |

## What to do when releasing

1. Tag equals `v` + `package.json` `version`.
2. On manual dispatch, fill the **exact** tag input.
3. Do not skip version / packaged verification steps in CI.
4. Prefer `OPENCLAW_SKIP_NPM_LATEST_CHECK=1` in release so CI validates the pin, not npm drift.

## Related

- [PACKAGING.md](PACKAGING.md)
- [CHANGELOG.md](../CHANGELOG.md) (0.2.x Control UI / black-screen fixes)
