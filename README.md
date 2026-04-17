# typora-plugin-remote-skill

一个独立的 Typora Remote Skill 项目，用来配合 [`typora-plugin-lite`](https://github.com/lr00rl/typora-plugin-lite) 里的 `remote-control` 插件，通过 AI / Node client / CLI 直接控制正在运行的 Typora。

这个仓库**不包含 Typora 插件本体**，而是包含：

- 可安装的 Skill：`SKILL.md`
- 面向 Codex/OpenAI skills 的元数据：`agents/openai.yaml`
- 独立 Node client：`scripts/typora-remote-client.mjs`
- 独立 CLI：`scripts/typora-remote-cli.mjs`
- 接口与能力文档：`references/*.md`

## 前置条件

你需要先满足这些条件：

1. Typora 正在运行
2. `typora-plugin-lite` 已安装
3. `remote-control` 插件已启用
4. 本机可访问 sidecar，默认地址：

```text
ws://127.0.0.1:5619/rpc
```

5. Node.js 22+

## 目录结构

```text
typora-plugin-remote-skill/
├── SKILL.md
├── README.md
├── agents/
│   └── openai.yaml
├── package.json
├── scripts/
│   ├── typora-remote-client.mjs
│   └── typora-remote-cli.mjs
└── references/
    ├── remote-control-api.md
    ├── plugin-commands.md
    └── typora-capability-inventory.md
```

## 快速开始

### 1. 先验证 Typora remote 是否在线

```bash
node scripts/typora-remote-cli.mjs ping
```

预期返回：

```json
"pong"
```

### 2. 查看当前 Typora 上下文

```bash
node scripts/typora-remote-cli.mjs context
```

### 3. 查看当前文档源码

```bash
node scripts/typora-remote-cli.mjs document
```

### 4. 切换 source mode

```bash
node scripts/typora-remote-cli.mjs source on
node scripts/typora-remote-cli.mjs source off
```

### 5. 打开文件

```bash
node scripts/typora-remote-cli.mjs open-file "/abs/path/to/file.md"
```

### 6. 切换挂载目录

```bash
node scripts/typora-remote-cli.mjs open-folder "/abs/path/to/folder"
```

### 7. 执行 console 命令

```bash
node scripts/typora-remote-cli.mjs run "pwd"
```

### 8. 查看当前插件与插件命令

```bash
node scripts/typora-remote-cli.mjs plugins
node scripts/typora-remote-cli.mjs plugin-commands note-assistant
```

### 9. 调用内置插件命令

```bash
node scripts/typora-remote-cli.mjs invoke note-assistant note-assistant:open
node scripts/typora-remote-cli.mjs invoke wider wider:set-wide
```

## Node Client 用法

```js
import { TyporaRemoteControlClient } from "./scripts/typora-remote-client.mjs"

const client = await TyporaRemoteControlClient.connectFromLocalSettings()

console.log(await client.ping())
console.log(await client.getInfo())
console.log(await client.getContext())
console.log(await client.getDocument())

await client.setSourceMode(true)
await client.openFile("/abs/path/to/file.md")
await client.openFolder("/abs/path/to/folder")

console.log(await client.listPlugins())
console.log(await client.listPluginCommands("note-assistant"))

await client.noteAssistantOpen()
await client.widerSetWide()

client.close()
```

## 当前支持的能力

### 系统

- `ping()`
- `getInfo()`
- `shutdown()`

### 执行命令

- `run()`
- `start()`
- `kill()`
- `listExecs()`
- `onNotification()`

### Typora 控制

- `getContext()`
- `getDocument()`
- `setDocument()`
- `setSourceMode()`
- `insertText()`
- `openFile()`
- `openFolder()`
- `listTyporaCommands()`
- `invokeTyporaCommand()`

### 插件控制

- `listPlugins()`
- `setPluginEnabled()`
- `listPluginCommands()`
- `invokePluginCommand()`

### 当前已封装的插件快捷方法

- `noteAssistantOpen()`
- `noteAssistantRebuildGraph()`
- `noteAssistantReparseDocument()`
- `widerCycle()`
- `widerSetDefault()`
- `widerSetWide()`
- `widerSetFull()`
- `widerNarrower()`
- `widerWider()`
- `mdPaddingFormat()`
- `titleShiftIncrease()`
- `titleShiftDecrease()`
- `quickOpenInstallFzf()`

## 配置来源

client 默认会自动读取本机的 `remote-control` 设置文件。

macOS 默认路径：

```text
~/Library/Application Support/abnerworks.Typora/plugins/data/remote-control/settings.json
```

你也可以手动指定：

```bash
node scripts/typora-remote-cli.mjs --settings /path/to/settings.json ping
```

## 参考文档

- [remote-control-api.md](./references/remote-control-api.md)
- [plugin-commands.md](./references/plugin-commands.md)
- [typora-capability-inventory.md](./references/typora-capability-inventory.md)

## 注意事项

- `getDocument()` 返回的是 **Markdown 源码**，不是渲染后的 DOM/HTML。
- `openFolder()` 是宿主异步操作，调用后应重新读取 `context.mountFolder` 做确认。
- 这个 skill 仓库本身不安装 Typora 插件，它假设插件已经在你的 Typora 里工作了。
