// Tests D.5 : persistance de la trace des injections (append en tête, cap 500, robustesse).
import { test, expect, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendInjection, loadInjections } from "../src/consolidate/store.ts";
import type { InjectionRecord } from "../src/consolidate/types.ts";

let dir: string | null = null;

async function withState(): Promise<string> {
  dir = await mkdtemp(join(tmpdir(), "arcade-inj-"));
  process.env.ARCADE_STATE_DIR = dir;
  return dir;
}

function record(over: Partial<InjectionRecord> = {}): InjectionRecord {
  return { at: 1, event: "session-start", cwd: "/p/a", categories: ["x"], charCount: 10, ...over };
}

afterEach(async () => {
  delete process.env.ARCADE_STATE_DIR;
  if (dir) { await rm(dir, { recursive: true, force: true }); dir = null; }
});

test("loadInjections : log absent → vide exploitable", async () => {
  await withState();
  const log = await loadInjections();
  expect(log.records).toEqual([]);
  expect(log.generatedAt).toBe(0);
});

test("appendInjection : 2 records, le plus récent en tête", async () => {
  await withState();
  await appendInjection(record({ at: 100, cwd: "/p/old" }));
  await appendInjection(record({ at: 200, cwd: "/p/new" }));
  const log = await loadInjections();
  expect(log.records).toHaveLength(2);
  expect(log.records[0]?.cwd).toBe("/p/new");
  expect(log.records[1]?.cwd).toBe("/p/old");
  expect(log.generatedAt).toBeGreaterThan(0);
});

test("appendInjection : cap à 500 records", async () => {
  await withState();
  for (let i = 0; i < 505; i++) await appendInjection(record({ at: i }));
  const log = await loadInjections();
  expect(log.records).toHaveLength(500);
  expect(log.records[0]?.at).toBe(504);
});
