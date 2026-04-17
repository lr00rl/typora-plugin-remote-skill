---
name: typora-remote
description: Use when you need to inspect or control a running Typora instance through the typora-plugin-lite remote-control plugin, including reading or replacing markdown, switching files or folders, toggling source mode, invoking built-in plugin commands, or running shell commands through the local sidecar.
---

# Typora Remote

## Overview

Use the bundled Node client or CLI in this skill to talk to the running `typora-plugin-lite` `remote-control` sidecar over JSON-RPC (`ws://127.0.0.1:5619/rpc`, loopback + token auth).

Prefer:

- the CLI for one-shot inspection or mutations
- the client module for multi-step automation, loops, and custom orchestration

Always verify mutating operations by rereading `context` or `document`. Host-side actions such as `openFolder` are asynchronous from Typora's perspective; use `waitForMountFolder()` (client) or the CLI's built-in re-read.

## Preconditions

- Typora is running
- `typora-plugin-lite` is installed with the `remote-control` plugin enabled
- Node.js 22+ is available (requires native `WebSocket`)

Smoke check:

```bash
node scripts/typora-remote-cli.mjs ping
```

If that fails, inspect in order:

1. `node scripts/typora-remote-cli.mjs info`
2. `~/Library/Application Support/abnerworks.Typora/plugins/data/remote-control/settings.json` (macOS)
3. Whether the Typora-side service is up (run `Remote Control: Start Local Service` inside Typora, or use `--url` + `--token`).

## Fast Path

One-shot operations (if installed via `typora-remote-install`, the bin is `typora-remote-cli`; otherwise run the mjs directly):

```bash
node scripts/typora-remote-cli.mjs ping
node scripts/typora-remote-cli.mjs info
node scripts/typora-remote-cli.mjs context
node scripts/typora-remote-cli.mjs document
node scripts/typora-remote-cli.mjs source on
node scripts/typora-remote-cli.mjs open-file   "/abs/path/to/file.md"
node scripts/typora-remote-cli.mjs open-folder "/abs/path/to/folder"
node scripts/typora-remote-cli.mjs insert-text "hello from the agent"
node scripts/typora-remote-cli.mjs set-document --file /tmp/new.md
echo "# replace" | node scripts/typora-remote-cli.mjs set-document --stdin
node scripts/typora-remote-cli.mjs plugins
node scripts/typora-remote-cli.mjs plugin-commands note-assistant
node scripts/typora-remote-cli.mjs invoke note-assistant note-assistant:open
node scripts/typora-remote-cli.mjs invoke-typora remote-control:show-status
node scripts/typora-remote-cli.mjs run   "pwd"
node scripts/typora-remote-cli.mjs start "pnpm test"    # streams stdout/stderr until exit
node scripts/typora-remote-cli.mjs call typora.setSourceMode '{"enabled":false}'
```

Programmatic use:

```js
import { TyporaRemoteControlClient } from "./scripts/typora-remote-client.mjs";

const client = await TyporaRemoteControlClient.connectFromLocalSettings();
const context = await client.getContext();
const documentState = await client.getDocument();
await client.setSourceMode(true);
await client.openFolder("/abs/path/to/folder");
await client.waitForMountFolder("/abs/path/to/folder");
client.close();
```

Override connection for ad-hoc inspection:

```bash
node scripts/typora-remote-cli.mjs --url ws://127.0.0.1:5619/rpc --token "$TOKEN" context
```

## Verification Rules

- After `openFile`, verify `context.filePath`.
- After `openFolder`, poll `getContext()` until `mountFolder` matches, or use `waitForMountFolder()` / the CLI's built-in re-read.
- After `setSourceMode`, verify `context.sourceMode`.
- After `setDocument`, verify `document.markdown`.
- After invoking plugin commands, verify by rereading `context` / `document` or by calling a read-side command again.
- Lazy plugins may not register commands until loaded. If a plugin command is missing, enable the plugin first.

## Current Surface

Supported now:

- inspect current Typora context and markdown source
- replace the whole document or insert text at the caret
- toggle source mode
- open a file / switch mounted folder
- list plugins and plugin-owned commands
- enable or disable a plugin
- invoke built-in plugin commands and arbitrary Typora app commands
- execute shell commands through the sidecar (buffered `run` or streaming `start`)
- raw JSON-RPC via `call <method> [jsonParams]`

Not exposed yet:

- inspect rendered DOM/HTML
- read or set selection/range
- arbitrary filesystem API (use `run` instead)
- raw `eval`
- full desktop automation

## References

- Read [references/remote-control-api.md](references/remote-control-api.md) for method schemas, payload shapes, and error semantics.
- Read [references/plugin-commands.md](references/plugin-commands.md) when you want to drive currently shipped plugin abilities.
- Read [references/typora-capability-inventory.md](references/typora-capability-inventory.md) when deciding whether a Typora host ability already exists but just is not exposed yet.

## Common Mistakes

- Treating `getDocument()` as rendered HTML. It returns markdown source.
- Treating `openFolder()` as synchronous. Verify `mountFolder` or call `waitForMountFolder()`.
- Assuming unloaded lazy plugins will already have registered commands. If a plugin is unloaded, enable it first.
- Reimplementing a WebSocket client from scratch inside every task instead of using the bundled client/CLI.
- Forgetting that shell `run` output is buffered and truncated at `maxBytes` (default 256KB); use `start` for long output.
