// CLI de consolidation : `bun run consolidate`. Résume un lot de sessions en attente.
// Mode auto (ARCADE_AUTO=1, utilisé par le timer systemd) : ne traite que les sessions
// postérieures au watermark = zéro rattrapage. Sans le flag, traite tout le backlog (manuel).
import { runConsolidation } from "./run.ts";
import { loadWatermark, saveWatermark } from "./store.ts";
import { logger } from "../logger.ts";

const C = { dim: "\x1b[38;5;245m", b: "\x1b[1m", g: "\x1b[38;5;42m", r: "\x1b[38;5;203m", x: "\x1b[0m" };

try {
  let since: number | undefined;
  if (process.env.ARCADE_AUTO === "1") {
    const wm = await loadWatermark();
    if (wm == null) {
      const now = Date.now();
      await saveWatermark(now);
      logger.info({ since: now }, "watermark auto initialisé — baseline posée, aucun rattrapage");
      process.exit(0);
    }
    since = wm;
  }
  const run = await runConsolidation({ since });
  const line = [
    `${C.b}${run.summarized}${C.x} résumées`,
    `${run.skipped} sautées`,
    run.failed ? `${C.r}${run.failed} échecs${C.x}` : `${run.failed} échecs`,
    `${C.dim}reste ${run.pending - run.summarized - run.skipped - run.failed} en attente${C.x}`,
  ].join(`  ${C.dim}|${C.x}  `);
  process.stdout.write(`\n${C.g}Consolidation${C.x}  ${line}  ${C.dim}(${(run.ms / 1000).toFixed(1)}s)${C.x}\n\n`);
} catch (err) {
  logger.error({ err }, "consolidation CLI failed");
  process.exit(1);
}
