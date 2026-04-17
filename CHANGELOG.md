# Changelog

All notable changes to this skill are documented in this file. The format is
loosely based on [Keep a Changelog](https://keepachangelog.com/) and the version
is pinned by the top-level `VERSION` file (repo source of truth; mirrored in
`skills/typora-remote/VERSION` for installed skill copies and in
`.claude-plugin/marketplace.json` for marketplace metadata).

## [2.0.0] - 2026-04-18

### ⚠ BREAKING SECURITY CONTRACT

1.x guaranteed that `allowExec=false` was an upper bound on what the
agent could do through the skill. **2.0 introduces a new L4 capability
(`typora.eval`) that exceeds that bound when enabled.** Users who have
granted `allowEval=true` are effectively ignoring the `allowExec` gate
below it, because evaluated JS can import Node builtins and spawn shell
commands regardless.

Security reviewers re-auditing the skill after this release should treat
`allowEval=true` hosts as equivalent to unrestricted local RCE. The
default remains `allowEval=false`, so installs that haven't flipped the
toggle retain 1.x semantics.

### Added

- **`typora.eval` RPC method (L4)**. Evaluates JavaScript inside the
  Typora renderer via `vm.runInThisContext` with a configurable timeout
  (default 10s). Wrapped in a sync or async IIFE so the body can declare
  locals, `return` a value, or `await`.
- **`TyporaRemoteControlClient.evalJs(code, { async, timeoutMs })`**
  programmatic helper on the bundled client.
- **`typora-remote-cli eval CODE...`** and **`typora-remote-cli eval-async CODE...`**
  CLI subcommands. Examples:
  ```bash
  typora-remote-cli eval 'window.alert("test"); return "shown"'
  typora-remote-cli eval 'return editor.getFilePath()'
  typora-remote-cli eval-async 'const r = await fetch("https://example.com"); return r.status'
  ```
- **SKILL.md L4 row in the Authorization Matrix** and a dedicated red
  warning explaining that `allowEval` subsumes every weaker gate.
- **`references/remote-control-api.md`** `typora.eval` entry with payload
  shape, timeout semantics, and serialisation rules.
- **One Common Mistakes entry**: "Using `typora.eval` as a powerful
  version of `run` when `exec.run` returns 403" — agents must not route
  around a user's default-deny decision on `allowExec`.

### Requires

- typora-plugin-lite with `allowEval` support (the plugin side adds
  the `--allow-eval` CLI flag, an `allowEval` schema toggle in the
  Plugin Center, and conditional registration of `typora.eval` in the
  sidecar). Older plugin releases pre-dating this feature will report
  method-not-found for `typora.eval` even with `allowEval=true`.

### Notes

- 1.x callers that never touched `typora.eval` see no behaviour change.
  The existing `TyporaRemoteControlClient` surface is unchanged except
  for the additive `evalJs()` method.

## [1.3.0] - 2026-04-18

### Documentation

- **Session Model section in SKILL.md.** Explains the hub/broker topology
  (`role=typora` singleton + N × `role=client`) and why
  `system.getInfo.sessionCount` is typically ≥ 2 — it counts the caller's
  own WebSocket. Resolves a common first-time agent misreading of "another
  agent is already connected".
- **Authorization Matrix in SKILL.md.** Four-layer table (L0 open / L1
  authed / L2 Typora-connected / L3 `allowExec=true`) with exact rejection
  codes and correct remediation per layer. Flags `system.shutdown` as a
  plain L1 method so agents don't trust "auth" with sidecar lifecycle.
- **`references/remote-control-api.md` auth tags.** Every RPC method
  carries an L0/L1/L2/L3 tag so the API reference stays the single
  source of truth for method-level permissions.
- **Four new Common Mistakes entries.** Covering: mistaking "Failed to
  connect" for sidecar-down (plugin-disabled is more common), reading
  `sessionCount > 1` as adversary, calling `system.shutdown` as "reset",
  and working around `403 exec disabled` instead of asking the user.

### Fixed

- **Installed skill update checks.** `update-check.mjs` now resolves the local
  version from either the repo-root `VERSION` file or the mirrored
  `skills/typora-remote/VERSION`, so standalone installed skill copies no
  longer silently lose update notices.

### Notes

- No runtime behavior changes. Existing callers of `TyporaRemoteControlClient`
  / `readLocalLoopbackToken` / `readLocalSettings` (the deprecated alias)
  see identical semantics.

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
