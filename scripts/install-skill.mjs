#!/usr/bin/env node

// Install this skill into a local skill host:
//   node scripts/install-skill.mjs [--target=claude|codex|both] [--name=typora-remote] [--force]
//
// Defaults:
//   --target = both
//   --name   = typora-remote
//
// Claude Code picks up skills from ~/.claude/skills/<name>/SKILL.md.
// Codex (OpenAI Codex CLI) picks them up from ~/.codex/skills/<name>/SKILL.md
// with additional metadata from ~/.codex/skills/<name>/agents/openai.yaml.

import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(HERE, "..");

const SKILL_PAYLOAD = [
  "SKILL.md",
  "README.md",
  "agents",
  "references",
  "scripts",
  "package.json",
];

function parseArgs(argv) {
  const opts = { target: "both", name: "typora-remote", force: false };
  for (const arg of argv) {
    if (arg.startsWith("--target=")) opts.target = arg.slice("--target=".length);
    else if (arg.startsWith("--name=")) opts.name = arg.slice("--name=".length);
    else if (arg === "--force") opts.force = true;
    else if (arg === "-h" || arg === "--help") opts.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const targets = opts.target === "both"
    ? ["claude", "codex"]
    : opts.target.split(",").map((x) => x.trim()).filter(Boolean);
  for (const t of targets) {
    if (!["claude", "codex"].includes(t)) {
      throw new Error(`Unknown target "${t}" (expected: claude, codex, or both)`);
    }
  }
  opts.targets = targets;
  return opts;
}

function targetRoot(target, name) {
  if (target === "claude") return join(homedir(), ".claude", "skills", name);
  if (target === "codex") return join(homedir(), ".codex", "skills", name);
  throw new Error(`Unsupported target: ${target}`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyEntry(src, dest) {
  if (!(await exists(src))) return false;
  await mkdir(dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true, force: true, dereference: false });
  return true;
}

async function installOne(target, name, force) {
  const dest = targetRoot(target, name);
  if (await exists(dest)) {
    if (!force) {
      throw new Error(
        `Destination already exists: ${dest}\nRe-run with --force to overwrite.`,
      );
    }
    await rm(dest, { recursive: true, force: true });
  }
  await mkdir(dest, { recursive: true });

  const installed = [];
  for (const entry of SKILL_PAYLOAD) {
    const src = join(SKILL_ROOT, entry);
    const out = join(dest, entry);
    if (await copyEntry(src, out)) installed.push(entry);
  }

  // Leave a small provenance file so future re-installs are easier to reason about.
  await writeFile(
    join(dest, "INSTALLED.json"),
    JSON.stringify(
      {
        installedAt: new Date().toISOString(),
        source: SKILL_ROOT,
        target,
        name,
        payload: installed,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  return { dest, installed };
}

function usage() {
  return `Install the typora-remote skill into Claude Code / Codex skill dirs.

Usage:
  node scripts/install-skill.mjs [--target=claude|codex|both] [--name=<skill-name>] [--force]

Options:
  --target   claude | codex | both   (default: both)
  --name     Folder name inside the skills dir (default: typora-remote)
  --force    Overwrite an existing installation
  -h --help  Show this message

Targets:
  claude -> ~/.claude/skills/<name>/
  codex  -> ~/.codex/skills/<name>/
`;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(String(error?.message ?? error) + "\n\n" + usage());
    process.exit(2);
  }

  if (opts.help) {
    process.stdout.write(usage());
    return;
  }

  const results = [];
  for (const target of opts.targets) {
    const result = await installOne(target, opts.name, opts.force);
    results.push({ target, ...result });
    process.stdout.write(`installed [${target}] -> ${result.dest}\n`);
    for (const entry of result.installed) {
      process.stdout.write(`  + ${entry}\n`);
    }
  }

  process.stdout.write("\nDone. Restart Claude Code / Codex if you want the new skill discovered immediately.\n");
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? (error.stack ?? error.message) : String(error)) + "\n");
  process.exit(1);
});
