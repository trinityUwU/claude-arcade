// Serveur dashboard : sert le front React + l'API + un flux SSE temps réel. 100% local.
import index from "../../web/index.html";
import { runScan } from "../scan.ts";
import { loadState } from "../engine/state.ts";
import { loadInsights, loadGraph, loadAllSummaries, loadSummary, loadChampions, loadEvolution, loadInjections, loadSessionEvents, loadPrinciples } from "../consolidate/store.ts";
import { consolidateStatus, startConsolidation, stopConsolidation } from "../consolidate/job.ts";
import { judgeStatus, startJudging, stopJudging } from "../consolidate/judge-job.ts";
import { readSession } from "../scanner/session-reader.ts";
import { cleanTranscript } from "../consolidate/transcript-view.ts";
import { watchSessions } from "./watch.ts";
import { logger } from "../logger.ts";
import type { ScanResult } from "../types.ts";
import type { SchemaInstance } from "../consolidate/types.ts";

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

/** Lit le transcript d'une session (via le chemin stocké dans son résumé) et le nettoie. */
async function transcriptResponse(id: string): Promise<Response> {
  const summary = await loadSummary(id);
  if (!summary) return new Response("not found", { status: 404 });
  const view = cleanTranscript(await readSession(summary.file));
  return Response.json(view);
}

/** Renvoie l'entrée champion d'une catégorie, ou 404 si absente. */
async function championResponse(category: string): Promise<Response> {
  const data = await loadChampions();
  const entry = data?.categories.find((c) => c.category === category);
  return entry ? Response.json(entry) : new Response("not found", { status: 404 });
}

/** Liste plate de tous les problèmes (contenders), triée par date décroissante. */
async function problemsResponse(): Promise<Response> {
  const data = await loadChampions();
  if (!data) return Response.json([] as SchemaInstance[]);
  const flat = data.categories.flatMap((c) => c.contenders);
  flat.sort((a, b) => b.at - a.at);
  return Response.json(flat);
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
    "/api/insights": async () => Response.json((await loadInsights()) ?? { sessionCount: 0, projects: [] }),
    "/api/graph": async () => Response.json((await loadGraph()) ?? { nodes: [], edges: [], generatedAt: 0 }),
    "/api/sessions": async () => Response.json(await loadAllSummaries()),
    "/api/session/:id": async (req) => {
      const s = await loadSummary(req.params.id);
      return s ? Response.json(s) : new Response("not found", { status: 404 });
    },
    "/api/champions": async () =>
      Response.json((await loadChampions()) ?? { generatedAt: 0, categories: [] }),
    "/api/champions/:category": async (req) => championResponse(req.params.category),
    "/api/problems": async () => problemsResponse(),
    "/api/evolution": async () =>
      Response.json(
        (await loadEvolution()) ?? {
          generatedAt: 0, buckets: [], overallRecurrenceRate: 0,
          recurrenceTrend: "flat", avgChampionFitness: 0, fitnessTrend: "flat",
        },
      ),
    "/api/principles": async () =>
      Response.json((await loadPrinciples()) ?? { generatedAt: 0, domains: [] }),
    "/api/principles/judge/status": async () => Response.json(await judgeStatus()),
    "/api/principles/judge": {
      POST: () => {
        const started = startJudging();
        return started
          ? Response.json({ started: true })
          : Response.json({ error: "déjà en cours" }, { status: 409 });
      },
    },
    "/api/principles/judge/stop": { POST: () => Response.json({ stopped: stopJudging() }) },
    "/api/injections": async () => Response.json(await loadInjections()),
    "/api/session-events": async () => Response.json(await loadSessionEvents()),
    "/api/transcript/:id": async (req) => transcriptResponse(req.params.id),
    "/api/consolidate/status": async () => Response.json(await consolidateStatus()),
    "/api/consolidate": {
      POST: async (req) => {
        const body = (await req.json().catch(() => ({}))) as { quota?: number };
        const started = startConsolidation(body.quota);
        if (!started) return Response.json({ error: "déjà en cours" }, { status: 409 });
        return Response.json(await consolidateStatus());
      },
    },
    "/api/consolidate/stop": { POST: () => Response.json({ stopped: stopConsolidation() }) },
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
