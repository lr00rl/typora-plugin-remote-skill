---
name: typora-remote
description: Use when you need to inspect or control a running Typora instance through the typora-plugin-lite remote-control plugin, including reading markdown, switching files or folders, toggling source mode, invoking built-in plugin commands, or running shell commands through the local sidecar.
---

# Typora Remote

## Overview

Use the bundled Node client or CLI in this skill to talk to the running `typora-plugin-lite` `remote-control` sidecar.

Prefer:

- the CLI for one-shot inspection or mutations
- the client module for multi-step automation, loops, and custom orchestration

Always verify mutating operations by rereading `context` or `document`. Some host actions, especially `openFolder`, are asynchronous from Typora's point of view.

## Preconditions

- Typora is running
- `typora-plugin-lite` is installed with the `remote-control` plugin enabled
- Node.js 22+ is available

Quick smoke check:

```bash
node scripts/typora-remote-cli.mjs ping
```

If that fails, stop and inspect:

- `node scripts/typora-remote-cli.mjs info`
- local settings path auto-detection in `scripts/typora-remote-client.mjs`
- whether Typora has actually started the sidecar

## Fast Path

One-shot operations:

```bash
node scripts/typora-remote-cli.mjs context
node scripts/typora-remote-cli.mjs document
node scripts/typora-remote-cli.mjs source on
node scripts/typora-remote-cli.mjs open-file "/abs/path/to/file.md"
node scripts/typora-remote-cli.mjs open-folder "/abs/path/to/folder"
node scripts/typora-remote-cli.mjs plugins
node scripts/typora-remote-cli.mjs plugin-commands note-assistant
node scripts/typora-remote-cli.mjs invoke note-assistant note-assistant:open
node scripts/typora-remote-cli.mjs run "pwd"
```

Programmable use:

```js
import { TyporaRemoteControlClient } from "./scripts/typora-remote-client.mjs"

const client = await TyporaRemoteControlClient.connectFromLocalSettings()
const context = await client.getContext()
const documentState = await client.getDocument()
await client.setSourceMode(true)
await client.openFolder("/abs/path/to/folder")
client.close()
```

## Verification Rules

- After `openFile`, verify `context.filePath`.
- After `openFolder`, verify `context.mountFolder`.
- After `setSourceMode`, verify `context.sourceMode`.
- After `setDocument`, verify `document.markdown`.
- After invoking plugin commands, verify by rereading context or document, or by calling the relevant plugin/open command again.

`openFolder` is asynchronous. The CLI already waits briefly and rereads context. If you script it yourself, poll `getContext()` until `mountFolder` changes.

## Current Surface

What you can do now:

- inspect current Typora context and markdown source
- switch source mode
- open a file
- switch the mounted folder
- list plugins and plugin-owned commands
- enable or disable a plugin
- invoke built-in plugin commands
- execute shell commands through the sidecar

What you cannot do yet:

- inspect rendered DOM/HTML
- read or set selection/range
- arbitrary filesystem API
- raw `eval`
- full desktop automation

## References

- Read [references/remote-control-api.md](references/remote-control-api.md) for method schemas, payload shapes, and error semantics.
- Read [references/plugin-commands.md](references/plugin-commands.md) when you want to drive currently shipped plugin abilities.
- Read [references/typora-capability-inventory.md](references/typora-capability-inventory.md) when deciding whether a Typora host ability already exists but just is not exposed yet.

## Common Mistakes

- Treating `getDocument()` as rendered HTML. It returns markdown source.
- Treating `openFolder()` as synchronous. Verify `mountFolder` after the call.
- Assuming unloaded lazy plugins will already have registered commands. If a plugin is unloaded, enable it first.
- Reimplementing a WebSocket client from scratch inside every task instead of using the bundled client/CLI.
