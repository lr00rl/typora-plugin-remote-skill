# Current Built-In Plugin Command Surface

These are the current built-in plugin commands that the remote client already wraps or can invoke directly.

## Note Assistant

- `note-assistant:open`
- `note-assistant:rebuild-graph`
- `note-assistant:reparse-document`

Client helpers:

- `noteAssistantOpen()`
- `noteAssistantRebuildGraph()`
- `noteAssistantReparseDocument()`

## Wider

- `wider:cycle`
- `wider:set-default`
- `wider:set-wide`
- `wider:set-full`
- `wider:narrower`
- `wider:wider`

Client helpers:

- `widerCycle()`
- `widerSetDefault()`
- `widerSetWide()`
- `widerSetFull()`
- `widerNarrower()`
- `widerWider()`

## Markdown Padding

- `md-padding:format`

Client helper:

- `mdPaddingFormat()`

## Title Shift

- `title-shift:increase`
- `title-shift:decrease`

Client helpers:

- `titleShiftIncrease()`
- `titleShiftDecrease()`

## Quick Open / Fuzzy Search

- `quick-open:install-fzf`

Client helper:

- `quickOpenInstallFzf()`

## Generic Fallback

When a helper method does not exist, use:

```js
await client.invokePluginCommand(pluginId, commandId)
```

Or via CLI:

```bash
node scripts/typora-remote-cli.mjs invoke <pluginId> <commandId>
```

## Important Note About Lazy Plugins

Some plugins are lazy-loaded. If a plugin command is missing:

1. list plugins
2. check whether the plugin is currently `loaded: false`
3. enable it first

Example:

```js
await client.setPluginEnabled("fuzzy-search", true)
const commands = await client.listPluginCommands("fuzzy-search")
```
