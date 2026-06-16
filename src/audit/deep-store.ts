// Persistance des audits profonds (claude -p) par fichier de config.
// Durable → filtre « Analysé » dans l'UI + verdict réaffiché sans re-dépense de tokens.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stateDir } from "../engine/state.ts";
import { logger } from "../logger.ts";
import type { DeepAudit } from "./types.ts";

interface DeepStore { generatedAt: number; audits: Record<string, DeepAudit>; }

function storePath(): string {
  return join(stateDir(), "deep-audits.json");
}

export async function loadDeepAudits(): Promise<Record<string, DeepAudit>> {
  try {
    const f = Bun.file(storePath());
    if (await f.exists()) {
      const d = (await f.json()) as DeepStore;
      if (d.audits && typeof d.audits === "object") return d.audits;
    }
  } catch (err) {
    logger.error({ err }, "loadDeepAudits failed");
  }
  return {};
}

async function writeStore(audits: Record<string, DeepAudit>): Promise<void> {
  await mkdir(stateDir(), { recursive: true });
  await Bun.write(storePath(), JSON.stringify({ generatedAt: Date.now(), audits }, null, 2));
}

/** Enregistre/écrase le verdict approfondi d'un fichier (clé = relPath). */
export async function saveDeepAudit(audit: DeepAudit): Promise<void> {
  const audits = await loadDeepAudits();
  audits[audit.relPath] = audit;
  try { await writeStore(audits); }
  catch (err) { logger.error({ err, relPath: audit.relPath }, "saveDeepAudit failed"); }
}

/** Supprime le verdict d'un fichier (reset après upgrade → on peut ré-analyser). */
export async function clearDeepAudit(relPath: string): Promise<void> {
  const audits = await loadDeepAudits();
  if (!(relPath in audits)) return;
  delete audits[relPath];
  try { await writeStore(audits); }
  catch (err) { logger.error({ err, relPath }, "clearDeepAudit failed"); }
}
