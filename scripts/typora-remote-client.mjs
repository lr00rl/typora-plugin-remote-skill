import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

export class TyporaRemoteControlError extends Error {
  constructor(code, message, data) {
    super(message);
    this.name = "TyporaRemoteControlError";
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

    this._onMessage = (event) => {
      this.#handleMessage(String(event.data));
    };
    this._onClose = () => {
      this.closed = true;
      const error = new Error("Remote control socket closed");
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
    };

    ws.addEventListener("message", this._onMessage);
    ws.addEventListener("close", this._onClose);
  }

  static async connect(options) {
    if (!options || typeof options.url !== "string") {
      throw new Error("connect() requires options.url");
    }
    if (!options.token) {
      throw new Error("connect() requires options.token");
    }

    if (typeof globalThis.WebSocket !== "function") {
      throw new Error("Global WebSocket is not available. Use Node.js 22+ (or provide a polyfill).");
    }

    const role = options.role ?? "client";
    const ws = new globalThis.WebSocket(options.url);

    await new Promise((resolve, reject) => {
      const onError = () => {
        ws.removeEventListener("open", onOpen);
        reject(new Error(`Failed to connect to ${options.url}`));
      };
      const onOpen = () => {
        ws.removeEventListener("error", onError);
        resolve();
      };
      ws.addEventListener("open", onOpen, { once: true });
      ws.addEventListener("error", onError, { once: true });
    });

    const client = new TyporaRemoteControlClient(ws);
    try {
      await client.call("session.authenticate", {
        token: options.token,
        role,
      });
    } catch (error) {
      client.close();
      throw error;
    }
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
    if (this.closed) return;
    this.closed = true;
    try {
      this.ws.removeEventListener("message", this._onMessage);
      this.ws.removeEventListener("close", this._onClose);
    } catch {}
    try {
      this.ws.close();
    } catch {}
    const error = new Error("Remote control client closed");
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
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
    return await this.call("typora.setSourceMode", { enabled: !!enabled });
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
    return await this.call("typora.plugins.setEnabled", { pluginId, enabled: !!enabled });
  }

  async listPluginCommands(pluginId) {
    return await this.call("typora.plugins.commands.list", pluginId ? { pluginId } : {});
  }

  async invokePluginCommand(pluginId, commandId) {
    return await this.call("typora.plugins.commands.invoke", { pluginId, commandId });
  }

  async waitForMountFolder(target, { timeoutMs = 5000, intervalMs = 150 } = {}) {
    const expected = typeof target === "string" ? target : null;
    const startedAt = Date.now();
    let last = null;
    while (Date.now() - startedAt < timeoutMs) {
      last = await this.getContext();
      if (expected == null || last.mountFolder === expected) return last;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return last;
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
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (message.jsonrpc !== "2.0") return;

    if (typeof message.method === "string" && message.id == null) {
      const handlers = this.handlers.get(message.method);
      if (!handlers) return;
      for (const handler of handlers) {
        try {
          handler(message.params);
        } catch (error) {
          // Never let a user handler corrupt the RPC pump.
          queueMicrotask(() => { throw error; });
        }
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
  let raw;
  try {
    raw = JSON.parse(await readFile(settingsPath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(
        `Remote control settings not found at ${settingsPath}. ` +
        `Open Typora, enable typora-plugin-lite's "remote-control" plugin, ` +
        `then re-run this command (or pass --settings / --url and --token).`,
      );
    }
    throw error;
  }
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
