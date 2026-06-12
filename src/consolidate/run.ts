// Orchestrateur de consolidation : résume les sessions en attente, idempotent et borné.
// Zéro-perte (index par empreinte) · zéro-doublon (skip inchangé) · quota (backfill lissé).
import { basename } from "node:path";
import { listSessionFiles } from "../scanner/session-reader.ts";
import { readSession } from "../scanner/session-reader.ts";
import { fileFingerprint } from "../scanner/fingerprint.ts";
import { digestTranscript } from "./transcript-digest.ts";
import { summarizeDigest, defaultModel } from "./summarize.ts";
import {
  loadIndex, saveIndex, saveSummary, isProcessed, markProcessed,
} from "./store.ts";
import type { SessionSummary, ConsolidationIndex, ConsolidationRun } from "./types.ts";
import { SUMMARY_SCHEMA_VERSION } from "./summary-prompt.ts";
import { logger } from "../logger.ts";

interface Pending { file: string; fp: string; mtime: number }

const FRESH_MS = 5 * 60_000; // on ne résume pas une session modifiée il y a < 5 min (en cours)
const DEFAULT_QUOTA = 25;

function quota(): number {
  const q = Number(process.env.ARCADE_BACKFILL_QUOTA);
  return Number.isFinite(q) && q > 0 ? Math.floor(q) : DEFAULT_QUOTA;
}

/** Sessions à traiter : non vues / modifiées, stables, triées récentes d'abord. */
async function selectPending(files: string[], idx: ConsolidationIndex): Promise<Pending[]> {
  const pending: Pending[] = [];
  for (const file of files) {
    const fp = await fileFingerprint(file);
    if (!fp) continue;
    if (isProcessed(idx, file, fp)) continue;
    const mtime = Number(fp.split(":")[0]);
    if (Date.now() - mtime < FRESH_MS) continue; // session en cours d'écriture
    pending.push({ file, fp, mtime });
  }
  return pending.sort((a, b) => b.mtime - a.mtime);
}

/** Résume une session. Retourne le résumé, "empty" (rien à résumer), ou null (échec). */
async function summarizeOne(file: string, fp: string, model: string): Promise<SessionSummary | "empty" | null> {
  const digest = digestTranscript(await readSession(file));
  if (!digest.text.trim() || digest.messageCount < 2) return "empty";
  const fields = await summarizeDigest(digest.text, model);
  if (!fields) return null;
  return {
    ...fields,
    project: digest.project || fields.project,
    sessionId: digest.sessionId || basename(file, ".jsonl"),
    file, fingerprint: fp, model,
    summarizedAt: Date.now(),
    schemaVersion: SUMMARY_SCHEMA_VERSION,
  };
}

export async function runConsolidation(): Promise<ConsolidationRun> {
  const started = Date.now();
  const model = defaultModel();
  const idx = await loadIndex();
  const files = await listSessionFiles();
  const pending = await selectPending(files, idx);
  const batch = pending.slice(0, quota());
  logger.info({ pending: pending.length, batch: batch.length, model }, "consolidation démarrée");

  let summarized = 0, failed = 0, skipped = 0;
  for (const { file, fp } of batch) {
    const res = await summarizeOne(file, fp, model);
    if (res === null) { failed++; continue; } // pas marqué → retenté au prochain run
    if (res === "empty") { skipped++; } else { await saveSummary(res); summarized++; }
    markProcessed(idx, file, fp);
  }
  idx.lastRun = Date.now();
  await saveIndex(idx);
  const run: ConsolidationRun = {
    scanned: files.length, pending: pending.length, summarized, failed, skipped,
    quota: quota(), ms: Date.now() - started,
  };
  logger.info(run, "consolidation terminée");
  return run;
}
