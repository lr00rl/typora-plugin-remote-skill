# Typora Capability Inventory

This inventory distinguishes:

- **Exposed now**: already reachable through the remote-control plugin
- **Known host capability**: present in current local type analysis or observed host code
- **Reference-backed capability**: present in `typora-copilot` / `typora-community-plugin` references, not necessarily exposed yet

## Exposed Now

- current file path / file name
- current `mountFolder`
- markdown source
- source mode read/write
- open file
- open folder
- list commands / invoke commands
- list plugins / enable-disable plugin / list plugin commands / invoke plugin commands
- shell command execution

## Known Host Capability

### File / Global

- `File.bundle.filePath`
- `File.bundle.fileName`
- `File.bundle.hasModified`
- `File.reloadContent(...)`
- `File.getMountFolder()`
- platform flags such as `isMac`, `isWin`, `isNode`, `isWK`

### Editor

- `editor.getMarkdown()`
- `editor.nodeMap.toMark()`
- `editor.getNode(cid)`
- `editor.findElemById(cid)`
- `editor.insertText(text)`
- `editor.refocus()`
- `editor.restoreLastCursor()`
- `editor.undo.undo()`
- `editor.undo.redo()`

### Library / File Tree

- `editor.library.openFile(path, cb)`
- `editor.library.watchedFolder`
- `editor.library.root`
- `editor.library.fileTree.expandNode(...)`

### SourceView

- `editor.sourceView.inSourceMode`
- `editor.sourceView.cm`
- `editor.sourceView.prep()`
- `editor.sourceView.show()`
- `editor.sourceView.hide()`

### Selection

- `editor.selection.getRangy()`
- `editor.selection.jumpIntoElemBegin(...)`
- `editor.selection.jumpIntoElemEnd(...)`

### Native Bridge

- macOS `bridge.callHandler("controller.runCommand", ...)`
- macOS `bridge.callSync("path.readText", path)`
- `JSBridge.invoke("controller.switchFolder", path)`

## Reference-Backed Capability

These are strong candidates for future exposure:

- rendered/source lifecycle events
- `sourceView.gotoLine(...)`
- `editor.tryOpenUrl(...)`
- `editor.reset(markdown)`
- autocomplete surface
- doc menu / frontmatter helpers
- table editing helpers
- more CodeMirror state for source mode

## Recommended Next Exposures

- selection read/write
- rendered HTML snapshot
- focused block / active `cid`
- frontmatter/meta read/write
- CodeMirror cursor APIs in source mode
