// Surveille les transcripts : détecte toute nouvelle activité de session (temps réel).
import { stat } from "node:fs/promises";
import { listSessionFiles } from "../scanner/session-reader.ts";
import { logger } from "../logger.ts";

async function maxMtime(): Promise<number> {
  const files = await listSessionFiles();
  const times = await Promise.all(files.map(async (f) => {
    try { return (await stat(f)).mtimeMs; } catch { return 0; }
  }));
  return times.reduce((a, b) => Math.max(a, b), 0);
}

/** Appelle onChange quand un transcript est modifié/créé. Retourne un disposer. */
export function watchSessions(onChange: () => void, intervalMs = 4000): () => void {
  let last = 0;
  let stopped = false;
  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const mx = await maxMtime();
      if (last && mx > last) {
        logger.info("activité de session détectée → rescan");
        onChange();
      }
      last = mx;
    } catch (err) {
      logger.error({ err }, "watch tick failed");
    }
  };
  const timer = setInterval(() => void tick(), intervalMs);
  void tick();
  return () => { stopped = true; clearInterval(timer); };
}
