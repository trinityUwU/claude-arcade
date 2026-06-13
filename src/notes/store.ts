// Persistance des notes vivantes : un bucket par cwd (hash stable), JSONL append-only + artefacts.
import { createHash } from "node:crypto";
import { mkdir, appendFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { stateDir } from "../engine/state.ts";
import type { SessionNote } from "./types.ts";
import { logger } from "../logger.ts";

function notesRoot(): string {
  return join(stateDir(), "session-notes");
}

/** Hash court et stable d'un cwd → nom de bucket (évite les chemins exotiques sur disque). */
export function cwdHash(cwd: string): string {
  return createHash("sha1").update(cwd).digest("hex").slice(0, 16);
}

export function bucketDir(cwd: string): string {
  return join(notesRoot(), cwdHash(cwd));
}
function notesFile(cwd: string): string {
  return join(bucketDir(cwd), "notes.jsonl");
}
export function artifactsDir(cwd: string): string {
  return join(bucketDir(cwd), "artifacts");
}

/** Archive une copie durable d'un artefact dans le bucket. Retourne le chemin de la copie ou null. */
export async function archiveArtifact(cwd: string, srcPath: string): Promise<string | null> {
  try {
    const src = Bun.file(srcPath);
    if (!(await src.exists())) return null;
    const dir = artifactsDir(cwd);
    await mkdir(dir, { recursive: true });
    const dest = join(dir, `${Date.now()}-${basename(srcPath)}`);
    await Bun.write(dest, src);
    return dest;
  } catch (err) {
    logger.error({ err, srcPath }, "archiveArtifact failed");
    return null;
  }
}

/** Ajoute une note au bucket du cwd (append atomique d'une ligne JSONL). Écrit aussi meta.json (cwd). */
export async function appendNote(cwd: string, note: SessionNote): Promise<void> {
  const dir = bucketDir(cwd);
  await mkdir(dir, { recursive: true });
  await Bun.write(join(dir, "meta.json"), JSON.stringify({ cwd }, null, 2));
  await appendFile(notesFile(cwd), `${JSON.stringify(note)}\n`, "utf8");
}

/** Lit toutes les notes d'un bucket (lignes JSONL corrompues ignorées). */
export async function readBucketNotes(cwd: string): Promise<SessionNote[]> {
  const out: SessionNote[] = [];
  try {
    const f = Bun.file(notesFile(cwd));
    if (!(await f.exists())) return out;
    for (const line of (await f.text()).split("\n")) {
      const t = line.trim();
      if (!t) continue;
      // cast : ligne JSONL écrite par appendNote, forme garantie côté écriture
      try { out.push(JSON.parse(t) as SessionNote); } catch { /* ligne corrompue */ }
    }
  } catch (err) {
    logger.error({ err, cwd }, "readBucketNotes failed");
  }
  return out;
}
