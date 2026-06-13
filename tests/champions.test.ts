// Tests Couche 2 : fitness composite + élection des champions par catégorie.
import { test, expect } from "bun:test";
import { computeFitness } from "../src/consolidate/fitness.ts";
import { buildChampions } from "../src/consolidate/champions.ts";
import type {
  SessionSummary, Problem, ResolutionSchema, ResolutionOutcome,
} from "../src/consolidate/types.ts";

function schema(over: Partial<ResolutionSchema> = {}): ResolutionSchema {
  return {
    steps: [], tools_used: [], turns_to_resolve: 1, backtracks: 0,
    tool_errors: 0, outcome: "resolved", ...over,
  };
}

function problem(over: Partial<Problem> = {}): Problem {
  return {
    id: "p1", description: "desc", category: "build error tsc",
    severity: "minor", resolution_schema: schema(), ...over,
  };
}

function summary(over: Partial<SessionSummary>): SessionSummary {
  return {
    project: "/p/a", topic: "t", wins: [], errors_claude: [], errors_chris: [],
    decisions: [], quality_score: 50, links_hint: [],
    difficulty: { level: "medium", why: "" }, problems: [], principles: [],
    sessionId: Math.random().toString(36).slice(2), file: "f", fingerprint: "1:1",
    model: "sonnet", startTs: 0, endTs: 0, notes: [], summarizedAt: 0, schemaVersion: 1, ...over,
  };
}

test("computeFitness : schéma parfait approche 1", () => {
  const f = computeFitness(schema({ turns_to_resolve: 1, backtracks: 0, tool_errors: 0, outcome: "resolved" }), 100);
  expect(f).toBeCloseTo(1, 5);
});

test("computeFitness : schéma médiocre est bas", () => {
  // trivial qui dérape largement hors budget (10 tours, 6 retours) + basse qualité
  const f = computeFitness(schema({ turns_to_resolve: 10, backtracks: 6, tool_errors: 4, outcome: "resolved" }), 30, "trivial");
  expect(f).toBeLessThan(0.4);
  expect(f).toBeGreaterThan(0);
});

test("computeFitness : ancrée sur la difficulté — un major résolu dans son budget n'est pas pénalisé", () => {
  // même schéma (6 tours, 2 retours) jugé comme trivial vs major
  const rs = schema({ turns_to_resolve: 6, backtracks: 2, tool_errors: 0, outcome: "resolved" });
  const asTrivial = computeFitness(rs, 80, "trivial"); // très au-dessus du budget trivial → pénalisé
  const asMajor = computeFitness(rs, 80, "major");     // dans l'enveloppe d'un major → plein effort
  expect(asMajor).toBeGreaterThan(asTrivial);
  expect(asMajor).toBeGreaterThan(0.7); // bien résolu compte tenu de la difficulté
});

test("computeFitness : un major dans son budget égale un trivial parfait (effort plein des deux côtés)", () => {
  const majorOk = computeFitness(schema({ turns_to_resolve: 8, backtracks: 3 }), 100, "major");
  const trivialOk = computeFitness(schema({ turns_to_resolve: 1, backtracks: 0 }), 100, "trivial");
  expect(majorOk).toBeCloseTo(trivialOk, 5);
  expect(majorOk).toBeCloseTo(1, 5);
});

test("computeFitness : outcome unresolved → 0", () => {
  const f = computeFitness(schema({ outcome: "unresolved" }), 100);
  expect(f).toBe(0);
});

test("computeFitness : partial = 0.6× du resolved équivalent", () => {
  const base = (o: ResolutionOutcome): number =>
    computeFitness(schema({ turns_to_resolve: 2, backtracks: 1, tool_errors: 1, outcome: o }), 80);
  expect(base("partial")).toBeCloseTo(base("resolved") * 0.6, 4);
});

test("buildChampions : champion = meilleur fitness, history montre l'amélioration", () => {
  const weak = problem({ id: "w", resolution_schema: schema({ turns_to_resolve: 5, backtracks: 2, tool_errors: 2 }) });
  const strong = problem({ id: "s", resolution_schema: schema({ turns_to_resolve: 1, backtracks: 0, tool_errors: 0 }) });
  const data = buildChampions([
    summary({ quality_score: 60, summarizedAt: 100, problems: [weak] }),
    summary({ quality_score: 90, summarizedAt: 200, problems: [strong] }),
  ]);
  expect(data.categories.length).toBe(1);
  const entry = data.categories[0]!;
  expect(entry.occurrences).toBe(2);
  expect(entry.champion?.problemId).toBe("s");
  expect(entry.contenders[0]?.problemId).toBe("s");
  expect(entry.resolvedRate).toBe(1);
  expect(entry.history.length).toBe(2);
});

test("buildChampions : 2e chronologique plus faible → history reste à 1 point", () => {
  const strong = problem({ id: "s", resolution_schema: schema({ turns_to_resolve: 1 }) });
  const weak = problem({ id: "w", resolution_schema: schema({ turns_to_resolve: 5, backtracks: 2 }) });
  const data = buildChampions([
    summary({ quality_score: 90, summarizedAt: 100, problems: [strong] }),
    summary({ quality_score: 50, summarizedAt: 200, problems: [weak] }),
  ]);
  expect(data.categories[0]!.history.length).toBe(1);
});

test("buildChampions : catégorie unresolved unique → champion null", () => {
  const p = problem({ id: "u", resolution_schema: schema({ outcome: "unresolved" }) });
  const data = buildChampions([summary({ problems: [p] })]);
  const entry = data.categories[0]!;
  expect(entry.champion).toBeNull();
  expect(entry.occurrences).toBe(1);
  expect(entry.resolvedRate).toBe(0);
});
