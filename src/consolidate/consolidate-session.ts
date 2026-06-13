// Worker détaché de consolidation temps réel : consolide la session qui vient de se terminer.
// Lancé en arrière-plan par le hook SessionEnd (src/hooks/session-end.ts) pour ne pas retarder
// la fermeture du terminal. argv : <transcriptPath> <reason> <cwd>. Fail-safe : ne throw jamais.
import { basename } from "node:path";
import { consolidateSession } from "./run.ts";
import { acquireConsolidationLock, releaseConsolidationLock, appendSessionEvent } from "./store.ts";
import { logger } from "../logger.ts";

async function main(): Promise<void> {
  const file = process.argv[2];
  const reason = process.argv[3] ?? "other";
  const cwd = process.argv[4] ?? "";
  if (!file) return;
  const sessionId = basename(file, ".jsonl");

  if (!(await acquireConsolidationLock())) {
    logger.info({ file }, "session-end : lock occupé, session laissée au rattrapage systemd");
    return; // une autre consolidation tourne → systemd rattrapera
  }
  try {
    const { outcome, summary } = await consolidateSession(file);
    await appendSessionEvent({
      at: Date.now(),
      sessionId: summary?.sessionId ?? sessionId,
      project: summary?.project || cwd,
      reason,
      outcome,
      quality: summary?.quality_score,
    });
    logger.info({ file, outcome }, "session-end : consolidation temps réel terminée");
  } finally {
    await releaseConsolidationLock();
  }
}

try {
  await main();
} catch (err) {
  logger.error({ err }, "consolidate-session worker failed");
}
