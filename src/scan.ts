// Orchestrateur : transcripts → agrégat → achievements → score. Réutilisé par CLI et serveur.
import type { ScanResult } from "./types.ts";
import { listSessionFiles } from "./scanner/session-reader.ts";
import { scanIncremental } from "./scanner/cache.ts";
import { aggregate, rankSkills } from "./scanner/aggregate.ts";
import { ACHIEVEMENTS } from "./engine/catalog.ts";
import { evaluate } from "./engine/evaluate.ts";
import { computeScore } from "./engine/score.ts";
import { loadState, saveState, reconcile } from "./engine/state.ts";
import { logger } from "./logger.ts";

export async function runScan(): Promise<ScanResult> {
  const started = Date.now();
  const files = await listSessionFiles();
  const { sessions, parsed, reused } = await scanIncremental(files);
  const agg = aggregate(sessions);
  const achievements = ACHIEVEMENTS.map((a) => evaluate(a, agg));
  const score = computeScore(achievements);
  const state = await loadState();
  const fresh = reconcile(achievements, state);
  await saveState(state);
  logger.info(
    { ms: Date.now() - started, sessions: sessions.length, parsed, reused, fresh: fresh.length },
    "scan terminé",
  );
  return {
    generatedAt: Date.now(), sessionCount: sessions.length, aggregate: agg,
    achievements, score, topSkills: rankSkills(sessions),
  };
}
