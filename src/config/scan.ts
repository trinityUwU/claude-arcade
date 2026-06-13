// Scan de la config Claude Code : CLAUDE.md, rules/, skills/, commands/, settings.json.
// Source de vérité = les fichiers sur disque (jamais une copie DB). Lecture seule.
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { configRoot, isPatchable } from "./paths.ts";
import { isRepo } from "./git.ts";
import { logger } from "../logger.ts";
import type { ConfigEntry, ConfigKind, ConfigTree } from "./types.ts";

const MANAGED_MARK = "<!-- arcade:managed";

interface FileMeta { name?: string; description?: string; bytes: number; managed: boolean }

/** Parse minimal du frontmatter YAML (name + description sur une ligne), sans dépendance. */
function parseFrontmatter(text: string): { name?: string; description?: string } {
  if (!text.startsWith("---")) return {};
  const end = text.indexOf("\n---", 3);
  if (end < 0) return {};
  const out: { name?: string; description?: string } = {};
  for (const line of text.slice(3, end).split("\n")) {
    const m = /^(name|description):\s*(.+)$/.exec(line.trim());
    if (m?.[1] && m[2]) out[m[1] as "name" | "description"] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function fileMeta(abs: string): Promise<FileMeta> {
  const text = await Bun.file(abs).text();
  const fm = parseFrontmatter(text);
  return { name: fm.name, description: fm.description, bytes: text.length, managed: text.includes(MANAGED_MARK) };
}

async function toEntry(root: string, abs: string, kind: ConfigKind): Promise<ConfigEntry> {
  const meta = await fileMeta(abs);
  const relPath = relative(root, abs);
  const parts = relPath.split("/");
  const base = parts.at(-1) ?? relPath;
  // skills/<nom>/SKILL.md → dossier parent ; skills/<fichier>.md → nom de fichier (sans .md)
  const fallback = base === "SKILL.md" ? (parts.at(-2) ?? base) : base.replace(/\.md$/, "");
  return {
    kind, relPath,
    name: meta.name ?? (kind === "skill" ? fallback : relPath),
    description: meta.description, bytes: meta.bytes, managed: meta.managed,
    patchable: isPatchable(relPath, kind),
  };
}

async function collectSkills(root: string, out: ConfigEntry[]): Promise<void> {
  const dir = join(root, "skills");
  try {
    for (const it of await readdir(dir, { withFileTypes: true })) {
      if (it.isDirectory()) {
        const abs = join(dir, it.name, "SKILL.md");
        if (await Bun.file(abs).exists()) out.push(await toEntry(root, abs, "skill"));
      } else if (it.name.endsWith(".md")) {
        out.push(await toEntry(root, join(dir, it.name), "skill"));
      }
    }
  } catch { /* pas de dossier skills */ }
}

async function collectMarkdownDir(root: string, sub: string, kind: ConfigKind, out: ConfigEntry[]): Promise<void> {
  const dir = join(root, sub);
  try {
    for (const it of await readdir(dir, { withFileTypes: true })) {
      if (it.isFile() && it.name.endsWith(".md")) out.push(await toEntry(root, join(dir, it.name), kind));
    }
  } catch { /* dossier absent */ }
}

async function collectSingles(root: string, out: ConfigEntry[]): Promise<void> {
  const singles: Array<[string, ConfigKind]> = [["CLAUDE.md", "instruction"], ["settings.json", "setting"]];
  for (const [rel, kind] of singles) {
    if (await Bun.file(join(root, rel)).exists()) out.push(await toEntry(root, join(root, rel), kind));
  }
}

export async function scanConfig(): Promise<ConfigTree> {
  const root = configRoot();
  const entries: ConfigEntry[] = [];
  try {
    await collectSingles(root, entries);
    await collectMarkdownDir(root, "rules", "instruction", entries);
    await collectSkills(root, entries);
    await collectMarkdownDir(root, "commands", "command", entries);
  } catch (err) {
    logger.error({ err }, "scanConfig failed");
  }
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath));
  return { generatedAt: Date.now(), versioned: await isRepo(), entries };
}
