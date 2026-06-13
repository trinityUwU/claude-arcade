// Persistance des résumés de session + index d'idempotence (zéro-perte, zéro-doublon).
import { mkdir, open, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Glob } from "bun";
import { stateDir } from "../engine/state.ts";
import type {
  SessionSummary, ConsolidationIndex, Insights, GraphData, ChampionsData,
  EvolutionData, InjectionRecord, InjectionLog, SessionEndEvent, SessionEndLog,
  PrinciplesData, JudgmentsData, CanonicalRegistry,
} from "./types.ts";
import { emptyRegistry } from "./canonical.ts";
import { logger } from "../logger.ts";

const INDEX_VERSION = 1;

function sessionsDir(): string {
  return join(stateDir(), "sessions");
}
function indexPath(): string {
  return join(stateDir(), "last-consolidation.json");
}
function summaryPath(sessionId: string): string {
  return join(sessionsDir(), `${sessionId}.json`);
}

export async function loadIndex(): Promise<ConsolidationIndex> {
  try {
    const f = Bun.file(indexPath());
    if (await f.exists()) {
      const idx = (await f.json()) as ConsolidationIndex;
      if (idx.schemaVersion === INDEX_VERSION && idx.processed) return idx;
    }
  } catch (err) {
    logger.error({ err }, "loadIndex failed — repart d'un index vide");
  }
  return { schemaVersion: INDEX_VERSION, lastRun: 0, processed: {} };
}

export async function saveIndex(idx: ConsolidationIndex): Promise<void> {
  try {
    await mkdir(stateDir(), { recursive: true });
    await Bun.write(indexPath(), JSON.stringify(idx, null, 2));
  } catch (err) {
    logger.error({ err }, "saveIndex failed");
  }
}

export async function loadSummary(sessionId: string): Promise<SessionSummary | null> {
  try {
    const f = Bun.file(summaryPath(sessionId));
    if (await f.exists()) return (await f.json()) as SessionSummary;
  } catch (err) {
    logger.error({ err, sessionId }, "loadSummary failed");
  }
  return null;
}

export async function saveSummary(summary: SessionSummary): Promise<void> {
  try {
    await mkdir(sessionsDir(), { recursive: true });
    await Bun.write(summaryPath(summary.sessionId), JSON.stringify(summary, null, 2));
  } catch (err) {
    logger.error({ err, id: summary.sessionId }, "saveSummary failed");
  }
}

/** Vrai si la session a déjà été traitée pour cette empreinte exacte (inchangée). */
export function isProcessed(idx: ConsolidationIndex, file: string, fp: string): boolean {
  return idx.processed[file]?.fingerprint === fp;
}

export function markProcessed(idx: ConsolidationIndex, file: string, fp: string): void {
  idx.processed[file] = { fingerprint: fp, at: Date.now() };
}

function insightsPath(): string {
  return join(stateDir(), "insights.json");
}
function graphPath(): string {
  return join(stateDir(), "graph.json");
}
function championsPath(): string {
  return join(stateDir(), "champions.json");
}
function evolutionPath(): string {
  return join(stateDir(), "evolution.json");
}
function principlesPath(): string {
  return join(stateDir(), "principles.json");
}
function judgmentsPath(): string {
  return join(stateDir(), "judgments.json");
}
function canonicalPath(): string {
  return join(stateDir(), "canonical-classes.json");
}

async function writeJson(path: string, data: unknown, label: string): Promise<void> {
  try {
    await mkdir(stateDir(), { recursive: true });
    await Bun.write(path, JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error({ err }, `${label} failed`);
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const f = Bun.file(path);
    if (await f.exists()) return (await f.json()) as T;
  } catch (err) {
    logger.error({ err, path }, "readJson failed");
  }
  return null;
}

export const saveInsights = (i: Insights): Promise<void> => writeJson(insightsPath(), i, "saveInsights");
export const saveGraph = (g: GraphData): Promise<void> => writeJson(graphPath(), g, "saveGraph");
export const loadInsights = (): Promise<Insights | null> => readJson<Insights>(insightsPath());
export const loadGraph = (): Promise<GraphData | null> => readJson<GraphData>(graphPath());
export const saveChampions = (c: ChampionsData): Promise<void> => writeJson(championsPath(), c, "saveChampions");
export const loadChampions = (): Promise<ChampionsData | null> => readJson<ChampionsData>(championsPath());
export const saveEvolution = (e: EvolutionData): Promise<void> => writeJson(evolutionPath(), e, "saveEvolution");
export const loadEvolution = (): Promise<EvolutionData | null> => readJson<EvolutionData>(evolutionPath());
export const savePrinciples = (p: PrinciplesData): Promise<void> => writeJson(principlesPath(), p, "savePrinciples");
export const loadPrinciples = (): Promise<PrinciplesData | null> => readJson<PrinciplesData>(principlesPath());
export const saveJudgments = (j: JudgmentsData): Promise<void> => writeJson(judgmentsPath(), j, "saveJudgments");
export async function loadJudgments(): Promise<JudgmentsData> {
  const j = await readJson<JudgmentsData>(judgmentsPath());
  return j && j.byDomain ? j : { generatedAt: 0, byDomain: {} };
}

export const saveCanonicalRegistry = (r: CanonicalRegistry): Promise<void> =>
  writeJson(canonicalPath(), r, "saveCanonicalRegistry");
export async function loadCanonicalRegistry(): Promise<CanonicalRegistry> {
  const r = await readJson<CanonicalRegistry>(canonicalPath());
  return r && Array.isArray(r.classes) ? r : emptyRegistry();
}

// Trace des injections de champions dans le contexte des sessions (visible dans l'app).
const INJECTION_CAP = 500;
function injectionsPath(): string {
  return join(stateDir(), "injections.json");
}
export async function loadInjections(): Promise<InjectionLog> {
  const log = await readJson<InjectionLog>(injectionsPath());
  return log && Array.isArray(log.records) ? log : { generatedAt: 0, records: [] };
}
export async function appendInjection(rec: InjectionRecord): Promise<void> {
  const log = await loadInjections();
  const records = [rec, ...log.records].slice(0, INJECTION_CAP);
  await writeJson(injectionsPath(), { generatedAt: Date.now(), records }, "appendInjection");
}

// Trace des consolidations temps réel déclenchées par le hook SessionEnd (visible dans l'app).
const SESSION_EVENT_CAP = 500;
function sessionEventsPath(): string {
  return join(stateDir(), "session-events.json");
}
export async function loadSessionEvents(): Promise<SessionEndLog> {
  const log = await readJson<SessionEndLog>(sessionEventsPath());
  return log && Array.isArray(log.records) ? log : { generatedAt: 0, records: [] };
}
export async function appendSessionEvent(ev: SessionEndEvent): Promise<void> {
  const log = await loadSessionEvents();
  const records = [ev, ...log.records].slice(0, SESSION_EVENT_CAP);
  await writeJson(sessionEventsPath(), { generatedAt: Date.now(), records }, "appendSessionEvent");
}

// Lock fichier global : sérialise les consolidations concurrentes (plusieurs hooks SessionEnd
// détachés en parallèle écriraient l'index/champions en même temps). Un lock périmé (process
// mort) au-delà du TTL est forcé. Échec d'acquisition = la session sera rattrapée par systemd.
const LOCK_TTL_MS = 3 * 60_000;
function lockPath(): string {
  return join(stateDir(), "consolidation.lock");
}
export async function acquireConsolidationLock(): Promise<boolean> {
  const path = lockPath();
  try { await mkdir(stateDir(), { recursive: true }); } catch { /* créé par ailleurs */ }
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fh = await open(path, "wx"); // O_EXCL : échoue atomiquement si le lock existe
      await fh.writeFile(String(process.pid));
      await fh.close();
      return true;
    } catch {
      try {
        const st = await stat(path);
        if (Date.now() - st.mtimeMs > LOCK_TTL_MS) { await unlink(path); continue; } // périmé → reprise
      } catch { continue; } // lock disparu entre-temps → on retente
      return false; // lock vivant détenu par un autre process
    }
  }
  return false;
}
export async function releaseConsolidationLock(): Promise<void> {
  try { await unlink(lockPath()); } catch { /* déjà libéré */ }
}

// Watermark du mode auto : les sessions antérieures sont laissées au déclenchement manuel.
function watermarkPath(): string {
  return join(stateDir(), "auto-watermark.json");
}
export async function loadWatermark(): Promise<number | null> {
  const w = await readJson<{ since: number }>(watermarkPath());
  return w && Number.isFinite(w.since) ? w.since : null;
}
export async function saveWatermark(since: number): Promise<void> {
  await writeJson(watermarkPath(), { since }, "saveWatermark");
}

/** Charge tous les résumés persistés (pour les couches 2-4). */
export async function loadAllSummaries(): Promise<SessionSummary[]> {
  const out: SessionSummary[] = [];
  const glob = new Glob("*.json");
  try {
    for await (const rel of glob.scan({ cwd: sessionsDir(), absolute: true })) {
      try { out.push((await Bun.file(rel).json()) as SessionSummary); } catch { /* fichier corrompu */ }
    }
  } catch {
    // dossier absent = aucun résumé encore
  }
  return out;
}
