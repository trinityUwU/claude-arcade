// Serveur dashboard : sert le front React + l'API + un flux SSE temps réel.
// Accessible sur le LAN (lecture) ; les écritures dans ~/.claude restent réservées au localhost.
import { join, resolve } from "node:path";
import { networkInterfaces } from "node:os";
import type { Server } from "bun";
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
import { applyProposal } from "../config/apply.ts";
import { runEvolution } from "../config/evolve-job.ts";
import { assessRevisions } from "../config/revisions.ts";
import { revertCommit } from "../config/git.ts";
import { configRoot } from "../config/paths.ts";
import { auditConfig } from "../audit/report.ts";
import { deepAuditFile } from "../audit/deep.ts";
import { correctFile, applyUpgrade } from "../audit/upgrade.ts";
import { loadUpgrades } from "../audit/upgrade-store.ts";
import type { CoverageReport, ConfigEntry, AutoSettings, Proposal } from "../config/types.ts";
import { logger } from "../logger.ts";
import type { ScanResult } from "../types.ts";
import type { SchemaInstance } from "../consolidate/types.ts";
import type { ConfigFile } from "../config/types.ts";

const PORT = Number(process.env.ARCADE_PORT ?? 4317);
const HOST = process.env.ARCADE_HOST?.trim() || "0.0.0.0"; // toutes les interfaces (accès LAN)
// Garde-fou : les écritures dans ~/.claude ne sont permises qu'en local, sauf ouverture explicite.
const ALLOW_REMOTE_WRITES = process.env.ARCADE_ALLOW_REMOTE_WRITES === "1";
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

/** Liste fusionnée (détection live précise via scan + journal). Source des routes propositions. */
async function liveProposals(): Promise<Proposal[]> {
  const [{ report, entries }, principles, journal] = await Promise.all([
    coverageData(), loadPrinciples(), loadJournal(),
  ]);
  const live = buildGraduation(principles ?? { generatedAt: 0, domains: [] }, report, entries);
  return mergeWithJournal(live, journal);
}

async function configProposalsResponse(): Promise<Response> {
  return Response.json(await liveProposals());
}

/** Applique UNE proposition (action manuelle). 404 si l'id n'est plus un candidat pending. */
async function applyOneResponse(req: Request): Promise<Response> {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return Response.json({ error: "id requis" }, { status: 400 });
  const target = (await liveProposals()).find((p) => p.id === id && p.status === "pending");
  if (!target) return new Response("not found", { status: 404 });
  return Response.json(await applyProposal(target));
}

async function configSettingsResponse(req: Request): Promise<Response> {
  const patch = (await req.json().catch(() => ({}))) as Partial<AutoSettings>;
  return Response.json(await saveSettings(patch));
}

/** Flux SSE générique claude -p : events `delta` (texte live) puis `done`/`error`.
 *  Local-only (dépense de tokens). `run` reçoit le chemin + un onText et rend le résultat ou null. */
function claudeSSE<T>(
  req: Request, server: Server<unknown>,
  run: (path: string, onText: (t: string) => void) => Promise<T | null>,
): Response {
  if (!ALLOW_REMOTE_WRITES && !isLocalRequest(server, req)) return new Response("local only", { status: 403 });
  const path = new URL(req.url).searchParams.get("path");
  if (!path) return new Response("missing path", { status: 400 });
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      const send = (event: string, data: unknown): void => {
        c.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const result = await run(path, (text) => send("delta", { text }));
        if (result) send("done", result);
        else send("failed", { error: "analyse introuvable ou vide" });
      } catch (err) {
        send("failed", { error: String(err) });
      } finally { c.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}

/** Applique une correction au fichier (snapshot+commit+reset analyse). Local-only (écrit la config). */
async function upgradeResponse(req: Request): Promise<Response> {
  const { path, after, costUsd } = (await req.json().catch(() => ({}))) as { path?: string; after?: string; costUsd?: number };
  if (!path || !after) return Response.json({ error: "path et after requis" }, { status: 400 });
  return Response.json(await applyUpgrade(path, after, costUsd ?? 0));
}

/** Vrai si la requête vient de la machine locale (loopback). */
function isLocalRequest(server: Server<unknown>, req: Request): boolean {
  const ip = server.requestIP(req)?.address ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

/** 403 si une écriture config est tentée à distance (sauf ARCADE_ALLOW_REMOTE_WRITES=1). */
function denyRemoteWrite(server: Server<unknown>, req: Request): Response | null {
  if (ALLOW_REMOTE_WRITES || isLocalRequest(server, req)) return null;
  return new Response(
    "écriture config réservée au localhost (ARCADE_ALLOW_REMOTE_WRITES=1 pour ouvrir au réseau)",
    { status: 403 },
  );
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
  hostname: HOST,
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
      POST: async (req, server) => {
        const denied = denyRemoteWrite(server, req);
        if (denied) return denied;
        const body = (await req.json().catch(() => ({}))) as { classId?: string; banned?: boolean };
        if (!body.classId) return Response.json({ error: "classId requis" }, { status: 400 });
        return Response.json(await setBanned(body.classId, body.banned !== false));
      },
    },
    "/api/config/proposals": async () => configProposalsResponse(),
    "/api/config/proposals/apply": { POST: async (req, server) => denyRemoteWrite(server, req) ?? applyOneResponse(req) },
    "/api/config/evolve": {
      POST: async (req, server) =>
        denyRemoteWrite(server, req) ?? Response.json(await runEvolution((await getScan()).topSkills)),
    },
    "/api/config/revisions": async () => Response.json(assessRevisions(await loadJournal(), await loadAllSummaries())),
    "/api/config/revert": {
      POST: async (req, server) => {
        const denied = denyRemoteWrite(server, req);
        if (denied) return denied;
        const { hash } = (await req.json().catch(() => ({}))) as { hash?: string };
        if (!hash) return Response.json({ error: "hash requis" }, { status: 400 });
        return Response.json({ reverted: await revertCommit(hash) });
      },
    },
    "/api/config/settings": {
      GET: async () => Response.json(await loadSettings()),
      POST: async (req, server) => denyRemoteWrite(server, req) ?? configSettingsResponse(req),
    },
    "/api/audit": async () => Response.json(await auditConfig()),
    "/api/audit/deep/stream": (req, server) => claudeSSE(req, server, (p, onText) => deepAuditFile(p, onText)),
    "/api/audit/correct/stream": (req, server) => claudeSSE(req, server, (p, onText) => correctFile(p, onText)),
    "/api/audit/upgrade": { POST: async (req, server) => denyRemoteWrite(server, req) ?? upgradeResponse(req) },
    "/api/audit/upgrades": async (req) => Response.json(await loadUpgrades(new URL(req.url).searchParams.get("path") ?? "")),
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
/** Première IPv4 LAN non-loopback, pour afficher l'URL réseau au démarrage. */
function lanAddress(): string | null {
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const i of ifaces ?? []) {
      if (i.family === "IPv4" && !i.internal) return i.address;
    }
  }
  return null;
}

const lan = lanAddress();
logger.info(
  { local: `http://localhost:${server.port}`, lan: lan ? `http://${lan}:${server.port}` : "—", remoteWrites: ALLOW_REMOTE_WRITES },
  "claude-arcade dashboard en ligne (LAN : lecture ouverte, écritures config localhost-only sauf override)",
);
void getScan();
