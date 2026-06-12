// Serveur dashboard : sert le front React + l'API d'achievements. 100% local.
import index from "../../web/index.html";
import { runScan } from "../scan.ts";
import { loadState } from "../engine/state.ts";
import { logger } from "../logger.ts";
import type { ScanResult } from "../types.ts";

const PORT = Number(process.env.ARCADE_PORT ?? 4317);

let cache: ScanResult | null = null;
let scanning: Promise<ScanResult> | null = null;

/** Scan mémoïsé : un seul scan concurrent, réutilisé entre requêtes. */
async function getScan(force = false): Promise<ScanResult> {
  if (!force && cache) return cache;
  if (!scanning) {
    scanning = runScan()
      .then((r) => { cache = r; return r; })
      .finally(() => { scanning = null; });
  }
  return scanning;
}

const server = Bun.serve({
  port: PORT,
  development: { hmr: false },
  routes: {
    "/": index,
    "/api/achievements": async () => Response.json(await getScan()),
    "/api/recent": async () => Response.json((await loadState()).recent),
    "/api/rescan": { POST: async () => Response.json(await getScan(true)) },
  },
  error(err) {
    logger.error({ err }, "erreur serveur");
    return new Response("Internal Error", { status: 500 });
  },
});

logger.info({ url: `http://localhost:${server.port}` }, "claude-arcade dashboard en ligne");
void getScan(); // préchauffe le cache au démarrage
