// Migration one-shot : redate les résumés existants avec la date RÉELLE de session
// (1er timestamp du transcript) au lieu de summarizedAt, puis reconstruit insights/champions/évolution.
// Usage : bun run src/consolidate/redate-summaries.ts
import { readSession } from "../scanner/session-reader.ts";
import { loadAllSummaries, saveSummary } from "./store.ts";
import { rebuildInsights } from "./run.ts";
import type { SessionSummary } from "./types.ts";
import type { TranscriptLine } from "../types.ts";
import { logger } from "../logger.ts";

interface RedateStats {
  redated: number;
  alreadyOk: number;
  noTimestamp: number;
}

/** Premier timestamp valide d'un transcript (même logique que digestTranscript). 0 si aucun. */
function firstTimestamp(lines: TranscriptLine[]): number {
  for (const line of lines) {
    if (line.isSidechain) continue;
    if (line.type !== "user" && line.type !== "assistant") continue;
    if (!line.timestamp) continue;
    const ts = Date.parse(line.timestamp);
    if (Number.isFinite(ts) && ts > 0) return ts;
  }
  return 0;
}

/** Recalcule startTs d'un résumé depuis son transcript. Retourne 0 si illisible/absent. */
async function resolveStartTs(summary: SessionSummary): Promise<number> {
  try {
    return firstTimestamp(await readSession(summary.file));
  } catch (err) {
    logger.error({ err, id: summary.sessionId }, "redate: lecture transcript échouée");
    return 0;
  }
}

/** Redate un résumé si nécessaire ; met à jour les stats. */
async function redateOne(summary: SessionSummary, stats: RedateStats): Promise<void> {
  if (summary.startTs && summary.startTs > 0) { stats.alreadyOk += 1; return; }
  const startTs = await resolveStartTs(summary);
  if (!startTs) { stats.noTimestamp += 1; return; }
  await saveSummary({ ...summary, startTs });
  stats.redated += 1;
}

async function redateAll(): Promise<RedateStats> {
  const stats: RedateStats = { redated: 0, alreadyOk: 0, noTimestamp: 0 };
  const summaries = await loadAllSummaries();
  logger.info({ total: summaries.length }, "redate: démarrage");
  for (const summary of summaries) {
    try {
      await redateOne(summary, stats);
    } catch (err) {
      logger.error({ err, id: summary.sessionId }, "redate: session ignorée");
    }
  }
  return stats;
}

async function main(): Promise<void> {
  const stats = await redateAll();
  await rebuildInsights();
  logger.info(stats, "redate: terminé");
  process.stdout.write(
    `Redatés: ${stats.redated} · Déjà ok: ${stats.alreadyOk} · Sans timestamp: ${stats.noTimestamp}\n`,
  );
}

main().catch((err) => {
  logger.error({ err }, "redate: échec fatal");
  process.exit(1);
});
