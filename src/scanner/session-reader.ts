// Lecture des transcripts Claude Code : localisation + parse JSONL.
import { Glob } from "bun";
import { homedir } from "node:os";
import { join } from "node:path";
import type { TranscriptLine } from "../types.ts";
import { logger } from "../logger.ts";

export function claudeHome(): string {
  return process.env.CLAUDE_HOME?.trim() || join(homedir(), ".claude");
}

/** Liste absolue des fichiers de session `.jsonl` sous ~/.claude/projects. */
export async function listSessionFiles(home = claudeHome()): Promise<string[]> {
  const root = join(home, "projects");
  const glob = new Glob("**/*.jsonl");
  const files: string[] = [];
  try {
    for await (const rel of glob.scan({ cwd: root, absolute: true })) files.push(rel);
  } catch (err) {
    logger.error({ err, root }, "listSessionFiles failed");
  }
  return files;
}

/** Parse un fichier de session en lignes typées. Les lignes corrompues sont ignorées. */
export async function readSession(file: string): Promise<TranscriptLine[]> {
  const lines: TranscriptLine[] = [];
  try {
    const text = await Bun.file(file).text();
    for (const raw of text.split("\n")) {
      if (!raw.trim()) continue;
      try {
        lines.push(JSON.parse(raw) as TranscriptLine);
      } catch {
        // ligne tronquée (session en cours d'écriture) — on saute
      }
    }
  } catch (err) {
    logger.error({ err, file }, "readSession failed");
  }
  return lines;
}
