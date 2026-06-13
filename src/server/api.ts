// Serveur dashboard : sert le front React + l'API + un flux SSE temps réel. 100% local.
import { join, resolve } from "node:path";
import index from "../../web/index.html";
import { runScan } from "../scan.ts";
import { loadState, stateDir } from "../engine/state.ts";
import { loadInsights, loadGraph, loadAllSummaries, loadSummary, loadChampions, loadEvolution, loadInjections, loadSessionEvents, loadPrinciples, loadCanonicalRegistry, loadLearning } from "../consolidate/store.ts";
import { consolidateStatus, startConsolidation, stopConsolidation } from "../consolidate/job.ts";
import { judgeStatus, startJudging, stopJudging } from "../consolidate/judge-job.ts";
import { readSession } from "../scanner/session-reader.ts";
import { cleanTranscript } from "../consolidate/transcript-view.ts";
import { watchSessions } from "./watch.ts";
import { scanConfig } from "../config/scan.ts";
import { fileHistory } from "../config/git.ts";
import { buildCoverage } from "../config/coverage.ts";
import { loadBanned, setBanned } from "../config/banned.ts";
import { buildGraduation, mergeWithJournal } from "../config/graduation.ts";
import { loadJournal } from "../config/proposals-store.ts";
import { loadSettings, saveSettings } from "../config/settings.ts";
import { configRoot } from "../config/paths.ts";
import type { CoverageReport, ConfigEntry, AutoSettings } from "../config/types.ts";
import { logger } from "../logger.ts";
import type { ScanResult } from "../types.ts";
import type { SchemaInstance } from "../consolidate/types.ts";
import type { ConfigFile } from "../config/types.ts";

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

/** Un artefact n'est servable que s'il est sous le bucket des notes, ou référencé par une note. */
async function artifactAllowed(abs: string): Promise<boolean> {
  if (abs.startsWith(`${join(stateDir(), "session-notes")}/`)) return true;
  const sums = await loadAllSummaries();
  return sums.some((s) => (s.notes ?? []).some((n) => n.artifactPath === abs || n.archivedPath === abs));
}

/** Sert le contenu d'un artefact de note (vue dans le navigateur). Refuse tout chemin non référencé. */
async function artifactResponse(raw: string | null): Promise<Response> {
  if (!raw) return new Response("missing path", { status: 400 });
  const abs = resolve(raw);
  if (!(await artifactAllowed(abs))) return new Response("forbidden", { status: 403 });
  const f = Bun.file(abs);
  if (!(await f.exists())) return new Response("not found", { status: 404 });
  return new Response(f);
}

/** Contenu d'un fichier de config. Refuse tout chemin hors de la whitelist scannée (anti-traversal). */
async function configFileResponse(rel: string | null): Promise<Response> {
  if (!rel) return new Response("missing path", { status: 400 });
  const tree = await scanConfig();
  if (!tree.entries.some((e) => e.relPath === rel)) return new Response("forbidden", { status: 403 });
  const f = Bun.file(join(configRoot(), rel));
  if (!(await f.exists())) return new Response("not found", { status: 404 });
  return Response.json({ relPath: rel, content: await f.text() } satisfies ConfigFile);
}

/** Historique git d'un fichier de config (même garde whitelist que le contenu). */
async function configHistoryResponse(rel: string | null): Promise<Response> {
  if (!rel) return new Response("missing path", { status: 400 });
  const tree = await scanConfig();
  if (!tree.entries.some((e) => e.relPath === rel)) return new Response("forbidden", { status: 403 });
  return Response.json(await fileHistory(rel));
}

/** Couverture skills calculée à la demande depuis les données persistées + le scan (mémoïsé). */
async function coverageData(): Promise<{ report: CoverageReport; entries: ConfigEntry[] }> {
  const [scan, tree, summaries, registry, champions, banned] = await Promise.all([
    getScan(), scanConfig(), loadAllSummaries(), loadCanonicalRegistry(), loadChampions(), loadBanned(),
  ]);
  const report = buildCoverage(
    summaries, registry, champions ?? { generatedAt: 0, categories: [] }, scan.topSkills, tree.entries, banned,
  );
  return { report, entries: tree.entries };
}

async function configCoverageResponse(): Promise<Response> {
  return Response.json((await coverageData()).report);
}

/** Propositions d'évolution : détection live (graduation) fusionnée avec le journal persisté. */
async function configProposalsResponse(): Promise<Response> {
  const [{ report, entries }, principles, journal] = await Promise.all([
    coverageData(), loadPrinciples(), loadJournal(),
  ]);
  const live = buildGraduation(principles ?? { generatedAt: 0, domains: [] }, report, entries);
  return Response.json(mergeWithJournal(live, journal));
}

async function configSettingsResponse(req: Request): Promise<Response> {
  const patch = (await req.json().catch(() => ({}))) as Partial<AutoSettings>;
  return Response.json(await saveSettings(patch));
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
    "/api/skills": async () => Response.json((await getScan()).topSkills),
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
    "/api/canonical": async () => Response.json(await loadCanonicalRegistry()),
    "/api/learning": async () =>
      Response.json(
        (await loadLearning()) ?? {
          generatedAt: 0, recurringClasses: 0, improvingClasses: 0, worseningClasses: 0,
          avgFitnessDelta: 0, avgTurnsDelta: 0, injectedEncounters: 0, injectionLift: null, curves: [],
        },
      ),
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
    "/api/artifact": async (req) => artifactResponse(new URL(req.url).searchParams.get("path")),
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
    "/api/config": async () => Response.json(await scanConfig()),
    "/api/config/file": async (req) => configFileResponse(new URL(req.url).searchParams.get("path")),
    "/api/config/history": async (req) => configHistoryResponse(new URL(req.url).searchParams.get("path")),
    "/api/config/coverage": async () => configCoverageResponse(),
    "/api/config/banned": {
      GET: async () => Response.json(await loadBanned()),
      POST: async (req) => {
        const body = (await req.json().catch(() => ({}))) as { classId?: string; banned?: boolean };
        if (!body.classId) return Response.json({ error: "classId requis" }, { status: 400 });
        return Response.json(await setBanned(body.classId, body.banned !== false));
      },
    },
    "/api/config/proposals": async () => configProposalsResponse(),
    "/api/config/settings": {
      GET: async () => Response.json(await loadSettings()),
      POST: async (req) => configSettingsResponse(req),
    },
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
