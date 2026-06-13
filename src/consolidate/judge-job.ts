// Job de jugement des principes : singleton non-concurrent, déclenché depuis l'app.
// Le jugement appelle le LLM (coûteux) → jamais automatique, toujours sur action de Chris.
import { judgePrinciples, judgeCounts } from "./principle-judge.ts";
import type { JudgeStatus } from "./types.ts";
import { logger } from "../logger.ts";

let running = false;
let stopRequested = false;
let judged = 0;
let startedAt: number | null = null;
let finishedAt: number | null = null;

export async function judgeStatus(): Promise<JudgeStatus> {
  const counts = running ? { eligible: 0, pending: 0 } : await judgeCounts();
  return { running, eligible: counts.eligible, pending: counts.pending, judged, startedAt, finishedAt };
}

/** Démarre un run de jugement en arrière-plan. Retourne false si un run est déjà en cours. */
export function startJudging(): boolean {
  if (running) return false;
  running = true;
  stopRequested = false;
  judged = 0;
  startedAt = Date.now();
  finishedAt = null;

  void judgePrinciples({
    onProgress: (done) => { judged = done; },
    shouldStop: () => stopRequested,
  })
    .then((r) => { judged = r.judged; logger.info(r, "jugement manuel terminé"); })
    .catch((err) => { logger.error({ err }, "jugement manuel échoué"); })
    .finally(() => { running = false; finishedAt = Date.now(); });

  return true;
}

export function stopJudging(): boolean {
  if (!running) return false;
  stopRequested = true;
  return true;
}
