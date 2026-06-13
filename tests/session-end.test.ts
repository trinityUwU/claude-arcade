// Tests Couche 3 — temps réel : lock de consolidation (anti-concurrence) + trace SessionEnd.
import { test, expect, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acquireConsolidationLock, releaseConsolidationLock,
  appendSessionEvent, loadSessionEvents,
} from "../src/consolidate/store.ts";
import type { SessionEndEvent } from "../src/consolidate/types.ts";

let dir: string | null = null;

async function withState(): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), "arcade-se-"));
  process.env.ARCADE_STATE_DIR = dir;
  return dir;
}

function event(over: Partial<SessionEndEvent> = {}): SessionEndEvent {
  return { at: 1, sessionId: "s1", project: "/p/a", reason: "other", outcome: "consolidated", ...over };
}

afterEach(async () => {
  await releaseConsolidationLock();
  delete process.env.ARCADE_STATE_DIR;
  if (dir) { await rm(dir, { recursive: true, force: true }); dir = null; }
});

test("lock : acquisition exclusive puis libération", async () => {
  await withState();
  expect(await acquireConsolidationLock()).toBe(true);
  expect(await acquireConsolidationLock()).toBe(false); // déjà détenu
  await releaseConsolidationLock();
  expect(await acquireConsolidationLock()).toBe(true); // de nouveau libre
});

test("loadSessionEvents : trace absente → vide exploitable", async () => {
  await withState();
  const log = await loadSessionEvents();
  expect(log.records).toEqual([]);
  expect(log.generatedAt).toBe(0);
});

test("appendSessionEvent : le plus récent en tête, quality conservée", async () => {
  await withState();
  await appendSessionEvent(event({ at: 100, sessionId: "old" }));
  await appendSessionEvent(event({ at: 200, sessionId: "new", outcome: "consolidated", quality: 87 }));
  const log = await loadSessionEvents();
  expect(log.records).toHaveLength(2);
  expect(log.records[0]?.sessionId).toBe("new");
  expect(log.records[0]?.quality).toBe(87);
  expect(log.records[1]?.sessionId).toBe("old");
});

test("appendSessionEvent : cap à 500", async () => {
  await withState();
  for (let i = 0; i < 505; i++) await appendSessionEvent(event({ at: i }));
  const log = await loadSessionEvents();
  expect(log.records).toHaveLength(500);
  expect(log.records[0]?.at).toBe(504);
});
