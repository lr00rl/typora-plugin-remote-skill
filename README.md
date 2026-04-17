# typora-plugin-remote-skill

一个独立的 **Typora Remote Skill** 项目，用来配合 [`typora-plugin-lite`](https://github.com/lr00rl/typora-plugin-lite) 中的 `remote-control` 插件，通过 AI Agent（Claude Code / Codex / 自定义脚本）直接控制正在运行的 Typora。

这个仓库**不包含 Typora 插件本体**，它只提供：

- 可安装到 Claude Code / Codex 的 Skill：`SKILL.md`
- Codex / OpenAI skills 元数据：`agents/openai.yaml`
- 独立 Node client：`scripts/typora-remote-client.mjs`
- 独立 CLI（可通过 `npx` 调用）：`scripts/typora-remote-cli.mjs`
- 一键安装脚本：`scripts/install-skill.mjs`
- 接口与能力参考文档：`references/*.md`

> 对接的是 `typora-plugin-lite` 里 `remote-control` 插件启动的本地 sidecar（loopback + token 鉴权的 JSON-RPC over WebSocket）。

---

## 目录

- [前置条件](#前置条件)
- [目录结构](#目录结构)
- [安装方式总览](#安装方式总览)
- [一、作为 Claude Code Skill 安装](#一作为-claude-code-skill-安装)
- [二、作为 Codex Skill 安装](#二作为-codex-skill-安装)
- [三、通过 npx 直接使用 CLI](#三通过-npx-直接使用-cli)
- [CLI 用法](#cli-用法)
- [Node Client 用法](#node-client-用法)
- [当前支持的能力](#当前支持的能力)
- [配置来源](#配置来源)
- [故障排查](#故障排查)
- [参考文档](#参考文档)

---

## 前置条件

1. Typora 正在运行
2. 已安装 [`typora-plugin-lite`](https://github.com/lr00rl/typora-plugin-lite)
3. `remote-control` 插件已启用（会在 Typora 启动时自动拉起本地 sidecar）
4. 本机可访问 sidecar（默认 `ws://127.0.0.1:5619/rpc`，loopback only）
5. **Node.js 22+**（需要原生 `WebSocket`）

Sidecar 鉴权 token 与地址由插件写入本机设置文件，Client / CLI 会自动读取。你也可以手动指定 `--settings` / `--url` / `--token`。

---

## 目录结构

```text
typora-plugin-remote-skill/
├── SKILL.md                       # 给 Claude Code / Codex 的 skill 定义
├── README.md
├── package.json                   # 含 bin: typora-remote-cli / typora-remote-install
├── agents/
│   └── openai.yaml                # Codex / OpenAI skills 元数据
├── references/
│   ├── remote-control-api.md
│   ├── plugin-commands.md
│   └── typora-capability-inventory.md
└── scripts/
    ├── typora-remote-client.mjs   # 独立 Node client（可 import）
    ├── typora-remote-cli.mjs      # CLI（bin: typora-remote-cli）
    └── install-skill.mjs          # 安装到 ~/.claude/skills 或 ~/.codex/skills
```

---

## 安装方式总览

| 场景 | 推荐方式 | 命令 |
|------|----------|------|
| Claude Code 里作为 skill 调用 | 安装到 `~/.claude/skills/typora-remote/` | `npx typora-remote-install --target=claude` |
| Codex CLI 里作为 skill 调用 | 安装到 `~/.codex/skills/typora-remote/` | `npx typora-remote-install --target=codex` |
| 两者都装 | 一条命令搞定 | `npx typora-remote-install` |
| 只想用 CLI（不装 skill） | 临时 npx 运行即可 | `npx typora-remote-cli ping` |
| 本地开发/调试 | 直接跑脚本 | `node scripts/typora-remote-cli.mjs ping` |

> 发布到 npm 之前，`npx` 方式需要指向本仓库（见下文每一节的「从本仓库直接运行」一栏）。

---

## 一、作为 Claude Code Skill 安装

Claude Code 会从 `~/.claude/skills/<skill-name>/SKILL.md` 自动发现 skill；本仓库的 `SKILL.md` 已经带好了 frontmatter (`name: typora-remote`)。

### 方式 A：一键安装脚本（推荐）

从发布后的 npm 包安装：

```bash
npx -y typora-plugin-remote-skill typora-remote-install --target=claude
```

或从本仓库直接运行：

```bash
# 在本仓库根目录
node scripts/install-skill.mjs --target=claude
# 或
npm run install-skill -- --target=claude
```

脚本会把 `SKILL.md` / `README.md` / `agents/` / `references/` / `scripts/` / `package.json` 复制到：

```text
~/.claude/skills/typora-remote/
```

并写入一个 `INSTALLED.json` 记录安装时间与来源。

### 方式 B：手动软链

如果你想保持 skill 跟随仓库同步更新（例如经常拉 git）：

```bash
mkdir -p ~/.claude/skills
ln -snf "$(pwd)" ~/.claude/skills/typora-remote
```

### 验证

重启 Claude Code，然后：

- 跟 Claude 说「用 typora-remote 看一下当前 Typora 上下文」
- 或让它执行：`node ~/.claude/skills/typora-remote/scripts/typora-remote-cli.mjs context`

---

## 二、作为 Codex Skill 安装

Codex 使用相似的 skill 目录结构，`agents/openai.yaml` 是给 Codex / OpenAI Skills 的显示与调用元数据。

### 一键安装

```bash
# 从 npm（发布后）
npx -y typora-plugin-remote-skill typora-remote-install --target=codex

# 或从本仓库
node scripts/install-skill.mjs --target=codex
```

安装目标：

```text
~/.codex/skills/typora-remote/
├── SKILL.md
├── agents/openai.yaml
├── references/
└── scripts/
```

### 同时安装到 Claude 与 Codex

```bash
npx typora-remote-install            # 默认 target=both
# 或
node scripts/install-skill.mjs       # 同上
```

### 自定义安装位置

```bash
# 换个 skill 名
node scripts/install-skill.mjs --name=typora --target=claude

# 覆盖已有安装
node scripts/install-skill.mjs --target=both --force
```

---

## 三、通过 npx 直接使用 CLI

不装 skill 也可以，CLI 可以直接 `npx` 调用。

### 从 npm（发布后）

```bash
npx -y typora-plugin-remote-skill typora-remote-cli ping
npx -y typora-plugin-remote-skill typora-remote-cli context
```

### 从 GitHub（免发布）

```bash
npx -y github:lr00rl/typora-plugin-remote-skill typora-remote-cli ping
```

### 从本仓库

```bash
npm link                           # 一次性注册 bin
typora-remote-cli ping

# 或直接跑 mjs
node scripts/typora-remote-cli.mjs ping
```

---

## CLI 用法

### 健康检查

```bash
typora-remote-cli ping             # -> "pong"
typora-remote-cli info             # sidecar pid / host / port / typoraConnected
typora-remote-cli shutdown         # 停止 sidecar
```

### 读取 Typora 状态

```bash
typora-remote-cli context          # 当前文件/目录/source mode/commands
typora-remote-cli document         # 当前文档 markdown 源
typora-remote-cli plugins          # 已安装插件
typora-remote-cli plugin-commands  # 所有插件命令
typora-remote-cli plugin-commands note-assistant
typora-remote-cli commands         # 全部已注册的 Typora 命令
```

### 写入 / 控制

```bash
typora-remote-cli source on
typora-remote-cli source off
typora-remote-cli open-file   "/abs/path/to/file.md"
typora-remote-cli open-folder "/abs/path/to/folder"
typora-remote-cli insert-text "hello from the cli"

# 整个文件替换当前文档
typora-remote-cli set-document --file /tmp/new.md

# 从 stdin 替换
echo "# Stdin" | typora-remote-cli set-document --stdin
```

### 插件命令

```bash
typora-remote-cli enable-plugin  fuzzy-search
typora-remote-cli disable-plugin fuzzy-search
typora-remote-cli invoke note-assistant note-assistant:open
typora-remote-cli invoke wider wider:set-wide
typora-remote-cli invoke-typora remote-control:show-status
```

### Shell 执行

```bash
typora-remote-cli run  "pwd"
typora-remote-cli run  "ls -la ~/Notes"

# 流式执行，会实时推送 stdout/stderr，Ctrl-C 发送 SIGTERM 给远端
typora-remote-cli start "pnpm test"
typora-remote-cli exec-list
typora-remote-cli kill <execId> SIGKILL
```

### 原始 JSON-RPC

```bash
typora-remote-cli call system.getInfo
typora-remote-cli call typora.setSourceMode '{"enabled":true}'
```

### 全局 flags

```bash
typora-remote-cli --settings /path/to/settings.json ping
typora-remote-cli --url ws://127.0.0.1:5619/rpc --token <token> ping
typora-remote-cli --role client ping
```

---

## Node Client 用法

```js
import { TyporaRemoteControlClient } from "typora-plugin-remote-skill";
// 或者本地路径：
// import { TyporaRemoteControlClient } from "./scripts/typora-remote-client.mjs";

const client = await TyporaRemoteControlClient.connectFromLocalSettings();

console.log(await client.ping());
console.log(await client.getContext());
console.log(await client.getDocument());

await client.setSourceMode(true);
await client.openFile("/abs/path/to/file.md");
await client.openFolder("/abs/path/to/folder");
await client.waitForMountFolder("/abs/path/to/folder"); // 轮询确认切换成功

console.log(await client.listPlugins());
console.log(await client.listPluginCommands("note-assistant"));

await client.noteAssistantOpen();
await client.widerSetWide();

client.close();
```

### 手动指定连接参数

```js
const client = await TyporaRemoteControlClient.connect({
  url: "ws://127.0.0.1:5619/rpc",
  token: process.env.TYPORA_REMOTE_TOKEN,
  role: "client",
});
```

### 订阅流式 exec 通知

```js
const started = await client.start("pnpm build");

const off = client.onNotification("exec.stdout", (payload) => {
  if (payload.execId !== started.execId) return;
  process.stdout.write(payload.data);
});

client.onNotification("exec.exit", (payload) => {
  if (payload.execId !== started.execId) return;
  console.log("exit", payload.exitCode);
  off();
  client.close();
});
```

---

## 当前支持的能力

### 系统

- `ping()` / `getInfo()` / `shutdown()`

### 执行命令

- `run()` / `start()` / `kill()` / `listExecs()`
- Notifications: `exec.stdout` / `exec.stderr` / `exec.exit`

### Typora 控制

- `getContext()` / `getDocument()` / `setDocument()`
- `setSourceMode()` / `insertText()`
- `openFile()` / `openFolder()` / `waitForMountFolder()`
- `listTyporaCommands()` / `invokeTyporaCommand()`

### 插件控制

- `listPlugins()` / `setPluginEnabled()`
- `listPluginCommands()` / `invokePluginCommand()`

### 已封装的插件快捷方法

- `noteAssistantOpen()` / `noteAssistantRebuildGraph()` / `noteAssistantReparseDocument()`
- `widerCycle()` / `widerSetDefault()` / `widerSetWide()` / `widerSetFull()` / `widerNarrower()` / `widerWider()`
- `mdPaddingFormat()`
- `titleShiftIncrease()` / `titleShiftDecrease()`
- `quickOpenInstallFzf()`

---

## 配置来源

Client 默认自动读取本机的 `remote-control` 设置文件：

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/abnerworks.Typora/plugins/data/remote-control/settings.json` |
| Windows | `%APPDATA%/Typora/plugins/data/remote-control/settings.json` |
| Linux | `$XDG_CONFIG_HOME/Typora/plugins/data/remote-control/settings.json` |

也可以用 `--settings /path/to/settings.json` 或直接 `--url` + `--token` 覆盖。

Token 与地址会在 Typora 启动（并启用 `remote-control` 插件）时自动生成；你也可以在 Typora 里执行命令 `Remote Control: Copy Bearer Token` / `Remote Control: Copy WebSocket URL` 拿到。

---

## 故障排查

| 症状 | 可能原因 / 修复方式 |
|------|--------------------|
| `Remote control settings not found at ...` | Typora 未运行，或 `remote-control` 插件未启用 |
| `Failed to connect to ws://...` | sidecar 没起来；在 Typora 里跑 `Remote Control: Start Local Service` |
| `Invalid token (403)` | 本机 settings.json 与 sidecar token 不一致，重启 Typora 即可 |
| `Typora session is unavailable (503)` | sidecar 起来了但 Typora 主进程没连进去；切换或重启 Typora |
| `Plugin command not registered` | 插件是 lazy-load 的，先 `enable-plugin <id>` 再 `plugin-commands <id>` |
| `Global WebSocket is not available` | Node 版本过低，升级到 Node 22+ |

---

## 参考文档

- [references/remote-control-api.md](./references/remote-control-api.md) — RPC 方法、参数、错误语义
- [references/plugin-commands.md](./references/plugin-commands.md) — 当前已封装的插件命令
- [references/typora-capability-inventory.md](./references/typora-capability-inventory.md) — Typora 宿主能力与尚未暴露的 API

---

## 注意事项

- `getDocument()` 返回 **Markdown 源码**，不是渲染后的 DOM/HTML
- `openFolder()` 对 Typora 来说是异步的，务必再读一次 `getContext()`（或用 `waitForMountFolder()`）确认
- 这个 skill 仓库本身不安装 Typora 插件，它假设插件已经在你的 Typora 里工作
- sidecar 只监听 loopback（`127.0.0.1`），不要把端口转发到外网
