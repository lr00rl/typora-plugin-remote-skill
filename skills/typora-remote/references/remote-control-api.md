# Remote Control API Reference

This skill assumes Typora is running with the `typora-plugin-lite` `remote-control` plugin enabled.

## Overview

- Transport: `JSON-RPC 2.0 over WebSocket`
- Endpoint: `ws://127.0.0.1:5619/rpc`
- Scope: loopback only
- Auth: `session.authenticate`

## Core Methods

### Session

- `session.authenticate`

Params:

```json
{
  "token": "<token>",
  "role": "client"
}
```

### System

- `system.ping`
- `system.getInfo`
- `system.shutdown`

### Exec

- `exec.run`
- `exec.start`
- `exec.kill`
- `exec.list`

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

- `typora.getContext`
- `typora.getDocument`
- `typora.setDocument`
- `typora.setSourceMode`
- `typora.insertText`
- `typora.openFile`
- `typora.openFolder`
- `typora.commands.list`
- `typora.commands.invoke`
- `typora.plugins.list`
- `typora.plugins.setEnabled`
- `typora.plugins.commands.list`
- `typora.plugins.commands.invoke`

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
