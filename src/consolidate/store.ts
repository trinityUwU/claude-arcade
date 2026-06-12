// Persistance des résumés de session + index d'idempotence (zéro-perte, zéro-doublon).
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Glob } from "bun";
import { stateDir } from "../engine/state.ts";
import type { SessionSummary, ConsolidationIndex, Insights, GraphData } from "./types.ts";
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
