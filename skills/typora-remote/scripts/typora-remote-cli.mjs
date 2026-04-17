#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { TyporaRemoteControlClient, getDefaultSettingsPath } from "./typora-remote-client.mjs";

const USAGE = `Usage:
  typora-remote-cli [global-flags] <command> [args...]

Global Flags:
  --settings <path>       Override remote-control settings.json location
  --url <ws-url>          Override WebSocket URL (bypasses settings.json)
  --token <token>         Override bearer token (use with --url)
  --role <client|typora>  Session role (default: client)
  -h, --help              Show this message

Commands:
  ping                           Authenticated liveness probe (expects "pong")
  info                           Sidecar status, PID, typora connectivity
  shutdown                       Ask the sidecar to stop
  context                        Current Typora context (file, folder, source mode)
  document                       Current Typora markdown source
  set-document --file <path>     Replace document with contents of <path>
  set-document --stdin           Replace document with stdin
  source <on|off>                Toggle source mode
  open-file <abs-path>           Open a markdown file
  open-folder <abs-folder>       Switch mounted folder (verified after 1.2s)
  insert-text <text...>          Insert text at current caret
  run <command...>               Buffered shell exec
  start <command...>             Streaming shell exec (Ctrl-C kills it)
  exec-list                      List running execs
  kill <execId> [signal]         Kill a running exec (default SIGTERM)
  plugins                        List installed plugins
  enable-plugin <pluginId>       Enable a plugin
  disable-plugin <pluginId>      Disable a plugin
  plugin-commands [pluginId]     List commands (optionally scoped to a plugin)
  invoke <pluginId> <commandId>  Invoke a plugin-owned command
  commands                       List every registered Typora command
  invoke-typora <commandId>      Invoke a Typora command by id (app.commands.execute)
  call <method> [jsonParams]     Raw JSON-RPC call

Examples:
  typora-remote-cli ping
  typora-remote-cli context
  typora-remote-cli open-folder "$HOME/Notes"
  typora-remote-cli insert-text "Hello from CLI"
  typora-remote-cli start "pnpm test"
  typora-remote-cli call typora.getContext
`;

class CliError extends Error {}

function parseGlobalFlags(argv) {
  const rest = [...argv];
  const opts = {};

  const consume = (flag) => {
    const idx = rest.findIndex((x) => x === flag);
    if (idx === -1) return undefined;
    const value = rest[idx + 1];
    if (value === undefined) throw new CliError(`Missing value for ${flag}`);
    rest.splice(idx, 2);
    return value;
  };

  opts.settingsPath = consume("--settings");
  opts.url = consume("--url");
  opts.token = consume("--token");
  opts.role = consume("--role");

  if (rest.includes("-h") || rest.includes("--help")) {
    opts.help = true;
    const i = rest.findIndex((x) => x === "-h" || x === "--help");
    rest.splice(i, 1);
  }

  return { opts, rest };
}

async function buildClient(opts) {
  if (opts.url) {
    if (!opts.token) {
      throw new CliError("--url also requires --token");
    }
    return await TyporaRemoteControlClient.connect({
      url: opts.url,
      token: opts.token,
      role: opts.role,
    });
  }
  return await TyporaRemoteControlClient.connectFromLocalSettings({
    settingsPath: opts.settingsPath,
    role: opts.role,
  });
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value ?? null, null, 2) + "\n");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function streamExec(client, execId) {
  let exited = false;
  const onInterrupt = async () => {
    if (exited) return;
    try {
      await client.kill(execId);
      printJson({ event: "signal", payload: { execId, sent: "SIGTERM" } });
    } catch (error) {
      printJson({ event: "signal-error", payload: { execId, message: String(error?.message ?? error) } });
    }
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);

  try {
    await new Promise((resolve) => {
      const offStdout = client.onNotification("exec.stdout", (payload) => {
        if (payload?.execId !== execId) return;
        printJson({ event: "stdout", payload });
      });
      const offStderr = client.onNotification("exec.stderr", (payload) => {
        if (payload?.execId !== execId) return;
        printJson({ event: "stderr", payload });
      });
      const offExit = client.onNotification("exec.exit", (payload) => {
        if (payload?.execId !== execId) return;
        exited = true;
        printJson({ event: "exit", payload });
        offStdout();
        offStderr();
        offExit();
        resolve();
      });
    });
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  }
}

async function dispatch(client, command, args) {
  switch (command) {
    case "ping":
      printJson(await client.ping());
      return;
    case "info":
      printJson(await client.getInfo());
      return;
    case "shutdown":
      printJson(await client.shutdown());
      return;
    case "context":
      printJson(await client.getContext());
      return;
    case "document":
      printJson(await client.getDocument());
      return;
    case "run":
      if (args.length === 0) throw new CliError("Missing command");
      printJson(await client.run(args.join(" ")));
      return;
    case "start": {
      if (args.length === 0) throw new CliError("Missing command");
      const started = await client.start(args.join(" "));
      printJson({ event: "started", payload: started });
      await streamExec(client, started.execId);
      return;
    }
    case "exec-list":
      printJson(await client.listExecs());
      return;
    case "kill":
      if (args.length === 0) throw new CliError("Missing execId");
      printJson(await client.kill(args[0], args[1]));
      return;
    case "open-file":
      if (args.length === 0) throw new CliError("Missing file path");
      printJson(await client.openFile(args[0]));
      return;
    case "open-folder": {
      if (args.length === 0) throw new CliError("Missing folder path");
      const requested = args[0];
      const result = await client.openFolder(requested);
      const context = await client.waitForMountFolder(requested, { timeoutMs: 3000 });
      printJson({ requested, result, context });
      return;
    }
    case "source":
      if (args.length === 0 || !["on", "off"].includes(args[0])) {
        throw new CliError('Expected "on" or "off"');
      }
      printJson(await client.setSourceMode(args[0] === "on"));
      return;
    case "set-document": {
      let markdown;
      if (args[0] === "--file" && args[1]) {
        markdown = await readFile(args[1], "utf8");
      } else if (args[0] === "--stdin") {
        markdown = await readStdin();
      } else {
        throw new CliError("Use: set-document --file <path> | --stdin");
      }
      printJson(await client.setDocument(markdown));
      return;
    }
    case "insert-text": {
      if (args.length === 0) throw new CliError("Missing text");
      printJson(await client.insertText(args.join(" ")));
      return;
    }
    case "plugins":
      printJson(await client.listPlugins());
      return;
    case "enable-plugin":
      if (args.length === 0) throw new CliError("Missing pluginId");
      printJson(await client.setPluginEnabled(args[0], true));
      return;
    case "disable-plugin":
      if (args.length === 0) throw new CliError("Missing pluginId");
      printJson(await client.setPluginEnabled(args[0], false));
      return;
    case "plugin-commands":
      printJson(await client.listPluginCommands(args[0]));
      return;
    case "invoke":
      if (args.length < 2) throw new CliError("Use: invoke <pluginId> <commandId>");
      printJson(await client.invokePluginCommand(args[0], args[1]));
      return;
    case "commands":
      printJson(await client.listTyporaCommands());
      return;
    case "invoke-typora":
      if (args.length === 0) throw new CliError("Missing commandId");
      printJson(await client.invokeTyporaCommand(args[0]));
      return;
    case "call": {
      if (args.length === 0) throw new CliError("Missing method");
      const method = args[0];
      let params;
      if (args[1] !== undefined) {
        try {
          params = JSON.parse(args[1]);
        } catch (error) {
          throw new CliError(`Invalid JSON params: ${error.message}`);
        }
      }
      printJson(await client.call(method, params));
      return;
    }
    default:
      throw new CliError(`Unknown command: ${command}`);
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseGlobalFlags(process.argv.slice(2));
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n\n" + USAGE);
    process.exit(2);
  }

  const { opts, rest } = parsed;

  if (opts.help || rest.length === 0) {
    process.stdout.write(USAGE);
    process.exit(opts.help ? 0 : 1);
  }

  const [command, ...args] = rest;

  let client;
  try {
    client = await buildClient(opts);
  } catch (error) {
    const hint = opts.url
      ? ""
      : `\nTip: default settings path is ${getDefaultSettingsPath()}. ` +
        `Pass --settings <path> or --url/--token to override.`;
    process.stderr.write((error instanceof Error ? error.message : String(error)) + hint + "\n");
    process.exit(3);
  }

  try {
    await dispatch(client, command, args);
    process.exitCode = 0;
  } catch (error) {
    if (error instanceof CliError) {
      process.stderr.write(error.message + "\n\n" + USAGE);
      process.exitCode = 2;
      return;
    }
    if (error && typeof error.code === "number") {
      process.stderr.write(`RPC error ${error.code}: ${error.message}\n`);
      if (error.data !== undefined) {
        process.stderr.write(JSON.stringify(error.data) + "\n");
      }
      process.exitCode = 4;
      return;
    }
    process.stderr.write((error instanceof Error ? (error.stack ?? error.message) : String(error)) + "\n");
    process.exitCode = 1;
  } finally {
    client.close();
  }
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? (error.stack ?? error.message) : String(error)) + "\n");
  process.exit(1);
});
