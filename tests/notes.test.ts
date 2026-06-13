// Tests Bridge : bucket de notes (roundtrip), rattachement par fenêtre, rendu digest.
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendNote, readBucketNotes, cwdHash } from "../src/notes/store.ts";
import { loadNotesForSession, renderNotesSection } from "../src/consolidate/session-notes.ts";
import type { SessionNote } from "../src/notes/types.ts";

const CWD = "/p/projet-x";
let dir = "";
const prevStateDir = process.env.ARCADE_STATE_DIR;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "arcade-notes-"));
  process.env.ARCADE_STATE_DIR = dir;
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
  if (prevStateDir === undefined) delete process.env.ARCADE_STATE_DIR;
  else process.env.ARCADE_STATE_DIR = prevStateDir;
});

function note(over: Partial<SessionNote>): SessionNote {
  return { at: 1000, kind: "note", text: "x", ...over };
}

test("cwdHash : stable et court", () => {
  expect(cwdHash(CWD)).toBe(cwdHash(CWD));
  expect(cwdHash(CWD)).toHaveLength(16);
  expect(cwdHash(CWD)).not.toBe(cwdHash("/autre"));
});

test("appendNote → readBucketNotes : roundtrip", async () => {
  await appendNote(CWD, note({ at: 5000, kind: "decision", text: "choix A" }));
  await appendNote(CWD, note({ at: 6000, kind: "stack", text: "bun", tags: ["t"] }));
  const all = await readBucketNotes(CWD);
  expect(all).toHaveLength(2);
  expect(all[1]!.tags).toEqual(["t"]);
});

test("loadNotesForSession : filtre par fenêtre [start,end] avec marge", async () => {
  const c = "/p/window";
  await appendNote(c, note({ at: 1_000_000, text: "avant" }));      // hors fenêtre
  await appendNote(c, note({ at: 5_000_000, text: "dedans" }));     // dans la fenêtre
  await appendNote(c, note({ at: 9_000_000, text: "après" }));      // hors fenêtre
  const got = await loadNotesForSession(c, 4_900_000, 5_100_000);
  expect(got.map((n) => n.text)).toEqual(["dedans"]);
});

test("loadNotesForSession : startTs=0 → aucun rattachement", async () => {
  expect(await loadNotesForSession(CWD, 0, 999)).toEqual([]);
});

test("renderNotesSection : vide → chaîne vide ; sinon en-tête haute fiabilité", () => {
  expect(renderNotesSection([])).toBe("");
  const out = renderNotesSection([note({ kind: "decision", text: "X", artifactPath: "/a.html" })]);
  expect(out).toContain("NOTES TEMPS RÉEL");
  expect(out).toContain("[decision]");
  expect(out).toContain("[artefact: /a.html]");
});
