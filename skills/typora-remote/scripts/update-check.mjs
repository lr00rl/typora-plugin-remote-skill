/**
 * Self-update notifier for the typora-remote skill.
 *
 * Contract:
 *   - Runs fire-and-forget from the CLI entry point.
 *   - Prints AT MOST one stderr line per run when a newer VERSION is
 *     available upstream.
 *   - Silent on every failure (network unreachable, GitHub 4xx/5xx,
 *     malformed version, missing local VERSION file, fs errors).
 *   - Network call at most once per 24h; cached result persists across runs
 *     under the OS-native cache directory.
 *   - Opt-out: set env var `TPL_SKILL_DISABLE_UPDATE_CHECK=1`.
 */

import { accessSync, constants } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "lr00rl/typora-plugin-remote-skill";
const REMOTE_VERSION_URL = `https://raw.githubusercontent.com/${REPO}/main/VERSION`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const SEMVER_RE = /^[0-9]+(\.[0-9]+){1,3}$/;

export function getCacheDir() {
  const plat = platform();
  if (plat === "darwin") {
    return join(homedir(), "Library", "Caches", "typora-plugin-remote-skill");
  }
  if (plat === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(localAppData, "typora-plugin-remote-skill", "Cache");
  }
  const xdgCache = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");
  return join(xdgCache, "typora-plugin-remote-skill");
}

export function getCacheFile() {
  return join(getCacheDir(), "last-check.json");
}

export function getLocalVersionFileCandidates() {
  const here = fileURLToPath(new URL(".", import.meta.url));
  return [
    // Repository checkout: <repo>/skills/typora-remote/scripts/update-check.mjs
    join(here, "..", "..", "..", "VERSION"),
    // Installed skill copy: <skill-root>/scripts/update-check.mjs
    join(here, "..", "VERSION"),
  ];
}

/**
 * Absolute path to the local VERSION file for the current layout.
 * Prefers the repo-root VERSION in source checkouts, then falls back to the
 * mirrored skill-local VERSION file in installed/copied skill directories.
 */
export function getLocalVersionFile() {
  for (const versionFile of getLocalVersionFileCandidates()) {
    try {
      accessSync(versionFile, constants.R_OK);
      return versionFile;
    } catch {
      // keep searching
    }
  }
  return getLocalVersionFileCandidates()[0];
}

export async function readLocalVersion() {
  const raw = await readFile(getLocalVersionFile(), "utf8");
  return raw.trim();
}

async function readCache() {
  try {
    const raw = await readFile(getCacheFile(), "utf8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.checkedAt === "number" && typeof parsed.latest === "string") {
      return parsed;
    }
  } catch {
    // ignore — cache absent or unreadable
  }
  return null;
}

async function writeCache(data) {
  const dir = dirname(getCacheFile());
  await mkdir(dir, { recursive: true });
  await writeFile(getCacheFile(), JSON.stringify(data), "utf8");
}

export function compareSemver(a, b) {
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const ai = Number.isFinite(pa[i]) ? pa[i] : 0;
    const bi = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (ai > bi) return 1;
    if (ai < bi) return -1;
  }
  return 0;
}

async function fetchRemoteVersion() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(REMOTE_VERSION_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "typora-plugin-remote-skill/update-check",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.text()).trim();
    if (!SEMVER_RE.test(raw)) {
      throw new Error(`Invalid remote version payload: ${raw.slice(0, 32)}`);
    }
    return raw;
  } finally {
    clearTimeout(timer);
  }
}

function formatNotice(current, latest) {
  return (
    `\n[typora-remote] update available: v${current} -> v${latest}\n` +
    `  Claude Code : /plugin marketplace update\n` +
    `  Codex       : codex skills update\n` +
    `  npm         : npx skills install ${REPO}\n` +
    `  disable     : export TPL_SKILL_DISABLE_UPDATE_CHECK=1\n`
  );
}

/**
 * Fire-and-forget update check. Returns a Promise the caller can race against
 * a short timeout to let the notice flush to stderr before normal exit.
 * Never rejects.
 */
export async function checkForUpdates() {
  try {
    if (process.env.TPL_SKILL_DISABLE_UPDATE_CHECK === "1") return;

    let currentVersion;
    try {
      currentVersion = await readLocalVersion();
    } catch {
      return; // no local VERSION file; skip silently
    }
    if (!SEMVER_RE.test(currentVersion)) return;

    const now = Date.now();
    const cache = await readCache();
    let latest;

    if (cache && now - cache.checkedAt < CACHE_TTL_MS) {
      latest = cache.latest;
    } else {
      try {
        latest = await fetchRemoteVersion();
        await writeCache({ checkedAt: now, latest });
      } catch {
        return;
      }
    }

    if (compareSemver(latest, currentVersion) > 0) {
      process.stderr.write(formatNotice(currentVersion, latest));
    }
  } catch {
    // absolute silence; update-check must never break the CLI
  }
}
