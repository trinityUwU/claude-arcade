// Orchestrateur : transcripts → agrégat → achievements → score. Réutilisé par CLI et serveur.
import type { ScanResult, SessionStats } from "./types.ts";
import { listSessionFiles, readSession } from "./scanner/session-reader.ts";
import { analyzeSession } from "./scanner/metrics.ts";
import { aggregate } from "./scanner/aggregate.ts";
import { ACHIEVEMENTS } from "./engine/catalog.ts";
import { evaluate } from "./engine/evaluate.ts";
import { computeScore } from "./engine/score.ts";
import { loadState, saveState, reconcile } from "./engine/state.ts";
import { logger } from "./logger.ts";

const CONCURRENCY = 16;

/** Analyse les fichiers par lots bornés pour limiter la pression mémoire. */
async function analyzeAll(files: string[]): Promise<SessionStats[]> {
  const out: SessionStats[] = [];
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const chunk = files.slice(i, i + CONCURRENCY);
    const stats = await Promise.all(chunk.map(async (f) => analyzeSession(await readSession(f), f)));
    out.push(...stats);
  }
  return out;
}

export async function runScan(): Promise<ScanResult> {
  const started = Date.now();
  const files = await listSessionFiles();
  logger.info({ files: files.length }, "scan démarré");
  const sessions = await analyzeAll(files);
  const agg = aggregate(sessions);
  const achievements = ACHIEVEMENTS.map((a) => evaluate(a, agg));
  const score = computeScore(achievements);
  const state = await loadState();
  const fresh = reconcile(achievements, state);
  await saveState(state);
  logger.info({ ms: Date.now() - started, sessions: sessions.length, unlocked: score.unlockedCount, fresh: fresh.length }, "scan terminé");
  return { generatedAt: Date.now(), sessionCount: sessions.length, aggregate: agg, achievements, score };
}
