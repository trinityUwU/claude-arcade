// Job de consolidation manuelle : singleton non-concurrent, déclenché depuis l'app.
// Anti-concurrence (un seul run à la fois) · progression live · arrêt coopératif.
import { runConsolidation, countPending } from "./run.ts";
import type { ConsolidateStatus, ConsolidationRun, RunProgress } from "./types.ts";
import { logger } from "../logger.ts";

let running = false;
let stopRequested = false;
let progress: RunProgress | null = null;
let lastRun: ConsolidationRun | null = null;
let startedAt: number | null = null;
let finishedAt: number | null = null;

export function isRunning(): boolean {
  return running;
}

/** État courant : compte les sessions en attente (sauf si un run est en cours). */
export async function consolidateStatus(): Promise<ConsolidateStatus> {
  const pending = running ? (progress ? progress.total - progress.done : 0) : await countPending();
  return { running, pending, progress, lastRun, startedAt, finishedAt };
}

/** Démarre un run en arrière-plan. Retourne false si un run est déjà en cours. */
export function startConsolidation(quota?: number): boolean {
  if (running) return false;
  running = true;
  stopRequested = false;
  progress = null;
  startedAt = Date.now();
  finishedAt = null;

  void runConsolidation({
    quota,
    onProgress: (p) => { progress = p; },
    shouldStop: () => stopRequested,
  })
    .then((run) => { lastRun = run; logger.info(run, "consolidation manuelle terminée"); })
    .catch((err) => { logger.error({ err }, "consolidation manuelle échouée"); })
    .finally(() => { running = false; finishedAt = Date.now(); });

  return true;
}

/** Demande l'arrêt du run en cours (coopératif : s'arrête après la session courante). */
export function stopConsolidation(): boolean {
  if (!running) return false;
  stopRequested = true;
  return true;
}
