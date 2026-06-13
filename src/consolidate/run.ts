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
  loadAllSummaries, saveInsights, saveGraph, saveChampions, saveEvolution, savePrinciples,
} from "./store.ts";
import { buildInsights } from "./insights.ts";
import { buildGraph } from "./graph.ts";
import { buildChampions } from "./champions.ts";
import { buildEvolution } from "./evolution.ts";
import { buildPrinciples } from "./principles.ts";
import type {
  SessionSummary, ConsolidationIndex, ConsolidationRun, RunOptions, RunProgress, SessionEndOutcome,
} from "./types.ts";
import { SUMMARY_SCHEMA_VERSION } from "./summary-prompt.ts";
import { logger } from "../logger.ts";

interface Pending { file: string; fp: string; mtime: number }

const FRESH_MS = 5 * 60_000; // on ne résume pas une session modifiée il y a < 5 min (en cours)
const DEFAULT_QUOTA = 25;

function quota(): number {
  const q = Number(process.env.ARCADE_BACKFILL_QUOTA);
  return Number.isFinite(q) && q > 0 ? Math.floor(q) : DEFAULT_QUOTA;
}

/** Nombre de sessions en attente de consolidation (sans les traiter). */
export async function countPending(since?: number): Promise<number> {
  const idx = await loadIndex();
  const files = await listSessionFiles();
  return (await selectPending(files, idx, since)).length;
}

/** Sessions à traiter : non vues / modifiées, stables, triées récentes d'abord.
 *  `sinceMs` (mode auto) : ignore tout ce qui est antérieur au watermark = zéro rattrapage. */
async function selectPending(files: string[], idx: ConsolidationIndex, sinceMs?: number): Promise<Pending[]> {
  const pending: Pending[] = [];
  for (const file of files) {
    const fp = await fileFingerprint(file);
    if (!fp) continue;
    if (isProcessed(idx, file, fp)) continue;
    const mtime = Number(fp.split(":")[0]);
    if (Date.now() - mtime < FRESH_MS) continue; // session en cours d'écriture
    if (sinceMs && mtime < sinceMs) continue; // antérieur au watermark auto → laissé au manuel
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
    startTs: digest.startTs,
    summarizedAt: Date.now(),
    schemaVersion: SUMMARY_SCHEMA_VERSION,
  };
}

/** Reconstruit insights + graphe depuis TOUS les résumés (déterministe, cheap). */
export async function rebuildInsights(): Promise<void> {
  const summaries = await loadAllSummaries();
  const insights = buildInsights(summaries);
  await saveInsights(insights);
  await saveGraph(buildGraph(summaries, insights));
  const champions = buildChampions(summaries);
  await saveChampions(champions);
  await saveEvolution(buildEvolution(summaries, champions));
  await savePrinciples(buildPrinciples(summaries));
}

/** Consolide UNE session ciblée (hook SessionEnd, temps réel). Idempotent : skip si déjà à jour.
 *  Ne prend PAS le lock : le worker détaché appelant le détient pour sérialiser les écritures. */
export async function consolidateSession(
  file: string,
): Promise<{ outcome: SessionEndOutcome; summary?: SessionSummary }> {
  const fp = await fileFingerprint(file);
  if (!fp) return { outcome: "failed" };
  const idx = await loadIndex();
  if (isProcessed(idx, file, fp)) return { outcome: "skipped" };
  const res = await summarizeOne(file, fp, defaultModel());
  if (res === null) return { outcome: "failed" }; // pas marqué → rattrapé par systemd
  markProcessed(idx, file, fp);
  idx.lastRun = Date.now();
  await saveIndex(idx);
  if (res === "empty") return { outcome: "empty" };
  await saveSummary(res);
  await rebuildInsights();
  return { outcome: "consolidated", summary: res };
}

export async function runConsolidation(opts: RunOptions = {}): Promise<ConsolidationRun> {
  const started = Date.now();
  const model = defaultModel();
  const limit = opts.quota && opts.quota > 0 ? Math.floor(opts.quota) : quota();
  const idx = await loadIndex();
  const files = await listSessionFiles();
  const pending = await selectPending(files, idx, opts.since);
  const batch = pending.slice(0, limit);
  logger.info({ pending: pending.length, batch: batch.length, model }, "consolidation démarrée");

  let summarized = 0, failed = 0, skipped = 0, done = 0;
  const report = (current?: string): void => {
    opts.onProgress?.({ done, total: batch.length, summarized, skipped, failed, current } as RunProgress);
  };
  report();
  for (const { file, fp } of batch) {
    if (opts.shouldStop?.()) break; // arrêt coopératif (bouton Stop)
    const res = await summarizeOne(file, fp, model);
    if (res === null) { failed++; } // pas marqué → retenté au prochain run
    else {
      if (res === "empty") skipped++; else { await saveSummary(res); summarized++; }
      markProcessed(idx, file, fp);
    }
    done++;
    report(res && res !== "empty" ? res.project : undefined);
  }
  idx.lastRun = Date.now();
  await saveIndex(idx);
  await rebuildInsights();
  const run: ConsolidationRun = {
    scanned: files.length, pending: pending.length, summarized, failed, skipped,
    quota: limit, ms: Date.now() - started,
  };
  logger.info(run, "consolidation terminée");
  return run;
}
