// Tests de robustesse du parseur de résumé (JSON bruité produit par un LLM).
import { test, expect } from "bun:test";
import { envelopeResult, extractJson, validateSummary } from "../src/consolidate/parse.ts";

test("envelopeResult déballe l'enveloppe claude --output-format json", () => {
  expect(envelopeResult('{"result":"hello","total_cost_usd":0.01}')).toBe("hello");
});

test("envelopeResult garde le brut si pas une enveloppe", () => {
  expect(envelopeResult('{"project":"x"}')).toBe('{"project":"x"}');
  expect(envelopeResult("texte nu")).toBe("texte nu");
});

test("extractJson isole le premier objet équilibré dans de la prose", () => {
  const noisy = 'Voici le résumé :\n```json\n{"a":1,"b":{"c":2}}\n```\nVoilà.';
  expect(extractJson(noisy)).toEqual({ a: 1, b: { c: 2 } });
});

test("extractJson tolère les accolades dans les chaînes", () => {
  const s = '{"topic":"fix de la fonction f() { return {} }","n":3}';
  expect(extractJson(s)).toEqual({ topic: "fix de la fonction f() { return {} }", n: 3 });
});

test("extractJson retourne null si rien d'exploitable", () => {
  expect(extractJson("pas de json ici")).toBeNull();
  expect(extractJson('{"cassé": ')).toBeNull();
});

test("validateSummary applique les défauts sûrs", () => {
  const r = validateSummary({ topic: "x" });
  expect(r).not.toBeNull();
  expect(r?.project).toBe("");
  expect(r?.quality_score).toBe(0);
  expect(r?.wins).toEqual([]);
});

test("validateSummary clamp le score et filtre les non-strings", () => {
  const r = validateSummary({
    topic: "t", quality_score: 250,
    wins: ["ok", 42, null, "  ", "bien"], links_hint: "pasunarray",
  });
  expect(r?.quality_score).toBe(100);
  expect(r?.wins).toEqual(["ok", "bien"]);
  expect(r?.links_hint).toEqual([]);
});

test("validateSummary rejette les non-objets", () => {
  expect(validateSummary(null)).toBeNull();
  expect(validateSummary("string")).toBeNull();
  expect(validateSummary(42)).toBeNull();
});

test("validateSummary v2 narrow difficulty et problems bien formés", () => {
  const r = validateSummary({
    topic: "t",
    difficulty: { level: "hard", why: "schéma complexe" },
    problems: [{
      id: "bug-1", description: "fuite mémoire", category: "perf", severity: "major",
      resolution_schema: {
        steps: ["profiler", "fix"], tools_used: ["Bash"],
        turns_to_resolve: 4, backtracks: 2, tool_errors: 1, outcome: "resolved",
      },
    }],
  });
  expect(r?.difficulty).toEqual({ level: "hard", why: "schéma complexe" });
  expect(r?.problems.length).toBe(1);
  expect(r?.problems[0]).toEqual({
    id: "bug-1", description: "fuite mémoire", category: "perf", severity: "major",
    resolution_schema: {
      steps: ["profiler", "fix"], tools_used: ["Bash"],
      turns_to_resolve: 4, backtracks: 2, tool_errors: 1, outcome: "resolved",
    },
  });
});

test("validateSummary v1 rétro-compat : difficulty/problems par défaut", () => {
  const r = validateSummary({ topic: "x" });
  expect(r?.difficulty).toEqual({ level: "medium", why: "" });
  expect(r?.problems).toEqual([]);
});

test("validateSummary applique les défauts robustes sur les problèmes", () => {
  const r = validateSummary({
    topic: "t",
    problems: [
      { description: "souci", category: "ux", severity: "bizarre", backtracks: -3 },
      { description: "  ", category: "ux", severity: "minor" },
    ],
  });
  expect(r?.problems.length).toBe(1);
  const p = r?.problems[0];
  expect(p?.id).toBe("p1");
  expect(p?.severity).toBe("minor");
  expect(p?.resolution_schema.turns_to_resolve).toBe(1);
  expect(p?.resolution_schema.backtracks).toBe(0);
  expect(p?.resolution_schema.outcome).toBe("resolved");
});

test("validateSummary difficulty level hors enum → medium", () => {
  const r = validateSummary({ topic: "t", difficulty: { level: "extreme", why: "x" } });
  expect(r?.difficulty).toEqual({ level: "medium", why: "x" });
});

test("validateSummary v3 narrow les principles bien formés", () => {
  const r = validateSummary({
    topic: "t",
    principles: [{
      id: "pr1", statement: "Maquette d'abord", domain: "design ui",
      trigger: "au début d'une UI", polarity: "positive", source: "stated", rationale: "valider le visuel",
    }],
  });
  expect(r?.principles.length).toBe(1);
  expect(r?.principles[0]).toEqual({
    id: "pr1", statement: "Maquette d'abord", domain: "design ui",
    trigger: "au début d'une UI", polarity: "positive", source: "stated", rationale: "valider le visuel",
  });
});

test("validateSummary v1/v2 rétro-compat : principles par défaut []", () => {
  const r = validateSummary({ topic: "x" });
  expect(r?.principles).toEqual([]);
});

test("validateSummary principles : défauts robustes + rejet statement/domain vides", () => {
  const r = validateSummary({
    topic: "t",
    principles: [
      { statement: "X", domain: "debug", polarity: "bizarre", source: "n'importe" },
      { statement: "  ", domain: "debug" },
      { statement: "Y", domain: "  " },
    ],
  });
  expect(r?.principles.length).toBe(1);
  const p = r?.principles[0];
  expect(p?.id).toBe("pr1");
  expect(p?.polarity).toBe("positive");
  expect(p?.source).toBe("inferred");
  expect(p?.trigger).toBe("");
});
