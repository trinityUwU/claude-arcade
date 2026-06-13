// Tests Couche 2 : séries temporelles d'évolution (recurrence ↓, fitness ↑).
import { test, expect } from "bun:test";
import { buildEvolution } from "../src/consolidate/evolution.ts";
import { buildChampions } from "../src/consolidate/champions.ts";
import type {
  SessionSummary, Problem, ResolutionSchema,
} from "../src/consolidate/types.ts";

// Deux semaines ISO distinctes (lundis) = dates RÉELLES de session (startTs).
const W1 = new Date(2026, 5, 1, 12, 0, 0).getTime(); // lundi 1 juin
const W2 = new Date(2026, 5, 8, 12, 0, 0).getTime(); // lundi 8 juin
// Date de CONSOLIDATION commune (backfill) — ne doit JAMAIS piloter le bucketing.
const CONSO = new Date(2026, 11, 31, 9, 0, 0).getTime(); // 31 déc, tout consolidé le même jour

function schema(over: Partial<ResolutionSchema> = {}): ResolutionSchema {
  return {
    steps: [], tools_used: [], turns_to_resolve: 1, backtracks: 0,
    tool_errors: 0, outcome: "resolved", ...over,
  };
}

function problem(over: Partial<Problem> = {}): Problem {
  return {
    id: Math.random().toString(36).slice(2), description: "desc",
    category: "build error tsc", severity: "minor", resolution_schema: schema(), ...over,
  };
}

function summary(over: Partial<SessionSummary>): SessionSummary {
  return {
    project: "/p/a", topic: "t", wins: [], errors_claude: [], errors_chris: [],
    decisions: [], quality_score: 50, links_hint: [],
    difficulty: { level: "medium", why: "" }, problems: [], principles: [],
    sessionId: Math.random().toString(36).slice(2), file: "f", fingerprint: "1:1",
    model: "sonnet", startTs: 0, endTs: 0, notes: [], summarizedAt: CONSO, schemaVersion: 1, ...over,
  };
}

test("buildEvolution : bucketing hebdo + recurrence S1=0, S2>0", () => {
  const a = { category: "build error compile" };
  const b = { category: "network timeout fetch" };
  const summaries: SessionSummary[] = [
    summary({ startTs: W1, problems: [problem(a), problem(b)] }), // 2 catégories neuves
    summary({ startTs: W2, problems: [problem(a), problem(b)] }), // les 2 réapparaissent
  ];
  const ev = buildEvolution(summaries, buildChampions(summaries));
  expect(ev.buckets).toHaveLength(2); // 2 buckets malgré summarizedAt identique → piloté par startTs
  expect(ev.buckets[0]!.problems).toBe(2);
  expect(ev.buckets[0]!.recurrenceRate).toBe(0); // rien vu avant
  expect(ev.buckets[1]!.recurringProblems).toBe(2);
  expect(ev.buckets[1]!.recurrenceRate).toBe(1);
  expect(ev.buckets[0]!.period).toMatch(/^2026-W\d{2}$/);
});

test("buildEvolution : recurrence en baisse → recurrenceTrend improving", () => {
  // S1 : 2 problèmes distincts (tous neufs → 0 recurring).
  // S2 : 1 problème déjà vu + 4 neufs → recurrenceRate ~0.2 < S1=0... on inverse :
  // S1 voit beaucoup de récurrents internes impossibles (1ère apparition) ; on force
  // une baisse en réintroduisant 1 seule catégorie sur 5 en S2.
  const c = (n: string) => ({ category: n });
  const s1 = summary({
    startTs: W1,
    problems: [problem(c("alpha")), problem(c("alpha"))], // 2nd alpha = recurring → rate 0.5
  });
  const s2 = summary({
    startTs: W2,
    problems: [problem(c("beta")), problem(c("gamma")), problem(c("delta")), problem(c("epsilon")), problem(c("alpha"))],
  });
  const ev = buildEvolution([s1, s2], buildChampions([s1, s2]));
  expect(ev.buckets[0]!.recurrenceRate).toBeGreaterThan(ev.buckets[1]!.recurrenceRate);
  expect(ev.recurrenceTrend).toBe("improving");
});

test("buildEvolution : fitness des champions monte → fitnessTrend improving", () => {
  // S1 : schéma médiocre pour 'tsc'. S2 : schéma excellent pour la même catégorie.
  const weak = problem({ category: "build error compile", resolution_schema: schema({ turns_to_resolve: 6, backtracks: 3, tool_errors: 3 }) });
  const strong = problem({ category: "build error compile", resolution_schema: schema({ turns_to_resolve: 1, backtracks: 0, tool_errors: 0 }) });
  const summaries: SessionSummary[] = [
    summary({ startTs: W1, quality_score: 50, problems: [weak] }),
    summary({ startTs: W2, quality_score: 95, problems: [strong] }),
  ];
  const ev = buildEvolution(summaries, buildChampions(summaries));
  expect(ev.buckets[1]!.avgChampionFitness).toBeGreaterThan(ev.buckets[0]!.avgChampionFitness);
  expect(ev.fitnessTrend).toBe("improving");
});

test("buildEvolution : un seul bucket → tendances flat", () => {
  const summaries: SessionSummary[] = [
    summary({ startTs: W1, problems: [problem()] }),
    summary({ startTs: W1 + 3600_000, problems: [problem()] }),
  ];
  const ev = buildEvolution(summaries, buildChampions(summaries));
  expect(ev.buckets).toHaveLength(1);
  expect(ev.recurrenceTrend).toBe("flat");
  expect(ev.fitnessTrend).toBe("flat");
});

test("buildEvolution : sessions sans aucune date (startTs=0 + summarizedAt<=0) ignorées", () => {
  const summaries: SessionSummary[] = [
    summary({ startTs: W1, problems: [problem()] }),
    summary({ startTs: 0, summarizedAt: 0, problems: [problem()] }),
    summary({ startTs: 0, summarizedAt: -5, problems: [problem()] }),
  ];
  const ev = buildEvolution(summaries, buildChampions(summaries));
  expect(ev.buckets).toHaveLength(1);
  expect(ev.buckets[0]!.sessions).toBe(1);
});

test("buildEvolution : startTs absent → fallback sur summarizedAt (zéro-perte legacy)", () => {
  // Anciens résumés sans startTs : on ne les perd pas, summarizedAt sert de date de repli.
  const summaries: SessionSummary[] = [
    summary({ startTs: 0, summarizedAt: W1, problems: [problem()] }),
    summary({ startTs: 0, summarizedAt: W2, problems: [problem()] }),
  ];
  const ev = buildEvolution(summaries, buildChampions(summaries));
  expect(ev.buckets).toHaveLength(2);
});
