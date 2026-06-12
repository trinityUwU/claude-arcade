// Cache incrémental du scan : ne re-parse que les transcripts modifiés (fingerprint mtime+size).
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SessionStats } from "../types.ts";
import { stateDir } from "../engine/state.ts";
import { fileFingerprint } from "./fingerprint.ts";
import { readSession } from "./session-reader.ts";
import { analyzeSession } from "./metrics.ts";
import { logger } from "../logger.ts";

interface CacheEntry { fp: string; stats: SessionStats }
export interface IncResult { sessions: SessionStats[]; parsed: number; reused: number }

const CACHE_VERSION = 1;
const PARSE_CONCURRENCY = 16;

const mem = new Map<string, CacheEntry>();
let loaded = false;

function cachePath(): string {
  return join(stateDir(), "scan-cache.json");
}

async function loadDisk(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const f = Bun.file(cachePath());
    if (!(await f.exists())) return;
    const data = (await f.json()) as { version?: number; entries?: Record<string, CacheEntry> };
    if (data.version !== CACHE_VERSION || !data.entries) return;
    for (const [file, entry] of Object.entries(data.entries)) mem.set(file, entry);
    logger.info({ entries: mem.size }, "scan cache chargé");
  } catch (err) {
    logger.error({ err }, "loadDisk cache failed — repart à vide");
  }
}

async function saveDisk(): Promise<void> {
  try {
    await mkdir(stateDir(), { recursive: true });
    const payload = JSON.stringify({ version: CACHE_VERSION, entries: Object.fromEntries(mem) });
    await Bun.write(cachePath(), payload);
  } catch (err) {
    logger.error({ err }, "saveDisk cache failed");
  }
}

async function parseOne(file: string, fp: string): Promise<void> {
  const stats = analyzeSession(await readSession(file), file);
  mem.set(file, { fp, stats });
}

function evictDisappeared(present: Set<string>): void {
  for (const key of [...mem.keys()]) {
    if (!present.has(key)) mem.delete(key);
  }
}

/** Analyse incrémentale : réutilise les sessions inchangées, ne re-parse que le delta. */
export async function scanIncremental(files: string[]): Promise<IncResult> {
  await loadDisk();
  const fps = await Promise.all(files.map(async (f) => [f, await fileFingerprint(f)] as const));
  evictDisappeared(new Set(files));

  const todo: Array<readonly [string, string]> = [];
  for (const [file, fp] of fps) {
    if (!fp) continue;
    const hit = mem.get(file);
    if (!hit || hit.fp !== fp) todo.push([file, fp]);
  }
  for (let i = 0; i < todo.length; i += PARSE_CONCURRENCY) {
    const chunk = todo.slice(i, i + PARSE_CONCURRENCY);
    await Promise.all(chunk.map(([file, fp]) => parseOne(file, fp)));
  }
  if (todo.length) await saveDisk();

  const sessions: SessionStats[] = [];
  for (const [file, fp] of fps) {
    if (!fp) continue;
    const hit = mem.get(file);
    if (hit) sessions.push(hit.stats);
  }
  return { sessions, parsed: todo.length, reused: sessions.length - todo.length };
}
