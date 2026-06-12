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
