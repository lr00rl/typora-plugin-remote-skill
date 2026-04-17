#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { TyporaRemoteControlClient } from "./typora-remote-client.mjs";

function usage() {
  console.error(`Usage:
  node scripts/typora-remote-cli.mjs ping
  node scripts/typora-remote-cli.mjs info
  node scripts/typora-remote-cli.mjs context
  node scripts/typora-remote-cli.mjs document
  node scripts/typora-remote-cli.mjs run <command...>
  node scripts/typora-remote-cli.mjs start <command...>
  node scripts/typora-remote-cli.mjs exec-list
  node scripts/typora-remote-cli.mjs kill <execId> [signal]
  node scripts/typora-remote-cli.mjs open-file <abs-path>
  node scripts/typora-remote-cli.mjs open-folder <abs-folder>
  node scripts/typora-remote-cli.mjs source <on|off>
  node scripts/typora-remote-cli.mjs set-document --file <path>
  node scripts/typora-remote-cli.mjs plugins
  node scripts/typora-remote-cli.mjs enable-plugin <pluginId>
  node scripts/typora-remote-cli.mjs disable-plugin <pluginId>
  node scripts/typora-remote-cli.mjs plugin-commands [pluginId]
  node scripts/typora-remote-cli.mjs invoke <pluginId> <commandId>
  node scripts/typora-remote-cli.mjs call <method> [jsonParams]

Options:
  --settings <path>  Override settings.json location
`);
}

function parseArgs(argv) {
  const rest = [...argv];
  let settingsPath;

  while (rest.length > 0) {
    if (rest[0] === "--settings") {
      settingsPath = rest[1];
      rest.splice(0, 2);
      continue;
    }
    break;
  }

  return { settingsPath, rest };
}

function printJson(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

async function main() {
  const { settingsPath, rest } = parseArgs(process.argv.slice(2));
  const [command, ...args] = rest;
  if (!command) {
    usage();
    process.exit(1);
  }

  const client = await TyporaRemoteControlClient.connectFromLocalSettings({ settingsPath });

  try {
    switch (command) {
      case "ping":
        printJson(await client.ping());
        return;
      case "info":
        printJson(await client.getInfo());
        return;
      case "context":
        printJson(await client.getContext());
        return;
      case "document":
        printJson(await client.getDocument());
        return;
      case "run":
        if (args.length === 0) throw new Error("Missing command");
        printJson(await client.run(args.join(" ")));
        return;
      case "start": {
        if (args.length === 0) throw new Error("Missing command");
        const started = await client.start(args.join(" "));
        printJson({ event: "started", payload: started });
        await streamExec(client, started.execId);
        return;
      }
      case "exec-list":
        printJson(await client.listExecs());
        return;
      case "kill":
        if (args.length === 0) throw new Error("Missing execId");
        printJson(await client.kill(args[0], args[1]));
        return;
      case "open-file":
        if (args.length === 0) throw new Error("Missing file path");
        printJson(await client.openFile(args[0]));
        return;
      case "open-folder": {
        if (args.length === 0) throw new Error("Missing folder path");
        const requested = args[0];
        const result = await client.openFolder(requested);
        await wait(1200);
        const context = await client.getContext();
        printJson({ requested, result, context });
        return;
      }
      case "source":
        if (args.length === 0 || !["on", "off"].includes(args[0])) {
          throw new Error('Expected "on" or "off"');
        }
        printJson(await client.setSourceMode(args[0] === "on"));
        return;
      case "set-document": {
        if (args[0] !== "--file" || !args[1]) {
          throw new Error("Use: set-document --file <path>");
        }
        const markdown = await readFile(args[1], "utf8");
        printJson(await client.setDocument(markdown));
        return;
      }
      case "plugins":
        printJson(await client.listPlugins());
        return;
      case "enable-plugin":
        if (args.length === 0) throw new Error("Missing pluginId");
        printJson(await client.setPluginEnabled(args[0], true));
        return;
      case "disable-plugin":
        if (args.length === 0) throw new Error("Missing pluginId");
        printJson(await client.setPluginEnabled(args[0], false));
        return;
      case "plugin-commands":
        printJson(await client.listPluginCommands(args[0]));
        return;
      case "invoke":
        if (args.length < 2) throw new Error("Use: invoke <pluginId> <commandId>");
        printJson(await client.invokePluginCommand(args[0], args[1]));
        return;
      case "call": {
        if (args.length === 0) throw new Error("Missing method");
        const method = args[0];
        const params = args[1] ? JSON.parse(args[1]) : undefined;
        printJson(await client.call(method, params));
        return;
      }
      default:
        usage();
        throw new Error(`Unknown command: ${command}`);
    }
  } finally {
    client.close();
  }
}

async function streamExec(client, execId) {
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
      printJson({ event: "exit", payload });
      offStdout();
      offStderr();
      offExit();
      resolve();
    });
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
