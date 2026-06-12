// Serveur dashboard : sert le front React + l'API + un flux SSE temps réel. 100% local.
import index from "../../web/index.html";
import { runScan } from "../scan.ts";
import { loadState } from "../engine/state.ts";
import { watchSessions } from "./watch.ts";
import { logger } from "../logger.ts";
import type { ScanResult } from "../types.ts";

const PORT = Number(process.env.ARCADE_PORT ?? 4317);
const encoder = new TextEncoder();
const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

let cache: ScanResult | null = null;
let scanning: Promise<ScanResult> | null = null;

/** Scan mémoïsé : un seul scan concurrent, réutilisé entre requêtes. */
async function getScan(force = false): Promise<ScanResult> {
  if (!force && cache) return cache;
  if (!scanning) {
    scanning = runScan().then((r) => { cache = r; return r; }).finally(() => { scanning = null; });
  }
  return scanning;
}

function broadcast(result: ScanResult): void {
  const msg = encoder.encode(`event: update\ndata: ${JSON.stringify(result)}\n\n`);
  for (const c of clients) {
    try { c.enqueue(msg); } catch { clients.delete(c); }
  }
}

// Heartbeat : commentaire SSE périodique pour garder la connexion vivante côté navigateur,
// même quand un rescan tient l'event loop quelques centaines de ms.
const HEARTBEAT = encoder.encode(": keepalive\n\n");
setInterval(() => {
  for (const c of clients) {
    try { c.enqueue(HEARTBEAT); } catch { clients.delete(c); }
  }
}, 15_000);

/** Flux SSE : ping initial puis un event `update` à chaque rescan. */
function streamResponse(): Response {
  let ref: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) { ref = c; clients.add(c); c.enqueue(encoder.encode("event: ping\ndata: {}\n\n")); },
    cancel() { clients.delete(ref); },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}

const server = Bun.serve({
  port: PORT,
  development: { hmr: false },
  routes: {
    "/": index,
    "/api/achievements": async () => Response.json(await getScan()),
    "/api/recent": async () => Response.json((await loadState()).recent),
    "/api/rescan": { POST: async () => Response.json(await getScan(true)) },
    "/api/stream": () => streamResponse(),
  },
  error(err) {
    logger.error({ err }, "erreur serveur");
    return new Response("Internal Error", { status: 500 });
  },
});

// Throttle : au plus un rescan toutes les 8s même si l'activité est continue.
let lastRescan = 0;
watchSessions(() => {
  const now = Date.now();
  if (now - lastRescan < 8000) return;
  lastRescan = now;
  void getScan(true).then(broadcast);
});
logger.info({ url: `http://localhost:${server.port}` }, "claude-arcade dashboard en ligne");
void getScan();
