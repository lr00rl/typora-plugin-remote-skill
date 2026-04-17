# Changelog

All notable changes to this skill are documented in this file. The format is
loosely based on [Keep a Changelog](https://keepachangelog.com/) and the version
is pinned by the top-level `VERSION` file (repo source of truth; mirrored in
`skills/typora-remote/VERSION` for installed skill copies and in
`.claude-plugin/marketplace.json` for marketplace metadata).

## [Unreleased]

### Fixed

- **Installed skill update checks.** `update-check.mjs` now resolves the local
  version from either the repo-root `VERSION` file or the mirrored
  `skills/typora-remote/VERSION`, so standalone installed skill copies no
  longer silently lose update notices.

## [1.2.0] - 2026-04-18

### Security

- **SKILL.md Trust Boundaries section** — explicitly documents the
  `<<<TPL_DOC_START id="..." trust="untrusted">>> ... <<<TPL_DOC_END id="..." >>>`
  markers that typora-plugin-lite v0.2+ wraps around `typora.getDocument` /
  `typora.getContext` responses. LLM agents are instructed to treat enclosed
  content as untrusted data, never as instructions.
- **SKILL.md Security Model section** — documents the threat model: loopback
  transport, OS-user-scoped token file, explicit token-override env vars, and
  the default-deny `allowExec` gate on `exec.run` / `exec.start` / `exec.kill`
  / `exec.list`.
- **Env var override** — `TPL_TYPORA_TOKEN` + `TPL_TYPORA_URL` bypass the
  on-disk `settings.json` entirely. Useful for CI / agent runners and for
  avoiding the "scanning sensitive directories" false positive in some
  static analyzers.
- **Helper rename** — `readLocalSettings` is now `readLocalLoopbackToken`;
  the old name remains as a deprecated alias for back-compat.

### Notes

- This release depends on typora-plugin-lite v0.2+ for the boundary-marker
  and exec-gate guarantees. With older plugin versions the client still
  works but gets no hardening.

## [1.1.0] - 2026-04-18

### Changed

- **BREAKING — Linux settings path.** `getDefaultSettingsPath()` now returns
  `~/.local/Typora/data/remote-control/settings.json` instead of
  `$XDG_CONFIG_HOME/Typora/plugins/data/remote-control/settings.json`. This
  tracks `typora-plugin-lite`'s own Linux-only migration to
  `~/.local/Typora/` as the sole persistent-data root. macOS and Windows paths
  are unchanged.

### Added

- **Self-update notifier.** The CLI now pings
  `raw.githubusercontent.com/lr00rl/typora-plugin-remote-skill/main/VERSION`
  at most once per 24h (cached cross-platform under the OS cache dir) and
  prints a one-line stderr notice when a newer version is available. Fails
  silently on every network / parse / fs error. Opt-out with
  `TPL_SKILL_DISABLE_UPDATE_CHECK=1`.
- **Top-level `VERSION` file** as the single source of truth for the skill
  version. `.claude-plugin/marketplace.json` mirrors the same value.

## [1.0.0] - 2026-04-17

Initial release.
