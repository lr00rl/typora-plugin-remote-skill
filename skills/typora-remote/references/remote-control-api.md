# Remote Control API Reference

This skill assumes Typora is running with the `typora-plugin-lite` `remote-control` plugin enabled.

## Overview

- Transport: `JSON-RPC 2.0 over WebSocket`
- Endpoint: `ws://127.0.0.1:5619/rpc`
- Scope: loopback only
- Auth: `session.authenticate`

## Authorization layers

Every method below carries a layer tag (**[L0]**, **[L1]**, **[L2]**,
**[L3]**). See the Authorization Matrix in `SKILL.md` for the full meaning
and failure-code mapping. Short version:

- **L0** — callable without authenticating (entry point only).
- **L1** — requires a successful `session.authenticate` first.
- **L2** — L1 **and** a Typora (`role=typora`) session must be connected;
  otherwise 503 `Typora session is unavailable`.
- **L3** — L1 **and** the plugin setting `allowExec=true`; otherwise 403
  `exec disabled by server policy`. Default-deny.

## Core Methods

### Session

- `session.authenticate` **[L0]**

Params:

```json
{
  "token": "<token>",
  "role": "client"
}
```

`role` must be one of `client` (default, external consumers) or `typora`
(the host-app session; singleton — latest authenticated `role=typora`
connection becomes the routing target).

### System

- `system.ping` **[L1]**
- `system.getInfo` **[L1]** — returns `sessionCount` counting every live
  WebSocket, **including the caller's own session**.
- `system.shutdown` **[L1]** — stops the sidecar. Any authenticated
  session can invoke this; there is no extra guard. Use only for
  intentional lifecycle management.

### Exec

All four require `allowExec=true` in the plugin settings (default-deny
since typora-plugin-lite v0.2+):

- `exec.run` **[L3]**
- `exec.start` **[L3]**
- `exec.kill` **[L3]**
- `exec.list` **[L3]**

When `allowExec=false` these methods still pass L1 (401 protection first)
and then reject with 403 `exec disabled by server policy (allowExec=false)`.
This ordering guarantees unauthenticated peers cannot probe whether exec
is enabled.

`exec.run` payload:

```json
{
  "command": "pwd",
  "cwd": "/optional/cwd",
  "timeoutMs": 5000,
  "maxBytes": 262144
}
```

### Typora

All require both L1 (authenticated) **and** an active `role=typora`
session registered on the sidecar. If Typora has crashed or its plugin
is disabled, these return 503 `Typora session is unavailable`.

- `typora.getContext` **[L2]** — response wraps any `markdown` field with
  trust-boundary markers (see SKILL.md Trust Boundaries).
- `typora.getDocument` **[L2]** — same wrapping.
- `typora.setDocument` **[L2]**
- `typora.setSourceMode` **[L2]**
- `typora.insertText` **[L2]**
- `typora.openFile` **[L2]**
- `typora.openFolder` **[L2]**
- `typora.commands.list` **[L2]**
- `typora.commands.invoke` **[L2]**
- `typora.plugins.list` **[L2]**
- `typora.plugins.setEnabled` **[L2]**
- `typora.plugins.commands.list` **[L2]**
- `typora.plugins.commands.invoke` **[L2]**

## Notifications

- `exec.stdout`
- `exec.stderr`
- `exec.exit`

## Key Result Shapes

### `typora.getContext`

```json
{
  "filePath": "/path/to/file.md",
  "fileName": "file.md",
  "mountFolder": "/path/to/folder",
  "watchedFolder": null,
  "sourceMode": false,
  "hasUnsavedChanges": false,
  "commands": [
    { "id": "remote-control:show-status", "name": "Remote Control: Show Status", "pluginId": "remote-control" }
  ]
}
```

### `typora.getDocument`

Returns markdown source, not rendered DOM.

```json
{
  "filePath": "/path/to/file.md",
  "fileName": "file.md",
  "markdown": "# Title\n..."
}
```

### `typora.setSourceMode`

```json
{
  "sourceMode": true
}
```

### `typora.plugins.list`

```json
[
  {
    "id": "note-assistant",
    "name": "Note Assistant",
    "version": "0.1.0",
    "description": "...",
    "loading": { "startup": true },
    "loaded": true
  }
]
```

### `typora.plugins.commands.list`

```json
[
  {
    "id": "note-assistant:open",
    "name": "Note Assistant: Open",
    "pluginId": "note-assistant"
  }
]
```

## Error Semantics

- `401`: unauthenticated session
- `403`: invalid token
- `404`: unknown `execId` or unknown command
- `409`: plugin/command mismatch
- `503`: typora session unavailable
- `-32601`: method not found
- `-32602`: invalid params
- `-32000`: generic runtime error

## Important Semantics

- `getDocument()` returns markdown source, not rendered HTML.
- `openFolder()` is asynchronous from the host's perspective. Always re-read `getContext()` and confirm `mountFolder`.
- Lazy plugins may not register commands until loaded. Enable them first if needed.
