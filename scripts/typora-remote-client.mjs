import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export class TyporaRemoteControlError extends Error {
  constructor(code, message, data) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

export class TyporaRemoteControlClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.closed = false;

    ws.addEventListener("message", (event) => {
      this.#handleMessage(String(event.data));
    });

    ws.addEventListener("close", () => {
      this.closed = true;
      const error = new Error("Remote control socket closed");
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
    });
  }

  static async connect(options) {
    const role = options.role ?? "client";
    const ws = new WebSocket(options.url);

    await new Promise((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error(`Failed to connect to ${options.url}`)), { once: true });
    });

    const client = new TyporaRemoteControlClient(ws);
    await client.call("session.authenticate", {
      token: options.token,
      role,
    });
    return client;
  }

  static async connectFromLocalSettings(options = {}) {
    const settings = await readLocalSettings(options.settingsPath);
    return await TyporaRemoteControlClient.connect({
      url: `ws://${settings.host}:${settings.port}/rpc`,
      token: settings.token,
      role: options.role,
    });
  }

  async call(method, params) {
    if (this.closed) {
      throw new Error("Remote control socket is closed");
    }

    const id = this.nextId++;
    const response = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    this.ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params }),
    }));

    return await response;
  }

  onNotification(method, handler) {
    if (!this.handlers.has(method)) {
      this.handlers.set(method, new Set());
    }
    this.handlers.get(method).add(handler);
    return () => {
      this.handlers.get(method)?.delete(handler);
    };
  }

  close() {
    this.closed = true;
    this.ws.close();
  }

  async ping() {
    return await this.call("system.ping");
  }

  async getInfo() {
    return await this.call("system.getInfo");
  }

  async shutdown() {
    return await this.call("system.shutdown");
  }

  async run(command, options = {}) {
    return await this.call("exec.run", {
      command,
      ...options,
    });
  }

  async start(command, options = {}) {
    return await this.call("exec.start", {
      command,
      ...options,
    });
  }

  async kill(execId, signal) {
    return await this.call("exec.kill", {
      execId,
      ...(signal ? { signal } : {}),
    });
  }

  async listExecs() {
    return await this.call("exec.list");
  }

  async getContext() {
    return await this.call("typora.getContext");
  }

  async getDocument() {
    return await this.call("typora.getDocument");
  }

  async setDocument(markdown) {
    return await this.call("typora.setDocument", { markdown });
  }

  async setSourceMode(enabled) {
    return await this.call("typora.setSourceMode", { enabled });
  }

  async insertText(text) {
    return await this.call("typora.insertText", { text });
  }

  async openFile(filePath) {
    return await this.call("typora.openFile", { filePath });
  }

  async openFolder(folderPath) {
    return await this.call("typora.openFolder", { folderPath });
  }

  async listTyporaCommands() {
    return await this.call("typora.commands.list");
  }

  async invokeTyporaCommand(commandId) {
    return await this.call("typora.commands.invoke", { commandId });
  }

  async listPlugins() {
    return await this.call("typora.plugins.list");
  }

  async setPluginEnabled(pluginId, enabled) {
    return await this.call("typora.plugins.setEnabled", { pluginId, enabled });
  }

  async listPluginCommands(pluginId) {
    return await this.call("typora.plugins.commands.list", pluginId ? { pluginId } : {});
  }

  async invokePluginCommand(pluginId, commandId) {
    return await this.call("typora.plugins.commands.invoke", { pluginId, commandId });
  }

  async noteAssistantOpen() {
    return await this.invokePluginCommand("note-assistant", "note-assistant:open");
  }

  async noteAssistantRebuildGraph() {
    return await this.invokePluginCommand("note-assistant", "note-assistant:rebuild-graph");
  }

  async noteAssistantReparseDocument() {
    return await this.invokePluginCommand("note-assistant", "note-assistant:reparse-document");
  }

  async widerCycle() {
    return await this.invokePluginCommand("wider", "wider:cycle");
  }

  async widerSetDefault() {
    return await this.invokePluginCommand("wider", "wider:set-default");
  }

  async widerSetWide() {
    return await this.invokePluginCommand("wider", "wider:set-wide");
  }

  async widerSetFull() {
    return await this.invokePluginCommand("wider", "wider:set-full");
  }

  async widerNarrower() {
    return await this.invokePluginCommand("wider", "wider:narrower");
  }

  async widerWider() {
    return await this.invokePluginCommand("wider", "wider:wider");
  }

  async mdPaddingFormat() {
    return await this.invokePluginCommand("md-padding", "md-padding:format");
  }

  async titleShiftIncrease() {
    return await this.invokePluginCommand("title-shift", "title-shift:increase");
  }

  async titleShiftDecrease() {
    return await this.invokePluginCommand("title-shift", "title-shift:decrease");
  }

  async quickOpenInstallFzf() {
    return await this.invokePluginCommand("fuzzy-search", "quick-open:install-fzf");
  }

  #handleMessage(raw) {
    const message = JSON.parse(raw);
    if (message.jsonrpc !== "2.0") return;

    if (typeof message.method === "string" && message.id == null) {
      const handlers = this.handlers.get(message.method);
      if (!handlers) return;
      for (const handler of handlers) {
        handler(message.params);
      }
      return;
    }

    if (message.id == null) return;

    const pending = this.pending.get(Number(message.id));
    if (!pending) return;
    this.pending.delete(Number(message.id));

    if (message.error) {
      pending.reject(new TyporaRemoteControlError(
        message.error.code,
        message.error.message,
        message.error.data,
      ));
      return;
    }

    pending.resolve(message.result);
  }
}

export async function readLocalSettings(settingsPath = getDefaultSettingsPath()) {
  const raw = JSON.parse(await readFile(settingsPath, "utf8"));
  if (!raw.host || !raw.port || !raw.token) {
    throw new Error(`Incomplete remote-control settings at ${settingsPath}`);
  }
  return {
    host: raw.host,
    port: raw.port,
    token: raw.token,
  };
}

export function getDefaultSettingsPath() {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "abnerworks.Typora", "plugins", "data", "remote-control", "settings.json");
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
    return join(appData, "Typora", "plugins", "data", "remote-control", "settings.json");
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdgConfig, "Typora", "plugins", "data", "remote-control", "settings.json");
}
