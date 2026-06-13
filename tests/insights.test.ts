// Tests Couche 2 : normalisation + détection d'items récurrents + graphe.
import { test, expect } from "bun:test";
import { normalizeText, groupingKey } from "../src/consolidate/text-normalize.ts";
import { buildInsights } from "../src/consolidate/insights.ts";
import { buildGraph } from "../src/consolidate/graph.ts";
import type { SessionSummary } from "../src/consolidate/types.ts";

function summary(over: Partial<SessionSummary>): SessionSummary {
  return {
    project: "/p/a", topic: "t", wins: [], errors_claude: [], errors_chris: [],
    decisions: [], quality_score: 50, links_hint: [],
    difficulty: { level: "medium", why: "" }, problems: [],
    sessionId: Math.random().toString(36).slice(2), file: "f", fingerprint: "1:1",
    model: "sonnet", summarizedAt: 0, schemaVersion: 1, ...over,
  };
}

test("normalizeText retire accents et ponctuation", () => {
  expect(normalizeText("Échec — Créé à 80%!")).toBe("echec cree a 80");
});

test("groupingKey regroupe deux phrases proches sur la même clé", () => {
  const a = groupingKey("A oublié de lancer les tests avant le commit");
  const b = groupingKey("Oublié de lancer les tests avant de commit !");
  expect(a).toBe(b);
  expect(a.length).toBeGreaterThan(0);
});

test("buildInsights détecte une erreur récurrente (count >= 2)", () => {
  const s = [
    summary({ errors_claude: ["Oublié de lancer les tests avant le commit"] }),
    summary({ errors_claude: ["A oublié de lancer les tests avant de commit"] }),
    summary({ errors_claude: ["Truc unique sans rapport aucun"] }),
  ];
  const ins = buildInsights(s);
  expect(ins.recurringErrorsClaude.length).toBe(1);
  expect(ins.recurringErrorsClaude[0]?.count).toBe(2);
});

test("buildInsights agrège les projets et notions", () => {
  const s = [
    summary({ project: "/p/a", quality_score: 80, links_hint: ["Tauri", "React"] }),
    summary({ project: "/p/a", quality_score: 60, links_hint: ["Tauri"] }),
    summary({ project: "/p/b", quality_score: 40, links_hint: ["Python"] }),
  ];
  const ins = buildInsights(s);
  expect(ins.projects[0]?.project).toBe("/p/a");
  expect(ins.projects[0]?.sessions).toBe(2);
  expect(ins.projects[0]?.avgQuality).toBe(70);
  expect(ins.topNotions.find((n) => n.text === "tauri")?.count).toBe(2);
});

test("buildGraph relie sessions, projets et notions", () => {
  const s = [
    summary({ project: "/p/a", links_hint: ["Tauri"] }),
    summary({ project: "/p/a", links_hint: ["Tauri"] }),
  ];
  const g = buildGraph(s, buildInsights(s));
  expect(g.nodes.some((n) => n.type === "project")).toBe(true);
  expect(g.nodes.some((n) => n.type === "notion" && n.id === "notion:tauri")).toBe(true);
  expect(g.edges.some((e) => e.kind === "belongs")).toBe(true);
  expect(g.edges.some((e) => e.kind === "mentions")).toBe(true);
});
